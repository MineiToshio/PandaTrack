import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import { createStorePayment, deleteStorePayment } from "../storePaymentMutations";
import { makeCreateStorePaymentTx, makeFixtureOrder, runStorePaymentTx } from "./storePaymentFixtures";

const PAYMENT_DATE = new Date("2020-06-01T00:00:00Z");

describe("createStorePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a multi-order, multi-item payment and refreshes every affected order's cache in ascending id order", async () => {
    const orderOne = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0, items: [] });
    const orderTwo = makeFixtureOrder({
      id: "order-2",
      totalCost: 5000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-1", unitPrice: null, quantity: 1 }],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [orderOne, orderTwo],
      debtByCurrency: { USD: { committedMinor: 20000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 300, "order-2": 500 },
      snapshotsByOrderId: {
        "order-1": { totalCost: 10000, allocatedAmountMinor: 300 },
        "order-2": { totalCost: 5000, allocatedAmountMinor: 500 },
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 800,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [
        { orderId: "order-2", orderItemId: "item-1", amountMinor: 500 },
        { orderId: "order-1", amountMinor: 300 },
      ],
    });

    // `affectedOrders` follows the order the allocations were submitted in (order-2 first); only
    // the cache refresh itself is sorted ascending by id, asserted below via `order.update`.
    expect(result).toMatchObject({
      ok: true,
      paymentId: "payment-new",
      currencyCode: "USD",
      affectedOrders: [
        { orderId: "order-2", totalCost: 5000, allocatedAmountMinor: 500 },
        { orderId: "order-1", totalCost: 10000, allocatedAmountMinor: 300 },
      ],
    });
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-new",
          orderId: "order-2",
          orderItemId: "item-1",
          userId: "user-1",
          amountMinor: 500,
          settlesTarget: false,
        },
        {
          paymentId: "payment-new",
          orderId: "order-1",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 300,
          settlesTarget: false,
        },
      ],
    });
    // The cache refresh writes orders in ascending id order regardless of the allocation order
    // submitted, which is what keeps two concurrent multi-order payments from deadlocking.
    expect(tx.order.update).toHaveBeenNthCalledWith(1, {
      where: { id: "order-1" },
      data: { allocatedAmountMinor: 300 },
    });
    expect(tx.order.update).toHaveBeenNthCalledWith(2, {
      where: { id: "order-2" },
      data: { allocatedAmountMinor: 500 },
    });
  });

  it("accepts a payment declared against nothing (a cuenta), touching no order", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 1000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });

    expect(result).toMatchObject({ ok: true, affectedOrders: [] });
    expect(tx.paymentAllocation.createMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("rejects AMOUNT_INVALID before touching the store", async () => {
    const tx = makeCreateStorePaymentTx();
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 0,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });

    expect(result).toEqual({ ok: false, error: "AMOUNT_INVALID" });
    expect(tx.store.findFirst).not.toHaveBeenCalled();
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects AMOUNT_FRACTIONAL_SUBUNITS on a zero-decimal currency", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 4300050,
      paymentDate: PAYMENT_DATE,
      currencyCode: "CLP",
    });

    expect(result).toEqual({ ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("accepts a whole major amount on a zero-decimal currency", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 4300000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "CLP",
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects STORE_NOT_FOUND", async () => {
    const tx = makeCreateStorePaymentTx({ storeExists: false });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });

    expect(result).toEqual({ ok: false, error: "STORE_NOT_FOUND" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects CURRENCY_REQUIRED when no currency is given and the store spans several", async () => {
    const tx = makeCreateStorePaymentTx({ inheritedCurrencyRows: [{ currencyCode: "PEN" }, { currencyCode: "USD" }] });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
    });

    expect(result).toEqual({ ok: false, error: "CURRENCY_REQUIRED" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("resolves the inherited currency when the store's standing orders agree on one", async () => {
    const tx = makeCreateStorePaymentTx({
      inheritedCurrencyRows: [{ currencyCode: "PEN" }],
      debtByCurrency: { PEN: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
    });

    expect(result).toMatchObject({ ok: true, currencyCode: "PEN" });
  });

  it("rejects STORE_DEBT_EXCEEDED using the debt for that currency only, mixing PEN and USD", async () => {
    const tx = makeCreateStorePaymentTx({
      debtByCurrency: {
        PEN: { committedMinor: 1000, paidMinor: 1000 }, // debt = 0
        USD: { committedMinor: 5000, paidMinor: 0 }, // debt = 5000
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const rejected = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "PEN",
    });
    expect(rejected).toEqual({ ok: false, error: "STORE_DEBT_EXCEEDED" });

    const accepted = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 3000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });
    expect(accepted).toMatchObject({ ok: true, currencyCode: "USD" });
  });

  it("rejects ALLOCATION_SUM_EXCEEDS_PAYMENT before validating any allocation", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 150 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_SUM_EXCEEDS_PAYMENT" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects ORDER_NOT_FOUND for an allocation naming an order that doesn't exist", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "missing-order", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_FOUND", orderId: "missing-order" });
  });

  it("rejects STORE_MISMATCH when the allocated order belongs to a different store", async () => {
    const order = makeFixtureOrder({ id: "order-1", storeId: "other-store" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "STORE_MISMATCH", orderId: "order-1" });
  });

  it("rejects ORDER_CANCELLED", async () => {
    const order = makeFixtureOrder({ id: "order-1", status: OrderStatus.CANCELLED });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "ORDER_CANCELLED", orderId: "order-1" });
  });

  it("rejects CURRENCY_MISMATCH between the payment and the allocated order", async () => {
    const order = makeFixtureOrder({ id: "order-1", currencyCode: "PEN" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "CURRENCY_MISMATCH", orderId: "order-1" });
  });

  it("rejects DATE_BEFORE_ORDER when the payment predates the order it is allocated to", async () => {
    const order = makeFixtureOrder({ id: "order-1", orderDate: new Date("2020-07-01T00:00:00Z") });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE, // 2020-06-01, before the order
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "DATE_BEFORE_ORDER", orderId: "order-1" });
  });

  it("rejects ALLOCATION_AMOUNT_INVALID for a negative allocation", async () => {
    const order = makeFixtureOrder({ id: "order-1" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: -100 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_AMOUNT_INVALID", orderId: "order-1" });
  });

  it("requires settlesTarget on a zero-amount allocation, rejecting it without one", async () => {
    const order = makeFixtureOrder({ id: "order-1" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 0 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_AMOUNT_INVALID", orderId: "order-1" });
  });

  it("accepts a zero-amount allocation when it declares settlesTarget", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 10000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 10000 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 10000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 0, settlesTarget: true }],
    });

    expect(result).toMatchObject({ ok: true });
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ orderId: "order-1", amountMinor: 0, settlesTarget: true })],
    });
  });

  it("rejects EXCEEDS_BALANCE when the allocation would push the order past its total", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 1000, allocatedAmountMinor: 900 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 200,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 200 }],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
  });

  it("rejects ITEM_ORDER_MISMATCH when the item does not belong to the allocated order", async () => {
    const order = makeFixtureOrder({ id: "order-1", items: [{ id: "item-1", unitPrice: 500, quantity: 1 }] });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", orderItemId: "item-does-not-belong", amountMinor: 100 }],
    });

    expect(result).toEqual({
      ok: false,
      error: "ITEM_ORDER_MISMATCH",
      orderId: "order-1",
      orderItemId: "item-does-not-belong",
    });
  });

  it("rejects EXCEEDS_ITEM_BASE when the item already has its own price fully declared", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 5000,
      allocatedAmountMinor: 800,
      items: [
        { id: "item-1", unitPrice: 1000, quantity: 1 },
        { id: "item-2", unitPrice: 4000, quantity: 1 },
      ],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
      allocatedByItemId: { "item-1": 800 },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 300,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", orderItemId: "item-1", amountMinor: 300 }],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_ITEM_BASE", orderId: "order-1", orderItemId: "item-1" });
  });
});

describe("deleteStorePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeDeleteTx(
    overrides: {
      payment?: { id: string; allocations: Array<{ orderId: string }> } | null;
      cacheAfterDeleteByOrderId?: Record<string, number>;
    } = {},
  ) {
    const { payment = { id: "payment-1", allocations: [{ orderId: "order-1" }] }, cacheAfterDeleteByOrderId = {} } =
      overrides;
    return {
      storePayment: {
        findFirst: vi.fn().mockResolvedValue(payment),
        delete: vi.fn().mockResolvedValue({}),
      },
      order: {
        update: vi.fn().mockResolvedValue({}),
      },
      paymentAllocation: {
        groupBy: vi.fn().mockResolvedValue(
          Object.entries(cacheAfterDeleteByOrderId).map(([orderId, sum]) => ({
            orderId,
            _sum: { amountMinor: sum },
          })),
        ),
      },
    };
  }

  it("returns NOT_FOUND without deleting anything when the payment doesn't belong to the user", async () => {
    const tx = makeDeleteTx({ payment: null });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteStorePayment("payment-1", "user-1");

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
  });

  it("deletes the payment and recalculates every order it was declared against", async () => {
    const tx = makeDeleteTx({
      payment: { id: "payment-1", allocations: [{ orderId: "order-2" }, { orderId: "order-1" }] },
      cacheAfterDeleteByOrderId: { "order-1": 0, "order-2": 0 },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteStorePayment("payment-1", "user-1");

    expect(result).toEqual({ ok: true, affectedOrderIds: ["order-2", "order-1"] });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(tx.order.update).toHaveBeenCalledTimes(2);
  });

  it("deletes an unallocated (a cuenta) payment without touching any order", async () => {
    const tx = makeDeleteTx({ payment: { id: "payment-1", allocations: [] } });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteStorePayment("payment-1", "user-1");

    expect(result).toEqual({ ok: true, affectedOrderIds: [] });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(tx.paymentAllocation.groupBy).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});
