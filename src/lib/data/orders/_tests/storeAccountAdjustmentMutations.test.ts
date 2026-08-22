import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import { createStoreAccountAdjustment, deleteStoreAccountAdjustment } from "../storeAccountAdjustmentMutations";
import {
  makeCreateStoreAccountAdjustmentTx,
  makeDeleteStoreAccountAdjustmentTx,
  makeFixtureOrder,
  runStoreAccountAdjustmentTx,
} from "./storeAccountAdjustmentFixtures";

const BASE_INPUT = { userId: "user-1", storeId: "store-1", currencyCode: "PEN", reason: "no identificado" };

describe("createStoreAccountAdjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes one line for a whole balance write-off", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 10000 }],
    });

    expect(result).toEqual({ ok: true, adjustmentId: "adjustment-new" });
    expect(tx.storeAccountAdjustment.create).toHaveBeenCalledWith({
      data: {
        storeId: "store-1",
        userId: "user-1",
        currencyCode: "PEN",
        adjustmentDate: expect.any(Date),
        reason: "no identificado",
      },
      select: { id: true },
    });
    expect(tx.storeAccountAdjustmentLine.createMany).toHaveBeenCalledWith({
      data: [{ adjustmentId: "adjustment-new", orderId: "order-1", userId: "user-1", amountMinor: 10000 }],
    });
  });

  it("writes a partial write-off and never touches the order's allocation cache", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 6000 }],
    });

    expect(result).toEqual({ ok: true, adjustmentId: "adjustment-new" });
    expect(tx.storeAccountAdjustmentLine.createMany).toHaveBeenCalledWith({
      data: [{ adjustmentId: "adjustment-new", orderId: "order-1", userId: "user-1", amountMinor: 6000 }],
    });
  });

  it("names only the order a line was declared against, leaving a sibling order untouched", async () => {
    const orderA = makeFixtureOrder({ id: "order-a", totalCost: 18000, allocatedAmountMinor: 0 });
    const orderB = makeFixtureOrder({ id: "order-b", totalCost: 20000, allocatedAmountMinor: 0 });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [orderA, orderB] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-a", amountMinor: 18000 }],
    });

    expect(result).toEqual({ ok: true, adjustmentId: "adjustment-new" });
    expect(tx.storeAccountAdjustmentLine.createMany).toHaveBeenCalledWith({
      data: [{ adjustmentId: "adjustment-new", orderId: "order-a", userId: "user-1", amountMinor: 18000 }],
    });
  });

  it("accepts a line against a COMPLETED order carrying a residue (the back-catalogue case)", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      status: OrderStatus.COMPLETED,
      totalCost: 20000,
      allocatedAmountMinor: 0,
    });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 20000 }],
    });

    expect(result).toEqual({ ok: true, adjustmentId: "adjustment-new" });
  });

  it("accepts a mixed declaration naming one open and one delivered order in a single adjustment", async () => {
    const openOrder = makeFixtureOrder({
      id: "order-open",
      status: OrderStatus.OPEN,
      totalCost: 5000,
      allocatedAmountMinor: 0,
    });
    const deliveredOrder = makeFixtureOrder({
      id: "order-delivered",
      status: OrderStatus.COMPLETED,
      totalCost: 7000,
      allocatedAmountMinor: 0,
    });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [openOrder, deliveredOrder] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [
        { orderId: "order-open", amountMinor: 5000 },
        { orderId: "order-delivered", amountMinor: 7000 },
      ],
    });

    expect(result).toEqual({ ok: true, adjustmentId: "adjustment-new" });
    expect(tx.storeAccountAdjustment.create).toHaveBeenCalledTimes(1);
    expect(tx.storeAccountAdjustmentLine.createMany).toHaveBeenCalledWith({
      data: [
        { adjustmentId: "adjustment-new", orderId: "order-open", userId: "user-1", amountMinor: 5000 },
        { adjustmentId: "adjustment-new", orderId: "order-delivered", userId: "user-1", amountMinor: 7000 },
      ],
    });
  });

  it("rejects a line against a CANCELLED order, writing nothing", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      status: OrderStatus.CANCELLED,
      totalCost: 10000,
      allocatedAmountMinor: 0,
    });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 5000 }],
    });

    expect(result).toEqual({ ok: false, error: "ORDER_CANCELLED", orderId: "order-1" });
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
  });

  it("rejects an empty declaration with NO_ADJUSTMENT_NEEDED, never spreading it across the store's orders", async () => {
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [makeFixtureOrder()] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({ ...BASE_INPUT, lines: [] });

    expect(result).toEqual({ ok: false, error: "NO_ADJUSTMENT_NEEDED" });
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
  });

  it("rejects a line of 0 with AMOUNT_INVALID", async () => {
    const order = makeFixtureOrder({ id: "order-1" });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 0 }],
    });

    expect(result).toEqual({ ok: false, error: "AMOUNT_INVALID" });
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
  });

  it("rejects a line larger than its own order's openBalanceMinor, writing nothing, including the valid line", async () => {
    const orderA = makeFixtureOrder({ id: "order-a", totalCost: 5000, allocatedAmountMinor: 0 });
    const orderB = makeFixtureOrder({ id: "order-b", totalCost: 7000, allocatedAmountMinor: 0 });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [orderA, orderB] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [
        { orderId: "order-a", amountMinor: 5000 }, // valid on its own
        { orderId: "order-b", amountMinor: 8000 }, // exceeds order-b's balance of 7000
      ],
    });

    expect(result).toEqual({ ok: false, error: "ADJUSTMENT_EXCEEDS_ORDER_BALANCE", orderId: "order-b" });
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
    expect(tx.storeAccountAdjustmentLine.createMany).not.toHaveBeenCalled();
  });

  it("bounds a new line by the order's balance net of an earlier declaration's line", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    // An earlier adjustment already wrote off 4000, so the open balance is 6000, not 10000.
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order], writtenOffByOrderId: { "order-1": 4000 } });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const tooMuch = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 6001 }],
    });
    expect(tooMuch).toEqual({ ok: false, error: "ADJUSTMENT_EXCEEDS_ORDER_BALANCE", orderId: "order-1" });

    vi.clearAllMocks();
    const tx2 = makeCreateStoreAccountAdjustmentTx({ orders: [order], writtenOffByOrderId: { "order-1": 4000 } });
    runStoreAccountAdjustmentTx(prismaMock, tx2);
    const exact = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 6000 }],
    });
    expect(exact).toEqual({ ok: true, adjustmentId: "adjustment-new" });
  });

  it("rejects a line against an order of another store, another currency, or another user with NOT_FOUND", async () => {
    const foreignStoreOrder = makeFixtureOrder({ id: "order-1", storeId: "some-other-store" });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [foreignStoreOrder] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
  });

  it("rejects the same order named by two lines with DUPLICATE_ORDER_LINE", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000 });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [
        { orderId: "order-1", amountMinor: 4000 },
        { orderId: "order-1", amountMinor: 4000 },
      ],
    });

    expect(result).toEqual({ ok: false, error: "DUPLICATE_ORDER_LINE" });
    expect(tx.order.findMany).not.toHaveBeenCalled();
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
  });

  it("rejects an empty or whitespace-only reason with REASON_REQUIRED", async () => {
    const order = makeFixtureOrder({ id: "order-1" });
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      userId: "user-1",
      storeId: "store-1",
      currencyCode: "PEN",
      reason: "   ",
      lines: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "REASON_REQUIRED" });
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
  });

  it("ignores any client-supplied adjustmentDate and resolves the collector's own civil day, not a wall-clock instant (FIX 2)", async () => {
    // 01:30 UTC is still 20:30 the PREVIOUS day in Lima (UTC-5). A wall-clock `new Date()` would
    // store 2026-08-21; the collector's own calendar says 2026-08-20, and BR-05-29's "never
    // rewrites the past" is a promise about THAT day, not the server's.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T01:30:00.000Z"));
    try {
      const order = makeFixtureOrder({ id: "order-1", totalCost: 10000 });
      const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order], userTimezone: "America/Lima" });
      runStoreAccountAdjustmentTx(prismaMock, tx);

      // Casts past the type system on purpose: `CreateStoreAccountAdjustmentInput` carries no
      // `adjustmentDate` field, so this proves a loosely-typed caller (a Server Action that spreads
      // a client-parsed object) still cannot backdate the write.
      const smuggledInput = {
        ...BASE_INPUT,
        lines: [{ orderId: "order-1", amountMinor: 100 }],
        adjustmentDate: new Date("2020-01-01T00:00:00.000Z"),
      };

      const result = await createStoreAccountAdjustment(
        smuggledInput as Parameters<typeof createStoreAccountAdjustment>[0],
      );

      expect(result).toEqual({ ok: true, adjustmentId: "adjustment-new" });
      expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" }, select: { timezone: true } });
      expect(tx.storeAccountAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ adjustmentDate: new Date("2026-08-20T00:00:00.000Z") }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when the store belongs to another user (or does not exist) with NOT_FOUND", async () => {
    const tx = makeCreateStoreAccountAdjustmentTx({ storeExists: false });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });

  it("rejects a currency outside the allowed set with CURRENCY_INVALID", async () => {
    const tx = makeCreateStoreAccountAdjustmentTx({ orders: [makeFixtureOrder()] });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      userId: "user-1",
      storeId: "store-1",
      currencyCode: "ZZZ",
      reason: "no identificado",
      lines: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "CURRENCY_INVALID" });
  });

  it("rejects while the store holds parked money in this currency, even though the line is within its own order's ceiling", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 18000, allocatedAmountMinor: 0 });
    const tx = makeCreateStoreAccountAdjustmentTx({
      orders: [order],
      unassignedPayments: [{ id: "payment-1", amount: 3000, paymentDate: new Date("2020-01-01") }],
    });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 18000 }],
    });

    expect(result).toEqual({ ok: false, error: "STORE_HAS_UNASSIGNED_MONEY" });
    expect(tx.order.findMany).not.toHaveBeenCalled();
    expect(tx.storeAccountAdjustment.create).not.toHaveBeenCalled();
  });

  it("accepts when the parked money belongs to another currency of the same store", async () => {
    const order = makeFixtureOrder({ id: "order-1", currencyCode: "PEN", totalCost: 18000, allocatedAmountMinor: 0 });
    const tx = makeCreateStoreAccountAdjustmentTx({
      orders: [order],
      scopeCurrencyCode: "PEN",
      // storePayment.findMany is queried scoped to PEN by the mutation; the fixture only ever
      // returns `unassignedPayments` regardless of the requested currency, which models a store
      // whose USD pool is invisible to a PEN reconciliation (the real query's own `currencyCode`
      // filter is what the production code relies on; here the fixture simply holds no PEN rows).
      unassignedPayments: [],
    });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 18000 }],
    });

    expect(result).toEqual({ ok: true, adjustmentId: "adjustment-new" });
    // The real assertion this test exists for: the fixture's `storePayment.findMany` answers every
    // currency alike, so without this the test would pass even if the mutation read the WRONG
    // currency's pool (or none at all). Pinning the call's own `where.currencyCode` is what makes
    // "another currency of the same store" a claim about the query, not just about its stub.
    expect(tx.storePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ currencyCode: "PEN" }) }),
    );
  });

  it("accepts a retried declaration once the parked money has been assigned", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 18000, allocatedAmountMinor: 0 });

    const firstAttemptTx = makeCreateStoreAccountAdjustmentTx({
      orders: [order],
      unassignedPayments: [{ id: "payment-1", amount: 3000, paymentDate: new Date("2020-01-01") }],
    });
    runStoreAccountAdjustmentTx(prismaMock, firstAttemptTx);
    const firstAttempt = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 18000 }],
    });
    expect(firstAttempt).toEqual({ ok: false, error: "STORE_HAS_UNASSIGNED_MONEY" });

    // The same 3000 is now fully allocated against a (different) order, so the pool reads 0.
    const retryTx = makeCreateStoreAccountAdjustmentTx({
      orders: [order],
      unassignedPayments: [{ id: "payment-1", amount: 3000, paymentDate: new Date("2020-01-01") }],
      allocatedByPaymentId: { "payment-1": 3000 },
    });
    runStoreAccountAdjustmentTx(prismaMock, retryTx);
    const retry = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 18000 }],
    });
    expect(retry).toEqual({ ok: true, adjustmentId: "adjustment-new" });
  });

  it("rejects reconciliation immediately after a default `credit` cancel parks the freed payment, then accepts once re-declared", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 18000, allocatedAmountMinor: 0 });

    const afterCancelTx = makeCreateStoreAccountAdjustmentTx({
      orders: [order],
      // `credit` deleted the cancelled order's allocations and left its StorePayment parked.
      unassignedPayments: [{ id: "freed-payment", amount: 5000, paymentDate: new Date("2020-01-01") }],
    });
    runStoreAccountAdjustmentTx(prismaMock, afterCancelTx);
    const afterCancel = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 18000 }],
    });
    expect(afterCancel).toEqual({ ok: false, error: "STORE_HAS_UNASSIGNED_MONEY" });

    const afterReassignmentTx = makeCreateStoreAccountAdjustmentTx({
      orders: [order],
      unassignedPayments: [{ id: "freed-payment", amount: 5000, paymentDate: new Date("2020-01-01") }],
      allocatedByPaymentId: { "freed-payment": 5000 },
    });
    runStoreAccountAdjustmentTx(prismaMock, afterReassignmentTx);
    const afterReassignment = await createStoreAccountAdjustment({
      ...BASE_INPUT,
      lines: [{ orderId: "order-1", amountMinor: 18000 }],
    });
    expect(afterReassignment).toEqual({ ok: true, adjustmentId: "adjustment-new" });
  });

  describe("Dashboard isolation (regression guard)", () => {
    it("never calls a PaymentAllocation or StorePayment write method", async () => {
      const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
      const tx = makeCreateStoreAccountAdjustmentTx({ orders: [order] });
      runStoreAccountAdjustmentTx(prismaMock, tx);

      const result = await createStoreAccountAdjustment({
        ...BASE_INPUT,
        lines: [{ orderId: "order-1", amountMinor: 10000 }],
      });

      expect(result.ok).toBe(true);
      // Reads of the unassigned pool are legitimate (`storePayment.findMany`,
      // `paymentAllocation.groupBy`); no WRITE on either model is ever issued by this mutation.
      const txAsAny = tx as unknown as Record<string, Record<string, { mock?: { calls: unknown[] } }>>;
      for (const model of ["storePayment", "paymentAllocation"] as const) {
        for (const method of ["create", "createMany", "update", "updateMany", "delete", "deleteMany"] as const) {
          const spy = txAsAny[model]?.[method];
          if (spy?.mock) {
            expect(spy.mock.calls, `${model}.${method} must never be called`).toHaveLength(0);
          }
        }
      }
    });
  });
});

describe("deleteStoreAccountAdjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the header, cascading its lines, touching no StorePayment or PaymentAllocation row", async () => {
    const tx = makeDeleteStoreAccountAdjustmentTx({ existingAdjustment: { id: "adjustment-1" } });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await deleteStoreAccountAdjustment({ userId: "user-1", adjustmentId: "adjustment-1" });

    expect(result).toEqual({ ok: true });
    expect(tx.storeAccountAdjustment.delete).toHaveBeenCalledWith({ where: { id: "adjustment-1" } });
  });

  it("rejects deleting an adjustment belonging to another user with NOT_FOUND, removing nothing", async () => {
    const tx = makeDeleteStoreAccountAdjustmentTx({ existingAdjustment: null });
    runStoreAccountAdjustmentTx(prismaMock, tx);

    const result = await deleteStoreAccountAdjustment({ userId: "user-1", adjustmentId: "adjustment-1" });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tx.storeAccountAdjustment.delete).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
