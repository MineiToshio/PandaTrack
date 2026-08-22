import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The canonical open balance (BR-05-32, ADR 0034 §3.1):
 *
 *   openBalanceMinor = totalCost − allocatedAmountMinor − Σ StoreAccountAdjustmentLine.amountMinor
 *
 * No real database: `db.storeAccountAdjustmentLine.groupBy` is mocked. The two terms other than the
 * line sum (`totalCost`, `allocatedAmountMinor`) come straight from the fixture the caller passes
 * in, so the only thing worth mocking is the one query the module issues.
 */

import {
  declaredAgainstOrderMinor,
  openBalanceMinor,
  openBalanceMinorByOrderId,
  type OrderOpenBalanceInput,
} from "../orderOpenBalance";

/** One row of the `groupBy` result, in the shape Prisma really returns it. */
function lineSumRow(orderId: string, amountMinor: number) {
  return { orderId, _sum: { amountMinor } };
}

/** A mock `Prisma.TransactionClient`, narrowed to the one model this module reads. */
function makeDb(lineRows: ReturnType<typeof lineSumRow>[] = []) {
  return { storeAccountAdjustmentLine: { groupBy: vi.fn().mockResolvedValue(lineRows) } };
}

function order(overrides: Partial<OrderOpenBalanceInput> = {}): OrderOpenBalanceInput {
  return { id: "order-1", totalCost: 180, allocatedAmountMinor: 0, ...overrides };
}

const USER_ID = "user-1";

describe("openBalanceMinor / declaredAgainstOrderMinor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. no allocations, no lines: open equals the full total, declared is zero", async () => {
    const db = makeDb([]);
    const o = order({ totalCost: 180, allocatedAmountMinor: 0 });

    await expect(openBalanceMinor(db as never, USER_ID, o)).resolves.toBe(180);
    await expect(declaredAgainstOrderMinor(db as never, USER_ID, o)).resolves.toBe(0);
  });

  it("2. one adjustment line for the full total: open is zero, declared is the full total", async () => {
    const db = makeDb([lineSumRow("order-1", 180)]);
    const o = order({ totalCost: 180, allocatedAmountMinor: 0 });

    await expect(openBalanceMinor(db as never, USER_ID, o)).resolves.toBe(0);
    await expect(declaredAgainstOrderMinor(db as never, USER_ID, o)).resolves.toBe(180);
  });

  it("3. an allocation of 50 and a line of 100 both subtract: open is 30, all three terms", async () => {
    const db = makeDb([lineSumRow("order-1", 100)]);
    const o = order({ totalCost: 180, allocatedAmountMinor: 50 });

    await expect(openBalanceMinor(db as never, USER_ID, o)).resolves.toBe(30);
    await expect(declaredAgainstOrderMinor(db as never, USER_ID, o)).resolves.toBe(150);
  });

  it("4. a COMPLETED order with a line for the full total still opens at zero: status is not read", async () => {
    const db = makeDb([lineSumRow("order-1", 200)]);
    // The input type carries no `status` field at all. This fixture keeps one anyway, assigned to a
    // variable rather than passed as an inline literal, so TypeScript's excess-property check does
    // not strip it silently: the point is that the function receives it and still ignores it.
    const completedOrder = { id: "order-1", totalCost: 200, allocatedAmountMinor: 0, status: "COMPLETED" };

    await expect(openBalanceMinor(db as never, USER_ID, completedOrder)).resolves.toBe(0);
  });

  it("5. a transaction-client mock and a plain-client mock produce the identical result", async () => {
    const o = order({ totalCost: 180, allocatedAmountMinor: 50 });
    const txClient = makeDb([lineSumRow("order-1", 100)]);
    const plainClient = makeDb([lineSumRow("order-1", 100)]);

    const fromTx = await openBalanceMinor(txClient as never, USER_ID, o);
    const fromPlain = await openBalanceMinor(plainClient as never, USER_ID, o);

    expect(fromTx).toBe(30);
    expect(fromPlain).toBe(30);
    expect(fromTx).toBe(fromPlain);
  });

  it("6. a batch of ten orders matches ten single reads, in exactly one groupBy call", async () => {
    const orders = Array.from({ length: 10 }, (_, index) =>
      order({
        id: `order-${index}`,
        totalCost: 1000 + index * 10,
        allocatedAmountMinor: index * 5,
      }),
    );
    // Every third order carries an adjustment line, so the batch exercises both the present-sum and
    // the absent-sum (defaults to 0) branches within the same call.
    const lineRows = orders.filter((_, index) => index % 3 === 0).map((o, i) => lineSumRow(o.id, 10 + i * 7));

    const batchDb = makeDb(lineRows);
    const batchResult = await openBalanceMinorByOrderId(batchDb as never, USER_ID, orders);

    expect(batchDb.storeAccountAdjustmentLine.groupBy).toHaveBeenCalledTimes(1);

    for (const o of orders) {
      const singleDb = makeDb(lineRows.filter((row) => row.orderId === o.id));
      const singleResult = await openBalanceMinor(singleDb as never, USER_ID, o);
      expect(batchResult.get(o.id)).toBe(singleResult);
    }
  });

  it("7. terms summing past the total return the exact negative figure, never clamped", async () => {
    const db = makeDb([lineSumRow("order-1", 50)]);
    const o = order({ totalCost: 100, allocatedAmountMinor: 80 });

    // Asserting `>= 0` here would be asserting the bug (BR-05-32): a ceiling was bypassed somewhere
    // upstream and this figure is the one place that is required to say so, unclamped.
    await expect(openBalanceMinor(db as never, USER_ID, o)).resolves.toBe(-30);
  });

  it("8. the adjustment-line query is scoped to the caller's userId, using the duplicated field and its index", async () => {
    const db = makeDb([lineSumRow("order-1", 50)]);
    const o = order({ totalCost: 180, allocatedAmountMinor: 0 });

    await openBalanceMinor(db as never, USER_ID, o);

    expect(db.storeAccountAdjustmentLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) }),
    );
  });
});
