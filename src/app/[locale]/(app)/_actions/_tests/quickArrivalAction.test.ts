import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  createDeliveryMock,
  getDeliverySourceOrderMock,
  getOrderDetailMock,
  preferencesMock,
  posthogCaptureMock,
  runOrderCloseMoneyTransactionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  createDeliveryMock: vi.fn(),
  getDeliverySourceOrderMock: vi.fn(),
  getOrderDetailMock: vi.fn(),
  preferencesMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  runOrderCloseMoneyTransactionMock: vi.fn(),
}));

// Cache revalidation is a Next request-scoped API; the unit under test only needs it to be
// called, and calling it for real here throws outside a request.
vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({
  revalidateCollectionSurfaces: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({ createDelivery: createDeliveryMock }));

vi.mock("@/lib/data/deliveries/deliveryQueries", () => ({ getDeliverySourceOrder: getDeliverySourceOrderMock }));

vi.mock("@/lib/data/orders/orderQueries", () => ({ getOrderDetail: getOrderDetailMock }));

vi.mock("@/lib/data/orders/storePaymentMutations", () => ({
  runOrderCloseMoneyTransaction: runOrderCloseMoneyTransactionMock,
}));

vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: preferencesMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
  captureException: vi.fn(),
}));

import { quickArrivalAction, type QuickArrivalActionInput } from "../quickArrivalAction";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const VALID_ORDER_ID = "clh1234567890abcdefghijk";
const VALID_PRODUCT_ID = "clh0000000000abcdefghijk";
const RECEIVED_DATE = new Date("2026-05-02T00:00:00.000Z");

function buildInput(overrides: Partial<QuickArrivalActionInput> = {}): QuickArrivalActionInput {
  return {
    orderId: VALID_ORDER_ID,
    productIds: [VALID_PRODUCT_ID],
    receivedDate: RECEIVED_DATE,
    shippedDate: null,
    cost: 0,
    currencyCode: "USD",
    exchangeRate: null,
    settleRemainder: true,
    ...overrides,
  };
}

const CLOSED_ORDER_SNAPSHOT = {
  orderId: VALID_ORDER_ID,
  storeId: "store-1",
  currencyCode: "USD",
  totalCost: 5000,
  allocatedAmountMinor: 0,
  adjustmentLineTotalMinor: 0,
  orderDate: new Date("2026-04-01T00:00:00.000Z"),
  humanReadableId: "PED-001",
};

describe("quickArrivalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getDeliverySourceOrderMock.mockResolvedValue({
      orderId: VALID_ORDER_ID,
      orderHumanReadableId: "PED-001",
      storeId: "store-1",
      storeName: "AmiAmi",
      status: "OPEN",
    });
    preferencesMock.mockResolvedValue({ baseCurrencyCode: "USD" });
    createDeliveryMock.mockResolvedValue({
      ok: true,
      deliveryId: "delivery-1",
      productCount: 1,
      orderCount: 1,
      closedOrders: [],
    });
    runOrderCloseMoneyTransactionMock.mockResolvedValue([]);
    // Default createDelivery leaves the order open (`closedOrders: []`), and `settleRemainder`
    // defaults to `true` (BLOCKER F3 wiring): most tests below hit the new partial-branch lookup,
    // so it needs a harmless default resolution to avoid an unrelated real-Prisma call.
    getOrderDetailMock.mockResolvedValue({ currencyCode: "USD" });
  });

  it("rejects an unauthenticated caller before touching the data layer", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(getDeliverySourceOrderMock).not.toHaveBeenCalled();
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("creates a delivery already received, with the store resolved from the owned order", async () => {
    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 1, moneyOutcomes: [] });
    expect(createDeliveryMock).toHaveBeenCalledWith("user-1", {
      storeId: "store-1",
      deliveryDate: RECEIVED_DATE,
      receivedDate: RECEIVED_DATE,
      cost: 0,
      currencyCode: "USD",
      exchangeRate: null,
      productIds: [VALID_PRODUCT_ID],
    });
  });

  it("never calls the money transaction when no order closed and the checkbox is unchecked", async () => {
    await quickArrivalAction(buildInput({ settleRemainder: false }));

    expect(runOrderCloseMoneyTransactionMock).not.toHaveBeenCalled();
  });

  // BLOCKER F3 wiring, 2026-08-20 review: an order that stays open (this arrival delivered only
  // some of its own items) used to get no `ClosedOrderInput` at all when the checkbox was checked,
  // so the money transaction was never even called. Before the fix this test fails:
  // `runOrderCloseMoneyTransactionMock` is never invoked.
  it("still calls the money transaction for the partial (still-open) branch when the checkbox is checked", async () => {
    await quickArrivalAction(buildInput({ settleRemainder: true }));

    expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        expect.objectContaining({ orderId: VALID_ORDER_ID, closed: false, settlement: expect.any(Object) }),
      ],
    });
  });

  it("uses the supplied dispatch date when the collector knows it", async () => {
    const shippedDate = new Date("2026-04-20T00:00:00.000Z");

    await quickArrivalAction(buildInput({ shippedDate }));

    expect(createDeliveryMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ deliveryDate: shippedDate, receivedDate: RECEIVED_DATE }),
    );
  });

  it("refuses a dispatch date later than the arrival date", async () => {
    const result = await quickArrivalAction(buildInput({ shippedDate: new Date("2026-05-03T00:00:00.000Z") }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_BEFORE_SHIPPED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses a future arrival date", async () => {
    const future = addUtcDays(utcMidnightToday(), 1);

    const result = await quickArrivalAction(buildInput({ receivedDate: future }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_DATE_IN_FUTURE" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses an order that is not the caller's", async () => {
    getDeliverySourceOrderMock.mockResolvedValue(null);

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_FOUND" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  /**
   * The cancelled-order refusal moved into `createDelivery`, so every entry point into a delivery
   * inherits it (the create wizard's product picker never filtered cancelled orders either). This
   * action must therefore relay it rather than pre-empt it: a second copy up here would be the
   * thing that drifts once the two paths change independently.
   */
  it("relays the cancelled-order refusal now owned by the data layer", async () => {
    getDeliverySourceOrderMock.mockResolvedValue({
      orderId: VALID_ORDER_ID,
      orderHumanReadableId: "PED-001",
      storeId: "store-1",
      storeName: "AmiAmi",
      status: "CANCELLED",
    });
    createDeliveryMock.mockResolvedValue({ ok: false, error: "ORDER_CANCELLED" });

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "ORDER_CANCELLED" });
    // The refusal is decided inside the transaction, against the products' real orders.
    expect(createDeliveryMock).toHaveBeenCalledTimes(1);
    expect(runOrderCloseMoneyTransactionMock).not.toHaveBeenCalled();
  });

  it("requires a rate when the cost currency differs from the collector base", async () => {
    const result = await quickArrivalAction(buildInput({ currencyCode: "JPY", cost: 1500 }));

    expect(result).toEqual({ ok: false, error: "EXCHANGE_RATE_REQUIRED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("accepts a foreign currency when the collector has no base currency set", async () => {
    preferencesMock.mockResolvedValue({ baseCurrencyCode: null });

    const result = await quickArrivalAction(buildInput({ currencyCode: "JPY", cost: 1500 }));

    expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 1, moneyOutcomes: [] });
  });

  it("surfaces a data-layer refusal unchanged", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });
  });

  it("captures the funnel event with the backdating flag", async () => {
    await quickArrivalAction(buildInput());

    expect(posthogCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-1",
        event: POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_LOGGED,
        properties: expect.objectContaining({ deliveryId: "delivery-1", product_count: 1, backdated: true }),
      }),
    );
  });

  it("reports a server error without leaking the exception", async () => {
    createDeliveryMock.mockRejectedValue(new Error("boom"));

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "server_error" });
  });

  describe("settlement on arrival (WO-08)", () => {
    beforeEach(() => {
      createDeliveryMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 1,
        orderCount: 1,
        closedOrders: [CLOSED_ORDER_SNAPSHOT],
      });
    });

    it("calls the money transaction only AFTER the delivery transaction resolved ok, for every closed order", async () => {
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: VALID_ORDER_ID, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
      ]);

      const result = await quickArrivalAction(buildInput());

      expect(createDeliveryMock).toHaveBeenCalledTimes(1);
      expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledTimes(1);
      expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith({
        userId: "user-1",
        deliveryId: "delivery-1",
        closedOrders: [
          {
            orderId: VALID_ORDER_ID,
            closed: true,
            settlement: {
              enabled: true,
              deliveredItemIds: [VALID_PRODUCT_ID],
              settlementDate: RECEIVED_DATE,
              manualAmountMinor: undefined,
            },
          },
        ],
      });
      expect(result).toEqual({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 1,
        moneyOutcomes: [
          {
            orderId: VALID_ORDER_ID,
            currencyCode: "USD",
            status: "settled",
            consumedMinor: 0,
            settledAmountMinor: 5000,
          },
        ],
      });
    });

    it("skips the settlement half but still runs the money transaction when the checkbox is unchecked", async () => {
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: VALID_ORDER_ID, status: "settled", consumedMinor: 300, settledAmountMinor: null },
      ]);

      await quickArrivalAction(buildInput({ settleRemainder: false }));

      expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          closedOrders: [{ orderId: VALID_ORDER_ID, closed: true, settlement: undefined }],
        }),
      );
    });

    it("never lets the delivery already committed be reported as a failure when the money transaction throws", async () => {
      runOrderCloseMoneyTransactionMock.mockRejectedValue(new Error("db down"));

      const result = await quickArrivalAction(buildInput());

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.deliveryId).toBe("delivery-1");
      expect(result.moneyOutcomes).toEqual([
        {
          orderId: VALID_ORDER_ID,
          currencyCode: "USD",
          status: "pending",
          consumedMinor: null,
          settledAmountMinor: null,
        },
      ]);
    });

    it("passes the manual amount only for the order it belongs to", async () => {
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: VALID_ORDER_ID, status: "settled", consumedMinor: 0, settledAmountMinor: 1200 },
      ]);

      await quickArrivalAction(
        buildInput({
          settlementIntents: [{ orderId: VALID_ORDER_ID, manualAmountMinor: 1200, branchHint: "manual" }],
        }),
      );

      expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          closedOrders: [
            expect.objectContaining({
              settlement: expect.objectContaining({ manualAmountMinor: 1200 }),
            }),
          ],
        }),
      );
    });

    it("defaults the settlement date to the received date and reports settlement_date_edited", async () => {
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: VALID_ORDER_ID, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
      ]);

      await quickArrivalAction(buildInput());

      expect(posthogCaptureMock).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            settled: true,
            settlement_branch: "full",
            settlement_amount_minor: 5000,
            settlement_date_edited: false,
          }),
        }),
      );
    });

    it("reports settlement_date_edited when the collector moved the settlement date away from the arrival date", async () => {
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: VALID_ORDER_ID, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
      ]);
      const settlementDate = new Date("2026-05-01T00:00:00.000Z");

      await quickArrivalAction(buildInput({ settlementDate }));

      expect(posthogCaptureMock).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ settlement_date_edited: true }),
        }),
      );
    });
  });
});
