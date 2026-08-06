import { formatDomainDate, formatDomainShortDate } from "@/lib/domainDate";

const MS_PER_DAY = 86_400_000;

/**
 * Shared arrival-window formatting for the collector's two dense lists: deliveries (a shipment's
 * expected arrival) and orders (the order's own expected delivery). Both answer the same question
 * in the same row shape, so they render it the same way. Promoted out of `deliveries/_utils/`
 * when the orders list started showing the window too.
 */

/**
 * "2 may" — day + short month, no year (list column / mobile meta). Domain dates are
 * stored at midnight UTC, so formatting is pinned to UTC (see `src/lib/domainDate.ts`).
 */
export function formatShortDate(date: Date, locale: string): string {
  return formatDomainShortDate(date, locale);
}

/**
 * Compact expected-arrival window: "15–22 may" (same month), "25 abr – 2 may"
 * (cross-month), or a single short date when only one endpoint exists. Same-month
 * detection uses UTC getters so it matches the UTC-pinned display.
 */
export function formatArrivalWindow(from: Date | null, to: Date | null, locale: string): string | null {
  if (from && to) {
    // A window whose ends are the same day is a single promised date, not a range: image intake
    // writes both ends from one stated date ("llega el 20"), and so does a collector who picks the
    // same day twice. Rendering it as "23–23 jul" reads as a defect.
    if (from.getTime() === to.getTime()) return formatShortDate(to, locale);
    const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
    if (sameMonth) {
      const monthPart = formatDomainDate(to, locale, { month: "short" });
      return `${from.getUTCDate()}–${to.getUTCDate()} ${monthPart}`;
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
