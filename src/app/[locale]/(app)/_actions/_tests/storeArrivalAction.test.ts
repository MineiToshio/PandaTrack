import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  createDeliveryMock,
  getEligibleProductsForStoreMock,
  getOrderDetailMock,
  preferencesMock,
  posthogCaptureMock,
  revalidateMock,
  runOrderCloseMoneyTransactionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  createDeliveryMock: vi.fn(),
  getEligibleProductsForStoreMock: vi.fn(),
  getOrderDetailMock: vi.fn(),
  preferencesMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  revalidateMock: vi.fn(),
  runOrderCloseMoneyTransactionMock: vi.fn(),
}));

// Cache revalidation is a Next request-scoped API; the unit under test only needs it to be
// called, and calling it for real here throws outside a request.
vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({
  revalidateCollectionSurfaces: revalidateMock,
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({ createDelivery: createDeliveryMock }));

vi.mock("@/lib/data/deliveries/deliveryQueries", () => ({
  getEligibleProductsForStore: getEligibleProductsForStoreMock,
}));

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

import { storeArrivalAction, type StoreArrivalActionInput } from "../storeArrivalAction";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const VALID_STORE_ID = "clh1234567890abcdefghijk";
const PRODUCT_A = "clh0000000000abcdefghijk";
const PRODUCT_B = "clh1111111111abcdefghijk";
const RECEIVED_DATE = new Date("2026-05-02T00:00:00.000Z");

function buildInput(overrides: Partial<StoreArrivalActionInput> = {}): StoreArrivalActionInput {
  return {
    storeId: VALID_STORE_ID,
    productIds: [PRODUCT_A, PRODUCT_B],
    receivedDate: RECEIVED_DATE,
    shippedDate: null,
    cost: 0,
    currencyCode: "USD",
    exchangeRate: null,
    settleRemainder: true,
    ...overrides,
  };
}

const ORDER_A_SNAPSHOT = {
  orderId: "clhaaaaaaaaaaabcdefghijk",
  storeId: VALID_STORE_ID,
  currencyCode: "USD",
  totalCost: 5000,
  allocatedAmountMinor: 0,
  adjustmentLineTotalMinor: 0,
  orderDate: new Date("2026-03-01T00:00:00.000Z"),
  humanReadableId: "PED-001",
};

const ORDER_B_SNAPSHOT = {
  orderId: "clhbbbbbbbbbbabcdefghijk",
  storeId: VALID_STORE_ID,
  currencyCode: "USD",
  totalCost: 3000,
  allocatedAmountMinor: 0,
  adjustmentLineTotalMinor: 0,
  orderDate: new Date("2026-03-05T00:00:00.000Z"),
  humanReadableId: "PED-002",
};

describe("storeArrivalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    preferencesMock.mockResolvedValue({ baseCurrencyCode: "USD" });
    createDeliveryMock.mockResolvedValue({
      ok: true,
      deliveryId: "delivery-1",
      productCount: 2,
      orderCount: 2,
      closedOrders: [],
    });
    runOrderCloseMoneyTransactionMock.mockResolvedValue([]);
    // Empty by default: no eligible product maps to an order, so the partial-branch lookup (BLOCKER
    // F3 wiring) finds nothing to add and every existing test below keeps its original shape. The
    // dedicated tests for that branch configure this explicitly.
    getEligibleProductsForStoreMock.mockResolvedValue({ byOrder: [] });
    getOrderDetailMock.mockResolvedValue({ currencyCode: "USD" });
  });

  it("rejects an unauthenticated caller before touching the data layer", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("writes a single already-received delivery for the whole selection", async () => {
    const result = await storeArrivalAction(buildInput());

    expect(createDeliveryMock).toHaveBeenCalledTimes(1);
    expect(createDeliveryMock).toHaveBeenCalledWith("user-1", {
      storeId: VALID_STORE_ID,
      deliveryDate: RECEIVED_DATE,
      receivedDate: RECEIVED_DATE,
      cost: 0,
      currencyCode: "USD",
      exchangeRate: null,
      productIds: [PRODUCT_A, PRODUCT_B],
    });
    expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 2, orderCount: 2, moneyOutcomes: [] });
  });

  it("returns the server's own counts, so the client never has to infer how many orders it hit", async () => {
    createDeliveryMock.mockResolvedValue({
      ok: true,
      deliveryId: "delivery-9",
      productCount: 5,
      orderCount: 3,
      closedOrders: [],
    });

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: true, deliveryId: "delivery-9", productCount: 5, orderCount: 3, moneyOutcomes: [] });
  });

  it("uses the supplied dispatch date when the collector knows it", async () => {
    const shippedDate = new Date("2026-04-20T00:00:00.000Z");

    await storeArrivalAction(buildInput({ shippedDate }));

    expect(createDeliveryMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ deliveryDate: shippedDate, receivedDate: RECEIVED_DATE }),
    );
  });

  it("refuses an invalid store id", async () => {
    const result = await storeArrivalAction(buildInput({ storeId: "not-a-cuid" }));

    expect(result).toEqual({ ok: false, error: "INVALID_STORE_ID" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses an empty selection", async () => {
    const result = await storeArrivalAction(buildInput({ productIds: [] }));

    expect(result).toEqual({ ok: false, error: "NO_PRODUCTS_SELECTED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses a future arrival date", async () => {
    const future = addUtcDays(utcMidnightToday(), 1);

    const result = await storeArrivalAction(buildInput({ receivedDate: future }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_DATE_IN_FUTURE" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses a dispatch date later than the arrival date", async () => {
    const result = await storeArrivalAction(buildInput({ shippedDate: new Date("2026-05-03T00:00:00.000Z") }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_BEFORE_SHIPPED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("requires a rate when the cost currency differs from the collector base", async () => {
    const result = await storeArrivalAction(buildInput({ currencyCode: "JPY", cost: 1500 }));

    expect(result).toEqual({ ok: false, error: "EXCHANGE_RATE_REQUIRED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  /**
   * Ownership and store scope are never re-checked here: `createDelivery` re-reads every product
   * inside its transaction, so the only correct behaviour for this action is to relay the refusal
   * untouched. A second copy of the rule up here would be the thing that drifts.
   */
  it("relays a foreign-store refusal from the data layer untouched", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE" });

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE", ineligibleProductIds: undefined });
  });

  it("relays a cancelled-order refusal from the data layer", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "ORDER_CANCELLED" });

    const result = await storeArrivalAction(buildInput());

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: "ORDER_CANCELLED" });
  });

  it("propagates the ineligible product ids so the client can flag exactly those rows", async () => {
    createDeliveryMock.mockResolvedValue({
      ok: false,
      error: "PRODUCT_NOT_ELIGIBLE",
      ineligibleProductIds: [PRODUCT_B],
    });

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({
      ok: false,
      error: "PRODUCT_NOT_ELIGIBLE",
      ineligibleProductIds: [PRODUCT_B],
    });
  });

  it("does not revalidate or report a refused write", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });

    await storeArrivalAction(buildInput());

    expect(revalidateMock).not.toHaveBeenCalled();
    expect(posthogCaptureMock).not.toHaveBeenCalled();
  });

  it("invalidates the cached collection surfaces after a successful write", async () => {
    await storeArrivalAction(buildInput());

    expect(revalidateMock).toHaveBeenCalledTimes(1);
  });

  it("captures the funnel event with the store, the counts and the backdating flag", async () => {
    await storeArrivalAction(buildInput());

    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.STORE_ARRIVAL_LOGGED,
      properties: {
        deliveryId: "delivery-1",
        store_id: VALID_STORE_ID,
        product_count: 2,
        order_count: 2,
        had_shipped_date: false,
        backdated: true,
        settled: false,
        settlement_branch: "not_settled",
        settlement_amount_minor: 0,
        settlement_date_edited: false,
      },
    });
  });

  it("reports a server error without leaking the exception", async () => {
    createDeliveryMock.mockRejectedValue(new Error("boom"));

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "server_error" });
  });

  describe("settlement on arrival (WO-08), batch", () => {
    beforeEach(() => {
      createDeliveryMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 2,
        orderCount: 2,
        closedOrders: [ORDER_A_SNAPSHOT, ORDER_B_SNAPSHOT],
      });
    });

    it("settles every order the batch closed, in the order the delivery transaction reported them", async () => {
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: ORDER_A_SNAPSHOT.orderId, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
        { orderId: ORDER_B_SNAPSHOT.orderId, status: "settled", consumedMinor: 0, settledAmountMinor: 3000 },
      ]);

      const result = await storeArrivalAction(buildInput());

      expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith({
        userId: "user-1",
        deliveryId: "delivery-1",
        closedOrders: [
          {
            orderId: ORDER_A_SNAPSHOT.orderId,
            closed: true,
            settlement: {
              enabled: true,
              deliveredItemIds: [PRODUCT_A, PRODUCT_B],
              settlementDate: RECEIVED_DATE,
              manualAmountMinor: undefined,
            },
          },
          {
            orderId: ORDER_B_SNAPSHOT.orderId,
            closed: true,
            settlement: {
              enabled: true,
              deliveredItemIds: [PRODUCT_A, PRODUCT_B],
              settlementDate: RECEIVED_DATE,
              manualAmountMinor: undefined,
            },
          },
        ],
      });
      expect(result).toMatchObject({
        ok: true,
        moneyOutcomes: [
          { orderId: ORDER_A_SNAPSHOT.orderId, currencyCode: "USD", settledAmountMinor: 5000 },
          { orderId: ORDER_B_SNAPSHOT.orderId, currencyCode: "USD", settledAmountMinor: 3000 },
        ],
      });
    });

    it("reports the summed settled amount in the funnel event", async () => {
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: ORDER_A_SNAPSHOT.orderId, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
        { orderId: ORDER_B_SNAPSHOT.orderId, status: "settled", consumedMinor: 0, settledAmountMinor: 3000 },
      ]);

      await storeArrivalAction(buildInput());

      expect(posthogCaptureMock).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ settled: true, settlement_amount_minor: 8000 }),
        }),
      );
    });

    it("never turns a money-transaction throw into ok:false, since the batch already committed", async () => {
      runOrderCloseMoneyTransactionMock.mockRejectedValue(new Error("db down"));

      const result = await storeArrivalAction(buildInput());

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.moneyOutcomes.every((outcome) => outcome.status === "pending")).toBe(true);
    });

    // BLOCKER F3 wiring, 2026-08-20 review: an order this batch affected (one of its own products
    // was in the submitted selection) but did NOT close used to get no `ClosedOrderInput` at all, so
    // a partial arrival with the box checked never even called the money transaction for it. Before
    // the fix this test fails: `runOrderCloseMoneyTransactionMock` is called with only ORDER_A's
    // closed entry, ORDER_C entirely absent.
    it("also settles an order the batch affected but did not close, closed:false, when the checkbox is checked", async () => {
      const ORDER_C_ID = "clhccccccccccabcdefghijk";
      createDeliveryMock.mockResolvedValue({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 2,
        orderCount: 2,
        // Only order A closed; order C (PRODUCT_B's real order) stayed open — a genuine partial
        // arrival for it.
        closedOrders: [ORDER_A_SNAPSHOT],
      });
      getEligibleProductsForStoreMock.mockResolvedValue({
        byOrder: [
          {
            orderId: ORDER_A_SNAPSHOT.orderId,
            orderHumanReadableId: "PED-001",
            orderDate: new Date(),
            products: [
              {
                orderItemId: PRODUCT_A,
                orderItemName: "x",
                quantity: 1,
                productTypeKey: null,
                deliveryState: "NONE",
                orderId: ORDER_A_SNAPSHOT.orderId,
                orderHumanReadableId: "PED-001",
                orderDate: new Date(),
              },
            ],
          },
          {
            orderId: ORDER_C_ID,
            orderHumanReadableId: "PED-003",
            orderDate: new Date(),
            products: [
              {
                orderItemId: PRODUCT_B,
                orderItemName: "y",
                quantity: 1,
                productTypeKey: null,
                deliveryState: "NONE",
                orderId: ORDER_C_ID,
                orderHumanReadableId: "PED-003",
                orderDate: new Date(),
              },
            ],
          },
        ],
      });
      getOrderDetailMock.mockResolvedValue({ currencyCode: "USD" });
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: ORDER_A_SNAPSHOT.orderId, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
        { orderId: ORDER_C_ID, status: "settled", consumedMinor: 0, settledAmountMinor: 700 },
      ]);

      await storeArrivalAction(buildInput());

      expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith({
        userId: "user-1",
        deliveryId: "delivery-1",
        closedOrders: [
          expect.objectContaining({ orderId: ORDER_A_SNAPSHOT.orderId, closed: true }),
          expect.objectContaining({ orderId: ORDER_C_ID, closed: false, settlement: expect.any(Object) }),
        ],
      });
    });
  });
});
