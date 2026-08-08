import type { Prisma } from "../../../../generated/prisma/client";

/**
 * One payment as an order sees it, under store-level payments.
 *
 * Money is recorded against the store (`StorePayment`); what ties it to an order is a
 * `PaymentAllocation`. An order therefore reads its "payments" from its own allocations, and the
 * record's `id` is the allocation's id, because the allocation is what an order-scoped action can
 * legitimately remove. The parent payment's id, total and shared-ness ride along so a screen can
 * say "part of a payment of N covering several orders" without a second query.
 */
export type OrderPaymentRecord = {
  /** The allocation's id: the unit an order-scoped delete acts on. */
  id: string;
  /** The allocation's `amountMinor`: what this payment put against THIS order, never the payment total. */
  amount: number;
  /** The parent payment's date. Allocations carry no date of their own. */
  paymentDate: Date;
  paymentId: string;
  /** The parent payment's full amount, which is larger than `amount` on a shared payment. */
  paymentTotalMinor: number;
  /** True when the parent payment is declared against more than one target. */
  isShared: boolean;
};

export const ORDER_PAYMENT_ALLOCATION_SELECT = {
  id: true,
  amountMinor: true,
  payment: {
    select: { id: true, amount: true, paymentDate: true, _count: { select: { allocations: true } } },
  },
} as const;

/** Newest payment first, matching the order the payment ledger has always been displayed in. */
export const ORDER_PAYMENT_ALLOCATION_ORDER_BY: Prisma.PaymentAllocationOrderByWithRelationInput[] = [
  { payment: { paymentDate: "desc" } },
  { createdAt: "desc" },
];

type AllocationRow = {
  id: string;
  amountMinor: number;
  payment: { id: string; amount: number; paymentDate: Date; _count: { allocations: number } };
};

const SHARED_PAYMENT_MIN_ALLOCATIONS = 2;

export function mapAllocationToOrderPayment(row: AllocationRow): OrderPaymentRecord {
  return {
    id: row.id,
    amount: row.amountMinor,
    paymentDate: row.payment.paymentDate,
    paymentId: row.payment.id,
    paymentTotalMinor: row.payment.amount,
    isShared: row.payment._count.allocations >= SHARED_PAYMENT_MIN_ALLOCATIONS,
  };
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
  return rows.map(mapAllocationToOrderPayment);
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
    await tx.order.update({
      where: { id: orderId },
      data: { allocatedAmountMinor: allocatedByOrderId.get(orderId) ?? 0 },
    });
  }
}
