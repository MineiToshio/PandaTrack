/**
 * Formatter for *true instants* — real moments in time such as `AdminAuditLog.createdAt`.
 *
 * Unlike the calendar-day domain dates in `src/lib/domainDate.ts` (stored at UTC midnight,
 * where only the day matters), an audit instant carries a meaningful time-of-day. The audit
 * trail is a compliance record, so every instant is rendered in a single fixed zone (UTC)
 * with a visible label instead of the viewer's local time. Pinning to UTC makes two admins
 * in different timezones read the same string for the same event, which is what an audit log
 * needs. This is why audit instants must not go through the `domainDate` helpers.
 */

/** Display shape: "12 jul 2026, 14:03" (es) / "Jul 12, 2026, 14:03" (en). 24h, no seconds. */
const AUDIT_INSTANT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
};

/**
 * Format an audit instant in UTC for the given locale. `timeZone: "UTC"` is always enforced
 * so the rendered value never drifts with the viewer's timezone; the surrounding UI is
 * responsible for showing the accompanying "UTC" label.
 */
export function formatAuditInstant(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, AUDIT_INSTANT_OPTIONS).format(date);
}
