/**
 * Dashboard aggregation constants shared across the read-only dashboard data layer.
 * These are internal to the dashboard vertical, so they live with the module rather
 * than in the app-wide constants file.
 */

/** Default trend-chart window: the current month plus the previous five (last 6 months). */
export const DASHBOARD_DEFAULT_RANGE_MONTHS = 6;

/** Forward calendar months (beyond the current one) surfaced in the obligations breakdown (FR-06-03). */
export const DASHBOARD_UPCOMING_MONTHS = 3;

/** How many recent orders the activity zone lists (FR-06-10). */
export const DASHBOARD_RECENT_ORDERS_LIMIT = 10;

/** Arrival lookahead window, in days, for "próximas llegadas" (FR-06-10). */
export const DASHBOARD_UPCOMING_ARRIVAL_DAYS = 30;

/** How many stores the collection zone ranks in "top tiendas" (FR-06-11). */
export const DASHBOARD_TOP_STORES_LIMIT = 5;

/**
 * Budget consumption enters the amber "warning" band at this share of the configured budget
 * (FR-06-06). Above 100% the status is `over`, expressed directly as `consumed > budget`.
 */
export const BUDGET_WARNING_THRESHOLD_PERCENT = 80;
