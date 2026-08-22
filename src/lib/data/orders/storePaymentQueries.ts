import { OrderStatus, type Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { openBalanceMinorByOrderId } from "./orderOpenBalance";

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
  /**
   * "Pendiente en pedidos abiertos" (`BR-05-26` / `FR-05-61`, `ADR 0033`): the sum of the canonical
   * `openBalanceMinor` (`BR-05-32`, `ADR 0034`) over this pair's still-active orders
   * ({@link ACTIVE_ORDER_STATUSES}). Reads the per-order figure net of any
   * `StoreAccountAdjustmentLine`, so an active order already partly written off in a store
   * reconciliation is never overstated here. This is the figure every "Debes / Falta" surface is
   * promoted to render, in place of the lifetime `debtMinor` (which stays the validation ceiling,
   * unchanged, `FR-05-63`). NEVER clamped at zero: see `openBalanceMinorByOrderId`'s own doc for why
   * a negative reading here must stay visible rather than be silenced.
   *
   * Required: `getStoreDebtByCurrency` always fills it in, and a caller that silently defaulted a
   * missing value to zero would hide exactly the kind of gap `BR-05-32` forbids papering over.
   */
  openOrderDebtMinor: number;
  /**
   * "Pagos que no registraste" at this pair's own scope (store/currency, no FX handling), a
   * diagnostic, never debt (`ADR 0033` §3). Sum of `openBalanceMinor` over this pair's `COMPLETED`
   * orders: since this market never lets a store hand over goods before it is paid in full, a
   * delivered order still carrying a balance is a payment that was made and never entered. NOT the
   * figure `FRD-06 · WO-07` renders on the dashboard: that one is global, base-currency,
   * FX-reconciliation-excluded, and defined independently there (`FR-06-28` / `BR-06-13`).
   *
   * Required for the same reason as {@link openOrderDebtMinor}: always filled in by
   * `getStoreDebtByCurrency`.
   */
  unrecordedPaymentsMinor: number;
  /**
   * The exact "parked" pool (`BR-05-27` / `FR-05-60`): money that left the collector's hands for
   * this store/currency pair and is not yet declared against any non-cancelled order,
   * `(Σ StorePayment.amount − lostMinor) − Σ Order.allocatedAmountMinor` over every non-cancelled
   * order of the pair. Unaffected by a `StoreAccountAdjustmentLine`: an adjustment reduces what an
   * order is shown to owe, never what a payment is shown to have paid.
   *
   * Required for the same reason as {@link openOrderDebtMinor}.
   */
  unassignedMinor: number;
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

  // Individual order rows, not a `groupBy` aggregate: `openOrderDebtMinor` and
  // `unrecordedPaymentsMinor` both read the canonical `openBalanceMinor` (`BR-05-32`, `ADR 0034`)
  // PER ORDER, which needs each order's own id to join against its `StoreAccountAdjustmentLine`
  // rows. The store-level and active-only aggregates below are folded from this same list in
  // memory rather than re-read from a second `groupBy`, so this is still exactly one query for the
  // order side, not one groupBy plus N order reads.
  const orders = await prisma.order.findMany({
    where: { userId, status: { not: OrderStatus.CANCELLED }, ...storeFilter },
    select: { id: true, storeId: true, currencyCode: true, status: true, totalCost: true, allocatedAmountMinor: true },
  });

  // Three independent reads (MINOR-8): none of them depends on another's result, only
  // `openBalanceMinorByOrderId` depends on `orders` above, which is already resolved by the time
  // this runs.
  const [paidGroups, lostMinorByKey, openBalanceByOrderId] = await Promise.all([
    prisma.storePayment.groupBy({
      by: ["storeId", "currencyCode"],
      where: { userId, ...storeFilter },
      _sum: { amount: true },
    }),
    sumLostAllocationsByKey(prisma, userId, storeId),
    // ONE batched read for every order's adjustment lines, regardless of how many orders or how many
    // stores this call spans (see `openBalanceMinorByOrderId`'s own doc). This is the single new
    // query this work order adds to the function.
    openBalanceMinorByOrderId(prisma, userId, orders),
  ]);

  const rowsByKey = new Map<DebtKey, StoreDebtRow>();
  // `Σ Order.allocatedAmountMinor` over every non-cancelled order of the pair, the second term
  // `unassignedMinor` needs (BR-05-27 / FR-05-60). Kept apart from `activePaidMinor`, which only
  // covers the still-active slice.
  const allocatedAllByKey = new Map<DebtKey, number>();
  // `Σ StoreAccountAdjustmentLine.amountMinor` over every non-cancelled order of the pair (WO-11):
  // the ceiling's own subtrahend (see `validationCeilingMinor` in the work order). Derived from data
  // already in hand rather than a second query: `openBalanceByOrderId` already read every line's sum
  // per order to compute `openBalance`, so `totalCost - allocatedAmountMinor - openBalance` recovers
  // that same per-order line sum with no extra round trip.
  const lineMinorAllByKey = new Map<DebtKey, number>();

  function ensureRow(orderStoreId: string, currencyCode: string): StoreDebtRow {
    const key = debtKey(orderStoreId, currencyCode);
    let row = rowsByKey.get(key);
    if (!row) {
      row = {
        storeId: orderStoreId,
        currencyCode,
        committedMinor: 0,
        paidMinor: 0,
        debtMinor: 0,
        lostMinor: lostMinorByKey.get(key) ?? 0,
        activeCommittedMinor: 0,
        activePaidMinor: 0,
        openOrderDebtMinor: 0,
        unrecordedPaymentsMinor: 0,
        unassignedMinor: 0,
      };
      rowsByKey.set(key, row);
    }
    return row;
  }

  for (const order of orders) {
    const key = debtKey(order.storeId, order.currencyCode);
    const row = ensureRow(order.storeId, order.currencyCode);
    row.committedMinor += order.totalCost;
    allocatedAllByKey.set(key, (allocatedAllByKey.get(key) ?? 0) + order.allocatedAmountMinor);

    // The batch form guarantees an entry per input order (see `openBalanceMinorByOrderId`'s doc);
    // this figure must never be silently degraded to a gross balance, so no `?? 0` fallback here.
    const openBalance = openBalanceByOrderId.get(order.id);
    if (openBalance === undefined) {
      throw new Error(`openBalanceMinorByOrderId missing entry for order ${order.id}`);
    }

    // This order's own share of `Σ StoreAccountAdjustmentLine.amountMinor`, recovered algebraically
    // from the batch already read: `openBalance = totalCost - allocatedAmountMinor - lineMinor`.
    const lineMinor = order.totalCost - order.allocatedAmountMinor - openBalance;
    lineMinorAllByKey.set(key, (lineMinorAllByKey.get(key) ?? 0) + lineMinor);

    if (isActiveOrderStatus(order.status)) {
      row.activeCommittedMinor += order.totalCost;
      row.activePaidMinor += order.allocatedAmountMinor;
      row.openOrderDebtMinor += openBalance;
    } else if (order.status === OrderStatus.COMPLETED) {
      row.unrecordedPaymentsMinor += openBalance;
    }
  }

  for (const group of paidGroups) {
    const lostMinor = lostMinorByKey.get(debtKey(group.storeId, group.currencyCode)) ?? 0;
    const paidMinor = (group._sum.amount ?? 0) - lostMinor;
    const row = ensureRow(group.storeId, group.currencyCode);
    row.paidMinor = paidMinor;
    row.lostMinor = lostMinor;
  }

  for (const row of rowsByKey.values()) {
    const key = debtKey(row.storeId, row.currencyCode);
    const allocatedAllMinor = allocatedAllByKey.get(key) ?? 0;
    row.unassignedMinor = computeUnassignedMinor(row.paidMinor, allocatedAllMinor);
    // The validation ceiling (`STORE_DEBT_EXCEEDED`, FR-05-43 / FR-05-63): lifetime debt over
    // non-cancelled orders at face value, minus every adjustment line written against that same set
    // (WO-11's `validationCeilingMinor`). Unclamped, like every other figure in this module: see
    // `openBalanceMinorByOrderId`'s doc for why a negative reading must stay visible.
    const lineMinorAll = lineMinorAllByKey.get(key) ?? 0;
    row.debtMinor = row.committedMinor - row.paidMinor - lineMinorAll;
  }

  return [...rowsByKey.values()];
}

/**
 * The single store/currency debt figure a payment is checked against, read inside the caller's
 * transaction so the check and the write it guards see the same snapshot. Same derivation as
 * `getStoreDebtByCurrency`, narrowed to one pair, including the same exclusion of money left
 * declared `lost` against a cancelled order.
 *
 * Also subtracts `Σ StoreAccountAdjustmentLine.amountMinor` written against this store/currency
 * pair's own non-cancelled orders (WO-11's `validationCeilingMinor`, FR-05-43 / FR-05-63): this
 * base is not built per order (unlike `openOrderDebtMinor`, which inherits the line term for free
 * through `openBalanceMinor`), so a written-off balance needs its own explicit subtrahend here or it
 * could be paid a second time, before or after the order is delivered. Unclamped, like every other
 * term of this figure.
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
  const writtenOff = await tx.storeAccountAdjustmentLine.aggregate({
    where: { userId, order: { storeId, currencyCode, status: { not: OrderStatus.CANCELLED } } },
    _sum: { amountMinor: true },
  });

  const paidMinor = (paid._sum.amount ?? 0) - (lost._sum.amountMinor ?? 0);
  return (committed._sum.totalCost ?? 0) - paidMinor - (writtenOff._sum.amountMinor ?? 0);
}

/**
 * The unassigned ("parked") pool arithmetic (`BR-05-27` / `FR-05-60`), written once and shared by
 * both `StoreDebtRow.unassignedMinor` (the batch form, folded per store/currency key above) and
 * {@link getUnassignedStoreMoneyMinor} (the transactional single-pair form): what left the
 * collector's hands for the pair, already net of anything left declared `lost` against a cancelled
 * order, minus whatever of it is already declared against a still-standing order.
 */
function computeUnassignedMinor(paidMinor: number, allocatedAgainstStandingOrdersMinor: number): number {
  return paidMinor - allocatedAgainstStandingOrdersMinor;
}

/** One `StorePayment`'s own remainder, as {@link getStorePaymentRemainders} reads it. */
export type StorePaymentRemainder = {
  paymentId: string;
  paymentDate: Date;
  /**
   * `amount − Σ its own PaymentAllocation.amountMinor`, over EVERY allocation of the payment
   * regardless of the target order's status. Deliberately NOT clamped at zero: a negative reading
   * means this one payment is over-allocated (more was declared against it than it is worth), which
   * can only happen if a ceiling elsewhere was bypassed. `BR-05-32`'s spirit applies here too — this
   * function reports the true figure; a caller that wants to spend the pool decides separately
   * whether a negative reading should stop it (see `consumeUnassignedStoreMoneyOnOrderClose`).
   */
  remainderMinor: number;
};

/**
 * The single source of the per-payment remainder arithmetic, shared by every reader of the
 * unassigned pool (`BR-05-27` / `FR-05-60`, `MINOR-5/6`): {@link getUnassignedStoreMoneyMinor} (the
 * scalar total) and `consumeUnassignedStoreMoneyOnOrderClose` (`WO-08`, which drains the rows
 * oldest-first). Before this helper existed the two had independent derivations of the same number,
 * which is exactly the shape a silent drift goes unnoticed in.
 *
 * Ordered `paymentDate` ASC, `id` ASC — the same "oldest money first" order the settle-on-arrival
 * batch consumption relies on (`FR-08-45`).
 */
export async function getStorePaymentRemainders(
  tx: Prisma.TransactionClient,
  userId: string,
  storeId: string,
  currencyCode: string,
): Promise<StorePaymentRemainder[]> {
  const payments = await tx.storePayment.findMany({
    where: { userId, storeId, currencyCode },
    select: { id: true, amount: true, paymentDate: true },
    orderBy: [{ paymentDate: "asc" }, { id: "asc" }],
  });
  if (payments.length === 0) return [];

  const paymentIds = payments.map((payment) => payment.id);
  // Every allocation of every one of these payments, regardless of the target order's status: an
  // allocation already made to a CANCELLED order is lost money, not available money, and is exactly
  // as much "no longer this payment's to give" as one made to a live order.
  const allocatedGroups = await tx.paymentAllocation.groupBy({
    by: ["paymentId"],
    where: { userId, paymentId: { in: paymentIds } },
    _sum: { amountMinor: true },
  });
  const allocatedByPaymentId = new Map(allocatedGroups.map((group) => [group.paymentId, group._sum.amountMinor ?? 0]));

  return payments.map((payment) => ({
    paymentId: payment.id,
    paymentDate: payment.paymentDate,
    remainderMinor: payment.amount - (allocatedByPaymentId.get(payment.id) ?? 0),
  }));
}

/**
 * The transactional single-pair form of `StoreDebtRow.unassignedMinor` (`BR-05-27` / `FR-05-60`),
 * read inside the caller's own transaction so a write that consumes the pool
 * (`consumeUnassignedStoreMoneyOnOrderClose`, `WO-08`) and a write that reconciles it
 * (`WO-11`) both see the same snapshot they act on.
 *
 * Sum of {@link getStorePaymentRemainders}, unclamped. Algebraically identical to the batch form's
 * three-term derivation above (`computeUnassignedMinor`): summing `amount − Σ allocations` over
 * every payment of the pair nets out to `Σ amount − Σ lost(cancelled) − Σ allocated(non-cancelled)`,
 * because every allocation is against either a cancelled order (the "lost" term) or a non-cancelled
 * one (the "allocated" term) and this sums both in one pass instead of two separate aggregates.
 */
export async function getUnassignedStoreMoneyMinor(
  tx: Prisma.TransactionClient,
  userId: string,
  storeId: string,
  currencyCode: string,
): Promise<number> {
  const remainders = await getStorePaymentRemainders(tx, userId, storeId, currencyCode);
  return remainders.reduce((sum, remainder) => sum + remainder.remainderMinor, 0);
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

/**
 * Plain-Prisma wrapper around {@link openBalanceMinorByOrderId} (`BR-05-32`, `ADR 0034` §3.1) for
 * callers (Server Actions) that need the net open balance of a known set of orders but do not
 * already own a `Prisma.TransactionClient` of their own (`D1` support, 2026-08-20 review): the whole
 * point is that such a caller never has to reach for `prisma` directly to read this figure.
 *
 * Does the `Order.findMany` read itself, scoped to `{ id: { in: orderIds }, userId }`, then hands the
 * result straight to the batch form: one bounded read for the orders plus the one `groupBy`
 * `openBalanceMinorByOrderId` already performs internally, never N+1 regardless of how many order ids
 * are passed. An id the caller does not own (or that no longer exists) simply has no entry in the
 * returned map, mirroring `findMany`'s own silent-omission semantics; the caller decides what a
 * missing id means for its own surface.
 */
export async function getOpenBalanceMinorByOrderIds(userId: string, orderIds: string[]): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, userId },
    select: { id: true, totalCost: true, allocatedAmountMinor: true },
  });

  return openBalanceMinorByOrderId(prisma, userId, orders);
}
