import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { openBalanceMinorByOrderId, type OrderOpenBalanceInput } from "../orders/orderOpenBalance";

/**
 * The one module in the progression domain allowed to read a monetary field.
 *
 * Every other file here (the rule catalogue, the rank ladder, the medal catalogue) is scanned by
 * `src/test/progression-money-guard.test.ts` and fails the build if it so much as names an amount.
 * This file is the deliberate exception, and it exists to make that exception a single, narrow,
 * reviewable place: it reads the figures, decides a yes-or-no, and returns only the boolean.
 *
 * The asymmetry is the contract. A predicate may look at money; nothing it returns may carry money.
 * A future rule that needs a new monetary condition adds a predicate HERE and consumes its boolean,
 * never a helper that hands a figure back to the caller.
 */

/**
 * Orders whose balance is fully covered, out of the ones asked about.
 *
 * Batched on purpose: the recompute resolves eligibility once per entity type, not once per ledger
 * entry, so a collector with hundreds of orders costs two queries rather than hundreds.
 *
 * An order missing from the input set (deleted, or belonging to somebody else) is simply absent from
 * the result: not settled, rather than an error, because the recompute already drops an entry whose
 * entity no longer exists.
 */
export async function resolveSettledOrderIds(
  userId: string,
  orderIds: readonly string[],
  db: Prisma.TransactionClient = prisma,
): Promise<Set<string>> {
  const settled = new Set<string>();
  if (orderIds.length === 0) {
    return settled;
  }

  const orders = await db.order.findMany({
    where: { userId, id: { in: [...orderIds] } },
    select: { id: true, totalCost: true, allocatedAmountMinor: true },
  });

  if (orders.length === 0) {
    return settled;
  }

  const balances = await openBalanceMinorByOrderId(db, userId, orders satisfies OrderOpenBalanceInput[]);
  for (const [orderId, openBalance] of balances) {
    // Exactly zero, never "close enough" and never a clamped figure: an overpaid order is a
    // reconciliation problem, not a settled one, and must not quietly earn the settled credit.
    if (openBalance === 0) {
      settled.add(orderId);
    }
  }

  return settled;
}

/**
 * Whether one order is fully covered. The single-order form the rule catalogue's `order-settled`
 * condition is written against; the recompute uses the batch form above.
 */
export async function isFullyAllocated(
  orderId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  const settled = await resolveSettledOrderIds(userId, [orderId], db);
  return settled.has(orderId);
}

/**
 * Orders whose payments came in as part of the one-to-one Notion import rather than being recorded
 * through the app.
 *
 * Not a money read at all: `migratedFromOrderId` is provenance, not an amount. It lives here anyway
 * because it is reached through the payment tables, and keeping every route into those tables inside
 * this one adapter is what makes the guard's job small enough to be trustworthy.
 *
 * The import fused each order's advance and its balance into a single record, so a replay of that
 * history cannot reconstruct two separate payment events that were never separately recorded. The
 * backfill consumes this to write one synthetic entry per order instead of guessing at two.
 */
export async function resolveMigratedPaymentOrderIds(
  userId: string,
  orderIds: readonly string[],
  db: Prisma.TransactionClient = prisma,
): Promise<Set<string>> {
  if (orderIds.length === 0) {
    return new Set<string>();
  }

  const allocations = await db.paymentAllocation.findMany({
    where: {
      userId,
      orderId: { in: [...orderIds] },
      payment: { migratedFromOrderId: { not: null } },
    },
    select: { orderId: true },
    distinct: ["orderId"],
  });

  return new Set(allocations.map((allocation) => allocation.orderId));
}
