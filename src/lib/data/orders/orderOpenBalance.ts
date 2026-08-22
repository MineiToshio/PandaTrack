import type { Prisma } from "../../../../generated/prisma/client";

/**
 * The three fields `openBalanceMinor` needs from an order, and nothing else. Deliberately narrower
 * than the Prisma `Order` model: this module never reads the order's status (BR-05-32's definition
 * does not vary by it, see the work order's Technical Notes). It performs no authorization of its
 * own beyond the `userId` it is passed, so the caller must still resolve the order against
 * `{ userId, ... }` first, exactly as it does today; this module trusts the row it is handed.
 */
export interface OrderOpenBalanceInput {
  id: string;
  totalCost: number;
  allocatedAmountMinor: number;
}

/**
 * Sum of `StoreAccountAdjustmentLine.amountMinor` per order, for the given order ids, in ONE
 * `groupBy` regardless of how many ids are passed. This is the only database read either the
 * single-order or the batch form of `openBalanceMinor` performs; the other two terms of the
 * balance (`totalCost`, `allocatedAmountMinor`) are already on the row the caller passed in.
 *
 * Exported (rather than module-private) so `getStoreReconciliationPreview` (`MINOR-10a`, WO-11
 * review) can surface the same figure as each row's own `writtenOffMinor`, without a second copy of
 * this arithmetic.
 */
export async function sumAdjustmentLineMinorByOrderId(
  db: Prisma.TransactionClient,
  userId: string,
  orderIds: readonly string[],
): Promise<Map<string, number>> {
  const uniqueOrderIds = [...new Set(orderIds)];
  if (uniqueOrderIds.length === 0) return new Map();

  const grouped = await db.storeAccountAdjustmentLine.groupBy({
    by: ["orderId"],
    where: { userId, orderId: { in: uniqueOrderIds } },
    _sum: { amountMinor: true },
  });

  return new Map(grouped.map((row) => [row.orderId, row._sum.amountMinor ?? 0]));
}

/**
 * The canonical open balance of a set of orders (BR-05-32, ADR 0034 §3.1):
 *
 * `openBalanceMinor = totalCost − Σ PaymentAllocation.amountMinor − Σ StoreAccountAdjustmentLine.amountMinor`
 *
 * The allocations term reads `allocatedAmountMinor`, the same transactionally maintained cache
 * every existing ceiling already uses (see `recalculateOrderAllocationCache`), so this module adds
 * exactly one new subtrahend rather than re-deriving a figure that is already correct.
 *
 * This is the batch form: the one query above stays a single round trip no matter how many orders
 * are passed, so migrating a caller that already holds several orders (a reconciliation preview, a
 * dashboard rollup, a multi-line payment) never turns one query into N. `openBalanceMinor` and
 * `declaredAgainstOrderMinor` are the single-order forms, and they call this one rather than
 * carrying a second copy of the arithmetic.
 *
 * NEVER clamped. Each subtrahend is bounded against this same figure before it is written
 * elsewhere (an allocation by `EXCEEDS_BALANCE`, a line by `ADJUSTMENT_EXCEEDS_ORDER_BALANCE`, the
 * order's own total by `TOTAL_BELOW_PAID`), so in a correctly guarded system the terms can never
 * sum past `totalCost`. If this figure is ever negative, a ceiling was bypassed and real money was
 * counted twice; a `Math.max(0, ...)` here would turn that one loud symptom into silence, which is
 * exactly the understatement BR-05-28 calls the failure that ruins the books. No clamping, ever.
 *
 * Accepts a `Prisma.TransactionClient`, and a `PrismaClient` singleton satisfies that type
 * structurally, so a caller inside an open transaction (`editOrder`, `createStorePayment`, the
 * settlement write) and a caller reading outside one see the same figure from the same code path.
 */
export async function openBalanceMinorByOrderId(
  db: Prisma.TransactionClient,
  userId: string,
  orders: readonly OrderOpenBalanceInput[],
): Promise<Map<string, number>> {
  const lineMinorByOrderId = await sumAdjustmentLineMinorByOrderId(
    db,
    userId,
    orders.map((order) => order.id),
  );

  const openBalanceByOrderId = new Map<string, number>();
  for (const order of orders) {
    const lineMinor = lineMinorByOrderId.get(order.id) ?? 0;
    openBalanceByOrderId.set(order.id, order.totalCost - order.allocatedAmountMinor - lineMinor);
  }
  return openBalanceByOrderId;
}

/**
 * The single-order form of {@link openBalanceMinorByOrderId}. Calls the batch form with a
 * one-element list rather than carrying a second copy of the arithmetic, so there is exactly one
 * implementation of the definition (ADR 0034 §3.1).
 */
export async function openBalanceMinor(
  db: Prisma.TransactionClient,
  userId: string,
  order: OrderOpenBalanceInput,
): Promise<number> {
  const openBalanceByOrderId = await openBalanceMinorByOrderId(db, userId, [order]);
  const balance = openBalanceByOrderId.get(order.id);
  // The batch form guarantees an entry per input order; a miss here is a programming error, not a
  // figure to degrade to gross (see the module doc's NEVER-clamped note: silence is the one thing
  // this figure must never do).
  if (balance === undefined) {
    throw new Error(`openBalanceMinorByOrderId missing entry for order ${order.id}`);
  }
  return balance;
}

/**
 * The complement of {@link openBalanceMinor}: `Σ allocations + Σ lines`, equivalently
 * `totalCost − openBalanceMinor`. What the order-edit guards bound (FR-05-68, applied in WO-11).
 *
 * Deliberately NOT the order's own detail balance: an adjustment squares the store's account, it
 * does not pay the order, so the order keeps showing `totalCost − Σ allocations` and keeps its
 * "still owed" chip (FR-05-35). This figure answers "may anything still be written against this
 * order", not "did anyone pay it".
 */
export async function declaredAgainstOrderMinor(
  db: Prisma.TransactionClient,
  userId: string,
  order: OrderOpenBalanceInput,
): Promise<number> {
  const openBalance = await openBalanceMinor(db, userId, order);
  return order.totalCost - openBalance;
}
