---
id: WO-04
type: WORK_ORDER
slug: scheduled-reminders
title: Scheduled Reminders
status: ACTIVE
parent: BP-01
source_issue: 117
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-14
---

# WO-04 Scheduled Reminders

## Summary

Deliver the reminders themselves: thin due-soon / overdue candidate queries, a `CRON_SECRET`-guarded dispatch route handler, a `vercel.json` daily cron, deduplicated once-only sends, localized deep-linked payloads for the three reminder types, and dispatch observability. This is the slice that turns opt-in subscriptions into actual notifications.

## Prerequisites

- [`WO-01`](wo-01-push-platform-foundation.md): `web-push` wrapper, `NotificationDelivery` dedup model, `NotificationPreference`
- [`WO-03`](wo-03-notification-opt-in.md): real subscriptions and per-type preferences to target, and the service worker `push` handler that renders payloads

## In Scope

- thin dedicated candidate queries under `src/lib/data/notifications/` for the three types, computing each collector's window in their timezone with a `UTC` fallback (`FR-09-15`, `FR-09-21`, `BR-09-03`, `BR-09-04`):
  - upcoming payment: non-cancelled orders with outstanding balance greater than zero whose expected date falls in the payment window (`BR-09-05`, `BR-09-08`)
  - upcoming arrival: not-yet-arrived non-cancelled orders or deliveries whose expected arrival falls in the arrival window (`BR-09-05`, `BR-09-06`)
  - overdue arrival: not-yet-arrived non-cancelled orders or deliveries whose expected-arrival reference date is already past (`BR-09-05`, `BR-09-06`)
- dispatch route handler at `src/app/api/notifications/dispatch/route.ts` guarded by a `CRON_SECRET` bearer check returning `401` before any query or send (`FR-09-13`, `FR-09-20`)
- `vercel.json` cron entry running the dispatcher daily
- per-candidate dispatch logic: skip when the type preference is off or no active subscription exists (`BR-09-01`), skip when a dedup row already exists (`FR-09-16`, `BR-09-02`), otherwise send to every active subscription and write the `NotificationDelivery` row on first successful send
- localized payloads composed with `getTranslations` against the collector's locale using the `notifications` namespace (reminder copy added here), each carrying a deep link to the owning order or delivery detail (`FR-09-17`, `FR-09-18`)
- expired-subscription pruning inline in the send path on `410`/`404` without aborting the batch (`FR-09-19`, `BR-09-07`)
- observability: a run-summary PostHog event (attempted / sent / deduped / pruned by type) and a single Sentry capture only on unexpected failure, with no money, note, or key leakage
- unit tests for window computation and dedup decisioning, plus an integration path exercising query → dispatch → dedup → prune

## Out of Scope

- the settings Notifications UI, subscribe/unsubscribe, and test send (WO-03)
- the manifest, icons, and service-worker registration (WO-02)
- email or SMS channels, in-app notification center, per-order custom reminders (out of scope for the FRD)
- collector-configurable lead-time windows (extension point, not MVP)

## Requirements

- `FR-09-13`, `FR-09-14`, `FR-09-15`, `FR-09-16`, `FR-09-17`, `FR-09-18`, `FR-09-19`, `FR-09-20`, `FR-09-21`
- `BR-09-02`, `BR-09-03`, `BR-09-04`, `BR-09-05`, `BR-09-06`, `BR-09-07`, `BR-09-08`
- dispatch candidate contract, send contract, and dispatch route contract from [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#contracts)

## Blueprints

- [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md): thin-query boundary, timezone windowing, dedup, and secret-guarded dispatch decisions

## Cross-domain notes

- The three candidate queries reuse the _definitions_ established by [`FRD-06 dashboard`](../../../frd-06-dashboard/frd-06-dashboard.md) (`buildUpcomingPayments`, `upcomingArrivals`, `overdueArrivals` in `src/lib/data/dashboard/dashboardAggregation.ts`) and the delivery overdue notion from [`FRD-08 delivery management`](../../../frd-08-delivery-management/frd-08-delivery-management.md) (`getDeliveriesList` `overdueOnly`), but must be implemented as thin queries. The dispatcher must not call `getDashboardData` (`BR-09-04`).
- Deep-link targets are the order detail from [`FRD-05`](../../../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) and the delivery detail from [`FRD-08`](../../../frd-08-delivery-management/frd-08-delivery-management.md).

## Analytics

- one server-side run-summary event under `POSTHOG_EVENTS.NOTIFICATIONS` carrying attempted / sent / deduped / pruned counts by type, finalized per [`posthog-events`](../../../../../../.agents/rules/posthog-events.mdc). No money values, note text, or subscriber keys.

## Notes

- Dedup must rely on the database-level unique constraint from [`WO-01`](wo-01-push-platform-foundation.md), so a same-day re-run or a retry is idempotent (`BR-09-02`).
- Sends must be isolated per subscription so one slow or failing endpoint never stalls or aborts the batch (`BR-09-07`).
- A shifted due date is intentionally a new dedup key and may legitimately reminder again (`BR-09-02`).
- Because `User.timezone` has no settings UI today, most collectors fall back to `UTC`; this is acceptable for MVP but can shift a window by up to a day at the edges (FRD open question).

## Assumptions

- **Locale resolution.** `User` carries no `locale` column today, so every dispatched payload is composed in `routing.defaultLocale` (`es`). The candidate queries expose a nullable `locale` extension point on each candidate and the dispatcher resolves it through `resolveReminderLocale`, which falls back to the default locale when the value is absent. Follow-up: once a `User.locale` (or a locale-capture prompt) ships, select it in the candidate queries and the per-collector localization becomes live with no dispatcher change. This mirrors the existing `User.timezone` `UTC`-fallback gap.
- **Timezone resolution.** Windows and the "today" boundary are computed per collector from `User.timezone`, reusing `resolveTimeZone` and `getTodayStart` (the same civil-day helpers the dashboard and budget cycles use, `BR-09-03`). Because `User.timezone` still has no settings UI, most collectors fall back to `UTC`; a window can therefore shift by up to a day at the edges, which is the accepted MVP tradeoff already noted in the FRD open questions.
- **Window constants.** `REMINDER_PAYMENT_LEAD_DAYS = 3` and `REMINDER_ARRIVAL_LEAD_DAYS = 3` live in `src/lib/notifications/reminderConstants.ts`. Three days is the FRD's suggested "a few days" starting point; the values are internal tuning constants and become collector-configurable in a later extension. A coarse `REMINDER_COARSE_WINDOW_PADDING_DAYS = 1` pads the SQL pre-filter so no candidate is missed at a timezone edge; the authoritative window gate then runs per collector in the pure dispatcher.
- **Thin-query boundary.** The three candidate queries never call `getDashboardData` (`BR-09-04`). Outstanding balance is derived thinly from the transactionally-synced `paidAmountMinor` cache the orders list already trusts (`paidAmountMinor < totalCost`, `BR-09-08`), evaluated over the already window-bounded row set, never by loading the payment graph. Not-yet-arrived orders are filtered with `items: { none: { deliveryState: { not: NONE } } }`, and arrivals from `IN_TRANSIT` deliveries. Each query joins to `user.pushSubscriptions.some({})` so only reachable collectors enter the batch. Payloads select only `id`, the relevant expected dates, `store.name`, and `user.timezone`: never money, note text, or subscriber keys.
- **Cron transport.** Vercel Cron issues a `GET` with an `Authorization: Bearer ${CRON_SECRET}` header when `CRON_SECRET` is set. The route therefore accepts both `GET` (production cron) and `POST` (manual invocation) and validates the bearer identically before any query or send. `CRON_SECRET` already exists in `.env.example`; no new environment variable is introduced.
- **Cron schedule.** `vercel.json` runs `0 9 * * *` (daily, 09:00 UTC). A single daily UTC run is correct because dispatch idempotency comes from the `NotificationDelivery` dedup key, not from the run hour, and each collector's window is resolved in their own timezone at run time. Daily cadence (not hourly) satisfies the WO; 09:00 UTC keeps the run inside daytime hours across the Americas where the collector base sits.

## Dispatch Contract

- **Guard (before any work).** The bearer token must equal `Bearer ${CRON_SECRET}`. A missing/wrong token, or an unset `CRON_SECRET`, returns `401` before any candidate query or send runs (`FR-09-20`, `AC-09-08`), fail-closed.
- **Per-candidate skip rules, in order:**
  1. per-type preference off -> skip (`BR-09-01`, `AC-09-09`).
  2. no active subscription for the collector -> skip (`BR-09-01`).
  3. candidate outside the collector's timezone-resolved window (`due` types: due date in `[today, today + lead)`; `overdue`: reference date before `today`) -> skip.
  4. a `NotificationDelivery` row already exists for `(userId, type, subjectId, dueDate)` -> skip as deduped (`BR-09-02`, `AC-09-05`).
  5. otherwise send to every active subscription; on the first `SENT` write the dedup row; an `EXPIRED` (`410`/`404`) result prunes that subscription inline without aborting the batch (`FR-09-19`, `BR-09-07`, `AC-09-07`); a `TRANSIENT_FAILURE` is counted and the batch continues.
- **Payload.** Composed with `getTranslations({ locale, namespace: "notifications" })` (framework function, never a React hook, `FR-09-17`) carrying only `title`, `body`, a deep-link `url` (`/{locale}/orders/{id}` or `/{locale}/deliveries/{id}`, `FR-09-18`), and a `tag`. Never money, note text, or subscriber keys (send contract).
- **Run summary (route JSON response and PostHog payload).** `{ byType: Record<NotificationType, { attempted, sent, deduped, pruned, transientFailures }>, totals: { attempted, sent, deduped, pruned, transientFailures } }`. `attempted` counts candidates that passed all skip gates and entered the send loop; `sent` counts candidates whose dedup row was written after at least one `SENT`; `deduped` counts candidates skipped by an existing (or concurrently-won) dedup row; `pruned` counts expired endpoints removed; `transientFailures` counts non-expired send failures. The response is a `200` JSON body; unexpected failures are captured once with Sentry and return `500`.
- **Observability.** One server-side `POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATION_DISPATCH_RUN` event carries the run-summary counts by type. No money, note text, or subscriber keys. One Sentry capture only on unexpected failure.

## Technical Notes

- Candidate queries: `src/lib/data/notifications/reminderCandidateQueries.ts` (ADR 0015 shape, `prisma` singleton only) expose `getPaymentDueCandidates`, `getArrivalDueCandidates`, `getArrivalOverdueCandidates`, each returning `ReminderCandidate[]` (userId, type, subjectType, subjectId, dueDate, descriptor = store name, locale extension point, timezone). The SQL windows are coarse; precise per-collector windowing is the dispatcher's job.
- Pure windowing helpers: `src/lib/notifications/reminderWindows.ts` compute the timezone-resolved `today` boundary and the due/overdue predicates. Pure and unit-tested without a database.
- Dispatcher core: `src/lib/notifications/reminderDispatch.ts` is dependency-injected (`DispatchDeps`: candidate loader, preference/subscription lookups, dedup check, delivery recorder, push sender, pruner, translator factory) so it is exercised in isolation with mocked data-layer collaborators. It caches per-collector preferences and subscriptions across a run and never imports the dashboard aggregation.
- Route handler: `src/app/api/notifications/dispatch/route.ts` wires the real deps, exports `GET` and `POST`, and is the only secret-guarded entry point.
- Payload composition (`composeReminderPayload`) is a pure function taking an injected translator, so the no-money invariant is asserted directly.

## Testing and E2E Exemption

Automated coverage is unit and integration only; there is no Playwright E2E for this slice, and this is a deliberate, justified exemption mirroring how [`WO-01`](wo-01-push-platform-foundation.md) documented its own exemption. The dispatch surface is a non-UI, `CRON_SECRET`-guarded route with no collector-facing screen, no routing/redirect/form flow, and no browser state to drive, so an E2E spec would add harness cost without exercising any behavior the unit/integration matrix does not already cover. `AC-09-05`..`AC-09-09` are covered by:

- window/timezone logic and the due/overdue boundaries: `reminderWindows` unit tests.
- dedup skipping, preference skipping, no-subscription skipping, prune-on-expired, transient-continues, sent-and-record, the no-money payload invariant, and the run-summary shape: `reminderDispatch` integration tests with mocked data-layer deps (`AC-09-05`, `AC-09-06`, `AC-09-07`, `AC-09-09`).
- the `401`-before-any-work guard and the correct-secret run: `dispatch` route-handler tests with a mocked dispatcher (`AC-09-08`).
- thin `where`-clause shape (subscription join, non-cancelled, not-arrived, outstanding, window bounds): `reminderCandidateQueries` tests with a mocked `prisma`.

## E2E Acceptance Tests

- An outstanding pre-order payment inside the payment window with the payment type enabled produces exactly one reminder; a second same-day dispatch sends nothing for that subject and due date.
- A not-yet-arrived order or delivery past its expected arrival with the overdue type enabled produces one overdue reminder, and clicking it opens the correct order or delivery detail.
- A collector whose per-type toggle is off receives no reminder of that type.
- A subscription endpoint returning `410 Gone` during a send is pruned, and the rest of the batch completes without a monitored error.
- A dispatch request with a missing or wrong `CRON_SECRET` is rejected with `401` before any query or send runs.
