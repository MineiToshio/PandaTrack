import { OrderStatus } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { openBalanceMinorByOrderId, sumAdjustmentLineMinorByOrderId } from "./orderOpenBalance";
import { ACTIVE_ORDER_STATUSES, getUnassignedStoreMoneyMinor, isActiveOrderStatus } from "./storePaymentQueries";

/**
 * Read-only surfaces for the "cuadrar cuenta" (reconcile account) feature (WO-11, ADR 0034).
 *
 * Both functions here are pure reads: calling either changes nothing, and calling the same one
 * twice in a row with no write between returns the same result (ADR 0034 §4.4, "Technical Notes").
 */

/** One non-cancelled order of a (store, currency) pair that still carries an open balance. */
export type StoreReconciliationOrderRow = {
  orderId: string;
  orderDate: Date;
  humanReadableId: string;
  totalCost: number;
  /** The canonical `openBalanceMinor` (BR-05-32), already net of any earlier adjustment line. */
  openBalanceMinor: number;
  /** Σ of this order's own earlier `StoreAccountAdjustmentLine`s (`MINOR-10a`, WO-11 review): what
   *  an EARLIER "cuadrar cuenta" already wrote off, so the row can say so rather than silently
   *  showing a smaller balance with no explanation for the gap against `totalCost`. */
  writtenOffMinor: number;
  status: OrderStatus;
};

export type StoreReconciliationPreview = {
  /** Still-active orders (one of `ACTIVE_ORDER_STATUSES`), the group that lowers the debt figure
   *  the collector is shown when marked. */
  openOrders: StoreReconciliationOrderRow[];
  /** `COMPLETED` orders that still carry a balance: outside the displayed debt figure already, but
   *  a legitimate write-off target (ADR 0034 §3), and what the "nothing left open" nudge lists. */
  deliveredOrders: StoreReconciliationOrderRow[];
  /** The store's own parked pool in this currency (`FR-05-69`), shown so the sheet can offer the
   *  assignment instead of the write while it is non-zero. */
  unassignedMinor: number;
};

/**
 * The per-order breakdown shown before the reconciliation write is offered: every non-cancelled
 * order of this (store, currency) pair whose `openBalanceMinor` is greater than zero, split into
 * the two groups the sheet renders separately, plus the store's unassigned pool.
 *
 * An order already written off in full (`openBalanceMinor <= 0`) is never listed: the per-order
 * figure this reads is already the canonical net one, so the same balance is never offered for
 * adjustment twice.
 */
export async function getStoreReconciliationPreview(
  userId: string,
  storeId: string,
  currencyCode: string,
): Promise<StoreReconciliationPreview> {
  const [orders, unassignedMinor] = await Promise.all([
    prisma.order.findMany({
      where: { userId, storeId, currencyCode, status: { not: OrderStatus.CANCELLED } },
      select: {
        id: true,
        orderDate: true,
        humanReadableId: true,
        totalCost: true,
        allocatedAmountMinor: true,
        status: true,
      },
    }),
    // The `Prisma.TransactionClient` parameter accepts the `prisma` singleton structurally (same
    // pattern `getStoreDebtByCurrency` already relies on): this read opens no transaction of its
    // own, it just shares the type every transactional caller of the same function uses.
    getUnassignedStoreMoneyMinor(prisma, userId, storeId, currencyCode),
  ]);

  // ONE batched read for every order's adjustment lines, regardless of how many orders this store
  // and currency carry (see `openBalanceMinorByOrderId`'s own doc).
  const openBalanceByOrderId = await openBalanceMinorByOrderId(prisma, userId, orders);
  // A second, equally batched read of the SAME lines (`MINOR-10a`): `openBalanceMinorByOrderId`
  // folds them straight into the balance and does not hand the sum back on its own, so the row's
  // own `writtenOffMinor` is read separately rather than reverse-engineered from `totalCost −
  // allocatedAmountMinor − openBalance`, which would silently break the moment either of those two
  // terms changes shape.
  const writtenOffByOrderId = await sumAdjustmentLineMinorByOrderId(
    prisma,
    userId,
    orders.map((order) => order.id),
  );

  const openOrders: StoreReconciliationOrderRow[] = [];
  const deliveredOrders: StoreReconciliationOrderRow[] = [];

  for (const order of orders) {
    const openBalance = openBalanceByOrderId.get(order.id);
    if (openBalance === undefined) {
      throw new Error(`openBalanceMinorByOrderId missing entry for order ${order.id}`);
    }
    // Nothing left to write off: not listed (BR-05-32, ADR 0034's own reading, never clamped
    // elsewhere but simply excluded here since there is nothing this sheet can offer on it).
    if (openBalance <= 0) continue;

    const row: StoreReconciliationOrderRow = {
      orderId: order.id,
      orderDate: order.orderDate,
      humanReadableId: order.humanReadableId,
      totalCost: order.totalCost,
      openBalanceMinor: openBalance,
      writtenOffMinor: writtenOffByOrderId.get(order.id) ?? 0,
      status: order.status,
    };

    if ((ACTIVE_ORDER_STATUSES as readonly OrderStatus[]).includes(order.status)) {
      openOrders.push(row);
    } else if (order.status === OrderStatus.COMPLETED) {
      deliveredOrders.push(row);
    }
  }

  return { openOrders, deliveredOrders, unassignedMinor };
}

/** One line of a listed adjustment, named by the order's own date rather than its code (FR-05-67). */
export type StoreAccountAdjustmentLineRow = {
  orderId: string;
  amountMinor: number;
  orderDate: Date;
  orderHumanReadableId: string;
  /**
   * True when the order this line's write-off targets is CURRENTLY in one of
   * `ACTIVE_ORDER_STATUSES` (`FIX 1`, WO-11 review), mirroring `StorePaymentAllocationLine.orderActive`'s
   * own convention rather than shipping the raw `OrderStatus` enum to the client: a delete needs to
   * know whether each line's own order is still in the OPEN group, to split `openOrderDebtMinor`'s
   * own share of the write-off back out from the lifetime `debtMinor` share, and history rows carry
   * no status of their own to derive it from otherwise.
   */
  orderActive: boolean;
};

export type StoreAccountAdjustmentListRow = {
  id: string;
  adjustmentDate: Date;
  reason: string;
  /** Σ of the lines that still exist, derived at read time (WO-10, ADR 0034 §5): if an order named
   *  by this adjustment was since deleted, its line cascaded away and this magnitude is smaller. */
  magnitudeMinor: number;
  lines: StoreAccountAdjustmentLineRow[];
};

/**
 * Per-store, per-currency adjustment history, newest first (`adjustmentDate` DESC, `createdAt` DESC
 * tiebreak). Each entry's magnitude is folded from the same lines already read for display, rather
 * than a second aggregate query: the whole read stays bounded (one query for the headers, one for
 * their lines, one for the lines' orders, per Prisma's own per-level batching, `getStorePaymentsForStore`'s
 * own documented cost) regardless of how many adjustments or lines exist.
 */
export async function listStoreAccountAdjustments(
  userId: string,
  storeId: string,
  currencyCode: string,
): Promise<StoreAccountAdjustmentListRow[]> {
  const adjustments = await prisma.storeAccountAdjustment.findMany({
    where: { userId, storeId, currencyCode },
    select: {
      id: true,
      adjustmentDate: true,
      reason: true,
      lines: {
        select: {
          orderId: true,
          amountMinor: true,
          order: { select: { orderDate: true, humanReadableId: true, status: true } },
        },
      },
    },
    orderBy: [{ adjustmentDate: "desc" }, { createdAt: "desc" }],
  });

  return adjustments.map((adjustment) => ({
    id: adjustment.id,
    adjustmentDate: adjustment.adjustmentDate,
    reason: adjustment.reason,
    magnitudeMinor: adjustment.lines.reduce((sum, line) => sum + line.amountMinor, 0),
    lines: adjustment.lines.map((line) => ({
      orderId: line.orderId,
      amountMinor: line.amountMinor,
      orderDate: line.order.orderDate,
      orderHumanReadableId: line.order.humanReadableId,
      orderActive: isActiveOrderStatus(line.order.status),
    })),
  }));
}

/**
 * Every distinct currency this store has an adjustment in, independent of `getStoreDebtByCurrency`
 * (`MINOR-5`, WO-11 review). `currencyCodesWithDebt` (the store page's own listing of which
 * currencies to fetch history for) is derived from `StoreDebtRow`, which is itself derived from the
 * store's ORDERS: a store whose only order was CANCELLED contributes no debt row at all, even
 * though an adjustment naming that order (written off before it was cancelled, or on a currency the
 * store no longer carries any live order in) can still exist and still needs to be listable and
 * deletable. Reading it straight from `StoreAccountAdjustment` itself is the only way to not miss
 * that case.
 */
export async function listStoreAccountAdjustmentCurrencyCodes(userId: string, storeId: string): Promise<string[]> {
  const rows = await prisma.storeAccountAdjustment.findMany({
    where: { userId, storeId },
    select: { currencyCode: true },
    distinct: ["currencyCode"],
  });
  return rows.map((row) => row.currencyCode);
}
