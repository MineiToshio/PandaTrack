import type { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";

/** Half-open time interval `[start, end)`. All boundaries are UTC-midnight instants. */
export type DateRange = {
  start: Date;
  end: Date;
};

/** Trend-chart window driving the range-controlled series. */
export type DashboardRange = DateRange;

/** Presets offered by the shared trend-chart range control. */
export const DASHBOARD_RANGE_PRESETS = ["3m", "6m", "12m", "ytd", "all"] as const;

export type DashboardRangePreset = (typeof DASHBOARD_RANGE_PRESETS)[number];

/**
 * What the collector picked in the range control. Resolved into a concrete `DashboardRange`
 * server-side, because presets depend on the user's timezone and `all` depends on their data.
 */
export type DashboardRangeSelection = { preset: DashboardRangePreset } | { preset: "custom"; from: Date; to: Date };

/** Calendar month identifier. `month` is 1-12 (not the zero-based `Date` convention). */
export type MonthKey = {
  year: number;
  month: number;
};

/**
 * Result of a base-currency rollup. `totalMinor` sums only reconciled orders;
 * `isPartial` / `excludedOrderCount` surface the FX-exclusion context.
 */
export type BaseCurrencyTotal = {
  totalMinor: number;
  isPartial: boolean;
  excludedOrderCount: number;
};

/** Raw order shape the aggregation layer consumes. Money is in minor units. */
export type DashboardOrderInput = {
  id: string;
  humanReadableId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  exchangeRateBaseCode: string | null;
  totalCost: number;
  status: OrderStatus;
  store: { id: string; name: string; slug: string; logoUrl: string | null };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    productTypeKey: string | null;
    unitPrice: number | null;
    deliveryState: OrderItemDeliveryState;
    /** Dispatch dates of the item's non-cancelled deliveries. Dated evidence that it left the store. */
    deliveryDates: Date[];
  }>;
  payments: Array<{ amount: number; paymentDate: Date }>;
};

/**
 * Raw delivery shape the aggregation layer consumes for spend (`FR-06-07`, `FR-06-08`, `BR-06-04`,
 * `BR-06-09`). Money is in minor units; the currency/exchange-rate fields mirror the order-level FX
 * context so a delivery's cost rolls up through the same base-currency/FX-pending logic as a payment.
 */
export type DashboardDeliveryInput = {
  id: string;
  cost: number;
  currencyCode: string;
  exchangeRate: number | null;
  exchangeRateBaseCode: string | null;
  /** Shipping date: the only date a delivery cost can be bucketed by, since cost has no ledger. */
  deliveryDate: Date;
  status: DeliveryStatus;
};

export type BuildDashboardDataInput = {
  orders: DashboardOrderInput[];
  deliveries: DashboardDeliveryInput[];
  now: Date;
  timezone: string | null;
  baseCurrencyCode: string | null;
  budgetAmountMinor: number | null;
  budgetResetDayOfMonth: number | null;
  range?: DashboardRange;
};

/** Per-month outstanding obligation, base-currency minor units. */
export type MonthlyObligation = MonthKey & {
  totalMinor: number;
};

/**
 * One row of the upcoming payments list. `baseOutstandingMinor` is null when
 * the order is FX-pending, in which case the order-currency amount is shown instead.
 */
export type UpcomingPayment = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  storeLogoUrl: string | null;
  dueDate: Date;
  currencyCode: string;
  outstandingMinor: number;
  baseOutstandingMinor: number | null;
  isFxPending: boolean;
};

export type CashObligationsBlock = {
  /** Due this month: current-month obligations with overdue balances folded in. */
  currentMonth: BaseCurrencyTotal;
  /** Overdue portion folded into the current month (expectedDeliveryFrom before today, balance > 0). */
  overdue: BaseCurrencyTotal;
  /** Forward per-month breakdown bucketed by expected-arrival month. */
  upcomingMonths: MonthlyObligation[];
  upcomingMonthsIsPartial: boolean;
  /** Total outstanding debt: outstanding across all non-cancelled orders. */
  totalOutstanding: BaseCurrencyTotal;
  /** Undated outstanding debt: outstanding of orders with no expected-arrival date. */
  noDateOutstanding: BaseCurrencyTotal;
  /** Per-order detail behind the aggregate obligation figures. */
  upcomingPayments: UpcomingPayment[];
};

export type BudgetStatus = "under" | "warning" | "over";

export type BudgetBlock = {
  isConfigured: boolean;
  budgetAmountMinor: number | null;
  consumedMinor: number;
  consumedIsPartial: boolean;
  percentage: number | null;
  status: BudgetStatus | null;
  /**
   * The collector's configured reset day (`User.budgetResetDayOfMonth`), or null when it means
   * "last day of the month". This is the setting itself, not the current cycle's clamped start day.
   */
  resetDayOfMonth: number | null;
  cycleStart: Date;
  cycleEnd: Date;
};

export type MonthlySpend = MonthKey & {
  totalMinor: number;
};

export type SpendBlock = {
  /** Disbursed this month: payments dated in the current calendar month. */
  currentMonthMinor: number;
  currentMonthIsPartial: boolean;
  /** Spend by month: disbursed payments grouped by month across the range. */
  monthlySeries: MonthlySpend[];
  monthlySeriesIsPartial: boolean;
};

/** Outstanding balance as it stood at the close of a month. */
export type MonthlyOutstanding = MonthKey & {
  totalMinor: number;
};

/** Outstanding debt trend: outstanding balance at each month-end across the range. */
export type OutstandingTrendBlock = {
  series: MonthlyOutstanding[];
  isPartial: boolean;
};

/** Total value of the orders placed in one month, in base currency. */
export type MonthlyCommitted = MonthKey & {
  totalMinor: number;
};

/** Committed-value trend: what the collector took on each month, the counterpart of `SpendBlock`. */
export type CommittedTrendBlock = {
  series: MonthlyCommitted[];
  isPartial: boolean;
};

/** Order summary used by the activity lists (recent / upcoming / overdue). */
export type OrderSummary = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  storeLogoUrl: string | null;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  status: OrderStatus;
  currencyCode: string;
  totalCostMinor: number;
  /** Committed value in base currency, or null when the order cannot be converted. */
  baseTotalCostMinor: number | null;
  outstandingMinor: number;
  /** True when the order is excluded from base-currency totals, so its amount reads in its own currency. */
  isFxPending: boolean;
};

/**
 * One product of an arrival row that the quick-arrival flow can close: still `NONE` or
 * `ARRIVED_AT_STORE`, so it is eligible for a new delivery. Only the arrival lists carry these
 * (the recent-orders list has no quick action), which keeps the payload bounded.
 */
export type ArrivalQuickItem = {
  id: string;
  name: string;
};

/** An arrival-list row: an order summary plus the products its quick-arrival modal would offer. */
export type ArrivalOrderSummary = OrderSummary & {
  quickArrivalItems: ArrivalQuickItem[];
};

/** Orders placed vs arrived, per month. */
export type MonthlyPlacedVsArrived = MonthKey & {
  placedCount: number;
  arrivedCount: number;
};

/**
 * Arrival punctuality among arrived orders. Only orders that carry both an expected
 * window and dated arrival evidence can be judged; the rest are counted as `unknownCount` rather
 * than being guessed into one of the two buckets.
 */
export type ArrivalPunctuality = {
  onTimeCount: number;
  lateCount: number;
  unknownCount: number;
};

export type ActivityBlock = {
  recentOrders: OrderSummary[];
  upcomingArrivals: ArrivalOrderSummary[];
  overdueArrivals: ArrivalOrderSummary[];
  placedVsArrived: MonthlyPlacedVsArrived[];
  punctuality: ArrivalPunctuality;
};

export type StatusCount = {
  status: OrderStatus;
  count: number;
};

/** Committed value grouped by product type. */
export type TypeSpend = {
  productTypeKey: string | null;
  committedMinor: number;
};

/** Product quantity grouped by product type. */
export type TypeCount = {
  productTypeKey: string | null;
  quantity: number;
};

/** Product quantity grouped by item delivery state (its progress from store to collector). */
export type DeliveryStateCount = {
  state: OrderItemDeliveryState;
  quantity: number;
};

export type TopStore = {
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeLogoUrl: string | null;
  committedMinor: number;
  orderCount: number;
};

export type CollectionBlock = {
  totalOrders: number;
  totalProducts: number;
  /** Distinct stores the collector has bought from, across non-cancelled orders. */
  totalStores: number;
  statusDistribution: StatusCount[];
  spendByType: TypeSpend[];
  spendByTypeIsPartial: boolean;
  productCountByType: TypeCount[];
  /** Product quantity split by delivery state (how much of the collection has arrived). */
  itemDeliveryStates: DeliveryStateCount[];
  topStores: TopStore[];
  topStoresIsPartial: boolean;
};

/** Paid vs outstanding: committed value split into paid and outstanding. */
export type PaidVsOutstandingBlock = {
  committedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  isPartial: boolean;
  excludedOrderCount: number;
};

/**
 * The single payload every dashboard zone consumes. All monetary fields are base-currency
 * minor units and exclude FX-unreconciled orders. When the collector
 * has no base currency configured, `baseCurrencyConfigured` is false and money rollups are zeroed.
 */
export type DashboardData = {
  baseCurrencyCode: string | null;
  baseCurrencyConfigured: boolean;
  timezone: string;
  generatedAt: Date;
  range: DashboardRange;
  cashObligations: CashObligationsBlock;
  budget: BudgetBlock;
  spend: SpendBlock;
  committedTrend: CommittedTrendBlock;
  outstandingTrend: OutstandingTrendBlock;
  activity: ActivityBlock;
  collection: CollectionBlock;
  paidVsOutstanding: PaidVsOutstandingBlock;
  /**
   * "Lost on cancelled": Σ `payment_allocation.amountMinor` over `CANCELLED` orders that still
   * carry allocations — money deliberately retained on a cancelled order and treated as sunk/lost. Base
   * currency, FX-excluded like every other total (`FR-06-13`). `totalMinor` is 0 when no cancelled
   * order retains payments; the surface renders only when it is greater than 0.
   */
  lostOnCancelled: BaseCurrencyTotal;
};
