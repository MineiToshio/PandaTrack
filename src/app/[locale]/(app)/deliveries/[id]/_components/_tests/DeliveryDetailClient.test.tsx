import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  markDeliveredActionMock,
  reopenDeliveryActionMock,
  cancelDeliveryActionMock,
  retrySettlementActionMock,
  undoReopenActionMock,
  addToastMock,
  refreshMock,
  readPendingSettlementMock,
  clearPendingSettlementMock,
} = vi.hoisted(() => ({
  markDeliveredActionMock: vi.fn(),
  reopenDeliveryActionMock: vi.fn(),
  cancelDeliveryActionMock: vi.fn(),
  retrySettlementActionMock: vi.fn(),
  undoReopenActionMock: vi.fn(),
  addToastMock: vi.fn(),
  refreshMock: vi.fn(),
  readPendingSettlementMock: vi.fn(),
  clearPendingSettlementMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: refreshMock }) }));
vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}|${JSON.stringify(vars)}` : key);
    return t;
  },
}));
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: addToastMock }),
  NEUTRAL_UNDO_DURATION_MS: 5000,
}));

vi.mock("../../_actions/deliveryLifecycleActions", () => ({
  markDeliveredAction: markDeliveredActionMock,
  reopenDeliveryAction: reopenDeliveryActionMock,
  cancelDeliveryAction: cancelDeliveryActionMock,
}));

vi.mock("@/app/[locale]/(app)/_actions/settlementActions", () => ({
  retrySettlementAction: retrySettlementActionMock,
  undoReopenAction: undoReopenActionMock,
}));

vi.mock("@/lib/deliveries/pendingSettlementStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/deliveries/pendingSettlementStore")>(
    "@/lib/deliveries/pendingSettlementStore",
  );
  return {
    ...actual,
    readPendingSettlement: readPendingSettlementMock,
    writePendingSettlement: vi.fn(),
    clearPendingSettlement: clearPendingSettlementMock,
  };
});

vi.mock("../DeliveryDetailHero", () => ({ default: () => <div data-testid="hero" /> }));
vi.mock("../DeliveryProductsCard", () => ({ default: () => <div data-testid="products" /> }));
vi.mock("../DeliverySummaryCard", () => ({ default: () => <div data-testid="summary" /> }));
vi.mock("../DeliveryActionsSheet", () => ({ default: () => null }));
vi.mock("../MarkDeliveredModal", () => ({ default: () => null }));
vi.mock("../DeliveryCancelModal", () => ({ default: () => null }));
vi.mock("../DeliveryDeleteModal", () => ({ default: () => null }));
vi.mock("../DeliveryActionsCard", () => ({
  default: ({ onReopen }: { onReopen: () => void }) => (
    <button type="button" onClick={onReopen}>
      reopen
    </button>
  ),
}));
vi.mock("../DeliveryStickyActionBar", () => ({ default: () => null }));

import DeliveryDetailClient from "../DeliveryDetailClient";

const BASE_DELIVERY = {
  id: "delivery-1",
  humanReadableId: "DLV-20260501-01",
  status: "DELIVERED" as const,
  deliveryDate: new Date("2026-05-01T00:00:00.000Z"),
  expectedArrivalFrom: null,
  expectedArrivalTo: null,
  receivedDate: new Date("2026-05-02T00:00:00.000Z"),
  cost: 0,
  currencyCode: "USD",
  exchangeRate: null,
  needsExchangeRateUpdate: false,
  note: null,
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
  store: { id: "store-1", name: "AmiAmi", slug: "amiami", logoUrl: null },
  productCount: 2,
  sourceOrders: [],
};

function renderClient() {
  render(
    <DeliveryDetailClient
      delivery={BASE_DELIVERY as never}
      baseCurrencyCode="USD"
      locale="en"
      today={new Date("2026-05-03T00:00:00.000Z")}
      noteCard={<div data-testid="note" />}
    />,
  );
}

describe("DeliveryDetailClient reopen (WO-08 two-amount copy + Retry affordance)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readPendingSettlementMock.mockReturnValue(null);
  });

  it("shows the plain reopened toast when the reopen produced no settlement", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    expect(addToastMock).toHaveBeenCalledWith("detail.toast.reopened", expect.objectContaining({ variant: "neutral" }));
  });

  it("names the reverted settlement amount when the reopen deleted one", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 5000,
        payments: [{ id: "payment-1", amount: 5000, currencyCode: "USD" }],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringContaining("detail.toast.reopenedWithSettlement"),
      expect.objectContaining({ variant: "neutral" }),
    );
  });

  // BLOCKER F1, 2026-08-20 review: the OLD code fired `undoReopenSettlementAction` (fire-and-forget)
  // and `markDeliveredAction` from two independent, concurrent promise chains. `undoReopenAction`
  // collapses both into ONE Server Action, so the undo handler must call exactly one action, never
  // `markDeliveredAction` (or `cancelDeliveryAction`) directly. Before the fix this test fails:
  // `markDeliveredActionMock` and `undoReopenSettlementActionMock` were both called, from a mocked
  // module that no longer even exports the latter under the new name.
  it("undo calls exactly one action (undoReopenAction), never the old two-dispatch shape", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 5000,
        payments: [
          {
            id: "payment-1",
            storeId: "store-1",
            userId: "user-1",
            amount: 5000,
            paymentDate: new Date("2026-05-02T00:00:00.000Z"),
            currencyCode: "USD",
            exchangeRate: null,
            exchangeRateBaseCode: null,
            note: null,
            migratedFromOrderId: null,
            settledByDeliveryId: "delivery-1",
            createdAt: new Date(),
            updatedAt: new Date(),
            allocations: [{ orderId: "order-1", orderItemId: null, amountMinor: 5000 }],
          },
        ],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });
    undoReopenActionMock.mockResolvedValue({ ok: true });

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    const undoCall = addToastMock.mock.calls.find(([, options]) => options?.action);
    expect(undoCall).toBeDefined();
    undoCall![1].action.onClick();

    expect(undoReopenActionMock).toHaveBeenCalledTimes(1);
    expect(undoReopenActionMock).toHaveBeenCalledWith({
      deliveryId: "delivery-1",
      previousStatus: "DELIVERED",
      receivedDate: BASE_DELIVERY.receivedDate,
      snapshot: [expect.objectContaining({ storeId: "store-1", amount: 5000 })],
    });
    expect(markDeliveredActionMock).not.toHaveBeenCalled();
    expect(cancelDeliveryActionMock).not.toHaveBeenCalled();
  });

  it("a NOT_FOUND restore shows a refusal toast and does not re-mark delivered", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 5000,
        payments: [
          {
            id: "payment-1",
            storeId: "store-1",
            userId: "user-1",
            amount: 5000,
            paymentDate: new Date("2026-05-02T00:00:00.000Z"),
            currencyCode: "USD",
            exchangeRate: null,
            exchangeRateBaseCode: null,
            note: null,
            migratedFromOrderId: null,
            settledByDeliveryId: "delivery-1",
            createdAt: new Date(),
            updatedAt: new Date(),
            allocations: [{ orderId: "order-1", orderItemId: null, amountMinor: 5000 }],
          },
        ],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });
    // The Server Action itself handles the sequential restore-then-remark ordering (unit-tested in
    // `settlementActions.test.ts`); this component test only needs to see a `NOT_FOUND` refusal
    // propagate to a toast and never trigger a client-side lifecycle action of its own.
    undoReopenActionMock.mockResolvedValue({ ok: false, error: "NOT_FOUND" });

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    const undoCall = addToastMock.mock.calls.find(([, options]) => options?.action);
    expect(undoCall).toBeDefined();
    addToastMock.mockClear();
    undoCall![1].action.onClick();

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ variant: "error" })),
    );
    expect(markDeliveredActionMock).not.toHaveBeenCalled();
    expect(cancelDeliveryActionMock).not.toHaveBeenCalled();
  });

  // MAJOR F8, 2026-08-20 review: reopening a delivery invalidates any pending money-transaction
  // retry for it — there is nothing left for `Retry` to re-attempt against once the close it
  // belonged to is undone. Before the fix this test fails: the reopen handler never called
  // `clearPendingSettlement` at all.
  it("clears the pendingSettlementStore entry on a successful reopen", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    expect(clearPendingSettlementMock).toHaveBeenCalledWith("delivery-1");
  });

  it("shows the pending-settlement Retry banner when a pending entry exists for this delivery", () => {
    readPendingSettlementMock.mockReturnValue({
      deliveryId: "delivery-1",
      settleRemainder: false,
      settlementDate: "2026-05-02",
      settlementIntents: [],
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    renderClient();

    expect(screen.getByText("detail.settlement.pendingNotice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "detail.settlement.retry" })).toBeInTheDocument();
  });

  it("does not show the Retry banner when nothing is pending", () => {
    readPendingSettlementMock.mockReturnValue(null);

    renderClient();

    expect(screen.queryByText("detail.settlement.pendingNotice")).not.toBeInTheDocument();
  });

  // MAJOR, 2026-08-21 review: `retrySettlementAction`'s `.then` had no rejection handler, so a
  // rejected promise left `isRetrying` (and the disabled button) stuck forever. Before this fix the
  // button never re-enables and no error toast fires.
  it("clears isRetrying and shows an error toast instead of hanging when the retry rejects", async () => {
    readPendingSettlementMock.mockReturnValue({
      deliveryId: "delivery-1",
      settleRemainder: false,
      settlementDate: "2026-05-02",
      settlementIntents: [],
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    retrySettlementActionMock.mockRejectedValue(new Error("boom"));

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "detail.settlement.retry" }));

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        "detail.toast.retrySettlementError",
        expect.objectContaining({ variant: "error" }),
      ),
    );
    expect(screen.getByRole("button", { name: "detail.settlement.retry" })).not.toBeDisabled();
  });

  // MAJOR, 2026-08-21 review: `undoReopenAction`'s `.then` had no rejection handler, so a rejected
  // promise left the reopen's optimistic snapshot applied with no toast and no rollback.
  it("rolls back the undo's optimistic patch and shows an error toast when undoReopenAction rejects", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });
    undoReopenActionMock.mockRejectedValue(new Error("boom"));

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    const undoCall = addToastMock.mock.calls.find(([, options]) => options?.action);
    expect(undoCall).toBeDefined();
    addToastMock.mockClear();
    undoCall![1].action.onClick();

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        "detail.toast.undoError",
        expect.objectContaining({ variant: "error" }),
      ),
    );
  });

  /**
   * The reopen-toast gap closure (WO-08 UX Notes "known gap"): when the delivery's close ran BOTH
   * the settlement write (reverted here) AND the unconditional FR-08-46 consumption (surviving
   * here, provenance from `consumedByDeliveryId`), the toast must name both amounts in one message,
   * never only the settlement half.
   */
  it("names both amounts when the reopen both reverted a settlement and left a surviving consumption", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 5000,
        payments: [{ id: "payment-1", amount: 5000, currencyCode: "USD" }],
        survivingConsumedMinor: 1200,
        survivingConsumedAllocations: [{ amountMinor: 1200, currencyCode: "USD" }],
      },
    });

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^detail\.toast\.reopenedWithSettlementAndConsumption\|.*"settlementAmount".*"consumedAmount"/,
      ),
      expect.objectContaining({ variant: "neutral" }),
    );
  });

  /**
   * Consumption-only case (checkbox left unchecked on close, `WO-08` reopen truth table): no
   * settlement `StorePayment` ever existed for this delivery to delete, so `totalAmountMinor` is 0,
   * but the close-time consumption still applied unassigned money to the order and that survives
   * the reopen. The toast must name that surviving figure, not fall back to the plain "reopened"
   * copy that would otherwise silently drop it.
   */
  it("names only the surviving consumed amount when the close only ran consumption (no settlement)", async () => {
    reopenDeliveryActionMock.mockResolvedValue({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 1200,
        survivingConsumedAllocations: [{ amountMinor: 1200, currencyCode: "USD" }],
      },
    });

    renderClient();
    await userEvent.click(screen.getByRole("button", { name: "reopen" }));

    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringMatching(/^detail\.toast\.reopenedWithSurvivingConsumption\|.*"amount"/),
      expect.objectContaining({ variant: "neutral" }),
    );
  });
});
