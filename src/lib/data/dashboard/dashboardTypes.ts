import type { OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";

/** Half-open time interval `[start, end)`. All boundaries are UTC-midnight instants. */
export type DateRange = {
  start: Date;
  end: Date;
};

/** Trend-chart window driving the range-controlled series (FR-06-12). */
export type DashboardRange = DateRange;

/** Presets offered by the shared trend-chart range control (FR-06-12). */
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
 * `isPartial` / `excludedOrderCount` surface the FX-exclusion context (FR-06-13).
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
  needsExchangeRateUpdate: boolean;
  totalCost: number;
  status: OrderStatus;
  store: { id: string; name: string; slug: string };
  items: Array<{
    quantity: number;
    productTypeKey: string | null;
    unitPrice: number | null;
    deliveryState: OrderItemDeliveryState;
    /** Dispatch dates of the item's non-cancelled deliveries. Dated evidence that it left the store. */
    deliveryDates: Date[];
  }>;
  payments: Array<{ amount: number; paymentDate: Date }>;
};

export type BuildDashboardDataInput = {
  orders: DashboardOrderInput[];
  now: Date;
  timezone: string | null;
  baseCurrencyCode: string | null;
  budgetAmountMinor: number | null;
  budgetResetDayOfMonth: number | null;
  range?: DashboardRange;
};

/** Per-month outstanding obligation, base-currency minor units (FR-06-03). */
export type MonthlyObligation = MonthKey & {
  totalMinor: number;
};

/**
 * One row of the "próximos pagos" list (FR-06-18). `baseOutstandingMinor` is null when
 * the order is FX-pending, in which case the order-currency amount is shown instead.
 */
export type UpcomingPayment = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  dueDate: Date;
  currencyCode: string;
  outstandingMinor: number;
  baseOutstandingMinor: number | null;
  isFxPending: boolean;
};

export type CashObligationsBlock = {
  /** "A pagar este mes": current-month obligations with overdue balances folded in (FR-06-02). */
  currentMonth: BaseCurrencyTotal;
  /** Overdue portion folded into the current month (expectedDeliveryFrom before today, balance > 0). */
  overdue: BaseCurrencyTotal;
  /** Forward per-month breakdown bucketed by expected-arrival month (FR-06-03). */
  upcomingMonths: MonthlyObligation[];
  upcomingMonthsIsPartial: boolean;
  /** "Deuda viva total": outstanding across all non-cancelled orders (FR-06-04). */
  totalOutstanding: BaseCurrencyTotal;
  /** "Deuda sin fecha": outstanding of orders with no expected-arrival date (FR-06-05). */
  noDateOutstanding: BaseCurrencyTotal;
  /** Per-order detail behind the aggregate obligation figures (FR-06-18). */
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
  /** "Desembolsado este mes": payments dated in the current calendar month (FR-06-07). */
  currentMonthMinor: number;
  currentMonthIsPartial: boolean;
  /** "Gasto por mes": disbursed payments grouped by month across the range (FR-06-08). */
  monthlySeries: MonthlySpend[];
  monthlySeriesIsPartial: boolean;
};

/** Outstanding balance as it stood at the close of a month. */
export type MonthlyOutstanding = MonthKey & {
  totalMinor: number;
};

/** "Deuda viva (tendencia)": outstanding balance at each month-end across the range (FR-06-21). */
export type OutstandingTrendBlock = {
  series: MonthlyOutstanding[];
  isPartial: boolean;
};

/** Order summary used by the activity lists (recent / upcoming / overdue). */
export type OrderSummary = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  status: OrderStatus;
  currencyCode: string;
  totalCostMinor: number;
  /** Committed value in base currency, or null when the order cannot be converted (FR-06-13). */
  baseTotalCostMinor: number | null;
  outstandingMinor: number;
  /** True when the order is excluded from base-currency totals, so its amount reads in its own currency. */
  isFxPending: boolean;
};

/** Orders placed vs arrived, per month (FR-06-09). */
export type MonthlyPlacedVsArrived = MonthKey & {
  placedCount: number;
  arrivedCount: number;
};

/**
 * Arrival punctuality among arrived orders (FR-06-17). Only orders that carry both an expected
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
  upcomingArrivals: OrderSummary[];
  overdueArrivals: OrderSummary[];
  placedVsArrived: MonthlyPlacedVsArrived[];
  punctuality: ArrivalPunctuality;
};

export type StatusCount = {
  status: OrderStatus;
  count: number;
};

/** Committed value grouped by product type (FR-06-11). */
export type TypeSpend = {
  productTypeKey: string | null;
  committedMinor: number;
};

/** Product quantity grouped by product type (FR-06-20). */
export type TypeCount = {
  productTypeKey: string | null;
  quantity: number;
};

export type TopStore = {
  storeId: string;
  storeName: string;
  storeSlug: string;
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
  topStores: TopStore[];
  topStoresIsPartial: boolean;
};

/** "Pagado vs pendiente": committed value split into paid and outstanding (FR-06-19). */
export type PaidVsOutstandingBlock = {
  committedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  isPartial: boolean;
  excludedOrderCount: number;
};

/**
 * The single payload every dashboard zone consumes. All monetary fields are base-currency
 * minor units (FR-06-14) and exclude FX-unreconciled orders (FR-06-13). When the collector
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
  outstandingTrend: OutstandingTrendBlock;
  activity: ActivityBlock;
  collection: CollectionBlock;
  paidVsOutstanding: PaidVsOutstandingBlock;
};
