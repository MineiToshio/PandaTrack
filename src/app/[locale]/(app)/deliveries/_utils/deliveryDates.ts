const MS_PER_DAY = 86_400_000;

/** "2 may" — day + short month, no year (list column / mobile meta). */
export function formatShortDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/**
 * Compact expected-arrival window: "15–22 may" (same month), "25 abr – 2 may"
 * (cross-month), or a single short date when only one endpoint exists.
 */
export function formatArrivalWindow(from: Date | null, to: Date | null, locale: string): string | null {
  if (from && to) {
    const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
    if (sameMonth) {
      const monthPart = to.toLocaleDateString(locale, { month: "short" });
      return `${from.getDate()}–${to.getDate()} ${monthPart}`;
    }
    return `${formatShortDate(from, locale)} – ${formatShortDate(to, locale)}`;
  }
  const single = from ?? to;
  return single ? formatShortDate(single, locale) : null;
}

/** Whole days past the expected-arrival end. 0 when not overdue or no window end. */
export function getDeliveryOverdueDays(expectedArrivalTo: Date | null, today: Date): number {
  if (!expectedArrivalTo) return 0;
  const diff = today.getTime() - expectedArrivalTo.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}
