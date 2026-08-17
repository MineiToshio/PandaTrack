/**
 * Domain-date builders for tests.
 *
 * A domain date is a calendar day pinned to UTC midnight (see `src/lib/domainDate.ts`), and
 * `domainDateSchema` refuses anything else. `new Date()` is a clock reading, not a calendar day:
 * using it as an `orderDate` / `paymentDate` / `receivedDate` fixture asserts against an input no
 * client can produce, and used to pass only because the schemas coerced without checking.
 */

/** Today's calendar day at UTC midnight. Always <= `new Date()`, so it never reads as "in future". */
export function utcMidnightToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Shifts a UTC-midnight domain date by whole days, staying on UTC midnight. */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
