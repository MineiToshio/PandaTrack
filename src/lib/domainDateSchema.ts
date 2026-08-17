import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { isUtcMidnight } from "@/lib/domainDate";

/**
 * Reports a refusal to Sentry, because this refusal is only reachable through a bug and the UI
 * cannot explain it.
 *
 * A collector who trips this sees a generic "validation" toast (most actions) or the raw
 * `DATE_NOT_UTC_MIDNIGHT` code (`markDeliveredAction`). Neither says which screen sent an
 * un-normalized `Date`, and the row is refused rather than written, so nothing is left behind to
 * find later either. Without this the only trace of a regression in `toDomainDate` usage would be a
 * user saying "no me deja guardar".
 *
 * Thrown-and-captured rather than `captureMessage` for the STACK: a Zod 4 refinement gets no `path`
 * (its `ctx` is `{ value, issues, addIssue }`; the field name is attached by the parent schema
 * afterwards), so the frames are what name the culprit — the server action and the schema that ran
 * the parse. The field is then one step away, in that action's own Zod issue path.
 *
 * The `Date` itself is deliberately NOT attached. Its calendar day is the collector's data and is
 * not what is broken; the time-of-day is the whole diagnosis, and it distinguishes the two causes
 * apart at a glance: `05:00:00.000` is a picker's local midnight from Lima, an arbitrary
 * `14:37:12.482` is a raw `new Date()` reaching a calendar-day field.
 *
 * Not noise: normal operation never reaches it, because every client path normalizes with
 * `toDomainDate` (or sends `yyyy-mm-dd` text) before the value crosses the wire.
 *
 * Tags and context ride on the capture call rather than on a `withScope`, so this module needs only
 * `captureException` from the SDK. The action tests that already mock `@sentry/nextjs` mock exactly
 * that one export, and a schema pulled in by ~15 of them must not widen what they have to stub.
 */
function reportNonUtcMidnightDomainDate(date: Date): void {
  Sentry.captureException(new Error("DATE_NOT_UTC_MIDNIGHT: domain date reached the server un-normalized"), {
    tags: { feature: "domain-date", severity: "high" },
    contexts: { domainDate: { timeOfDayUtc: date.toISOString().slice(11, 23) } },
  });
}

/**
 * The Zod boundary for a *domain date* — a calendar-day field (`orderDate`, `paymentDate`,
 * `receivedDate`, `expectedArrival*`, `expectedDelivery*`). Every such field in the app must be
 * declared with this, never with a bare `z.coerce.date()`; `src/test/domain-date-guard.test.ts`
 * enforces that statically.
 *
 * Two kinds of caller reach these schemas, and a bare `z.coerce.date()` is only safe for one:
 *
 *  - a FORM route sends `yyyy-mm-dd` TEXT through `FormData`. Coercion reads a date-only string as
 *    UTC midnight, so the value lands correctly. This is why the order and delivery create/edit
 *    routes were never affected.
 *  - a SERVER ACTION route sends a real `Date` across the RSC boundary. Coercion passes it through
 *    untouched, so a picker's local-midnight value is persisted as that instant: 05:00Z from Lima.
 *    `store_payment`, `order_payment` and `delivery.receivedDate` all collected rows that way.
 *
 * So this schema coerces, and then REFUSES anything not sitting on UTC midnight. It refuses rather
 * than truncating because truncation is not a correct repair: rebuilding a civil day from an
 * instant needs the writer's timezone, and the server does not have it at parse time (a viewer at
 * UTC+9 would be silently moved to the previous day). The client already knows the day it collected
 * — `toDomainDate` in `src/lib/domainDate.ts` is the one-line conversion, and this refusal is what
 * makes forgetting it loud instead of a five-hour drift nobody sees until an audit.
 *
 * The refusal also reports itself (see {@link reportNonUtcMidnightDomainDate}): loud to the writer
 * of the bug, not only to the collector who happens to hit it.
 */
export const domainDateSchema = z.coerce.date().superRefine((date, ctx) => {
  if (isUtcMidnight(date)) {
    return;
  }
  reportNonUtcMidnightDomainDate(date);
  ctx.addIssue({ code: "custom", message: "DATE_NOT_UTC_MIDNIGHT" });
});
