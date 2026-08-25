import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { createOrder, editOrder } from "../orderMutations";
import { replaceOrderItems } from "../orderItemMutations";
import { DeliveryStatus, OrderStatus, type Prisma } from "../../../../../generated/prisma/client";
import type { OrderCreateInput, OrderEditInput } from "@/lib/orders/orderValidation";

/**
 * These tests cover one class of data-integrity bug: a refusal returned from inside a
 * `prisma.$transaction` callback after a write has already happened. Returning normally from that
 * callback COMMITS the transaction, so such a refusal persists the write while reporting failure to
 * the caller; only a thrown error rolls it back.
 *
 * WHAT THE MOCK GUARANTEES: `runInTx` below is not a database. It cannot prove that Postgres
 * discarded anything, so "rolled back" is asserted through the two mechanisms that actually produce
 * a rollback, both of which are observable here:
 *
 *   1. NO WRITE WAS ISSUED. Every write method on the fake client is a spy, so asserting that all of
 *      them are un-called on the failure path proves the refusal is decided before the first write.
 *      With nothing written, commit-versus-rollback is not a distinction the database can make, and
 *      the assertion holds whatever the engine does.
 *   2. THE CALLBACK REJECTED. `runInTx` records whether the callback threw, which is exactly the
 *      signal Prisma turns into a `ROLLBACK`. A recorded rejection therefore stands in for the
 *      rollback of writes that had already been issued.
 *
 * Each failing case below asserts which of the two mechanisms protects it. What the mock does NOT
 * cover is the engine's own commit/rollback behaviour (that is Prisma's contract, not this code's)
 * nor the outcome under concurrency.
 */
type FakeTx = {
  store: { findFirst: ReturnType<typeof vi.fn> };
  storeProductType: { findMany: ReturnType<typeof vi.fn> };
  order: {
    findFirst: ReturnType<typeof vi.fn>;
    /** Read-only: `generateOrderHumanReadableId` derives the next daily sequence, it reserves nothing. */
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  orderItem: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  orderHistory: { create: ReturnType<typeof vi.fn> };
  paymentAllocation: {
    findFirst: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  deliveryOrderItem: { findFirst: ReturnType<typeof vi.fn> };
  storeAccountAdjustmentLine: {
    findFirst: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeFakeTx(): FakeTx {
  return {
    store: { findFirst: vi.fn().mockResolvedValue({ id: "store-1" }) },
    // Empty catalog by default: every referenced productTypeKey resolves as invalid.
    storeProductType: { findMany: vi.fn().mockResolvedValue([]) },
    order: {
      findFirst: vi.fn().mockResolvedValue({ status: OrderStatus.OPEN, storeId: "store-1" }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "order-1", humanReadableId: "ORD-20260729-01" }),
      update: vi.fn().mockResolvedValue({}),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: "item-1" }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    orderHistory: { create: vi.fn().mockResolvedValue({}) },
    paymentAllocation: {
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    deliveryOrderItem: { findFirst: vi.fn().mockResolvedValue(null) },
    storeAccountAdjustmentLine: {
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: null }) },
  };
}

function asTransactionClient(tx: FakeTx): Prisma.TransactionClient {
  return tx as unknown as Prisma.TransactionClient;
}

/** Records whether the callback rejected, which is the signal Prisma turns into a `ROLLBACK`. */
function runInTx(tx: FakeTx): { callbackRejected: () => boolean } {
  let rejected = false;
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => {
    try {
      return await cb(tx);
    } catch (error) {
      rejected = true;
      throw error;
    }
  });
  return { callbackRejected: () => rejected };
}

function expectNoWrites(tx: FakeTx): void {
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.order.update).not.toHaveBeenCalled();
  expect(tx.orderItem.createMany).not.toHaveBeenCalled();
  expect(tx.orderItem.create).not.toHaveBeenCalled();
  expect(tx.orderItem.update).not.toHaveBeenCalled();
  expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  expect(tx.orderHistory.create).not.toHaveBeenCalled();
}

const createInput: OrderCreateInput = {
  storeId: "store-1",
  orderDate: new Date("2026-07-29T00:00:00.000Z"),
  currencyCode: "PEN",
  totalCost: 10000,
  items: [{ name: "Gojo figure", quantity: 1, position: 1, productTypeKey: "not-in-catalog" }],
};

const editInput: OrderEditInput = {
  totalCost: 20000,
  note: "edited",
  items: [{ name: "Gojo figure", quantity: 1, position: 1, productTypeKey: "not-in-catalog" }],
};

describe("createOrder transaction integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses an invalid category without creating the order row (no phantom order)", async () => {
    const tx = makeFakeTx();
    const transaction = runInTx(tx);

    const result = await createOrder("user-1", createInput);

    expect(result).toEqual({ ok: false, error: "INVALID_PRODUCT_TYPE" });
    // Mechanism 1: the order row is never inserted, so there is nothing a commit could keep. Before
    // the fix, `order.create` ran first and this refusal committed a phantom order with no items and
    // no history entry, visible in the collector's list while the UI reported a failure.
    expectNoWrites(tx);
    // No rollback is needed on this path, so the callback is expected to return, not throw.
    expect(transaction.callbackRejected()).toBe(false);
  });

  it("checks the category catalog before the order row is created", async () => {
    const tx = makeFakeTx();
    tx.storeProductType.findMany.mockResolvedValue([{ key: "not-in-catalog" }]);
    runInTx(tx);

    const result = await createOrder("user-1", createInput);

    expect(result).toEqual({
      ok: true,
      orderId: "order-1",
      humanReadableId: "ORD-20260729-01",
      // The fake store carries no eligibility fields, so it reads as not credit-eligible and there
      // is nothing to defer either (`FR-12-05`).
      progression: { pointsDelta: 0, rankUp: null, medalsUnlocked: [], deferredOrderPoints: null },
    });
    const validationCall = tx.storeProductType.findMany.mock.invocationCallOrder[0];
    const createCall = tx.order.create.mock.invocationCallOrder[0];
    expect(validationCall).toBeLessThan(createCall);
  });

  it("still refuses STORE_NOT_FOUND before any write", async () => {
    const tx = makeFakeTx();
    tx.store.findFirst.mockResolvedValue(null);
    runInTx(tx);

    const result = await createOrder("user-1", createInput);

    expect(result).toEqual({ ok: false, error: "STORE_NOT_FOUND" });
    expectNoWrites(tx);
  });
});

describe("editOrder transaction integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses an invalid category without updating the order row", async () => {
    const tx = makeFakeTx();
    const transaction = runInTx(tx);

    const result = await editOrder("order-1", "user-1", editInput);

    expect(result).toEqual({ ok: false, error: "INVALID_PRODUCT_TYPE" });
    // Mechanism 1. Before the fix, `order.update` had already written the new total and note, so the
    // refusal committed an edit the caller was told had failed.
    expectNoWrites(tx);
    expect(transaction.callbackRejected()).toBe(false);
  });

  it("refuses a removed product that is in a live delivery without updating the order row", async () => {
    const tx = makeFakeTx();
    tx.storeProductType.findMany.mockResolvedValue([{ key: "not-in-catalog" }]);
    // One existing product is absent from the submitted list, so the replace would delete it...
    tx.orderItem.findMany.mockResolvedValue([{ id: "existing-item", paidDeclaredAt: null }]);
    // ...but it is linked to a live delivery, which blocks the whole edit.
    tx.deliveryOrderItem.findFirst.mockResolvedValue({ deliveryId: "dlv-1", orderItemId: "existing-item" });
    const transaction = runInTx(tx);

    const result = await editOrder("order-1", "user-1", editInput);

    expect(result).toEqual({ ok: false, error: "ITEM_HAS_LIVE_DELIVERY" });
    expectNoWrites(tx);
    expect(transaction.callbackRejected()).toBe(false);
  });

  it("replaces the products before touching the order row on the success path", async () => {
    const tx = makeFakeTx();
    tx.storeProductType.findMany.mockResolvedValue([{ key: "not-in-catalog" }]);
    runInTx(tx);

    const result = await editOrder("order-1", "user-1", editInput);

    expect(result).toEqual({ ok: true });
    const itemWrite = tx.orderItem.create.mock.invocationCallOrder[0];
    const orderWrite = tx.order.update.mock.invocationCallOrder[0];
    // Ordering is the fix: every refusal is decided while the order row is still untouched.
    expect(itemWrite).toBeLessThan(orderWrite);
  });
});

describe("replaceOrderItems transaction integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses an invalid category before deleting the products it would have removed", async () => {
    const tx = makeFakeTx();
    // An existing product absent from the submitted list would be deleted by the replace.
    tx.orderItem.findMany.mockResolvedValue([{ id: "existing-item", paidDeclaredAt: null }]);

    const result = await replaceOrderItems(asTransactionClient(tx), "order-1", "user-1", [
      { name: "Gojo figure", quantity: 1, position: 1, productTypeKey: "not-in-catalog" },
    ]);

    expect(result).toEqual({ ok: false, error: "INVALID_PRODUCT_TYPE", detail: "not-in-catalog" });
    // Mechanism 1. Before the fix the deleteMany ran first, so refusing here destroyed the removed
    // products for good: the caller's `{ ok: false }` return committed the deletion.
    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.orderItem.create).not.toHaveBeenCalled();
    expect(tx.orderItem.update).not.toHaveBeenCalled();
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the live-delivery guard ahead of the delete too", async () => {
    const tx = makeFakeTx();
    tx.storeProductType.findMany.mockResolvedValue([{ key: "known" }]);
    tx.orderItem.findMany.mockResolvedValue([{ id: "existing-item", paidDeclaredAt: null }]);
    tx.deliveryOrderItem.findFirst.mockResolvedValue({ deliveryId: "dlv-1", orderItemId: "existing-item" });

    const result = await replaceOrderItems(asTransactionClient(tx), "order-1", "user-1", [
      { name: "Gojo figure", quantity: 1, position: 1, productTypeKey: "known" },
    ]);

    expect(result).toEqual({ ok: false, error: "ITEM_HAS_LIVE_DELIVERY", detail: "dlv-1" });
    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.deliveryOrderItem.findFirst).toHaveBeenCalledWith({
      where: {
        orderItemId: { in: ["existing-item"] },
        delivery: { status: { not: DeliveryStatus.CANCELLED } },
      },
      select: { deliveryId: true, orderItemId: true },
    });
  });
});
