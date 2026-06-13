/**
 * Formatting + conversion helpers for *domain dates* — calendar-day values such as
 * `orderDate`, `deliveryDate`, `expectedArrival*`/`expectedDelivery*`, `receivedDate`,
 * and `paymentDate`. These are persisted as `DateTime` at midnight UTC: the form sends a
 * `yyyy-mm-dd` string and Zod's `z.coerce.date` interprets it as UTC midnight. The stored
 * instant carries no meaningful time-of-day — only its UTC calendar day matters.
 *
 * Any surface that DISPLAYS a server-loaded domain date MUST format it with
 * `timeZone: "UTC"` so the day shown matches the day the user entered, regardless of the
 * viewer's timezone. Without it, viewers west of UTC (the Americas) see the previous day
 * (off-by-one).
 *
 * Do NOT use these for true timestamps (`createdAt`, `updatedAt`, audit-log instants) —
 * those represent real moments and should render in the viewer's local time. For
 * local-time filter/form boundary math see `src/lib/localDate.ts`.
 */

/** Default display shape: "12 may 2026". */
const LONG_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

/** Compact display shape (no year): "12 may". */
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/**
 * Format a server-origin domain date pinned to its UTC calendar day. Pass any
 * `Intl.DateTimeFormatOptions`; `timeZone: "UTC"` is always enforced and cannot be
 * overridden by the caller.
 */
export function formatDomainDate(date: Date, locale: string, options: Intl.DateTimeFormatOptions = LONG_DATE): string {
  return date.toLocaleDateString(locale, { ...options, timeZone: "UTC" });
}

/** "12 may" — day + short month, no year. */
export function formatDomainShortDate(date: Date, locale: string): string {
  return formatDomainDate(date, locale, SHORT_DATE);
}

/**
 * Convert a UTC-midnight domain date into a local-midnight `Date` carrying the SAME
 * calendar day. Edit forms prefill a local-time date picker (react-day-picker emits
 * local-midnight dates) and re-serialize the selection with local getters; feeding the
 * raw UTC instant would shift the day in non-UTC zones — showing AND silently saving the
 * wrong day. Convert at prefill so the picker, the change summary, and the submitted
 * value all agree on the calendar day in every timezone.
 */
export function utcDomainDateToLocal(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
