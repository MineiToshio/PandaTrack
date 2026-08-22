import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  quickArrivalActionMock,
  retrySettlementActionMock,
  addToastMock,
  refreshMock,
  writePendingSettlementMock,
  clearPendingSettlementMock,
} = vi.hoisted(() => ({
  quickArrivalActionMock: vi.fn(),
  retrySettlementActionMock: vi.fn(),
  addToastMock: vi.fn(),
  refreshMock: vi.fn(),
  writePendingSettlementMock: vi.fn(),
  clearPendingSettlementMock: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: refreshMock }) }));
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ addToast: addToastMock }) }));

// `orders.detail.storePayment.error.*` carries a real key per `CreateStorePaymentError`; only
// `AMOUNT_INVALID` is registered here so the fallback-to-`server_error` branch stays exercisable.
const STORE_PAYMENT_ERROR_KEYS = new Set(["error.AMOUNT_INVALID", "error.server_error"]);

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${namespace}.${key}|${JSON.stringify(values)}` : `${namespace}.${key}`;
    t.has = (key: string) => (namespace === "orders.detail.storePayment" ? STORE_PAYMENT_ERROR_KEYS.has(key) : true);
    return t;
  },
}));

vi.mock("@/app/[locale]/(app)/_actions/quickArrivalAction", () => ({
  quickArrivalAction: quickArrivalActionMock,
}));
vi.mock("@/app/[locale]/(app)/_actions/settlementActions", () => ({
  retrySettlementAction: retrySettlementActionMock,
}));
vi.mock("@/lib/deliveries/pendingSettlementStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/deliveries/pendingSettlementStore")>(
    "@/lib/deliveries/pendingSettlementStore",
  );
  return {
    ...actual,
    writePendingSettlement: writePendingSettlementMock,
    clearPendingSettlement: clearPendingSettlementMock,
  };
});

import { useQuickArrival, type QuickArrivalSubmitInput } from "../useQuickArrival";

function buildSubmitInput(overrides: Partial<QuickArrivalSubmitInput> = {}): QuickArrivalSubmitInput {
  return {
    productIds: ["item-1"],
    receivedDate: new Date("2026-06-12T00:00:00.000Z"),
    shippedDate: null,
    cost: 0,
    currencyCode: "USD",
    exchangeRate: null,
    settleRemainder: true,
    ...overrides,
  };
}

describe("useQuickArrival", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // MAJOR F5, 2026-08-20 review: `settlementDate` (falling back to `receivedDate`) is already a
  // UTC-midnight domain date by the time it reaches this hook (`QuickArrivalModal` normalizes it
  // with `toDomainDate` before calling `onSubmit`). Serializing it with the OLD `toLocalIsoDateString`
  // (local getters) shifts the calendar day backward for any collector whose ambient timezone sits
  // west of UTC — `America/Lima` (UTC-5) reproduces it. Run under that zone so this test actually
  // exercises the regression rather than reading back the right answer by accident.
  describe("under TZ=America/Lima", () => {
    const originalTz = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "America/Lima";
    });
    afterAll(() => {
      process.env.TZ = originalTz;
    });

    it("persists the pending entry's settlementDate on the SAME civil day as the UTC-midnight input", async () => {
      quickArrivalActionMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 1,
        moneyOutcomes: [
          { orderId: "order-1", currencyCode: "USD", status: "pending", consumedMinor: null, settledAmountMinor: null },
        ],
      });
      const { result } = renderHook(() =>
        useQuickArrival({ orderId: "order-1", locale: "en", source: "actions_card" }),
      );

      act(() => result.current.submit(buildSubmitInput()));
      await waitFor(() => expect(writePendingSettlementMock).toHaveBeenCalled());

      expect(writePendingSettlementMock).toHaveBeenCalledWith(
        expect.objectContaining({ settlementDate: "2026-06-12" }),
      );
    });
  });

  // MAJOR F7, 2026-08-20 review: a "refused" money outcome is a genuine business refusal (a stale
  // allocation, an amount no longer fitting the balance), never transient. Before the fix, "refused"
  // was lumped together with "pending" and always produced the persisted Retry banner — retrying a
  // refusal verbatim only refuses again. This asserts the split: refused clears/skips the pending
  // entry and shows a dismissable notice: pending still gets the Retry banner.
  describe("refused vs pending outcomes (F7)", () => {
    it("shows a dismissable refusal for a 'refused' outcome, and never persists a pending entry", async () => {
      quickArrivalActionMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 1,
        moneyOutcomes: [
          {
            orderId: "order-1",
            currencyCode: "USD",
            status: "refused",
            consumedMinor: 0,
            settledAmountMinor: null,
            error: "AMOUNT_INVALID",
          },
        ],
      });
      const { result } = renderHook(() =>
        useQuickArrival({ orderId: "order-1", locale: "en", source: "actions_card" }),
      );

      act(() => result.current.submit(buildSubmitInput()));
      await waitFor(() => expect(addToastMock).toHaveBeenCalled());

      expect(writePendingSettlementMock).not.toHaveBeenCalled();
      expect(addToastMock).toHaveBeenCalledWith(
        "orders.detail.storePayment.error.AMOUNT_INVALID",
        expect.objectContaining({ variant: "error" }),
      );
      // No retry action attached: this is a dismissable notice, not the persisted Retry banner.
      const [, options] = addToastMock.mock.calls[0];
      expect(options.action).toBeUndefined();
    });

    it("falls back to the generic store-payment error copy for an unregistered error code", async () => {
      quickArrivalActionMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 1,
        moneyOutcomes: [
          {
            orderId: "order-1",
            currencyCode: "USD",
            status: "refused",
            consumedMinor: 0,
            settledAmountMinor: null,
            error: "SOME_UNMAPPED_CODE",
          },
        ],
      });
      const { result } = renderHook(() =>
        useQuickArrival({ orderId: "order-1", locale: "en", source: "actions_card" }),
      );

      act(() => result.current.submit(buildSubmitInput()));
      await waitFor(() => expect(addToastMock).toHaveBeenCalled());

      expect(addToastMock).toHaveBeenCalledWith(
        "orders.detail.storePayment.error.server_error",
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("still offers the persisted Retry banner for a 'pending' (transient) outcome", async () => {
      quickArrivalActionMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 1,
        moneyOutcomes: [
          { orderId: "order-1", currencyCode: "USD", status: "pending", consumedMinor: null, settledAmountMinor: null },
        ],
      });
      const { result } = renderHook(() =>
        useQuickArrival({ orderId: "order-1", locale: "en", source: "actions_card" }),
      );

      act(() => result.current.submit(buildSubmitInput()));
      await waitFor(() => expect(writePendingSettlementMock).toHaveBeenCalled());

      const successCall = addToastMock.mock.calls.find(([, options]) => options?.action);
      expect(successCall).toBeDefined();
    });

    // MAJOR, 2026-08-21 review: `retrySettlementAction`'s `.then` had no rejection handler here
    // either, so a rejected promise silently did nothing at all: no toast, and the pending entry was
    // never cleared or re-offered.
    it("shows an error toast instead of doing nothing when the Retry action's call rejects", async () => {
      quickArrivalActionMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 1,
        moneyOutcomes: [
          { orderId: "order-1", currencyCode: "USD", status: "pending", consumedMinor: null, settledAmountMinor: null },
        ],
      });
      retrySettlementActionMock.mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() =>
        useQuickArrival({ orderId: "order-1", locale: "en", source: "actions_card" }),
      );

      act(() => result.current.submit(buildSubmitInput()));
      await waitFor(() => expect(writePendingSettlementMock).toHaveBeenCalled());

      const successCall = addToastMock.mock.calls.find(([, options]) => options?.action);
      expect(successCall).toBeDefined();
      addToastMock.mockClear();
      act(() => successCall![1].action.onClick());

      await waitFor(() =>
        expect(addToastMock).toHaveBeenCalledWith(
          "orders.detail.quickArrival.error.server_error",
          expect.objectContaining({ variant: "error" }),
        ),
      );
    });
  });
});
