/**
 * Formatting + conversion helpers for *domain dates* — calendar-day values such as
 * `orderDate`, `deliveryDate`, `expectedArrival*`/`expectedDelivery*`, `receivedDate`,
 * and `paymentDate`. These are persisted as `DateTime` at midnight UTC. The stored instant
 * carries no meaningful time-of-day — only its UTC calendar day matters.
 *
 * MANDATORY, for every domain date, on both sides of the wire:
 *
 *  1. WRITING. A client that hands a `Date` to a Server Action MUST convert it with
 *     `toDomainDate` (or send the `yyyy-mm-dd` text from `toLocalIsoDateString`) FIRST.
 *     A `Date` survives the RSC boundary as the exact instant it holds, so a picker's
 *     local-midnight value arrives as that day at 05:00Z in Lima, 03:00Z in Madrid — a
 *     row that is silently off the midnight all the other rows sit on. Normalizing has to
 *     happen on the CLIENT: only the client knows which civil day the user picked, so the
 *     server cannot rebuild it from the instant alone. The server side of that contract is
 *     `domainDateSchema` (`src/lib/domainDateSchema.ts`), which refuses a `Date` that did
 *     not go through this step instead of persisting the skew.
 *  2. READING. Any surface that DISPLAYS a server-loaded domain date MUST format it with
 *     `timeZone: "UTC"` (i.e. via `formatDomainDate`) so the day shown matches the day the
 *     user entered. Without it, viewers west of UTC (the Americas) see the previous day.
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

/**
 * Serialize a UTC-midnight domain date back to its `yyyy-mm-dd` string, or `undefined`
 * when there is no date. Used at server-side query boundaries (list filter chips, URL
 * params) that already hold a domain `Date` and need its calendar day as text. Relies on
 * `toISOString()` rather than local getters because the value is a UTC-anchored domain
 * date, not a local-time boundary — see the module docs above.
 */
export function domainDateToIsoString(date: Date | undefined): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

/**
 * Serialize a picker's LOCAL-midnight `Date` (as emitted by `DatePickerInput`) to its `yyyy-mm-dd`
 * string using local getters, never `toISOString()`. `toISOString()` first converts to UTC, which
 * shifts the calendar day backward for any viewer EAST of UTC (Europe, most of Asia) — a picker
 * selection of "8 Aug" silently becomes "7 Aug" once it crosses the wire. Viewers west of UTC (the
 * Americas, including Lima) are unaffected by this specific defect: local midnight converts FORWARD
 * into the same UTC day, so the wrong serializer happens to read back the right one there, which is
 * exactly why it can ship unnoticed from a Lima-only test pass. Use this at every form boundary that
 * reads a `DatePickerInput` value and needs it as text for a domain date field (`paymentDate`, etc.).
 */
export function toLocalIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert a picker's local-midnight `Date` into the UTC-midnight domain `Date` carrying the SAME
 * calendar day, ready to compare against or persist alongside other domain dates.
 */
export function toDomainDate(date: Date): Date {
  return new Date(`${toLocalIsoDateString(date)}T00:00:00.000Z`);
}

/**
 * Whether a `Date` sits exactly on UTC midnight, i.e. whether it is shaped like a domain date at
 * all. This is the predicate `domainDateSchema` refuses on: a value that fails it reached the
 * server without going through `toDomainDate`, and persisting it would put the row on a different
 * instant than every other domain date in the collection.
 *
 * Kept here, next to the writers, and deliberately free of any Zod import: this module is pulled
 * into ~20 client bundles for `formatDomainDate`, and none of them should carry a validator.
 */
export function isUtcMidnight(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}
