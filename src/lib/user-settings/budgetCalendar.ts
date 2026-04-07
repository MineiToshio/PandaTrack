/**
 * Budget reset calendar helpers (FR-07-26, FR-07-34).
 * `monthIndex` is 0-based (JavaScript `Date` convention).
 */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Resolves the calendar day (1-31) used as the budget reset anchor for a given month.
 * When `configuredDay` is null, uses the last day of the month.
 * When the configured day does not exist in the month, uses that month's last day.
 */
export function resolveBudgetResetCalendarDay(year: number, monthIndex: number, configuredDay: number | null): number {
  const dim = daysInMonth(year, monthIndex);
  if (configuredDay === null) {
    return dim;
  }
  if (configuredDay < 1) {
    return dim;
  }
  return Math.min(configuredDay, dim);
}
