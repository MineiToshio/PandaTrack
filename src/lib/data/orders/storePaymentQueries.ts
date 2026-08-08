import { OrderStatus, type Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * What the collector owes one store in one currency.
 *
 * `committedMinor` is what they promised (the total of every order that is still standing),
 * `paidMinor` is what actually left their hands for that store, and the difference is the debt.
 * It is deliberately NOT clamped at zero: a negative value is real money the store is holding on
 * the collector's behalf (an overpayment, or a cancelled order that was already paid), and
 * clamping it would erase the only signal that credit exists.
 */
export type StoreDebtRow = {
  storeId: string;
  currencyCode: string;
  committedMinor: number;
  paidMinor: number;
  debtMinor: number;
};

type DebtKey = `${string}|${string}`;

function debtKey(storeId: string, currencyCode: string): DebtKey {
  return `${storeId}|${currencyCode}`;
}

/**
 * Debt per store and currency for one collector, optionally narrowed to a single store.
 *
 * Cancelled orders are excluded from the committed side (nothing is owed on an order that no
 * longer stands) while their payments stay counted, which is exactly what turns a paid-then-
 * cancelled order into store credit. A store/currency pair appears when either side has rows, so a
 * payment made in a currency the collector has no open order in is still visible.
 */
export async function getStoreDebtByCurrency(userId: string, storeId?: string): Promise<StoreDebtRow[]> {
  const storeFilter = storeId ? { storeId } : {};

  const committedGroups = await prisma.order.groupBy({
    by: ["storeId", "currencyCode"],
    where: { userId, status: { not: OrderStatus.CANCELLED }, ...storeFilter },
    _sum: { totalCost: true },
  });

  const paidGroups = await prisma.storePayment.groupBy({
    by: ["storeId", "currencyCode"],
    where: { userId, ...storeFilter },
    _sum: { amount: true },
  });

  const rowsByKey = new Map<DebtKey, StoreDebtRow>();

  for (const group of committedGroups) {
    rowsByKey.set(debtKey(group.storeId, group.currencyCode), {
      storeId: group.storeId,
      currencyCode: group.currencyCode,
      committedMinor: group._sum.totalCost ?? 0,
      paidMinor: 0,
      debtMinor: group._sum.totalCost ?? 0,
    });
  }

  for (const group of paidGroups) {
    const key = debtKey(group.storeId, group.currencyCode);
    const paidMinor = group._sum.amount ?? 0;
    const existing = rowsByKey.get(key);
    if (existing) {
      existing.paidMinor = paidMinor;
      existing.debtMinor = existing.committedMinor - paidMinor;
      continue;
    }
    rowsByKey.set(key, {
      storeId: group.storeId,
      currencyCode: group.currencyCode,
      committedMinor: 0,
      paidMinor,
      debtMinor: -paidMinor,
    });
  }

  return [...rowsByKey.values()];
}

/**
 * The single store/currency debt figure a payment is checked against, read inside the caller's
 * transaction so the check and the write it guards see the same snapshot. Same derivation as
 * `getStoreDebtByCurrency`, narrowed to one pair.
 */
export async function getStoreDebtMinor(
  tx: Prisma.TransactionClient,
  userId: string,
  storeId: string,
  currencyCode: string,
): Promise<number> {
  const committed = await tx.order.aggregate({
    where: { userId, storeId, currencyCode, status: { not: OrderStatus.CANCELLED } },
    _sum: { totalCost: true },
  });
  const paid = await tx.storePayment.aggregate({
    where: { userId, storeId, currencyCode },
    _sum: { amount: true },
  });

  return (committed._sum.totalCost ?? 0) - (paid._sum.amount ?? 0);
}

/**
 * The currency a payment to this store is denominated in when the caller did not name one.
 * Inherited only when every standing order with the store agrees; a store the collector buys from
 * in two currencies has no default, and returns `null` so the caller can demand an explicit one.
 */
export async function resolveInheritedStoreCurrency(
  tx: Prisma.TransactionClient,
  userId: string,
  storeId: string,
): Promise<string | null> {
  const rows = await tx.order.findMany({
    where: { userId, storeId, status: { not: OrderStatus.CANCELLED } },
    select: { currencyCode: true },
    distinct: ["currencyCode"],
  });
  return rows.length === 1 ? rows[0].currencyCode : null;
}
