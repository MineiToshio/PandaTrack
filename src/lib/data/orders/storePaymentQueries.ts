import { OrderStatus, type Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * What the collector owes one store in one currency.
 *
 * `committedMinor` is what they promised (the total of every order that is still standing),
 * `paidMinor` is what actually left their hands for that store AND is still available (it excludes
 * money deliberately left declared against a cancelled order, `lost` at cancel time per BR-05-15 -
 * that money is sunk, not a credit the store owes back), and the difference is the debt. It is
 * deliberately NOT clamped at zero: a negative value is real money the store is holding on the
 * collector's behalf (an overpayment, or a cancelled order whose payment was freed as `credit`
 * instead of `lost`), and clamping it would erase the only signal that credit exists.
 */
export type StoreDebtRow = {
  storeId: string;
  currencyCode: string;
  committedMinor: number;
  paidMinor: number;
  debtMinor: number;
  /**
   * The slice of the money that left the collector's hands which is sunk in cancelled orders, and
   * therefore already subtracted from `paidMinor`. Surfaced (rather than left implicit) because it
   * is money that bought nothing and no other figure carries it: `paidMinor` nets it out, the bar's
   * pair never counted it (a cancelled order is not active), and the store's payments list shows
   * each payment at face value. A store whose payments add up to 410.00 has 250.00 in `paidMinor`
   * when 160.00 died with a cancelled order; the store detail names that 160.00 rather than leaving
   * it in no total at all.
   */
  lostMinor: number;
  /**
   * `committedMinor` narrowed to the orders that have not finished yet: the four non-terminal
   * statuses of {@link ACTIVE_ORDER_STATUSES}, which is the same set the "Pedidos activos" count in
   * the store aside already reports (`getViewerStoreActivity`).
   */
  activeCommittedMinor: number;
  /**
   * Money declared against those same still-active orders (`Order.allocatedAmountMinor`, the
   * transactionally maintained cache of their `PaymentAllocation` rows).
   *
   * Deliberately NOT `paidMinor` narrowed by status: `paidMinor` counts every sol that left the
   * collector's hands, including money handed over on account and never declared against anything.
   * On-account money cannot be attributed to an order, so it must not raise the numerator of a
   * ratio whose denominator is a set of orders. This is the pair the progress bar draws, and the
   * only one where "0 of X" and "X of X" both mean what they say.
   */
  activePaidMinor: number;
};

/**
 * The order statuses the store detail treats as "still active": everything that is neither
 * delivered nor called off. Exported because the progress bar's denominator and the aside's
 * "Pedidos activos" count have to name the same set, and a second inline list of statuses is how
 * those two silently drift apart.
 */
export const ACTIVE_ORDER_STATUSES = [
  OrderStatus.OPEN,
  OrderStatus.PARTIALLY_IN_TRANSIT,
  OrderStatus.IN_TRANSIT,
  OrderStatus.PARTIALLY_DELIVERED,
] as const;

const ACTIVE_ORDER_STATUS_SET: ReadonlySet<OrderStatus> = new Set(ACTIVE_ORDER_STATUSES);

/** True for the four non-terminal statuses: not COMPLETED, not CANCELLED. */
export function isActiveOrderStatus(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUS_SET.has(status);
}

type DebtKey = `${string}|${string}`;

function debtKey(storeId: string, currencyCode: string): DebtKey {
  return `${storeId}|${currencyCode}`;
}

/**
 * Money still declared (`PaymentAllocation.amountMinor`) against a now-CANCELLED order, grouped by
 * the parent payment's store and currency. This is the `lost` half of the cancel-time `lost`/
 * `credit` choice (BR-05-15): the allocation is left in place on purpose as a "sunk" signal for the
 * dashboard's "Perdido en cancelados" figure, so it must not also read as money still available to
 * pay off the store's other orders. `credit` deletes the allocation instead, which is why that path
 * needs no exclusion here: a freed allocation no longer shows up in this query at all.
 */
async function sumLostAllocationsByKey(
  client: Prisma.TransactionClient,
  userId: string,
  storeId?: string,
): Promise<Map<DebtKey, number>> {
  const rows = await client.paymentAllocation.findMany({
    where: {
      userId,
      order: { status: OrderStatus.CANCELLED },
      ...(storeId ? { payment: { storeId } } : {}),
    },
    select: { amountMinor: true, payment: { select: { storeId: true, currencyCode: true } } },
  });

  const lostByKey = new Map<DebtKey, number>();
  for (const row of rows) {
    const key = debtKey(row.payment.storeId, row.payment.currencyCode);
    lostByKey.set(key, (lostByKey.get(key) ?? 0) + row.amountMinor);
  }
  return lostByKey;
}

/**
 * Debt per store and currency for one collector, optionally narrowed to a single store.
 *
 * Cancelled orders are excluded from the committed side (nothing is owed on an order that no
 * longer stands) while their payments stay counted, minus whatever of those payments is still
 * declared `lost` against one of those same cancelled orders (see `sumLostAllocationsByKey`). That
 * is what turns a paid-then-`credit`-cancelled order into store credit while a paid-then-`lost`-
 * cancelled order does not. A store/currency pair appears when either side has rows, so a payment
 * made in a currency the collector has no open order in is still visible.
 *
 * Each row carries TWO scopes on purpose, and they must not be collapsed into one:
 *
 *  - `committedMinor` / `paidMinor` / `debtMinor` are store-level and lifetime-wide. `debtMinor` is
 *    the figure `createStorePayment` enforces its ceiling against (`getStoreDebtMinor` derives the
 *    same number inside the transaction), the one the "Por tienda" order view and the dashboard
 *    read, and the one that decides whether "Registrar pago" is enabled. Narrowing it would refuse
 *    a payment on an order that is already delivered but not paid.
 *  - `activeCommittedMinor` / `activePaidMinor` are the still-active slice, and they exist for one
 *    consumer: the store aside's progress bar, whose ratio is about the orders the collector is
 *    currently waiting on, not about five years of settled history.
 */
export async function getStoreDebtByCurrency(userId: string, storeId?: string): Promise<StoreDebtRow[]> {
  const storeFilter = storeId ? { storeId } : {};

  // Grouped by status as well as by store and currency, so one round trip yields both the
  // store-level committed total (every standing order) and the active-only slice the progress bar
  // measures. A second `groupBy` filtered to the active statuses would read the same rows twice.
  const committedGroups = await prisma.order.groupBy({
    by: ["storeId", "currencyCode", "status"],
    where: { userId, status: { not: OrderStatus.CANCELLED }, ...storeFilter },
    _sum: { totalCost: true, allocatedAmountMinor: true },
  });

  const paidGroups = await prisma.storePayment.groupBy({
    by: ["storeId", "currencyCode"],
    where: { userId, ...storeFilter },
    _sum: { amount: true },
  });

  const lostMinorByKey = await sumLostAllocationsByKey(prisma, userId, storeId);

  const rowsByKey = new Map<DebtKey, StoreDebtRow>();

  for (const group of committedGroups) {
    const key = debtKey(group.storeId, group.currencyCode);
    const committedMinor = group._sum.totalCost ?? 0;
    const isActive = isActiveOrderStatus(group.status);
    const existing = rowsByKey.get(key);
    if (existing) {
      existing.committedMinor += committedMinor;
      existing.debtMinor += committedMinor;
      if (isActive) {
        existing.activeCommittedMinor += committedMinor;
        existing.activePaidMinor += group._sum.allocatedAmountMinor ?? 0;
      }
      continue;
    }
    rowsByKey.set(key, {
      storeId: group.storeId,
      currencyCode: group.currencyCode,
      committedMinor,
      paidMinor: 0,
      debtMinor: committedMinor,
      lostMinor: lostMinorByKey.get(key) ?? 0,
      activeCommittedMinor: isActive ? committedMinor : 0,
      activePaidMinor: isActive ? (group._sum.allocatedAmountMinor ?? 0) : 0,
    });
  }

  for (const group of paidGroups) {
    const key = debtKey(group.storeId, group.currencyCode);
    const lostMinor = lostMinorByKey.get(key) ?? 0;
    const paidMinor = (group._sum.amount ?? 0) - lostMinor;
    const existing = rowsByKey.get(key);
    if (existing) {
      existing.paidMinor = paidMinor;
      existing.debtMinor = existing.committedMinor - paidMinor;
      existing.lostMinor = lostMinor;
      continue;
    }
    rowsByKey.set(key, {
      storeId: group.storeId,
      currencyCode: group.currencyCode,
      committedMinor: 0,
      paidMinor,
      debtMinor: -paidMinor,
      lostMinor,
      activeCommittedMinor: 0,
      activePaidMinor: 0,
    });
  }

  return [...rowsByKey.values()];
}

/**
 * The single store/currency debt figure a payment is checked against, read inside the caller's
 * transaction so the check and the write it guards see the same snapshot. Same derivation as
 * `getStoreDebtByCurrency`, narrowed to one pair, including the same exclusion of money left
 * declared `lost` against a cancelled order.
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
  const lost = await tx.paymentAllocation.aggregate({
    where: { userId, payment: { storeId, currencyCode }, order: { status: OrderStatus.CANCELLED } },
    _sum: { amountMinor: true },
  });

  const paidMinor = (paid._sum.amount ?? 0) - (lost._sum.amountMinor ?? 0);
  return (committed._sum.totalCost ?? 0) - paidMinor;
}

/**
 * Row cap for the store detail "Pagos a esta tienda" list — a simple list, deliberately not
 * paginated. Exported because the card's "Ver los N pagos" control has to know the same number the
 * query capped at to decide whether anything is being withheld.
 */
export const STORE_PAYMENTS_LIST_LIMIT = 20;

/**
 * One declaration line of a payment, as the store detail payments card reads it.
 *
 * Deliberately has no `id`: `createMany` does not hand back the rows it wrote, so the mutation path
 * would need an extra read purely to fill a field nobody renders. Callers key these by position
 * within their payment, which is stable because the query orders them.
 */
export type StorePaymentAllocationLine = {
  orderId: string;
  /** `Order.humanReadableId`, e.g. "ORD-20260805-01" — the reference the collector actually reads. */
  orderHumanReadableId: string;
  /**
   * True when the order this line points at has since been CANCELLED. The line survives on purpose
   * (BR-05-15's `lost` half), and this is what lets the row say so instead of presenting sunk money
   * as if it still counted.
   */
  orderCancelled: boolean;
  /**
   * True when the order this line points at is still active (one of {@link ACTIVE_ORDER_STATUSES}).
   * Carried alongside `orderCancelled` rather than derived from it because they are not two halves
   * of one thing: a COMPLETED order is neither. This is what lets the client move
   * `activePaidMinor` by the right amount when a payment is added or removed, instead of moving
   * the progress bar for money that landed on an order that has already been delivered.
   */
  orderActive: boolean;
  /** Null when the line names the whole order rather than one of its products. */
  orderItemId: string | null;
  /**
   * The product's name. Never null while `orderItemId` is set: deleting a product that carries an
   * allocation is refused on both paths (`ITEM_HAS_ALLOCATION`), so the pair cannot come apart.
   */
  orderItemName: string | null;
  amountMinor: number;
  settlesTarget: boolean;
};

/** One payment as the store detail page's payments card sees it. */
export type StorePaymentListRow = {
  id: string;
  amount: number;
  currencyCode: string;
  paymentDate: Date;
  note: string | null;
  /** Sum of every `PaymentAllocation.amountMinor` declared against this payment so far. */
  allocatedTotal: number;
  /**
   * How many ORDERS this payment claims, which is what a delete-confirm modal names as affected.
   *
   * Distinct orders, never allocation lines. A payment broken down across two products of one order
   * writes three allocations (two products plus the undetailed remainder) and still touches exactly
   * one order, so counting lines put "se perderá su asignación con 3 pedidos" in a destructive
   * dialog about a single order. Same correction, and the same reason, as `resolvePaymentCoverage`
   * counting PRODUCT lines rather than allocations.
   */
  claimingOrdersCount: number;
  /** The declaration lines themselves, oldest first, so the row can say what the payment covers. */
  allocations: StorePaymentAllocationLine[];
};

export type StorePaymentsForStoreResult = {
  payments: StorePaymentListRow[];
  /** True total, independent of the `STORE_PAYMENTS_LIST_LIMIT` cap on `payments`. */
  totalCount: number;
};

/**
 * Every payment the collector has made to one store, newest first, capped at
 * `STORE_PAYMENTS_LIST_LIMIT` unless the caller asks for the whole list. This is the only screen
 * that can reach a payment with zero allocations ("on account") or a payment whose remainder was
 * never declared against anything — `deleteOrderPayment` cannot orphan one anymore (it deletes the
 * whole payment once its last allocation goes), but a payment that started life with no allocation
 * at all still needs a door.
 *
 * Cost, since the nested selects look like they should worry someone: the generator does not
 * declare `previewFeatures = ["relationJoins"]`, so Prisma resolves relations with one batched
 * query per level rather than a JOIN. That is FOUR queries in total (payments, their allocations,
 * those allocations' orders, those allocations' products) plus the count — a constant, whether the
 * store has one payment or a hundred. It is not an N+1, and collapsing it into a raw JOIN would
 * trade readability for nothing.
 *
 * @param options.limit Row cap. Defaults to `STORE_PAYMENTS_LIST_LIMIT`; pass `null` for no cap,
 *   which is what the card's "Ver los N pagos" control asks for on an explicit click.
 */
export async function getStorePaymentsForStore(
  userId: string,
  storeId: string,
  options?: { limit?: number | null },
): Promise<StorePaymentsForStoreResult> {
  const limit = options?.limit === undefined ? STORE_PAYMENTS_LIST_LIMIT : options.limit;

  const [rows, totalCount] = await Promise.all([
    prisma.storePayment.findMany({
      where: { userId, storeId },
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        paymentDate: true,
        note: true,
        allocations: {
          select: {
            orderId: true,
            orderItemId: true,
            amountMinor: true,
            settlesTarget: true,
            order: { select: { humanReadableId: true, status: true } },
            orderItem: { select: { name: true } },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      ...(limit == null ? {} : { take: limit }),
    }),
    prisma.storePayment.count({ where: { userId, storeId } }),
  ]);

  return {
    totalCount,
    payments: rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      currencyCode: row.currencyCode,
      paymentDate: row.paymentDate,
      note: row.note,
      allocatedTotal: row.allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0),
      claimingOrdersCount: new Set(row.allocations.map((allocation) => allocation.orderId)).size,
      allocations: row.allocations.map((allocation) => ({
        orderId: allocation.orderId,
        orderHumanReadableId: allocation.order.humanReadableId,
        orderCancelled: allocation.order.status === OrderStatus.CANCELLED,
        orderActive: isActiveOrderStatus(allocation.order.status),
        orderItemId: allocation.orderItemId,
        orderItemName: allocation.orderItem?.name ?? null,
        amountMinor: allocation.amountMinor,
        settlesTarget: allocation.settlesTarget,
      })),
    })),
  };
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
