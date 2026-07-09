/**
 * `User.budgetAmount` is persisted in minor units, like every other money column
 * (`Order.totalCost`, `OrderPayment.amount`). The collector still enters whole currency
 * units — the settings boundary converts, and `BUDGET_MINOR_UNITS_PER_MAJOR` divides evenly
 * into every bound below so "no fractional subunits" stays enforceable server-side.
 */
export const BUDGET_MINOR_UNITS_PER_MAJOR = 100;

/**
 * Ceiling is bounded by the `INTEGER` (int4) column, whose max is 2_147_483_647. The largest
 * whole-unit budget that fits is 9_999_999 (→ 999_999_900 minor). Not a practical limit:
 * `Order.totalCost` is int4 too, so orders cap far below this and a larger budget could never
 * be consumed.
 */
export const MAX_BUDGET_AMOUNT_MINOR = 999_999_900;

export const MIN_BUDGET_AMOUNT_MINOR = BUDGET_MINOR_UNITS_PER_MAJOR;

export const BUDGET_RESET_DAY_MIN = 1;
export const BUDGET_RESET_DAY_MAX = 31;
