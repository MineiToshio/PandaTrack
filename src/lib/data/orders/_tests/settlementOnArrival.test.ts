import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderItemDeliveryState } from "../../../../../generated/prisma/client";
import {
  createStorePaymentInTx,
  resolveSettlementPlan,
  restoreSettlementPayments,
  runOrderCloseMoneyTransaction,
  type SettlementPlan,
} from "../storePaymentMutations";
import {
  makeCreateStorePaymentTx,
  makeFixtureOrder,
  makeOrderCloseMoneyTx,
  makeRestoreSettlementTx,
  runOrderCloseMoneyTx,
  runRestoreSettlementTx,
  runStorePaymentTx,
  type OrderCloseMoneyOrder,
} from "./storePaymentFixtures";

const DELIVERED = OrderItemDeliveryState.DELIVERED;
const IN_TRANSIT = OrderItemDeliveryState.IN_TRANSIT;

/** A minimal fully-delivered, single-item order: the common shape for the full-order branch. */
function fullyDeliveredOrder(overrides: Partial<OrderCloseMoneyOrder> = {}): OrderCloseMoneyOrder {
  return {
    id: "order-1",
    storeId: "store-1",
    currencyCode: "USD",
    totalCost: 10000,
    allocatedAmountMinor: 0,
    items: [{ id: "item-1", unitPrice: 10000, quantity: 1, deliveryState: DELIVERED }],
    ...overrides,
  };
}

describe("resolveSettlementPlan", () => {
  it("full-order branch, order not yet fully allocated: amount = openBalanceMinor, no per-item lines required", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [fullyDeliveredOrder({ totalCost: 10000, allocatedAmountMinor: 4000 })],
    });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", { orderId: "order-1", deliveredItemIds: [] });
    expect(plan).toEqual({ kind: "computedFull", amountMinor: 6000, coveredItemIds: ["item-1"] });
  });

  it("full-order branch, order already fully allocated: nothing to settle, no StorePayment implied", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [fullyDeliveredOrder({ totalCost: 10000, allocatedAmountMinor: 10000 })],
    });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", { orderId: "order-1", deliveredItemIds: [] });
    expect(plan).toEqual({ kind: "nothingToSettle" });
  });

  it("full-order branch, order fully written off by an earlier reconciliation: nothing to settle", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [fullyDeliveredOrder({ totalCost: 10000, allocatedAmountMinor: 0, writtenOffMinor: 10000 })],
    });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", { orderId: "order-1", deliveredItemIds: [] });
    expect(plan).toEqual({ kind: "nothingToSettle" });
  });

  it("full-order branch, order partially written off: amount is the post-write-off remainder", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [fullyDeliveredOrder({ totalCost: 10000, allocatedAmountMinor: 0, writtenOffMinor: 3000 })],
    });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", { orderId: "order-1", deliveredItemIds: [] });
    expect(plan).toEqual({ kind: "computedFull", amountMinor: 7000, coveredItemIds: ["item-1"] });
  });

  it("partial branch, both conditions hold, multi-product order: sums each delivered item's own base minus what is already allocated", async () => {
    const order: OrderCloseMoneyOrder = {
      id: "order-2",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 15000,
      allocatedAmountMinor: 2000,
      items: [
        { id: "item-a", unitPrice: 5000, quantity: 1, deliveryState: DELIVERED },
        { id: "item-b", unitPrice: 10000, quantity: 1, deliveryState: IN_TRANSIT },
      ],
    };
    const fixture = makeOrderCloseMoneyTx({
      orders: [order],
      payments: [
        {
          id: "p-existing",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 2000,
          paymentDate: new Date("2019-06-01"),
          allocations: [{ orderId: "order-2", orderItemId: "item-a", amountMinor: 2000 }],
        },
      ],
    });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", {
      orderId: "order-2",
      deliveredItemIds: ["item-a"],
    });
    // item-a base 5000, already allocated 2000 -> line 3000. Only item-a is "delivered" here.
    expect(plan).toEqual({
      kind: "computedPartial",
      amountMinor: 3000,
      undetailed: false,
      itemLines: [{ orderItemId: "item-a", amountMinor: 3000 }],
      coveredItemIds: ["item-a"],
    });
  });

  it("partial branch, both conditions hold, single-product order: base uses totalCost, not unitPrice * quantity", async () => {
    const order: OrderCloseMoneyOrder = {
      id: "order-3",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 9000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-solo", unitPrice: 1234, quantity: 3, deliveryState: DELIVERED }],
    };
    // A single-item order is, by construction, fully delivered once its one item is DELIVERED, so
    // this exercises the full-order branch's own totalCost read rather than the partial formula;
    // the assertion is the same claim either way: totalCost (9000), never unitPrice * quantity
    // (3702).
    const fixture = makeOrderCloseMoneyTx({ orders: [order] });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", {
      orderId: "order-3",
      deliveredItemIds: ["item-solo"],
    });
    expect(plan).toMatchObject({ kind: "computedFull", amountMinor: 9000 });
  });

  it("partial branch, single-product order still IN_TRANSIT: base uses totalCost even though the naive unitPrice * quantity formula would differ", async () => {
    const orderA: OrderCloseMoneyOrder = {
      id: "order-3b",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 9000,
      allocatedAmountMinor: 0,
      items: [
        { id: "item-solo", unitPrice: 1234, quantity: 3, deliveryState: IN_TRANSIT },
        { id: "item-other", unitPrice: 500, quantity: 1, deliveryState: DELIVERED },
      ],
    };
    // Two-item order (so it is NOT single-product) is used as scaffolding to keep the order from
    // closing; what is under test is a genuinely single-item order below.
    void orderA;

    const singleItemOrder: OrderCloseMoneyOrder = {
      id: "order-3c",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 9000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-solo-2", unitPrice: 1234, quantity: 3, deliveryState: IN_TRANSIT }],
    };
    const fixture = makeOrderCloseMoneyTx({ orders: [singleItemOrder] });
    // This item is not yet DELIVERED, so the order does not close (full branch), but the resolver
    // is still asked as if it were the delivered item of the event to exercise the base formula.
    const plan = await resolveSettlementPlan(fixture as never, "user-1", {
      orderId: "order-3c",
      deliveredItemIds: ["item-solo-2"],
    });
    expect(plan).toMatchObject({ kind: "computedPartial", amountMinor: 9000, undetailed: false });
  });

  it("partial branch, a delivered item has a null unitPrice: not computable, reason names the missing price", async () => {
    const order: OrderCloseMoneyOrder = {
      id: "order-4",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 8000,
      allocatedAmountMinor: 0,
      items: [
        { id: "item-priced", unitPrice: 3000, quantity: 1, deliveryState: DELIVERED },
        { id: "item-no-price", unitPrice: null, quantity: 1, deliveryState: DELIVERED },
        { id: "item-pending", unitPrice: 1000, quantity: 1, deliveryState: IN_TRANSIT },
      ],
    };
    const fixture = makeOrderCloseMoneyTx({ orders: [order] });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", {
      orderId: "order-4",
      deliveredItemIds: ["item-priced", "item-no-price"],
    });
    expect(plan).toEqual({
      kind: "manual",
      reasonCode: "missingPrice",
      referenceAmountMinor: 8000,
      coveredItemIds: ["item-priced", "item-no-price"],
    });
    // Not computable, but the reference amount is still returned, reference-only.
    expect((plan as Extract<SettlementPlan, { kind: "manual" }>).referenceAmountMinor).toBe(8000);
  });

  it("partial branch, all delivered items priced but the order has an orderItemId IS NULL allocation: not computable, reason names the undetailed money", async () => {
    const order: OrderCloseMoneyOrder = {
      id: "order-5",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 8000,
      allocatedAmountMinor: 2000,
      items: [
        { id: "item-priced-a", unitPrice: 3000, quantity: 1, deliveryState: DELIVERED },
        { id: "item-priced-b", unitPrice: 5000, quantity: 1, deliveryState: IN_TRANSIT },
      ],
    };
    const fixture = makeOrderCloseMoneyTx({
      orders: [order],
      payments: [
        {
          id: "p-undetailed",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 2000,
          paymentDate: new Date("2019-06-01"),
          allocations: [{ orderId: "order-5", orderItemId: null, amountMinor: 2000 }],
        },
      ],
    });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", {
      orderId: "order-5",
      deliveredItemIds: ["item-priced-a"],
    });
    expect(plan).toEqual({
      kind: "manual",
      reasonCode: "undetailedMoney",
      referenceAmountMinor: 6000,
      coveredItemIds: ["item-priced-a"],
    });
  });

  it("partial branch, cap: a StoreAccountAdjustmentLine forces the per-item sum down, and the write becomes undetailed rather than scaled", async () => {
    // totalCost 500, adjustment line 300 -> openBalanceMinor = 200. Three delivered items of base
    // 100 each sum to 300 uncapped; the cap forces 200, undetailed (BR-08-15/16: no proportional
    // scaling of the per-item lines to fit).
    const order: OrderCloseMoneyOrder = {
      id: "order-6",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 500,
      allocatedAmountMinor: 0,
      writtenOffMinor: 300,
      items: [
        { id: "item-1", unitPrice: 100, quantity: 1, deliveryState: DELIVERED },
        { id: "item-2", unitPrice: 100, quantity: 1, deliveryState: DELIVERED },
        { id: "item-3", unitPrice: 100, quantity: 1, deliveryState: IN_TRANSIT },
      ],
    };
    const fixture = makeOrderCloseMoneyTx({ orders: [order] });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", {
      orderId: "order-6",
      deliveredItemIds: ["item-1", "item-2", "item-3"],
    });
    expect(plan).toEqual({
      kind: "computedPartial",
      amountMinor: 200,
      undetailed: true,
      itemLines: null,
      coveredItemIds: ["item-1", "item-2", "item-3"],
    });
  });

  /**
   * MUTATION EVIDENCE (b) + (c): if the cap were removed, this would assert `amountMinor: 300,
   * undetailed: false, itemLines: [...]` instead and this test would fail. If the cap were kept but
   * the per-item lines were scaled down proportionally to fit (e.g. ~66/67/67) instead of dropping
   * to one undetailed line, `itemLines` would be non-null here and this test would fail too.
   */
  it("mutation evidence: the cap forces undetailed, never a proportionally-scaled per-item breakdown", async () => {
    const order: OrderCloseMoneyOrder = {
      id: "order-6b",
      storeId: "store-1",
      currencyCode: "USD",
      totalCost: 500,
      allocatedAmountMinor: 0,
      writtenOffMinor: 300,
      items: [
        { id: "item-1", unitPrice: 100, quantity: 1, deliveryState: DELIVERED },
        { id: "item-2", unitPrice: 100, quantity: 1, deliveryState: DELIVERED },
        { id: "item-3", unitPrice: 100, quantity: 1, deliveryState: IN_TRANSIT },
      ],
    };
    const fixture = makeOrderCloseMoneyTx({ orders: [order] });
    const plan = await resolveSettlementPlan(fixture as never, "user-1", {
      orderId: "order-6b",
      deliveredItemIds: ["item-1", "item-2", "item-3"],
    });
    expect(plan.kind).toBe("computedPartial");
    const partial = plan as Extract<SettlementPlan, { kind: "computedPartial" }>;
    expect(partial.amountMinor).toBe(200); // not 300 (evidence the cap is applied)
    expect(partial.undetailed).toBe(true); // not false (evidence it drops to undetailed, not scaled)
    expect(partial.itemLines).toBeNull();
  });
});

describe("createStorePaymentInTx / createStorePayment write path for a resolved settlement plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const PAYMENT_DATE = new Date("2020-06-01T00:00:00Z");

  it("computed plan, submitted unedited: StorePayment written with per-item PaymentAllocation rows matching the computed lines", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 15000,
      allocatedAmountMinor: 2000,
      items: [
        { id: "item-a", unitPrice: 5000, quantity: 1 },
        { id: "item-b", unitPrice: 10000, quantity: 1 },
      ],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 15000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 5000 },
      snapshotsByOrderId: { "order-1": { totalCost: 15000, allocatedAmountMinor: 5000 } },
      declarableItemIds: ["item-a"],
    });
    runStorePaymentTx(prismaMock, tx);

    const { createStorePayment } = await import("../storePaymentMutations");
    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 3000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", orderItemId: "item-a", amountMinor: 3000 }],
      declarePaidItemIds: ["item-a"],
      settledByDeliveryId: "delivery-1",
    });

    expect(result).toMatchObject({ ok: true });
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-new",
          orderId: "order-1",
          orderItemId: "item-a",
          userId: "user-1",
          amountMinor: 3000,
          settlesTarget: false,
        },
      ],
    });
    expect(tx.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ settledByDeliveryId: "delivery-1" }) }),
    );
  });

  it("manual amount (collector typed or edited): StorePayment written with one orderItemId: null allocation for the full amount, never a per-item split", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 15000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 15000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 4000 },
      snapshotsByOrderId: { "order-1": { totalCost: 15000, allocatedAmountMinor: 4000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const { createStorePayment } = await import("../storePaymentMutations");
    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 4000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 4000 }],
      settledByDeliveryId: "delivery-1",
    });

    expect(result).toMatchObject({ ok: true });
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-new",
          orderId: "order-1",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 4000,
          settlesTarget: false,
        },
      ],
    });
  });

  it("manual amount greater than openBalanceMinor(order): rejected EXCEEDS_BALANCE, nothing written", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 5000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      // Store debt ceiling deliberately far above 5001, so STORE_DEBT_EXCEEDED cannot fire first:
      // this test is about the order's OWN balance ceiling, not the store-wide one.
      debtByCurrency: { USD: { committedMinor: 999999, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const { createStorePayment } = await import("../storePaymentMutations");
    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 5001,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 5001 }],
      settledByDeliveryId: "delivery-1",
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("settlement date left as the delivery's received date: StorePayment.paymentDate equals it exactly", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 5000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 5000 },
      snapshotsByOrderId: { "order-1": { totalCost: 5000, allocatedAmountMinor: 5000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const { createStorePayment } = await import("../storePaymentMutations");
    await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 5000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 5000 }],
      settledByDeliveryId: "delivery-1",
    });

    expect(tx.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentDate: PAYMENT_DATE }) }),
    );
  });

  it("settlement date edited earlier than order.orderDate: rejected DATE_BEFORE_ORDER, nothing written", async () => {
    const order = makeFixtureOrder({ id: "order-1", orderDate: new Date("2020-07-01T00:00:00Z") });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const { createStorePayment } = await import("../storePaymentMutations");
    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE, // 2020-06-01, before the order
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
      settledByDeliveryId: "delivery-1",
    });

    expect(result).toEqual({ ok: false, error: "DATE_BEFORE_ORDER", orderId: "order-1" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("delivered products covered by the settlement: declarePaidItemIds includes exactly those product ids", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 15000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-a", unitPrice: 5000, quantity: 1 }],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 15000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 5000 },
      snapshotsByOrderId: { "order-1": { totalCost: 15000, allocatedAmountMinor: 5000 } },
      declarableItemIds: ["item-a"],
    });
    runStorePaymentTx(prismaMock, tx);

    const { createStorePayment } = await import("../storePaymentMutations");
    await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 5000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", orderItemId: "item-a", amountMinor: 5000 }],
      declarePaidItemIds: ["item-a"],
      settledByDeliveryId: "delivery-1",
    });

    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-a"] }, userId: "user-1" },
      data: { paidDeclaredAt: expect.any(Date) },
    });
  });

  it("settledByDeliveryId on the written row equals the delivery id that triggered the write", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 5000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 5000 },
      snapshotsByOrderId: { "order-1": { totalCost: 5000, allocatedAmountMinor: 5000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const { createStorePayment } = await import("../storePaymentMutations");
    await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 5000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 5000 }],
      settledByDeliveryId: "delivery-42",
    });

    expect(tx.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ settledByDeliveryId: "delivery-42" }) }),
    );
  });

  it("createStorePaymentInTx runs inside a caller-owned tx without opening its own transaction", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 5000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 5000 },
      snapshotsByOrderId: { "order-1": { totalCost: 5000, allocatedAmountMinor: 5000 } },
    });

    const result = await createStorePaymentInTx(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      amount: 5000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 5000 }],
      settledByDeliveryId: "delivery-1",
    });

    expect(result).toMatchObject({ ok: true });
  });
});

describe("runOrderCloseMoneyTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("order-close consumption call site: consumes unassigned money before computing the settlement, so the two writes never double-count", async () => {
    // Store already holds 30 unassigned; order's own remaining balance (after consumption) is 70.
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
      payments: [
        {
          id: "p-unassigned",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 30,
          paymentDate: new Date("2019-01-01"),
          allocations: [],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        {
          orderId: "order-a",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-a"], settlementDate: new Date("2020-01-01") },
        },
      ],
    });

    expect(outcomes).toEqual([{ orderId: "order-a", status: "settled", consumedMinor: 30, settledAmountMinor: 70 }]);
  });

  /**
   * MUTATION EVIDENCE (a): if settlement were computed BEFORE consumption, the settlement amount
   * here would be 100 (the pre-consumption balance) instead of 70, and this test would fail.
   */
  it("mutation evidence: settlement reads the POST-consumption balance, never the pre-consumption one", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
      payments: [
        {
          id: "p-unassigned",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 30,
          paymentDate: new Date("2019-01-01"),
          allocations: [],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    const [outcome] = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        {
          orderId: "order-a",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-a"], settlementDate: new Date("2020-01-01") },
        },
      ],
    });

    expect(outcome.status).toBe("settled");
    expect((outcome as { settledAmountMinor: number }).settledAmountMinor).toBe(70); // not 100
  });

  it("consumption runs when settlement is disabled: consumes any unassigned money but writes no settlement StorePayment", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
      payments: [
        {
          id: "p-unassigned",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 30,
          paymentDate: new Date("2019-01-01"),
          allocations: [],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [{ orderId: "order-a", closed: true }], // no settlement at all: checkbox unchecked
    });

    expect(outcomes).toEqual([{ orderId: "order-a", status: "settled", consumedMinor: 30, settledAmountMinor: null }]);
    expect(fixture.__state.paymentRows.find((p) => p.id === "p-unassigned")!.allocations).toEqual([
      { orderId: "order-a", orderItemId: null, amountMinor: 30 },
    ]);
    // Only the pool payment gained an allocation; no NEW StorePayment (a settlement) was created.
    expect(fixture.__state.paymentRows).toHaveLength(1);
  });

  it("an order closes with no unassigned money: the consumption call is still attempted and is a no-op", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        {
          orderId: "order-a",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-a"], settlementDate: new Date("2020-01-01") },
        },
      ],
    });

    expect(outcomes).toEqual([{ orderId: "order-a", status: "settled", consumedMinor: 0, settledAmountMinor: 100 }]);
  });

  it("store-scoped batch closing two orders: consumption and settlement follow the given order, one order at a time, draining one shared pool", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 50,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 50, quantity: 1, deliveryState: DELIVERED }],
        },
        {
          id: "order-b",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 50,
          allocatedAmountMinor: 0,
          items: [{ id: "item-b", unitPrice: 50, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
      payments: [
        {
          id: "p-unassigned",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 30,
          paymentDate: new Date("2019-01-01"),
          allocations: [],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    // orderDate ASC, humanReadableId ASC (FR-08-45): order-a first.
    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        {
          orderId: "order-a",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-a"], settlementDate: new Date("2020-01-01") },
        },
        {
          orderId: "order-b",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-b"], settlementDate: new Date("2020-01-01") },
        },
      ],
    });

    // order-a drains the whole 30-unit pool (its own balance is 50, pool has 30): consumed 30,
    // settled 20 (50 - 30). order-b's own close finds the pool already empty: consumed 0, settled 50.
    expect(outcomes).toEqual([
      { orderId: "order-a", status: "settled", consumedMinor: 30, settledAmountMinor: 20 },
      { orderId: "order-b", status: "settled", consumedMinor: 0, settledAmountMinor: 50 },
    ]);
  });

  it("an order closing through the formal Marcar como llegada action (no settlement checkbox) still consumes unassigned money", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
      payments: [
        {
          id: "p-unassigned",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 40,
          paymentDate: new Date("2019-01-01"),
          allocations: [],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    // markDeliveredAction never sets `settlement` at all, matching this slice's own scope for that action.
    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [{ orderId: "order-a", closed: true }],
    });

    expect(outcomes).toEqual([{ orderId: "order-a", status: "settled", consumedMinor: 40, settledAmountMinor: null }]);
  });

  it("stops on the first refused order and reports the remaining as pending", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: IN_TRANSIT }],
        },
        {
          id: "order-b",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 50,
          allocatedAmountMinor: 0,
          items: [{ id: "item-b", unitPrice: 50, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    // order-a's settlement date predates the order's own orderDate fixture default (2019-01-01), so
    // its own createStorePaymentInTx call refuses DATE_BEFORE_ORDER before any write.
    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        {
          orderId: "order-a",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-a"], settlementDate: new Date("2018-01-01") },
        },
        {
          orderId: "order-b",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-b"], settlementDate: new Date("2020-01-01") },
        },
      ],
    });

    expect(outcomes[0]).toMatchObject({ orderId: "order-a", status: "refused", error: "DATE_BEFORE_ORDER" });
    expect(outcomes[1]).toEqual({
      orderId: "order-b",
      status: "pending",
      consumedMinor: null,
      settledAmountMinor: null,
    });
  });

  /**
   * BLOCKER F3 (2026-08-20 adversarial review): FR-08-40's partial branch (an order that stayed OPEN
   * because this delivery event only delivered SOME of its products) was unreachable through this
   * function, because every `ClosedOrderInput` was silently treated as a closed order and consumption
   * ran unconditionally. `closed: false` is the signal that this delivery event did NOT close the
   * order: consumption (the CLOSE invariant, FR-08-46) must be skipped, while settlement — if the
   * collector left the box checked — still runs off the fresh, partial-branch plan.
   *
   * Captured red evidence (pre-fix, this exact test): `consumedMinor` came back `30`, not `0`, and the
   * pool payment's own `allocations` gained a `{ orderId: "order-a", orderItemId: null, amountMinor:
   * 30 }` row — proof the code always drains the pool regardless of `closed`, because the field did
   * not exist yet and consumption was unconditional.
   */
  it("F3: a non-closed entry (partial arrival) with settlement enabled skips consumption but still writes from the partial plan", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 15000,
          allocatedAmountMinor: 0,
          items: [
            { id: "item-a", unitPrice: 5000, quantity: 1, deliveryState: DELIVERED },
            { id: "item-b", unitPrice: 10000, quantity: 1, deliveryState: IN_TRANSIT },
          ],
        },
      ],
      payments: [
        {
          id: "p-unassigned",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 30,
          paymentDate: new Date("2019-01-01"),
          allocations: [],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        {
          orderId: "order-a",
          closed: false,
          settlement: { enabled: true, deliveredItemIds: ["item-a"], settlementDate: new Date("2020-01-01") },
        },
      ],
    });

    // Consumption skipped entirely: the unassigned pool payment gained no allocation.
    expect(fixture.__state.paymentRows.find((p) => p.id === "p-unassigned")!.allocations).toEqual([]);
    // Settlement still wrote from the partial plan: item-a base 5000, nothing allocated yet -> 5000.
    expect(outcomes).toEqual([{ orderId: "order-a", status: "settled", consumedMinor: 0, settledAmountMinor: 5000 }]);
  });

  it("F3: a non-closed entry with settlement disabled does truly nothing: no consumption, no settlement write", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: IN_TRANSIT }],
        },
      ],
      payments: [
        {
          id: "p-unassigned",
          storeId: "store-1",
          currencyCode: "USD",
          amount: 30,
          paymentDate: new Date("2019-01-01"),
          allocations: [],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    const outcomes = await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [{ orderId: "order-a", closed: false }],
    });

    expect(outcomes).toEqual([{ orderId: "order-a", status: "settled", consumedMinor: 0, settledAmountMinor: null }]);
    expect(fixture.__state.paymentRows).toHaveLength(1); // no new settlement StorePayment
    expect(fixture.__state.paymentRows[0].allocations).toEqual([]); // pool untouched
  });

  /**
   * MAJOR F6 (2026-08-20 adversarial review): the settlement `StorePayment` used to be written with
   * NO FX pair at all, unlike `addOrderPayment`'s single-order path (`orderPaymentMutations.ts:222-225`),
   * which always inherits `order.exchangeRate`/`exchangeRateBaseCode`. Captured red evidence (pre-fix,
   * this exact test): `tx.storePayment.create` was called with `data.exchangeRate: undefined` and
   * `data.exchangeRateBaseCode: undefined` even though the order carried a rate, because the money
   * transaction's own order read never selected those columns.
   */
  it("F6: the settlement StorePayment inherits the order's own FX pair, like the single-order path does", async () => {
    const fixture = makeOrderCloseMoneyTx({
      orders: [
        {
          id: "order-a",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 100,
          allocatedAmountMinor: 0,
          exchangeRate: 3.75,
          exchangeRateBaseCode: "PEN",
          items: [{ id: "item-a", unitPrice: 100, quantity: 1, deliveryState: DELIVERED }],
        },
      ],
    });
    runOrderCloseMoneyTx(prismaMock, fixture);

    await runOrderCloseMoneyTransaction({
      userId: "user-1",
      deliveryId: "delivery-1",
      closedOrders: [
        {
          orderId: "order-a",
          closed: true,
          settlement: { enabled: true, deliveredItemIds: ["item-a"], settlementDate: new Date("2020-01-01") },
        },
      ],
    });

    expect(fixture.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ exchangeRate: 3.75, exchangeRateBaseCode: "PEN" }) }),
    );
  });
});

describe("restoreSettlementPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores the exact deleted payment(s) verbatim: same amount, date, allocations, settledByDeliveryId", async () => {
    const fixture = makeRestoreSettlementTx({
      deliveries: [{ id: "delivery-1" }],
      stores: [{ id: "store-1" }],
      orders: [{ id: "order-a", storeId: "store-1" }],
      cacheAfterWriteByOrderId: { "order-a": 100 },
    });
    runRestoreSettlementTx(prismaMock, fixture);

    const result = await restoreSettlementPayments({
      userId: "user-1",
      snapshot: [
        {
          storeId: "store-1",
          amount: 100,
          paymentDate: new Date("2020-01-01"),
          currencyCode: "USD",
          note: null,
          exchangeRate: null,
          exchangeRateBaseCode: null,
          settledByDeliveryId: "delivery-1",
          allocations: [{ orderId: "order-a", orderItemId: null, amountMinor: 100 }],
        },
      ],
    });

    expect(result).toMatchObject({ ok: true, affectedOrderIds: ["order-a"] });
    const okResult = result as Extract<typeof result, { ok: true }>;
    expect(okResult.paymentIds).toHaveLength(1);
    const restored = fixture.__state.createdPayments.find((p) => p.id === okResult.paymentIds[0])!;
    expect(restored.amount).toBe(100);
    expect(restored.paymentDate).toEqual(new Date("2020-01-01"));
    expect(restored.settledByDeliveryId).toBe("delivery-1");
    expect(restored.allocations).toEqual([{ orderId: "order-a", orderItemId: null, amountMinor: 100 }]);
  });

  it("never calls the settlement resolver: recomputing at restore time could invent or lose money relative to what was reverted", async () => {
    const fixture = makeRestoreSettlementTx({
      deliveries: [{ id: "delivery-1" }],
      stores: [{ id: "store-1" }],
      orders: [{ id: "order-a", storeId: "store-1" }],
      cacheAfterWriteByOrderId: { "order-a": 100 },
    });
    runRestoreSettlementTx(prismaMock, fixture);

    await restoreSettlementPayments({
      userId: "user-1",
      snapshot: [
        {
          storeId: "store-1",
          amount: 100,
          paymentDate: new Date("2020-01-01"),
          currencyCode: "USD",
          note: null,
          exchangeRate: null,
          exchangeRateBaseCode: null,
          settledByDeliveryId: "delivery-1",
          allocations: [{ orderId: "order-a", orderItemId: null, amountMinor: 100 }],
        },
      ],
    });

    // The resolver reads an order with `select.items`; this fixture's `order.findMany` never
    // receives one, which is what proves `resolveSettlementPlan` never ran during restore.
    expect(fixture.order.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ items: expect.anything() }) }),
    );
  });

  /**
   * BLOCKER F2 (2026-08-20 adversarial review): before this fix, `restoreSettlementPayments` wrote
   * the client-supplied snapshot with NO ownership verification at all — any orderId, storeId, or
   * `settledByDeliveryId` in the payload was trusted verbatim. This is the literal red evidence: run
   * against the pre-fix code (a plain loop over `tx.storePayment.create` / `tx.paymentAllocation.
   * createMany`, no ids resolved against the caller first), this exact scenario returns `{ paymentIds:
   * ["restored-payment-0"], affectedOrderIds: ["order-victim"] }` and WRITES the row — there is no
   * `ok` field at all on the old return shape, so `result.ok` was `undefined`, never `false`. Captured
   * output (this test, pre-fix):
   *   AssertionError: expected { paymentIds: [ …(1) ], affectedOrderIds: [ …(1) ] } to
   *   deep equal { ok: false, error: 'NOT_FOUND' }
   * and a follow-up assertion on `fixture.storePayment.create` showed it WAS called once, proving the
   * foreign order's payment was persisted.
   */
  it("F2: a snapshot naming another user's order is refused NOT_FOUND before the first write", async () => {
    const fixture = makeRestoreSettlementTx({
      deliveries: [{ id: "delivery-1" }],
      stores: [{ id: "store-1" }],
      // "order-victim" is deliberately absent: from this caller's `{ id, userId }` read it does not
      // exist, exactly as another user's order would.
      orders: [],
    });
    runRestoreSettlementTx(prismaMock, fixture);

    const result = await restoreSettlementPayments({
      userId: "user-1",
      snapshot: [
        {
          storeId: "store-1",
          amount: 100,
          paymentDate: new Date("2020-01-01"),
          currencyCode: "USD",
          note: null,
          exchangeRate: null,
          exchangeRateBaseCode: null,
          settledByDeliveryId: "delivery-1",
          allocations: [{ orderId: "order-victim", orderItemId: null, amountMinor: 100 }],
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(fixture.storePayment.create).not.toHaveBeenCalled();
  });

  it("F2: a snapshot naming another user's delivery is refused NOT_FOUND before the first write", async () => {
    const fixture = makeRestoreSettlementTx({
      deliveries: [], // "delivery-victim" absent: not this caller's delivery.
      stores: [{ id: "store-1" }],
      orders: [{ id: "order-a", storeId: "store-1" }],
    });
    runRestoreSettlementTx(prismaMock, fixture);

    const result = await restoreSettlementPayments({
      userId: "user-1",
      snapshot: [
        {
          storeId: "store-1",
          amount: 100,
          paymentDate: new Date("2020-01-01"),
          currencyCode: "USD",
          note: null,
          exchangeRate: null,
          exchangeRateBaseCode: null,
          settledByDeliveryId: "delivery-victim",
          allocations: [{ orderId: "order-a", orderItemId: null, amountMinor: 100 }],
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(fixture.storePayment.create).not.toHaveBeenCalled();
  });

  it("F2: a snapshot whose store no longer exists is refused NOT_FOUND before the first write", async () => {
    const fixture = makeRestoreSettlementTx({
      deliveries: [{ id: "delivery-1" }],
      stores: [], // "store-gone" absent.
      orders: [{ id: "order-a", storeId: "store-gone" }],
    });
    runRestoreSettlementTx(prismaMock, fixture);

    const result = await restoreSettlementPayments({
      userId: "user-1",
      snapshot: [
        {
          storeId: "store-gone",
          amount: 100,
          paymentDate: new Date("2020-01-01"),
          currencyCode: "USD",
          note: null,
          exchangeRate: null,
          exchangeRateBaseCode: null,
          settledByDeliveryId: "delivery-1",
          allocations: [{ orderId: "order-a", orderItemId: null, amountMinor: 100 }],
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(fixture.storePayment.create).not.toHaveBeenCalled();
  });

  it("F2: an allocation's orderItemId belonging to a DIFFERENT order than the allocation names is refused NOT_FOUND", async () => {
    const fixture = makeRestoreSettlementTx({
      deliveries: [{ id: "delivery-1" }],
      stores: [{ id: "store-1" }],
      orders: [
        { id: "order-a", storeId: "store-1" },
        { id: "order-b", storeId: "store-1" },
      ],
      // "item-b" belongs to order-b, but the snapshot below claims it against order-a.
      orderItems: [{ id: "item-b", orderId: "order-b" }],
    });
    runRestoreSettlementTx(prismaMock, fixture);

    const result = await restoreSettlementPayments({
      userId: "user-1",
      snapshot: [
        {
          storeId: "store-1",
          amount: 100,
          paymentDate: new Date("2020-01-01"),
          currencyCode: "USD",
          note: null,
          exchangeRate: null,
          exchangeRateBaseCode: null,
          settledByDeliveryId: "delivery-1",
          allocations: [{ orderId: "order-a", orderItemId: "item-b", amountMinor: 100 }],
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(fixture.storePayment.create).not.toHaveBeenCalled();
  });

  it("F6: restores the settlement's own FX pair verbatim, parsed back from the serialized string", async () => {
    const fixture = makeRestoreSettlementTx({
      deliveries: [{ id: "delivery-1" }],
      stores: [{ id: "store-1" }],
      orders: [{ id: "order-a", storeId: "store-1" }],
      cacheAfterWriteByOrderId: { "order-a": 100 },
    });
    runRestoreSettlementTx(prismaMock, fixture);

    const result = await restoreSettlementPayments({
      userId: "user-1",
      snapshot: [
        {
          storeId: "store-1",
          amount: 100,
          paymentDate: new Date("2020-01-01"),
          currencyCode: "USD",
          note: null,
          exchangeRate: "3.75000000",
          exchangeRateBaseCode: "PEN",
          settledByDeliveryId: "delivery-1",
          allocations: [{ orderId: "order-a", orderItemId: null, amountMinor: 100 }],
        },
      ],
    });

    expect(result).toMatchObject({ ok: true });
    expect(fixture.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ exchangeRate: 3.75, exchangeRateBaseCode: "PEN" }) }),
    );
  });
});
