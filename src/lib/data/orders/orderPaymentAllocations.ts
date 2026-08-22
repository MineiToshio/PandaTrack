import type { Prisma } from "../../../../generated/prisma/client";

/**
 * One TRANSFER as an order sees it, under store-level payments.
 *
 * Money is recorded against the store (`StorePayment`); what ties it to an order is a
 * `PaymentAllocation`. An order used to read one record per allocation, which held only while every
 * payment in the system carried exactly one. A payment broken down across several products of the
 * same order carries N+1, and one transfer would then be drawn as N+1 separate payments, each with
 * its own delete button, where deleting any one of them silently changes what the others mean.
 *
 * So the unit of an order's ledger is "what this order claims out of one transfer": the records are
 * grouped by `paymentId`, `amount` is the SUM of this order's allocations on it, and `id` is the
 * payment's id, because the pair (payment, order) is what an order-scoped delete acts on. The
 * parent payment's total and shared-ness ride along so a screen can say "part of a payment of N
 * covering several orders" without a second query.
 */
export type OrderPaymentRecord = {
  /** The payment's id: an order-scoped delete acts on the pair (payment, order). */
  id: string;
  /** Sum of THIS order's allocations on that payment, never the payment total. */
  amount: number;
  /** The parent payment's date. Allocations carry no date of their own. */
  paymentDate: Date;
  paymentId: string;
  /** The parent payment's full amount, which is larger than `amount` on a shared payment. */
  paymentTotalMinor: number;
  /** True when the parent payment is declared against more than one ORDER. Several lines against
   *  this same order are one transfer to this order, not a shared payment. */
  isShared: boolean;
  /**
   * True when no other order claims this payment AND this order's claim does not cover the
   * payment's full amount — the payment has an unclaimed remainder ("on account") sitting alongside
   * the declaration. Deleting the claim deletes the whole payment (see `deleteOrderPayment`), so a
   * screen showing it must say so rather than implying only this order's slice goes.
   */
  isPartialClaim: boolean;
  /**
   * How many products of this order the payment names. `0` means the money sits on the order as a
   * whole. Derived from the grouped lines, which is the only reason `orderItemId` is mandatory in
   * {@link ORDER_PAYMENT_ALLOCATION_SELECT}.
   */
  detailedLineCount: number;
};

/**
 * `orderItemId` is NOT optional here: it is what `detailedLineCount` counts. The nested
 * `allocations` replaced a `_count`, because "shared" is about distinct ORDERS and a count cannot
 * tell three lines on one order from three lines on three.
 */
export const ORDER_PAYMENT_ALLOCATION_SELECT = {
  id: true,
  amountMinor: true,
  orderItemId: true,
  payment: {
    select: {
      id: true,
      amount: true,
      paymentDate: true,
      allocations: { select: { orderId: true, amountMinor: true, orderItemId: true } },
    },
  },
} as const;

/** Newest payment first, matching the order the payment ledger has always been displayed in. */
export const ORDER_PAYMENT_ALLOCATION_ORDER_BY: Prisma.PaymentAllocationOrderByWithRelationInput[] = [
  { payment: { paymentDate: "desc" } },
  { createdAt: "desc" },
];

/** One allocation row as {@link ORDER_PAYMENT_ALLOCATION_SELECT} projects it. */
export type AllocationRow = {
  id: string;
  amountMinor: number;
  orderItemId: string | null;
  payment: {
    id: string;
    amount: number;
    paymentDate: Date;
    allocations: Array<{ orderId: string; amountMinor: number; orderItemId: string | null }>;
  };
};

const SHARED_PAYMENT_MIN_ORDERS = 2;

/**
 * Collapses one order's allocation rows into one record per TRANSFER.
 *
 * There is deliberately NO single-row counterpart exported beside this: a 1:1 mapper is exactly the
 * defect this replaces, and the three readers of an order's ledger (`listOrderPaymentRecords`,
 * `getOrderDetailBasic`, `getOrderDetail`) must not be able to reach for one. Fixing only some of
 * them is worse than fixing none: the first paint would draw N rows, an add would collapse them to
 * one, and the following `router.refresh()` would split them again.
 *
 * `rows` are expected pre-sorted by {@link ORDER_PAYMENT_ALLOCATION_ORDER_BY}; grouping preserves
 * first-appearance order, so the records come out newest payment first as they always have.
 */
export function mapAllocationsToOrderPayments(rows: AllocationRow[]): OrderPaymentRecord[] {
  const byPaymentId = new Map<string, OrderPaymentRecord>();

  for (const row of rows) {
    const existing = byPaymentId.get(row.payment.id);
    if (existing) {
      existing.amount += row.amountMinor;
      if (row.orderItemId !== null) existing.detailedLineCount += 1;
      continue;
    }

    // Distinct ORDERS, not lines: a payment broken down across three products of this same order is
    // one transfer to this order, and calling it "shared" would send the collector to the
    // multi-order delete modal for a payment nobody else claims.
    const claimingOrderIds = new Set(row.payment.allocations.map((allocation) => allocation.orderId));

    byPaymentId.set(row.payment.id, {
      id: row.payment.id,
      amount: row.amountMinor,
      paymentDate: row.payment.paymentDate,
      paymentId: row.payment.id,
      paymentTotalMinor: row.payment.amount,
      isShared: claimingOrderIds.size >= SHARED_PAYMENT_MIN_ORDERS,
      // Filled in below, once every line of this payment has been folded in: a partial claim is a
      // property of the SUM, not of the first line seen.
      isPartialClaim: false,
      detailedLineCount: row.orderItemId === null ? 0 : 1,
    });
  }

  for (const record of byPaymentId.values()) {
    record.isPartialClaim = !record.isShared && record.amount < record.paymentTotalMinor;
  }

  return [...byPaymentId.values()];
}

/** Reads an order's payment records inside a caller-owned transaction. */
export async function listOrderPaymentRecords(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
): Promise<OrderPaymentRecord[]> {
  const rows = await tx.paymentAllocation.findMany({
    where: { orderId, userId },
    select: ORDER_PAYMENT_ALLOCATION_SELECT,
    orderBy: ORDER_PAYMENT_ALLOCATION_ORDER_BY,
  });
  return mapAllocationsToOrderPayments(rows);
}

/**
 * Rewrites the `allocatedAmountMinor` cache of the given orders from the allocation rows
 * themselves, so the cache is always provably equal to its own source of truth rather than
 * incremented against it.
 *
 * Orders are updated in ascending id order: every mutation that touches several orders takes their
 * row locks in the same sequence, which is what keeps two concurrent multi-order payments from
 * deadlocking against each other.
 */
export async function recalculateOrderAllocationCache(
  tx: Prisma.TransactionClient,
  orderIds: string[],
  userId: string,
): Promise<void> {
  const uniqueOrderIds = [...new Set(orderIds)].sort();
  if (uniqueOrderIds.length === 0) return;

  const grouped = await tx.paymentAllocation.groupBy({
    by: ["orderId"],
    where: { orderId: { in: uniqueOrderIds }, userId },
    _sum: { amountMinor: true },
  });
  const allocatedByOrderId = new Map(grouped.map((row) => [row.orderId, row._sum.amountMinor ?? 0]));

  for (const orderId of uniqueOrderIds) {
    // `updateMany` rather than `update` (defense in depth, `data-layer-user-id-duplication.mdc`):
    // every caller already resolved this order against `{ userId, ... }` earlier in its own
    // transaction, so this never let a cross-account write happen in practice, but the write itself
    // should not rely solely on an earlier read to stay scoped. `updateMany` silently affects zero
    // rows on a mismatch instead of throwing, which is fine here: there is nothing to refuse this far
    // into a transaction whose other writes already committed under the same ownership assumption.
    await tx.order.updateMany({
      where: { id: orderId, userId },
      data: { allocatedAmountMinor: allocatedByOrderId.get(orderId) ?? 0 },
    });
  }
}
