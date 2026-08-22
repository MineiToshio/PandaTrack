import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getOrderDetailMock,
  getStoreDebtByCurrencyMock,
  getOpenBalanceMinorByOrderIdsMock,
  getDeliveryDetailMock,
  runOrderCloseMoneyTransactionMock,
  restoreSettlementPaymentsMock,
  markDeliveryDeliveredMock,
  cancelDeliveryMock,
  posthogCaptureMock,
  revalidateMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getOrderDetailMock: vi.fn(),
  getStoreDebtByCurrencyMock: vi.fn(),
  getOpenBalanceMinorByOrderIdsMock: vi.fn(),
  getDeliveryDetailMock: vi.fn(),
  runOrderCloseMoneyTransactionMock: vi.fn(),
  restoreSettlementPaymentsMock: vi.fn(),
  markDeliveryDeliveredMock: vi.fn(),
  cancelDeliveryMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({ revalidateCollectionSurfaces: revalidateMock }));
vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/orders/orderQueries", () => ({ getOrderDetail: getOrderDetailMock }));
vi.mock("@/lib/data/orders/storePaymentQueries", () => ({
  getStoreDebtByCurrency: getStoreDebtByCurrencyMock,
  getOpenBalanceMinorByOrderIds: getOpenBalanceMinorByOrderIdsMock,
}));
vi.mock("@/lib/data/deliveries/deliveryQueries", () => ({ getDeliveryDetail: getDeliveryDetailMock }));
vi.mock("@/lib/data/orders/storePaymentMutations", () => ({
  runOrderCloseMoneyTransaction: runOrderCloseMoneyTransactionMock,
  restoreSettlementPayments: restoreSettlementPaymentsMock,
}));
vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({
  markDeliveryDelivered: markDeliveryDeliveredMock,
  cancelDelivery: cancelDeliveryMock,
}));
vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));
vi.mock("@sentry/nextjs", () => ({
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
  captureException: vi.fn(),
}));

import { getSettlementContextAction, retrySettlementAction, undoReopenAction } from "../settlementActions";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const ORDER_ID = "clh1234567890abcdefghijk";
const ITEM_ID = "clh0000000000abcdefghijk";
const ITEM_ID_2 = "clh1111111111abcdefghijk";
const DELIVERY_ID = "clh2222222222abcdefghijk";

function orderDetailFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    storeId: "store-1",
    currencyCode: "USD",
    status: "OPEN",
    totalCost: 5000,
    remainingAmount: 5000,
    undetailedPaidMinor: 0,
    items: [{ id: ITEM_ID, unitPrice: 5000, quantity: 1, allocatedMinor: 0, deliveryState: "open" }],
    ...overrides,
  };
}

describe("getSettlementContextAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getStoreDebtByCurrencyMock.mockResolvedValue([]);
    // Empty by default: the code falls back to `order.remainingAmount` (gross) whenever the net map
    // has no entry, so every existing test below (none of which is about the net-vs-gross gap
    // itself) keeps exercising the same gross figure it always has. The one test that cares sets
    // this explicitly.
    getOpenBalanceMinorByOrderIdsMock.mockResolvedValue(new Map());
  });

  it("rejects an unauthenticated caller", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(getOrderDetailMock).not.toHaveBeenCalled();
  });

  it("reports nothingToSettle when the order's balance is already zero", async () => {
    getOrderDetailMock.mockResolvedValue(orderDetailFixture({ remainingAmount: 0 }));

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({ plan: { kind: "nothingToSettle" }, defaultChecked: false });
  });

  // MAJOR D1, 2026-08-20 review: a store reconciliation write-off (`StoreAccountAdjustmentLine`)
  // lowers the order's NET balance without ever touching `allocatedAmountMinor`, so the old gross
  // read (`order.remainingAmount`) kept showing 180 owed and a checked-by-default settlement box for
  // an order the collector had already written off entirely. Before the fix this test fails: the
  // context reports `plan.kind: "computedFull"` off the stale gross 180 instead.
  it("reports nothingToSettle when the order's NET balance is zero even though the gross balance is not (a written-off order)", async () => {
    getOrderDetailMock.mockResolvedValue(orderDetailFixture({ remainingAmount: 180 }));
    getOpenBalanceMinorByOrderIdsMock.mockResolvedValue(new Map([[ORDER_ID, 0]]));

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({ plan: { kind: "nothingToSettle" }, defaultChecked: false });
  });

  it("full-order branch: amount is the order's own balance when every item closes", async () => {
    getOrderDetailMock.mockResolvedValue(orderDetailFixture());

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({
      closesOrder: true,
      plan: { kind: "computedFull", amountMinor: 5000, appliedUnassignedMinor: 0 },
      defaultChecked: true,
    });
  });

  it("full-order branch: pre-marks (informative) even with unassigned money, and nets it out of the shown amount", async () => {
    getOrderDetailMock.mockResolvedValue(orderDetailFixture());
    getStoreDebtByCurrencyMock.mockResolvedValue([{ currencyCode: "USD", unassignedMinor: 2000 }]);

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({
      closesOrder: true,
      unassignedMinor: 2000,
      plan: { kind: "computedFull", amountMinor: 3000, appliedUnassignedMinor: 2000 },
      defaultChecked: true,
    });
  });

  it("partial branch: double-counting guard defaults unchecked when the arrival does not close the order and unassigned money exists", async () => {
    getOrderDetailMock.mockResolvedValue(
      orderDetailFixture({
        items: [
          { id: ITEM_ID, unitPrice: 2000, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
          { id: ITEM_ID_2, unitPrice: 3000, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
        ],
      }),
    );
    getStoreDebtByCurrencyMock.mockResolvedValue([{ currencyCode: "USD", unassignedMinor: 500 }]);

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({
      closesOrder: false,
      unassignedMinor: 500,
      plan: { kind: "computedPartial", amountMinor: 2000, undetailed: false },
      defaultChecked: false,
    });
  });

  it("partial branch: manual, missing price named as the reason", async () => {
    getOrderDetailMock.mockResolvedValue(
      orderDetailFixture({
        items: [
          { id: ITEM_ID, unitPrice: null, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
          { id: ITEM_ID_2, unitPrice: 3000, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
        ],
      }),
    );

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({
      plan: { kind: "manual", reasonCode: "missingPrice", referenceAmountMinor: 5000 },
    });
  });

  it("partial branch: manual, undetailed money named as the reason", async () => {
    getOrderDetailMock.mockResolvedValue(
      orderDetailFixture({
        undetailedPaidMinor: 400,
        items: [
          { id: ITEM_ID, unitPrice: 2000, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
          { id: ITEM_ID_2, unitPrice: 3000, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
        ],
      }),
    );

    const result = await getSettlementContextAction({ orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID] }] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({
      plan: { kind: "manual", reasonCode: "undetailedMoney", referenceAmountMinor: 5000 },
    });
  });

  it("partial branch: caps the naive per-item sum at the order's own balance and marks it undetailed", async () => {
    // A fourth, NOT-yet-delivered item keeps this a genuine partial arrival (closesOrder: false);
    // the remaining balance (200) is smaller than the naive per-item sum of the two delivered items
    // (100 + 100 = 200)... so make the balance smaller than that sum to force the cap.
    getOrderDetailMock.mockResolvedValue(
      orderDetailFixture({
        remainingAmount: 150,
        items: [
          { id: ITEM_ID, unitPrice: 100, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
          { id: ITEM_ID_2, unitPrice: 100, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
          { id: "clh3333333333abcdefghijk", unitPrice: 100, quantity: 1, allocatedMinor: 0, deliveryState: "open" },
        ],
      }),
    );

    const result = await getSettlementContextAction({
      orders: [{ orderId: ORDER_ID, deliveredItemIds: [ITEM_ID, ITEM_ID_2] }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.contexts[0]).toMatchObject({ plan: { kind: "computedPartial", amountMinor: 150, undetailed: true } });
  });
});

describe("retrySettlementAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
  });

  it("refuses (no-longer-pending) when the delivery is not found", async () => {
    getDeliveryDetailMock.mockResolvedValue(null);

    const result = await retrySettlementAction({
      deliveryId: DELIVERY_ID,
      settleRemainder: true,
      settlementDate: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: true, noLongerPending: true });
    expect(runOrderCloseMoneyTransactionMock).not.toHaveBeenCalled();
  });

  it("Retry's precondition: refuses when the delivery is no longer DELIVERED (it was reopened)", async () => {
    getDeliveryDetailMock.mockResolvedValue({ status: "IN_TRANSIT", sourceOrders: [] });

    const result = await retrySettlementAction({
      deliveryId: DELIVERY_ID,
      settleRemainder: true,
      settlementDate: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: true, noLongerPending: true });
    expect(runOrderCloseMoneyTransactionMock).not.toHaveBeenCalled();
  });

  it("re-derives deliveredItemIds from the delivery's own current items, never from client input", async () => {
    getDeliveryDetailMock.mockResolvedValue({
      status: "DELIVERED",
      sourceOrders: [{ orderId: ORDER_ID, items: [{ id: ITEM_ID }, { id: ITEM_ID_2 }] }],
    });
    getOrderDetailMock.mockResolvedValue({ ...orderDetailFixture(), status: "COMPLETED" });
    runOrderCloseMoneyTransactionMock.mockResolvedValue([
      { orderId: ORDER_ID, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
    ]);

    const result = await retrySettlementAction({
      deliveryId: DELIVERY_ID,
      settleRemainder: true,
      settlementDate: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith({
      userId: "user-1",
      deliveryId: DELIVERY_ID,
      closedOrders: [
        {
          orderId: ORDER_ID,
          closed: true,
          settlement: {
            enabled: true,
            deliveredItemIds: [ITEM_ID, ITEM_ID_2],
            settlementDate: new Date("2026-05-01T00:00:00.000Z"),
            manualAmountMinor: undefined,
          },
        },
      ],
    });
    expect(result).toEqual({
      ok: true,
      noLongerPending: false,
      outcomes: [
        { orderId: ORDER_ID, currencyCode: "USD", status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
      ],
    });
  });

  it("does nothing when an order is no longer COMPLETED and the checkbox is unchecked (genuinely nothing pending)", async () => {
    getDeliveryDetailMock.mockResolvedValue({
      status: "DELIVERED",
      sourceOrders: [{ orderId: ORDER_ID, items: [{ id: ITEM_ID }] }],
    });
    getOrderDetailMock.mockResolvedValue({ ...orderDetailFixture(), status: "PARTIALLY_DELIVERED" });

    const result = await retrySettlementAction({
      deliveryId: DELIVERY_ID,
      settleRemainder: false,
      settlementDate: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: true, noLongerPending: true });
    expect(runOrderCloseMoneyTransactionMock).not.toHaveBeenCalled();
  });

  // BLOCKER F3 wiring, 2026-08-20 review: an order that reopened out of COMPLETED (still
  // PARTIALLY_DELIVERED) used to be silently dropped here — the partial branch was unreachable
  // through Retry at all. Before the fix this test fails: `runOrderCloseMoneyTransactionMock` is
  // never called because the order is filtered out entirely.
  it("re-derives the partial (still-open) branch too, with closed:false, in the SAME money-transaction call", async () => {
    getDeliveryDetailMock.mockResolvedValue({
      status: "DELIVERED",
      sourceOrders: [
        { orderId: ORDER_ID, items: [{ id: ITEM_ID }] },
        { orderId: "clh4444444444abcdefghijk", items: [{ id: ITEM_ID_2 }] },
      ],
    });
    getOrderDetailMock.mockImplementation(async (orderId: string) => {
      if (orderId === ORDER_ID) return { ...orderDetailFixture(), status: "COMPLETED" };
      return { ...orderDetailFixture(), id: orderId, status: "PARTIALLY_DELIVERED" };
    });
    runOrderCloseMoneyTransactionMock.mockResolvedValue([
      { orderId: ORDER_ID, status: "settled", consumedMinor: 0, settledAmountMinor: 5000 },
      { orderId: "clh4444444444abcdefghijk", status: "settled", consumedMinor: 0, settledAmountMinor: 1000 },
    ]);

    await retrySettlementAction({
      deliveryId: DELIVERY_ID,
      settleRemainder: true,
      settlementDate: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledTimes(1);
    const call = runOrderCloseMoneyTransactionMock.mock.calls[0][0];
    expect(call.closedOrders).toEqual([
      expect.objectContaining({ orderId: ORDER_ID, closed: true }),
      expect.objectContaining({ orderId: "clh4444444444abcdefghijk", closed: false }),
    ]);
  });
});

describe("undoReopenAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
  });

  const SNAPSHOT = [
    {
      storeId: ORDER_ID,
      amount: 5000,
      paymentDate: new Date("2026-05-01T00:00:00.000Z"),
      currencyCode: "USD",
      note: null,
      exchangeRate: null,
      exchangeRateBaseCode: null,
      settledByDeliveryId: DELIVERY_ID,
      allocations: [{ orderId: ORDER_ID, orderItemId: null, amountMinor: 5000 }],
    },
  ];

  it("restores the snapshot FIRST, then re-marks delivered, sequential — never concurrent", async () => {
    const callOrder: string[] = [];
    restoreSettlementPaymentsMock.mockImplementation(async () => {
      callOrder.push("restore");
      return { ok: true, paymentIds: ["payment-1"], affectedOrderIds: [ORDER_ID] };
    });
    markDeliveryDeliveredMock.mockImplementation(async () => {
      callOrder.push("markDelivered");
      return { ok: true, productCount: 1, closedOrders: [] };
    });

    const result = await undoReopenAction({
      deliveryId: DELIVERY_ID,
      previousStatus: "DELIVERED",
      receivedDate: new Date("2026-05-02T00:00:00.000Z"),
      snapshot: SNAPSHOT,
    });

    expect(result).toEqual({ ok: true });
    expect(restoreSettlementPaymentsMock).toHaveBeenCalledWith({ userId: "user-1", snapshot: SNAPSHOT });
    expect(markDeliveryDeliveredMock).toHaveBeenCalledWith(DELIVERY_ID, "user-1", new Date("2026-05-02T00:00:00.000Z"));
    // The concurrency shape (BLOCKER F1): the restore's own promise fully resolved before the
    // lifecycle re-write ever started, not two dispatches racing each other.
    expect(callOrder).toEqual(["restore", "markDelivered"]);
  });

  // Red-first evidence for the concurrency shape: against the OLD two-dispatch code, this exact
  // ordering assertion (and the "called once" shape below, once ported to the component test) is
  // what fails — the old code fired `undoReopenSettlementAction` and the inverse mutation from two
  // independent `void`/`.then` chains with no ordering between them at all.
  it("never calls markDeliveryDelivered when the restore reports NOT_FOUND — refuses instead", async () => {
    restoreSettlementPaymentsMock.mockResolvedValue({ ok: false, error: "NOT_FOUND" });

    const result = await undoReopenAction({
      deliveryId: DELIVERY_ID,
      previousStatus: "DELIVERED",
      receivedDate: new Date("2026-05-02T00:00:00.000Z"),
      snapshot: SNAPSHOT,
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(markDeliveryDeliveredMock).not.toHaveBeenCalled();
  });

  it("re-cancels instead when the previous status was CANCELLED, and skips the restore call for an empty snapshot", async () => {
    cancelDeliveryMock.mockResolvedValue({ ok: true, productCount: 1 });

    const result = await undoReopenAction({
      deliveryId: DELIVERY_ID,
      previousStatus: "CANCELLED",
      receivedDate: null,
      snapshot: [],
    });

    expect(result).toEqual({ ok: true });
    expect(restoreSettlementPaymentsMock).not.toHaveBeenCalled();
    expect(cancelDeliveryMock).toHaveBeenCalledWith(DELIVERY_ID, "user-1");
    expect(markDeliveryDeliveredMock).not.toHaveBeenCalled();
  });

  it("never enables a fresh settlement on the re-close: closed:true with no settlement field", async () => {
    restoreSettlementPaymentsMock.mockResolvedValue({ ok: true, paymentIds: [], affectedOrderIds: [] });
    markDeliveryDeliveredMock.mockResolvedValue({
      ok: true,
      productCount: 1,
      closedOrders: [{ orderId: ORDER_ID, storeId: "store-1", currencyCode: "USD" }],
    });
    runOrderCloseMoneyTransactionMock.mockResolvedValue([
      { orderId: ORDER_ID, status: "settled", consumedMinor: 0, settledAmountMinor: null },
    ]);

    await undoReopenAction({
      deliveryId: DELIVERY_ID,
      previousStatus: "DELIVERED",
      receivedDate: new Date("2026-05-02T00:00:00.000Z"),
      snapshot: SNAPSHOT,
    });

    expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith({
      userId: "user-1",
      deliveryId: DELIVERY_ID,
      closedOrders: [{ orderId: ORDER_ID, closed: true }],
    });
  });

  it("reports a server error without leaking the exception", async () => {
    restoreSettlementPaymentsMock.mockRejectedValue(new Error("db down"));

    const result = await undoReopenAction({
      deliveryId: DELIVERY_ID,
      previousStatus: "DELIVERED",
      receivedDate: new Date("2026-05-02T00:00:00.000Z"),
      snapshot: SNAPSHOT,
    });

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});
