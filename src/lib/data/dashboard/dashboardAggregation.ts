import {
  BUDGET_WARNING_THRESHOLD_PERCENT,
  DASHBOARD_RECENT_ORDERS_LIMIT,
  DASHBOARD_TOP_STORES_LIMIT,
  DASHBOARD_UPCOMING_ARRIVAL_DAYS,
  DASHBOARD_UPCOMING_MONTHS,
} from "./dashboardConstants";
import {
  enumerateMonthKeys,
  getBudgetCycleRange,
  getCalendarMonthRange,
  getDefaultDashboardRange,
  getMonthKeyAhead,
  getTodayStart,
  isWithinRange,
  resolveTimeZone,
  toMonthKey,
} from "./dashboardPeriods";
import {
  computeOutstandingMinor,
  computePaidMinor,
  convertToBaseCurrencyMinor,
  hasOrderArrived,
  isCancelled,
  isFxPending,
  rollUpToBaseCurrency,
  type RollupItem,
} from "./dashboardRollup";
import type {
  ActivityBlock,
  BudgetBlock,
  BudgetStatus,
  BuildDashboardDataInput,
  CashObligationsBlock,
  CollectionBlock,
  DashboardData,
  DashboardOrderInput,
  DateRange,
  MonthKey,
  MonthlyObligation,
  OrderSummary,
  PaidVsOutstandingBlock,
  SpendBlock,
  StatusCount,
  UpcomingPayment,
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
    needsExchangeRateUpdate: order.needsExchangeRateUpdate,
  };
}

/** Base-currency value of an order-currency amount, or null when the order is FX-excluded. */
function convertOrderAmount(order: DashboardOrderInput, amountMinor: number, baseCurrencyCode: string): number | null {
  if (isFxPending(order, baseCurrencyCode)) {
    return null;
  }
  return convertToBaseCurrencyMinor(amountMinor, order.currencyCode, order.exchangeRate, baseCurrencyCode);
}

function buildOrderSummary(order: DerivedOrder): OrderSummary {
  return {
    orderId: order.input.id,
    humanReadableId: order.input.humanReadableId,
    storeName: order.input.store.name,
    orderDate: order.input.orderDate,
    expectedDeliveryFrom: order.input.expectedDeliveryFrom,
    expectedDeliveryTo: order.input.expectedDeliveryTo,
    status: order.input.status,
    currencyCode: order.input.currencyCode,
    totalCostMinor: order.input.totalCost,
    outstandingMinor: order.outstandingMinor,
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

  // "A pagar este mes" = orders whose expected arrival falls in the current month, plus every
  // overdue balance folded in (BR-06-01). Both collapse to "expected arrival before next month".
  const currentMonthItems = datedOutstanding
    .filter((order) => order.input.expectedDeliveryFrom!.getTime() < monthRange.end.getTime())
    .map((order) => toRollupItem(order.input, order.outstandingMinor));
  const currentMonth = rollUpToBaseCurrency(currentMonthItems, baseCurrencyCode);

  // The overdue slice of that figure: expected arrival already past (BR-06-01), surfaced so the
  // zone can name how much of "a pagar este mes" is already owed.
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

  const upcomingPayments = buildUpcomingPayments(datedOutstanding, baseCurrencyCode);

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

function buildUpcomingPayments(datedOutstanding: DerivedOrder[], baseCurrencyCode: string | null): UpcomingPayment[] {
  return datedOutstanding
    .slice()
    .sort((a, b) => a.input.expectedDeliveryFrom!.getTime() - b.input.expectedDeliveryFrom!.getTime())
    .map((order) => {
      const fxPending = baseCurrencyCode ? isFxPending(order.input, baseCurrencyCode) : true;
      const baseOutstandingMinor = baseCurrencyCode
        ? convertOrderAmount(order.input, order.outstandingMinor, baseCurrencyCode)
        : null;
      return {
        orderId: order.input.id,
        humanReadableId: order.input.humanReadableId,
        storeName: order.input.store.name,
        dueDate: order.input.expectedDeliveryFrom!,
        currencyCode: order.input.currencyCode,
        outstandingMinor: order.outstandingMinor,
        baseOutstandingMinor,
        isFxPending: fxPending,
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
 * Budget status thresholds (FR-06-06): green below 80%, amber from 80% to 100% inclusive, red above
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

function buildSpend(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
  range: DateRange,
  now: Date,
  timeZone: string,
): SpendBlock {
  const monthRange = getCalendarMonthRange(now, timeZone);
  const currentMonthItems = orders
    .map((order) => toRollupItem(order.input, sumPaymentsInRange(order.input, monthRange)))
    .filter((item) => item.amountMinor > 0);
  const currentMonth = rollUpToBaseCurrency(currentMonthItems, baseCurrencyCode);

  const monthlySeries = enumerateMonthKeys(range).map((monthKey) => {
    const monthItems = orders
      .map((order) => toRollupItem(order.input, sumPaymentsInMonth(order.input, monthKey)))
      .filter((item) => item.amountMinor > 0);
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

/** Sums an order's payments bucketed into a specific month, in order currency. */
function sumPaymentsInMonth(order: DashboardOrderInput, monthKey: MonthKey): number {
  return order.payments.reduce(
    (sum, payment) => (isSameMonth(toMonthKey(payment.paymentDate), monthKey) ? sum + payment.amount : sum),
    0,
  );
}

function buildActivity(orders: DerivedOrder[], range: DateRange, now: Date, timeZone: string): ActivityBlock {
  const recentOrders = orders
    .slice()
    .sort((a, b) => b.input.orderDate.getTime() - a.input.orderDate.getTime())
    .slice(0, DASHBOARD_RECENT_ORDERS_LIMIT)
    .map(buildOrderSummary);

  const todayStart = getTodayStart(now, timeZone);
  const arrivalWindowEnd = new Date(todayStart.getTime() + DASHBOARD_UPCOMING_ARRIVAL_DAYS * MILLISECONDS_PER_DAY);
  const notArrived = orders.filter((order) => !order.hasArrived);

  const upcomingArrivals = notArrived
    .filter((order) => {
      const from = order.input.expectedDeliveryFrom;
      return from !== null && from.getTime() >= todayStart.getTime() && from.getTime() < arrivalWindowEnd.getTime();
    })
    .sort((a, b) => a.input.expectedDeliveryFrom!.getTime() - b.input.expectedDeliveryFrom!.getTime())
    .map(buildOrderSummary);

  const overdueArrivals = notArrived
    .map((order) => ({ order, dueDate: resolveArrivalDueDate(order.input) }))
    .filter((entry) => entry.dueDate !== null && entry.dueDate.getTime() < todayStart.getTime())
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .map((entry) => buildOrderSummary(entry.order));

  const placedVsArrived = enumerateMonthKeys(range).map((monthKey) => {
    const placedCount = orders.filter((order) => isSameMonth(toMonthKey(order.input.orderDate), monthKey)).length;
    const arrivedCount = orders.filter(
      (order) => order.hasArrived && isSameMonth(toMonthKey(resolveArrivalBucketDate(order.input)), monthKey),
    ).length;
    return { ...monthKey, placedCount, arrivedCount };
  });

  const punctuality = buildPunctuality(orders, todayStart);

  return { recentOrders, upcomingArrivals, overdueArrivals, placedVsArrived, punctuality };
}

/** Overdue reference date for an unfulfilled arrival: window close, or its start when there is no close. */
function resolveArrivalDueDate(order: DashboardOrderInput): Date | null {
  return order.expectedDeliveryTo ?? order.expectedDeliveryFrom;
}

/**
 * Bucket date for an arrived order in the placed-vs-arrived series. No explicit arrival timestamp
 * is persisted yet, so the expected-arrival start is used as the best available proxy, falling back
 * to the order date. Refine once delivery arrival timestamps exist (FRD-06 open question).
 */
function resolveArrivalBucketDate(order: DashboardOrderInput): Date {
  return order.expectedDeliveryFrom ?? order.orderDate;
}

/**
 * Punctuality split among arrived orders that carry an expected window (FR-06-17). Because no
 * arrival timestamp is stored yet, an arrived order counts as on time while the current date is
 * still at or before its window close, and late once that date has passed. This is an approximation
 * to be replaced when delivery arrival timestamps are available (FRD-06 open question).
 */
function buildPunctuality(orders: DerivedOrder[], todayStart: Date): ArrivalPunctualityAccumulator {
  let onTimeCount = 0;
  let lateCount = 0;
  for (const order of orders) {
    if (!order.hasArrived) {
      continue;
    }
    const dueDate = resolveArrivalDueDate(order.input);
    if (dueDate === null) {
      continue;
    }
    if (todayStart.getTime() <= dueDate.getTime()) {
      onTimeCount += 1;
    } else {
      lateCount += 1;
    }
  }
  return { onTimeCount, lateCount };
}

type ArrivalPunctualityAccumulator = { onTimeCount: number; lateCount: number };

function buildCollection(orders: DerivedOrder[], baseCurrencyCode: string | null): CollectionBlock {
  const totalOrders = orders.length;
  const totalProducts = orders.reduce(
    (sum, order) => sum + order.input.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  const statusDistribution = buildStatusDistribution(orders);
  const productCountByType = buildProductCountByType(orders);
  const spendByType = buildSpendByType(orders, baseCurrencyCode);
  const topStores = buildTopStores(orders, baseCurrencyCode);

  return {
    totalOrders,
    totalProducts,
    statusDistribution,
    spendByType: spendByType.entries,
    spendByTypeIsPartial: spendByType.isPartial,
    productCountByType,
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

/**
 * Committed spend grouped by product type (FR-06-11). Committed value (`Σ unitPrice × quantity`)
 * is used because payments are order-level and cannot be attributed to a single product type;
 * FX-excluded orders are dropped and reported via the partial flag.
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
    for (const item of order.input.items) {
      const committedInOrderCurrency = (item.unitPrice ?? 0) * item.quantity;
      const converted = convertOrderAmount(order.input, committedInOrderCurrency, baseCurrencyCode);
      if (converted === null) {
        isPartial = true;
        continue;
      }
      totals.set(item.productTypeKey, (totals.get(item.productTypeKey) ?? 0) + converted);
    }
  }

  const entries = Array.from(totals.entries())
    .map(([productTypeKey, committedMinor]) => ({ productTypeKey, committedMinor }))
    .sort((a, b) => b.committedMinor - a.committedMinor);
  return { entries, isPartial };
}

function buildTopStores(
  orders: DerivedOrder[],
  baseCurrencyCode: string | null,
): { entries: CollectionBlock["topStores"]; isPartial: boolean } {
  const byStore = new Map<string, { storeName: string; committedMinor: number; orderCount: number }>();
  let isPartial = false;

  for (const order of orders) {
    const entry = byStore.get(order.input.store.id) ?? {
      storeName: order.input.store.name,
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
 * Pure aggregation entry point: turns raw orders plus the collector's currency/budget/timezone
 * context into the single `DashboardData` payload consumed by every zone. Deterministic given its
 * inputs (including `now`), so it is unit-tested directly without a database.
 */
export function buildDashboardData(input: BuildDashboardDataInput): DashboardData {
  const { orders, now, baseCurrencyCode, budgetAmountMinor, budgetResetDayOfMonth } = input;
  const timeZone = resolveTimeZone(input.timezone);
  const range = input.range ?? getDefaultDashboardRange(now, timeZone);

  const nonCancelled = orders.filter((order) => !isCancelled(order.status)).map(deriveOrder);

  return {
    baseCurrencyCode,
    baseCurrencyConfigured: baseCurrencyCode !== null,
    timezone: timeZone,
    generatedAt: now,
    range,
    cashObligations: buildCashObligations(nonCancelled, baseCurrencyCode, now, timeZone),
    budget: buildBudget(nonCancelled, baseCurrencyCode, budgetAmountMinor, now, timeZone, budgetResetDayOfMonth),
    spend: buildSpend(nonCancelled, baseCurrencyCode, range, now, timeZone),
    activity: buildActivity(nonCancelled, range, now, timeZone),
    collection: buildCollection(nonCancelled, baseCurrencyCode),
    paidVsOutstanding: buildPaidVsOutstanding(nonCancelled, baseCurrencyCode),
  };
}
