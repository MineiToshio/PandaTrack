---
id: WO-04
type: WORK_ORDER
slug: scheduled-reminders
title: Scheduled Reminders
status: DRAFT
parent: BP-01
source_issue: 117
source_features: []
implementation_status: PLANNED
last_updated: 2026-07-13
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

## E2E Acceptance Tests

- An outstanding pre-order payment inside the payment window with the payment type enabled produces exactly one reminder; a second same-day dispatch sends nothing for that subject and due date.
- A not-yet-arrived order or delivery past its expected arrival with the overdue type enabled produces one overdue reminder, and clicking it opens the correct order or delivery detail.
- A collector whose per-type toggle is off receives no reminder of that type.
- A subscription endpoint returning `410 Gone` during a send is pruned, and the rest of the batch completes without a monitored error.
- A dispatch request with a missing or wrong `CRON_SECRET` is rejected with `401` before any query or send runs.
