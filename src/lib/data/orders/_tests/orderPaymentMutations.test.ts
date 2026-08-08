import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "../../../../../generated/prisma/client";
import { addOrderPayment, deleteOrderPayment } from "../orderPaymentMutations";
import { makeCreateStorePaymentTx, makeFixtureOrder, runStorePaymentTx } from "./storePaymentFixtures";

const PAYMENT_DATE = new Date("2020-06-01T00:00:00Z");

const params = { orderId: "order-1", userId: "user-1", amount: 1000, paymentDate: PAYMENT_DATE };

/**
 * `addOrderPayment` reads the order once, outside any transaction, to shape the input it hands to
 * `createStorePayment` (store id, currency, whether it's a single-item order). That read has to be
 * mocked on the top-level `prisma` object; everything `createStorePayment` itself does happens
 * inside the `tx` handed to the transaction callback, built with the shared store-payment fixture.
 */
function setUpOrder(overrides: { currencyCode?: string; itemId?: string | null } = {}): void {
  const { currencyCode = "USD", itemId = null } = overrides;
  prismaMock.order.findFirst.mockResolvedValue({
    storeId: "store-1",
    currencyCode,
    exchangeRate: null,
    exchangeRateBaseCode: null,
    items: itemId ? [{ id: itemId }] : [],
  });
}

describe("addOrderPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the underlying store payment at Serializable isolation", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 1000 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 1000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    await addOrderPayment(params);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    );
  });

  it("returns the fresh payment summary read back from the order's own allocation cache", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 3000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 3000 } },
      cacheAfterWriteByOrderId: { "order-1": 4000 },
      snapshotsByOrderId: {
        "order-1": {
          totalCost: 10000,
          allocatedAmountMinor: 4000,
        },
      },
      paymentRecordsByOrderId: {
        "order-1": [
          {
            id: "alloc-1",
            amountMinor: 4000,
            payment: { id: "payment-new", amount: 1000, paymentDate: PAYMENT_DATE, _count: { allocations: 1 } },
          },
        ],
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment(params);

    expect(result).toMatchObject({ ok: true, paidAmount: 4000, remainingAmount: 6000, paymentPercentage: 40 });
  });

  it("rejects a payment that exceeds the remaining balance without creating it", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 8000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 8000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment({ ...params, amount: 5000 });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects a fractional amount on a zero-decimal currency without creating it", async () => {
    // 43000.50 CLP would scale to 4300050 minor units — not a whole major amount for a currency
    // with no subunit, so the server guard must refuse it even though it fits the balance.
    setUpOrder({ currencyCode: "CLP" });
    const order = makeFixtureOrder({ id: "order-1", currencyCode: "CLP", totalCost: 5000000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment({ ...params, amount: 4300050 });

    expect(result).toEqual({ ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("accepts a whole major amount on a zero-decimal currency", async () => {
    setUpOrder({ currencyCode: "CLP" });
    const order = makeFixtureOrder({ id: "order-1", currencyCode: "CLP", totalCost: 5000000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 4300000 },
      snapshotsByOrderId: { "order-1": { totalCost: 5000000, allocatedAmountMinor: 4300000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment({ ...params, amount: 4300000 });

    expect(result).toMatchObject({ ok: true });
    expect(tx.storePayment.create).toHaveBeenCalled();
  });

  it("declares the allocation against the order's single item", async () => {
    setUpOrder({ itemId: "item-1" });
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 10000,
      items: [{ id: "item-1", unitPrice: null, quantity: 1 }],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 1000 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 1000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    await addOrderPayment(params);

    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ orderId: "order-1", orderItemId: "item-1", amountMinor: 1000 })],
    });
  });

  it("retries once and succeeds when the first attempt hits a serialization failure (P2034)", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 1000 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 1000 } },
    });
    const serializationError = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    let calls = 0;
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => {
      calls += 1;
      if (calls === 1) throw serializationError;
      return cb(tx);
    });

    const result = await addOrderPayment(params);

    expect(calls).toBe(2);
    expect(result).toMatchObject({ ok: true });
  });

  it("gives up and rethrows after exhausting the serialization retries", async () => {
    setUpOrder();
    const serializationError = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    prismaMock.$transaction.mockRejectedValue(serializationError);

    await expect(addOrderPayment(params)).rejects.toBe(serializationError);
    // Initial attempt plus the bounded retries.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(4);
  });

  it("does not retry on a non-serialization error", async () => {
    setUpOrder();
    const otherError = new Error("boom");
    prismaMock.$transaction.mockRejectedValue(otherError);

    await expect(addOrderPayment(params)).rejects.toBe(otherError);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns ORDER_NOT_FOUND when the order does not belong to the user", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const result = await addOrderPayment(params);

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_FOUND" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("deleteOrderPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeDeleteTx(
    overrides: {
      allocation?: {
        id: string;
        amountMinor: number;
        payment: { id: string; amount: number; _count: { allocations: number } };
      } | null;
      order?: { totalCost: number } | null;
      cacheAfterDeleteByOrderId?: Record<string, number>;
      remainingPayments?: unknown[];
    } = {},
  ) {
    const {
      allocation = {
        id: "alloc-1",
        amountMinor: 1000,
        payment: { id: "payment-1", amount: 1000, _count: { allocations: 1 } },
      },
      order = { totalCost: 10000 },
      cacheAfterDeleteByOrderId = { "order-1": 0 },
      remainingPayments = [],
    } = overrides;
    return {
      paymentAllocation: {
        findFirst: vi.fn().mockResolvedValue(allocation),
        delete: vi.fn().mockResolvedValue({}),
        groupBy: vi.fn().mockResolvedValue(
          Object.entries(cacheAfterDeleteByOrderId).map(([orderId, sum]) => ({
            orderId,
            _sum: { amountMinor: sum },
          })),
        ),
        findMany: vi.fn().mockResolvedValue(remainingPayments),
      },
      order: {
        findFirst: vi.fn().mockResolvedValue(order),
        update: vi.fn().mockResolvedValue({}),
      },
      storePayment: {
        delete: vi.fn().mockResolvedValue({}),
      },
    };
  }

  it("returns NOT_FOUND when the allocation does not exist for this order/user", async () => {
    const tx = makeDeleteTx({ allocation: null });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ allocationId: "alloc-1", orderId: "order-1", userId: "user-1" });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.delete).not.toHaveBeenCalled();
  });

  it("deletes the whole payment when it was born 1:1 for this order (sole claim, full amount)", async () => {
    const tx = makeDeleteTx({
      allocation: {
        id: "alloc-1",
        amountMinor: 1000,
        payment: { id: "payment-1", amount: 1000, _count: { allocations: 1 } },
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ allocationId: "alloc-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: true });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(tx.paymentAllocation.delete).not.toHaveBeenCalled();
  });

  it("removes only this order's declaration when the payment is shared with other orders", async () => {
    const tx = makeDeleteTx({
      allocation: {
        id: "alloc-1",
        amountMinor: 400,
        payment: { id: "payment-1", amount: 1000, _count: { allocations: 2 } },
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ allocationId: "alloc-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: false });
    expect(tx.paymentAllocation.delete).toHaveBeenCalledWith({ where: { id: "alloc-1" } });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
  });

  it("treats a full-amount allocation on an otherwise-shared payment as shared, not 1:1", async () => {
    // Same amount as the payment, but the payment has more than one declaration: it is still
    // sharing the payment with something else, so only the declaration should go.
    const tx = makeDeleteTx({
      allocation: {
        id: "alloc-1",
        amountMinor: 1000,
        payment: { id: "payment-1", amount: 1000, _count: { allocations: 2 } },
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ allocationId: "alloc-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: false });
    expect(tx.paymentAllocation.delete).toHaveBeenCalledWith({ where: { id: "alloc-1" } });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
  });
});
