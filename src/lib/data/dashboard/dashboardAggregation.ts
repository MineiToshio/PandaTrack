import {
  BUDGET_WARNING_THRESHOLD_PERCENT,
  DASHBOARD_ACTIVITY_LIST_LIMIT,
  DASHBOARD_TOP_STORES_LIMIT,
  DASHBOARD_UPCOMING_ARRIVAL_DAYS,
  DASHBOARD_UPCOMING_MONTHS,
} from "./dashboardConstants";
import {
  enumerateMonthKeys,
  getBudgetCycleRange,
  getCalendarMonthRange,
  getDefaultDashboardRange,
  getMonthEndExclusive,
  getMonthKeyAhead,
  getTodayStart,
  isWithinRange,
  resolveTimeZone,
  toMonthKey,
} from "./dashboardPeriods";
import { isEligibleForDelivery } from "@/lib/deliveries/deliveryState";
import { resolveOrderArrivalDueDate } from "@/lib/orders/orderDerivedState";
import { needsFxReconciliation } from "@/lib/fx/reconciliation";
import {
  computeOutstandingMinor,
  computePaidMinor,
  convertToBaseCurrencyMinor,
  hasOrderArrived,
  isCancelled,
  isCancelledDelivery,
  rollUpToBaseCurrency,
  type RollupItem,
} from "./dashboardRollup";
import type {
  ActivityBlock,
  ArrivalOrderSummary,
  ArrivalPunctuality,
  BaseCurrencyTotal,
  BudgetBlock,
  BudgetStatus,
  BuildDashboardDataInput,
  CashObligationsBlock,
  CollectionBlock,
  CommittedTrendBlock,
  DashboardData,
  DeliveryStateCount,
  DashboardDeliveryInput,
  DashboardOrderInput,
  DateRange,
  MonthKey,
  MonthlyObligation,
  OrderSummary,
  OutstandingTrendBlock,
  PaidVsOutstandingBlock,
  SpendBlock,
  StatusCount,
  UpcomingPayment,
  UpcomingPaymentDueState,
} from "./dashboardTypes";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** An order enriched with the derivations every block shares. Amounts stay in order currency. */
type DerivedOrder = {
  input: DashboardOrderInput;
  outstandingMinor: number;
  paidMinor: number;
  hasArrived: boolean;
};

function deriveOrder(input: DashboardOrderInput): DerivedOrder {
  return {
    input,
    outstandingMinor: computeOutstandingMinor(input.totalCost, input.payments),
    paidMinor: computePaidMinor(input.payments),
    hasArrived: hasOrderArrived(input.items),
  };
}

/** Same month bucket, disregarding day. */
function isSameMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Builds a rollup item from an order-currency amount, carrying the order's FX context. */
function toRollupItem(order: DashboardOrderInput, amountMinor: number): RollupItem {
  return {
    amountMinor,
    currencyCode: order.currencyCode,
    exchangeRate: order.exchangeRate,
    exchangeRateBaseCode: order.exchangeRateBaseCode,
  };
}

/** Builds a rollup item from a delivery's shipping cost, carrying the delivery's own FX context. */
function toDeliveryRollupItem(delivery: DashboardDeliveryInput): RollupItem {
  return {
    amountMinor: delivery.cost,
    currencyCode: delivery.currencyCode,
    exchangeRate: delivery.exchangeRate,
    exchangeRateBaseCode: delivery.exchangeRateBaseCode,
  };
}

/** Base-currency value of an order-currency amount, or null when the order is FX-excluded. */
function convertOrderAmount(order: DashboardOrderInput, amountMinor: number, baseCurrencyCode: string): number | null {
  return convertToBaseCurrencyMinor(amountMinor, order, baseCurrencyCode);
}

function buildOrderSummary(order: DerivedOrder, baseCurrencyCode: string | null): OrderSummary {
  return {
    orderId: order.input.id,
    humanReadableId: order.input.humanReadableId,
    storeName: order.input.store.name,
    storeLogoUrl: order.input.store.logoUrl,
    orderDate: order.input.orderDate,
    expectedDeliveryFrom: order.input.expectedDeliveryFrom,
    expectedDeliveryTo: order.input.expectedDeliveryTo,
    status: order.input.status,
    currencyCode: order.input.currencyCode,
    totalCostMinor: order.input.totalCost,
    baseTotalCostMinor: baseCurrencyCode
      ? convertOrderAmount(order.input, order.input.totalCost, baseCurrencyCode)
      : null,
    outstandingMinor: order.outstandingMinor,
    isFxPending: baseCurrencyCode ? needsFxReconciliation(order.input, baseCurrencyCode) : false,
  };
}

function buildCashObligations(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
  now: Date,
  timeZone: string,
): CashObligationsBlock {
  const monthRange = getCalendarMonthRange(now, timeZone);
  const todayStart = getTodayStart(now, timeZone);
  const outstandingOrders = orders.filter((order) => order.outstandingMinor > 0);
  const datedOutstanding = outstandingOrders.filter((order) => order.input.expectedDeliveryFrom !== null);

  // "Due this month" = orders whose expected arrival falls in the current month, plus every
  // overdue balance folded in. Both collapse to "expected arrival before next month".
  const currentMonthItems = datedOutstanding
    .filter((order) => order.input.expectedDeliveryFrom!.getTime() < monthRange.end.getTime())
    .map((order) => toRollupItem(order.input, order.outstandingMinor));
  const currentMonth = rollUpToBaseCurrency(currentMonthItems, baseCurrencyCode);

  // The overdue slice of that figure: expected arrival already past, surfaced so the
  // zone can name how much of "due this month" is already owed.
  const overdue = rollUpToBaseCurrency(
    datedOutstanding
      .filter((order) => order.input.expectedDeliveryFrom!.getTime() < todayStart.getTime())
      .map((order) => toRollupItem(order.input, order.outstandingMinor)),
    baseCurrencyCode,
  );

  const upcomingMonths: MonthlyObligation[] = [];
  let upcomingMonthsIsPartial = false;
  for (let monthsAhead = 1; monthsAhead <= DASHBOARD_UPCOMING_MONTHS; monthsAhead += 1) {
    const monthKey = getMonthKeyAhead(now, timeZone, monthsAhead);
    const monthItems = datedOutstanding
      .filter((order) => isSameMonth(toMonthKey(order.input.expectedDeliveryFrom!), monthKey))
      .map((order) => toRollupItem(order.input, order.outstandingMinor));
    const monthTotal = rollUpToBaseCurrency(monthItems, baseCurrencyCode);
    upcomingMonthsIsPartial = upcomingMonthsIsPartial || monthTotal.isPartial;
    upcomingMonths.push({ ...monthKey, totalMinor: monthTotal.totalMinor });
  }

  const totalOutstanding = rollUpToBaseCurrency(
    outstandingOrders.map((order) => toRollupItem(order.input, order.outstandingMinor)),
    baseCurrencyCode,
  );

  const noDateOutstanding = rollUpToBaseCurrency(
    outstandingOrders
      .filter((order) => order.input.expectedDeliveryFrom === null)
      .map((order) => toRollupItem(order.input, order.outstandingMinor)),
    baseCurrencyCode,
  );

  const upcomingPayments = buildUpcomingPayments(datedOutstanding, baseCurrencyCode, todayStart);

  return {
    currentMonth,
    overdue,
    upcomingMonths,
    upcomingMonthsIsPartial,
    totalOutstanding,
    noDateOutstanding,
    upcomingPayments,
  };
}

/** Same lookahead window "próximas llegadas" uses, so "pronto" means one thing across the dashboard. */
function resolveUpcomingPaymentDueState(dueDate: Date, todayStart: Date): UpcomingPaymentDueState {
  const daysAhead = (dueDate.getTime() - todayStart.getTime()) / MILLISECONDS_PER_DAY;
  if (daysAhead < 0) return "overdue";
  return daysAhead <= DASHBOARD_UPCOMING_ARRIVAL_DAYS ? "soon" : "scheduled";
}

/**
 * "Lo que toca pagar": per-order balances the collector still has ahead of them.
 *
 * `COMPLETED` orders are excluded from this LIST even though they stay in every obligation total
 * above. A delivered pedido that still owes money is real debt (so it must keep counting in
 * `totalOutstanding` / `overdue` / `currentMonth`), but it is not "upcoming": its arrival date is
 * in the past and, sorted ascending by that date, those rows sit permanently at the top and push
 * out everything the collector actually has coming. That is how a set of years-old delivered
 * pedidos occupied all five rows of this widget. Those balances now have their own door: the
 * orders list "Con saldo pendiente" filter, and the warning chip on their own rows (`FR-05-35`).
 */
function buildUpcomingPayments(
  datedOutstanding: DerivedOrder[],
  baseCurrencyCode: string | null,
  todayStart: Date,
): UpcomingPayment[] {
  return datedOutstanding
    .filter((order) => order.input.status !== "COMPLETED")
    .slice()
    .sort((a, b) => a.input.expectedDeliveryFrom!.getTime() - b.input.expectedDeliveryFrom!.getTime())
    .map((order) => {
      const fxPending = baseCurrencyCode ? needsFxReconciliation(order.input, baseCurrencyCode) : true;
      const baseOutstandingMinor = baseCurrencyCode
        ? convertOrderAmount(order.input, order.outstandingMinor, baseCurrencyCode)
        : null;
      return {
        orderId: order.input.id,
        humanReadableId: order.input.humanReadableId,
        storeName: order.input.store.name,
        storeLogoUrl: order.input.store.logoUrl,
        dueDate: order.input.expectedDeliveryFrom!,
        currencyCode: order.input.currencyCode,
        outstandingMinor: order.outstandingMinor,
        baseOutstandingMinor,
        isFxPending: fxPending,
        dueState: resolveUpcomingPaymentDueState(order.input.expectedDeliveryFrom!, todayStart),
      };
    });
}

/** Sums an order's payments that fall in a range, in order currency. */
function sumPaymentsInRange(order: DashboardOrderInput, range: DateRange): number {
  return order.payments.reduce(
    (sum, payment) => (isWithinRange(payment.paymentDate, range) ? sum + payment.amount : sum),
    0,
  );
}

function buildBudget(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
  budgetAmountMinor: number | null,
  now: Date,
  timeZone: string,
  resetDay: number | null,
): BudgetBlock {
  const cycleRange = getBudgetCycleRange(now, timeZone, resetDay);
  const consumedItems = orders
    .map((order) => toRollupItem(order.input, sumPaymentsInRange(order.input, cycleRange)))
    .filter((item) => item.amountMinor > 0);
  const consumed = rollUpToBaseCurrency(consumedItems, baseCurrencyCode);

  const isConfigured = budgetAmountMinor !== null && budgetAmountMinor > 0;
  const percentage = isConfigured ? Math.floor((consumed.totalMinor / budgetAmountMinor) * 100) : null;
  const status = isConfigured ? resolveBudgetStatus(consumed.totalMinor, budgetAmountMinor) : null;

  return {
    isConfigured,
    budgetAmountMinor: budgetAmountMinor ?? null,
    consumedMinor: consumed.totalMinor,
    consumedIsPartial: consumed.isPartial,
    percentage,
    status,
    resetDayOfMonth: resetDay,
    cycleStart: cycleRange.start,
    cycleEnd: cycleRange.end,
  };
}

/**
 * Budget status thresholds: green below 80%, amber from 80% to 100% inclusive, red above
 * 100%. Compared in exact minor units rather than against the floored display percentage, so a cycle
 * at 100.4% of budget resolves to `over` instead of rounding down into `warning`.
 */
function resolveBudgetStatus(consumedMinor: number, budgetAmountMinor: number): BudgetStatus {
  if (consumedMinor > budgetAmountMinor) {
    return "over";
  }
  if (consumedMinor * 100 >= budgetAmountMinor * BUDGET_WARNING_THRESHOLD_PERCENT) {
    return "warning";
  }
  return "under";
}

/**
 * Disbursed spend: order payments plus delivery shipping cost, merged into one total rather than
 * charted as separate series — a shipping cost sits on a completely different scale than an order
 * total, so a shared series would be disproportionate (`BR-06-04`, `BR-06-09`).
 */
function buildSpend(
  orders: DerivedOrder[],
  deliveries: DashboardDeliveryInput[],
  baseCurrencyCode: string | null,
  range: DateRange,
  now: Date,
  timeZone: string,
): SpendBlock {
  const monthRange = getCalendarMonthRange(now, timeZone);
  const currentMonthItems = [
    ...orders
      .map((order) => toRollupItem(order.input, sumPaymentsInRange(order.input, monthRange)))
      .filter((item) => item.amountMinor > 0),
    ...deliveries.filter((delivery) => isWithinRange(delivery.deliveryDate, monthRange)).map(toDeliveryRollupItem),
  ];
  const currentMonth = rollUpToBaseCurrency(currentMonthItems, baseCurrencyCode);

  const monthlySeries = enumerateMonthKeys(range).map((monthKey) => {
    const monthItems = [
      ...orders
        .map((order) => toRollupItem(order.input, sumPaymentsInMonth(order.input, monthKey)))
        .filter((item) => item.amountMinor > 0),
      ...deliveries
        .filter((delivery) => isSameMonth(toMonthKey(delivery.deliveryDate), monthKey))
        .map(toDeliveryRollupItem),
    ];
    const monthTotal = rollUpToBaseCurrency(monthItems, baseCurrencyCode);
    return { key: monthKey, total: monthTotal };
  });
  const monthlySeriesIsPartial = monthlySeries.some((entry) => entry.total.isPartial);

  return {
    currentMonthMinor: currentMonth.totalMinor,
    currentMonthIsPartial: currentMonth.isPartial,
    monthlySeries: monthlySeries.map((entry) => ({ ...entry.key, totalMinor: entry.total.totalMinor })),
    monthlySeriesIsPartial,
  };
}

/**
 * Outstanding debt trend: the outstanding balance as it stood at the close of each
 * month in the range. An order contributes only once it has been placed, and only the payments
 * settled by that month-end reduce it, so the series reconstructs the debt at each point in time.
 */
function buildOutstandingTrend(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
  range: DateRange,
): OutstandingTrendBlock {
  let isPartial = false;

  const series = enumerateMonthKeys(range).map((monthKey) => {
    const monthEnd = getMonthEndExclusive(monthKey).getTime();
    const items = orders
      .filter((order) => order.input.orderDate.getTime() < monthEnd)
      .map((order) => {
        const paidByThen = order.input.payments.reduce(
          (sum, payment) => (payment.paymentDate.getTime() < monthEnd ? sum + payment.amount : sum),
          0,
        );
        return toRollupItem(order.input, Math.max(0, order.input.totalCost - paidByThen));
      });
    const monthTotal = rollUpToBaseCurrency(items, baseCurrencyCode);
    isPartial = isPartial || monthTotal.isPartial;
    return { ...monthKey, totalMinor: monthTotal.totalMinor };
  });

  return { series, isPartial };
}

/**
 * Committed value trend: the total value of the orders *placed* in each month of the range.
 *
 * Deliberately the counterpart of `buildSpend`, which tracks money that actually left the
 * collector's hands. An order's full cost lands in the month it was placed, regardless of when it
 * is paid, so the pair reads as "what I took on" against "what I have paid down"; the gap between
 * them is what `buildOutstandingTrend` then carries forward as debt.
 */
function buildCommittedTrend(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
  range: DateRange,
): CommittedTrendBlock {
  let isPartial = false;

  const series = enumerateMonthKeys(range).map((monthKey) => {
    const items = orders
      .filter((order) => isSameMonth(toMonthKey(order.input.orderDate), monthKey))
      .map((order) => toRollupItem(order.input, order.input.totalCost));
    const monthTotal = rollUpToBaseCurrency(items, baseCurrencyCode);
    isPartial = isPartial || monthTotal.isPartial;
    return { ...monthKey, totalMinor: monthTotal.totalMinor };
  });

  return { series, isPartial };
}

/** Sums an order's payments bucketed into a specific month, in order currency. */
function sumPaymentsInMonth(order: DashboardOrderInput, monthKey: MonthKey): number {
  return order.payments.reduce(
    (sum, payment) => (isSameMonth(toMonthKey(payment.paymentDate), monthKey) ? sum + payment.amount : sum),
    0,
  );
}

function buildActivity(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
  range: DateRange,
  now: Date,
  timeZone: string,
): ActivityBlock {
  const toSummary = (order: DerivedOrder): OrderSummary => buildOrderSummary(order, baseCurrencyCode);

  // Arrival rows carry the products their quick-arrival modal would offer, so the dashboard can
  // log a delivery inline without a second round trip. The eligibility predicate is the delivery
  // domain's own (`isEligibleForDelivery`), never a copy of the rule: the dashboard must not be
  // able to offer a product that `createDelivery` would then refuse.
  //
  // It is defensive today, because `hasOrderArrived` drops an order from these lists as soon as any
  // product leaves `NONE`, so the rows only ever hold fully-open orders. It stays because that
  // definition is not this module's to depend on.
  const toArrivalSummary = (order: DerivedOrder): ArrivalOrderSummary => ({
    ...toSummary(order),
    quickArrivalItems: order.input.items
      .filter((item) => isEligibleForDelivery(item.deliveryState))
      .map((item) => ({ id: item.id, name: item.name })),
  });
  const recentOrders = orders
    .slice()
    .sort((a, b) => b.input.orderDate.getTime() - a.input.orderDate.getTime())
    .slice(0, DASHBOARD_ACTIVITY_LIST_LIMIT)
    .map(toSummary);

  const todayStart = getTodayStart(now, timeZone);
  const arrivalWindowEnd = new Date(todayStart.getTime() + DASHBOARD_UPCOMING_ARRIVAL_DAYS * MILLISECONDS_PER_DAY);
  const notArrived = orders.filter((order) => !order.hasArrived);

  const upcomingArrivals = notArrived
    .filter((order) => {
      const from = order.input.expectedDeliveryFrom;
      return from !== null && from.getTime() >= todayStart.getTime() && from.getTime() < arrivalWindowEnd.getTime();
    })
    .sort((a, b) => a.input.expectedDeliveryFrom!.getTime() - b.input.expectedDeliveryFrom!.getTime())
    .slice(0, DASHBOARD_ACTIVITY_LIST_LIMIT)
    .map(toArrivalSummary);

  // Not sliced: `overdueArrivals.length` also drives the "Atrasados" tab count badge, which must
  // reflect the true total. The component caps the rendered rows at `DASHBOARD_ACTIVITY_LIST_LIMIT`.
  const overdueArrivals = notArrived
    .map((order) => ({ order, dueDate: resolveArrivalDueDate(order.input) }))
    .filter((entry) => entry.dueDate !== null && entry.dueDate.getTime() < todayStart.getTime())
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .map((entry) => toArrivalSummary(entry.order));

  const placedVsArrived = enumerateMonthKeys(range).map((monthKey) => {
    const placedCount = orders.filter((order) => isSameMonth(toMonthKey(order.input.orderDate), monthKey)).length;
    const arrivedCount = orders.filter(
      (order) => order.hasArrived && isSameMonth(toMonthKey(resolveArrivalBucketDate(order.input)), monthKey),
    ).length;
    return { ...monthKey, placedCount, arrivedCount };
  });

  const punctuality = buildPunctuality(orders);

  return { recentOrders, upcomingArrivals, overdueArrivals, placedVsArrived, punctuality };
}

/**
 * Overdue reference date for an unfulfilled arrival: window close, or its start when there is no
 * close. Delegates so the dashboard, the orders list chip and the "Entrega atrasada" filter cannot
 * drift apart on what "late" means.
 */
function resolveArrivalDueDate(order: DashboardOrderInput): Date | null {
  return resolveOrderArrivalDueDate(order);
}

/**
 * Earliest dated evidence that an order reached the store: the dispatch date of its first
 * non-cancelled delivery. The store can only dispatch what it already holds, so the order had
 * arrived by then. Orders whose items were only flagged `ARRIVED_AT_STORE` by hand carry no
 * delivery and therefore no date, which is why this returns null instead of guessing.
 */
function resolveArrivalEvidenceDate(order: DashboardOrderInput): Date | null {
  let earliest: number | null = null;
  for (const item of order.items) {
    for (const dispatchedAt of item.deliveryDates) {
      const time = dispatchedAt.getTime();
      if (earliest === null || time < earliest) {
        earliest = time;
      }
    }
  }
  return earliest === null ? null : new Date(earliest);
}

/**
 * Bucket date for an arrived order in the placed-vs-arrived series. Uses the dated arrival evidence
 * when the order was delivered, and falls back to its expected-arrival start (then its order date)
 * for orders marked arrived by hand, which carry no timestamp.
 */
function resolveArrivalBucketDate(order: DashboardOrderInput): Date {
  return resolveArrivalEvidenceDate(order) ?? order.expectedDeliveryFrom ?? order.orderDate;
}

/**
 * Punctuality among arrived orders. An order is judged only when it carries both an
 * expected window and dated arrival evidence: it is on time when that evidence lands on or before
 * the window close, late otherwise. Everything else is counted as unknown rather than guessed —
 * comparing the window against *today* would silently reclassify every past arrival as late.
 */
function buildPunctuality(orders: DerivedOrder[]): ArrivalPunctuality {
  let onTimeCount = 0;
  let lateCount = 0;
  let unknownCount = 0;

  for (const order of orders) {
    if (!order.hasArrived) {
      continue;
    }
    const dueDate = resolveArrivalDueDate(order.input);
    const arrivedAt = resolveArrivalEvidenceDate(order.input);
    if (dueDate === null || arrivedAt === null) {
      unknownCount += 1;
      continue;
    }
    if (arrivedAt.getTime() <= dueDate.getTime()) {
      onTimeCount += 1;
    } else {
      lateCount += 1;
    }
  }

  return { onTimeCount, lateCount, unknownCount };
}

function buildCollection(orders: DerivedOrder[], baseCurrencyCode: string | null): CollectionBlock {
  const totalOrders = orders.length;
  const totalProducts = orders.reduce(
    (sum, order) => sum + order.input.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  const totalStores = new Set(orders.map((order) => order.input.store.id)).size;

  const statusDistribution = buildStatusDistribution(orders);
  const productCountByType = buildProductCountByType(orders);
  const itemDeliveryStates = buildItemDeliveryStates(orders);
  const spendByType = buildSpendByType(orders, baseCurrencyCode);
  const topStores = buildTopStores(orders, baseCurrencyCode);

  return {
    totalOrders,
    totalProducts,
    totalStores,
    statusDistribution,
    spendByType: spendByType.entries,
    spendByTypeIsPartial: spendByType.isPartial,
    productCountByType,
    itemDeliveryStates,
    topStores: topStores.entries,
    topStoresIsPartial: topStores.isPartial,
  };
}

function buildStatusDistribution(orders: DerivedOrder[]): StatusCount[] {
  const counts = new Map<StatusCount["status"], number>();
  for (const order of orders) {
    counts.set(order.input.status, (counts.get(order.input.status) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}

function buildProductCountByType(orders: DerivedOrder[]): CollectionBlock["productCountByType"] {
  const counts = new Map<string | null, number>();
  for (const order of orders) {
    for (const item of order.input.items) {
      counts.set(item.productTypeKey, (counts.get(item.productTypeKey) ?? 0) + item.quantity);
    }
  }
  return Array.from(counts.entries())
    .map(([productTypeKey, quantity]) => ({ productTypeKey, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

/** Product quantity split by item delivery state, so the dashboard can show how much has arrived. */
function buildItemDeliveryStates(orders: DerivedOrder[]): DeliveryStateCount[] {
  const counts = new Map<DeliveryStateCount["state"], number>();
  for (const order of orders) {
    for (const item of order.input.items) {
      counts.set(item.deliveryState, (counts.get(item.deliveryState) ?? 0) + item.quantity);
    }
  }
  return Array.from(counts.entries())
    .map(([state, quantity]) => ({ state, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

/**
 * Committed spend grouped by product type. The collector's committed money lives on the
 * order (`Order.totalCost`), not on its items, so each order's committed value is distributed across
 * its items: by `unitPrice × quantity` when the items carry prices, and by quantity alone when they
 * do not. Summing `unitPrice × quantity` directly would report zero for the many orders whose items
 * have no unit price, hiding the breakdown entirely. FX-excluded orders are dropped and reported via
 * the partial flag; the value stays committed, never disbursed.
 */
function buildSpendByType(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
): { entries: CollectionBlock["spendByType"]; isPartial: boolean } {
  const totals = new Map<string | null, number>();
  let isPartial = false;

  for (const order of orders) {
    if (!baseCurrencyCode) {
      isPartial = true;
      continue;
    }
    const committedBase = convertOrderAmount(order.input, order.input.totalCost, baseCurrencyCode);
    if (committedBase === null) {
      isPartial = true;
      continue;
    }

    const weights = resolveItemWeights(order.input.items);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) {
      continue;
    }

    order.input.items.forEach((item, index) => {
      const share = (committedBase * weights[index]) / totalWeight;
      totals.set(item.productTypeKey, (totals.get(item.productTypeKey) ?? 0) + share);
    });
  }

  const entries = Array.from(totals.entries())
    .map(([productTypeKey, committedMinor]) => ({ productTypeKey, committedMinor: Math.round(committedMinor) }))
    .filter((entry) => entry.committedMinor > 0)
    .sort((a, b) => b.committedMinor - a.committedMinor);
  return { entries, isPartial };
}

/**
 * How much of an order's committed value each item represents. Priced items are weighted by their
 * line value; when no item carries a price, quantity is the only signal available.
 */
function resolveItemWeights(items: DashboardOrderInput["items"]): number[] {
  const priced = items.map((item) => (item.unitPrice ?? 0) * item.quantity);
  const pricedTotal = priced.reduce((sum, weight) => sum + weight, 0);
  return pricedTotal > 0 ? priced : items.map((item) => item.quantity);
}

function buildTopStores(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
): { entries: CollectionBlock["topStores"]; isPartial: boolean } {
  const byStore = new Map<
    string,
    {
      storeName: string;
      storeSlug: string;
      storeLogoUrl: string | null;
      committedMinor: number;
      orderCount: number;
    }
  >();
  let isPartial = false;

  for (const order of orders) {
    const entry = byStore.get(order.input.store.id) ?? {
      storeName: order.input.store.name,
      storeSlug: order.input.store.slug,
      storeLogoUrl: order.input.store.logoUrl,
      committedMinor: 0,
      orderCount: 0,
    };
    entry.orderCount += 1;
    const converted = baseCurrencyCode
      ? convertOrderAmount(order.input, order.input.totalCost, baseCurrencyCode)
      : null;
    if (converted === null) {
      isPartial = true;
    } else {
      entry.committedMinor += converted;
    }
    byStore.set(order.input.store.id, entry);
  }

  const entries = Array.from(byStore.entries())
    .map(([storeId, value]) => ({ storeId, ...value }))
    .sort((a, b) => b.committedMinor - a.committedMinor || b.orderCount - a.orderCount)
    .slice(0, DASHBOARD_TOP_STORES_LIMIT);
  return { entries, isPartial };
}

function buildPaidVsOutstanding(orders: DerivedOrder[], baseCurrencyCode: string | null): PaidVsOutstandingBlock {
  const committed = rollUpToBaseCurrency(
    orders.map((order) => toRollupItem(order.input, order.input.totalCost)),
    baseCurrencyCode,
  );
  const paid = rollUpToBaseCurrency(
    orders.map((order) => toRollupItem(order.input, order.paidMinor)),
    baseCurrencyCode,
  );
  const outstanding = rollUpToBaseCurrency(
    orders.map((order) => toRollupItem(order.input, order.outstandingMinor)),
    baseCurrencyCode,
  );

  return {
    committedMinor: committed.totalMinor,
    paidMinor: paid.totalMinor,
    outstandingMinor: outstanding.totalMinor,
    isPartial: committed.isPartial,
    excludedOrderCount: committed.excludedOrderCount,
  };
}

/**
 * "Lost on cancelled": sunk money retained on cancelled orders. A cancelled order that still
 * carries payments kept them deliberately (the cancel modal forces the keep/remove choice), so the
 * presence of payments is the signal that the money was lost rather than refunded or moved. Summed
 * in base currency through the shared rollup, so FX-unreconciled cancelled orders are excluded
 * exactly like every other total (`FR-06-13`). Cancelled orders with no payments contribute nothing.
 */
function buildLostOnCancelled(orders: DashboardOrderInput[], baseCurrencyCode: string | null): BaseCurrencyTotal {
  const items = orders
    .filter((order) => isCancelled(order.status))
    .map((order) => toRollupItem(order, computePaidMinor(order.payments)))
    .filter((item) => item.amountMinor > 0);
  return rollUpToBaseCurrency(items, baseCurrencyCode);
}

/**
 * Pure aggregation entry point: turns raw orders plus the collector's currency/budget/timezone
 * context into the single `DashboardData` payload consumed by every zone. Deterministic given its
 * inputs (including `now`), so it is unit-tested directly without a database.
 */
export function buildDashboardData(input: BuildDashboardDataInput): DashboardData {
  const { orders, deliveries, now, baseCurrencyCode, budgetAmountMinor, budgetResetDayOfMonth } = input;
  const timeZone = resolveTimeZone(input.timezone);
  const range = input.range ?? getDefaultDashboardRange(now, timeZone);

  const nonCancelled = orders.filter((order) => !isCancelled(order.status)).map(deriveOrder);
  const nonCancelledDeliveries = deliveries.filter((delivery) => !isCancelledDelivery(delivery.status));

  return {
    baseCurrencyCode,
    baseCurrencyConfigured: baseCurrencyCode !== null,
    timezone: timeZone,
    generatedAt: now,
    range,
    cashObligations: buildCashObligations(nonCancelled, baseCurrencyCode, now, timeZone),
    budget: buildBudget(nonCancelled, baseCurrencyCode, budgetAmountMinor, now, timeZone, budgetResetDayOfMonth),
    spend: buildSpend(nonCancelled, nonCancelledDeliveries, baseCurrencyCode, range, now, timeZone),
    committedTrend: buildCommittedTrend(nonCancelled, baseCurrencyCode, range),
    outstandingTrend: buildOutstandingTrend(nonCancelled, baseCurrencyCode, range),
    activity: buildActivity(nonCancelled, baseCurrencyCode, range, now, timeZone),
    collection: buildCollection(nonCancelled, baseCurrencyCode),
    paidVsOutstanding: buildPaidVsOutstanding(nonCancelled, baseCurrencyCode),
    // Computed from the FULL orders list — the only figure that reads cancelled orders (`BR-06-10`).
    lostOnCancelled: buildLostOnCancelled(orders, baseCurrencyCode),
  };
}
