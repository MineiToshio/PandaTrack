---
id: FRD-09
type: FRD
slug: reminders-and-notifications
title: Reminders and Notifications
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-07-14
source_features: []
implementation_status: IMPLEMENTED
---

# FRD-09 Reminders and Notifications

## Overview

Define how PandaTrack becomes an installable Progressive Web App (PWA) and delivers timely reminder notifications to collectors through the Web Push standard. The reminders cover the three follow-up moments a collector most often misses: an upcoming pre-order payment, an upcoming order or delivery arrival, and an arrival that is already overdue.

This FRD is the surface the parent PRD reserved. [`PRD-02`](../prd-02-collector-app.md) lists "Reminders and alerts" as MVP workflow priority 8 and states they are "planned as a separate upcoming FRD delivered as a PWA with Web Push". [`FRD-06`](../frd-06-dashboard/frd-06-dashboard.md#out-of-scope) also defers all reminder and notification behavior to this FRD. This document turns that deferral into a concrete, testable scope.

The reminder surface is opt-in. A collector enables it from Settings, which extends the settings domain owned by [`FRD-07 user settings`](../frd-07-user-settings/frd-07-user-settings.md). Nothing is sent until the collector grants browser permission and PandaTrack holds an active push subscription for them.

## Domain Goal

Give collectors dependable, low-noise reminders so they stop relying on chats, screenshots, and memory to remember what to pay and what to chase, while keeping PandaTrack installable on a phone home screen like a native app.

## Current State

### Implemented

- Nothing in this FRD's scope ships yet. There is no service worker, no web app manifest, no PWA icon set, no push subscription model, and no scheduled dispatch. The app is a standard Next.js web app with a single top HTML layout at `src/app/[locale]/layout.tsx` (there is no separate root layout).
- The foundations this FRD reuses already exist:
  - `User.timezone` is present in `prisma/schema.prisma`. It is read, validated, and patched server-side, but has no settings UI and is excluded from the settings snapshot, so in practice the `UTC` fallback applies today (see [`FRD-07 · FR-07-34`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements)). This FRD's dispatch windowing depends on the same timezone value and inherits the same `UTC` fallback.
  - The dashboard aggregation in `src/lib/data/dashboard/dashboardAggregation.ts` already derives the exact concepts this FRD reminds on: `buildUpcomingPayments` (dated outstanding orders), `upcomingArrivals` (not-yet-arrived orders inside a forward window), and `overdueArrivals` (not-yet-arrived orders past their expected-arrival reference date). This FRD reuses the _definitions_ but must not reuse the heavy `getDashboardData` path (see Implementation Notes).
  - The deliveries data layer already exposes an overdue notion: `getDeliveriesList` supports an `overdueOnly` filter over `IN_TRANSIT` deliveries whose `expectedArrivalTo` is past ([`FRD-08 delivery management`](../frd-08-delivery-management/frd-08-delivery-management.md)).
  - Session access for server actions and route handlers is provided by `getSession` in `src/lib/auth/auth-server.ts`.
  - Locale message namespaces are wired in `src/i18n/request.ts`; this FRD adds one namespace (`notifications`).

### Planned

- The full PWA installability layer: web app manifest, PWA icon set, and a hand-rolled service worker registered on authenticated app load.
- A push subscription platform: Prisma models, a `web-push` wrapper, VAPID key plumbing, and subscribe / unsubscribe server actions.
- A Notifications section in Settings with a master enable toggle plus per-type toggles and a "send test notification" action.
- A scheduled, timezone-aware daily dispatcher that sends the three reminder types once each, guarded by a shared secret, with a send-dedup log and localized, deep-linked payloads.

## User Stories

### US-09-01 Install PandaTrack like an app

As a collector, I want to add PandaTrack to my phone home screen and open it full-screen, so it feels like a real app I check often.

### US-09-02 Be reminded before a payment is due

As a collector with pre-orders, I want a reminder before a payment's expected date, so I do not miss it or lose the seller's trust.

### US-09-03 Be reminded about arrivals

As a collector who waits long periods, I want a reminder when an order or delivery is expected to arrive, and a nudge when it is already overdue, so I know when to follow up with the store.

### US-09-04 Control which reminders I receive

As a collector, I want to turn reminders on or off and choose which kinds I get, so PandaTrack stays useful without becoming noisy.

## Functional Requirements

### PWA installability

- `FR-09-01`: The collector app must be installable as a PWA, satisfying the baseline install criteria: a linked web app manifest, a registered service worker, and a maskable icon set.
- `FR-09-02`: The web app manifest must be served through the Next.js metadata route `src/app/manifest.ts`. It must declare `name`, `short_name`, `start_url`, `scope`, `display: standalone`, and `theme_color` / `background_color` values sourced from the design tokens rather than hardcoded hex duplicated from elsewhere.
- `FR-09-03`: The app must ship a PWA icon set at `192x192`, `512x512`, and a `512x512` maskable variant, generated from the existing `src/app/icon.svg` and served from `public/`. The locale layout metadata must also expose `appleWebApp` and `themeColor` so iOS installs render correctly.
- `FR-09-04`: A service worker must be registered when an authenticated collector loads the app. Registration must be idempotent (registering when a worker already controls the page must not create duplicates) and must fail closed (a registration error must not break the app shell).
- `FR-09-05`: The service worker must be a hand-rolled plain-JavaScript file at `public/sw.js`. It must handle the `push` event (render a notification from the payload) and the `notificationclick` event (focus or open the app and navigate to the reminder's deep link).

### Opt-in and subscription management

- `FR-09-06`: Reminders must be off by default. No notification may be sent unless the collector has explicitly opted in from Settings and PandaTrack holds an active push subscription for them.
- `FR-09-07`: The master enable action must request browser notification permission and, on grant, create a push subscription (using the public VAPID key) and persist it server-side against the collector.
- `FR-09-08`: The collector must be able to toggle each reminder type independently: upcoming payment, upcoming arrival, and overdue arrival. Per-type preferences must be stored server-side so the dispatcher can honor them without a live client.
- `FR-09-09`: Disabling the master toggle must unsubscribe the browser and deactivate or remove the corresponding server-side subscription so the dispatcher stops targeting it.
- `FR-09-10`: A push subscription must be uniquely keyed by its `endpoint`. Re-subscribing from the same browser must upsert (update keys and `lastSeenAt`) rather than create a duplicate row.
- `FR-09-11`: The Notifications section must expose a "send test notification" action that delivers one push to the collector's own active subscriptions immediately, so the collector can confirm the channel works.
- `FR-09-12`: When browser permission is denied, the flow must degrade gracefully: it must not retry silently, must reflect the denied state, and must explain how to re-enable permission at the browser level. When the browser does not support the required APIs (service workers or the Push API), the master toggle must be disabled with an explanation instead of erroring.

### Reminder content and dispatch

- `FR-09-13`: Reminders must be produced by a scheduled server-side dispatcher on a daily cadence, not by client polling.
- `FR-09-14`: The dispatcher must support exactly three reminder types for MVP: (a) upcoming pre-order payment due, (b) upcoming order or delivery arrival, and (c) overdue arrival.
- `FR-09-15`: Reminder windowing must be timezone-aware using `User.timezone`, falling back to `UTC` when it is not set, mirroring the budget-cycle rule in [`FRD-07 · FR-07-34`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements).
- `FR-09-16`: Each reminder must be sent at most once. Deduplication must be keyed by the tuple (`userId`, reminder `type`, subject id, due date) and recorded in a send-log so a repeated daily run does not resend an already-sent reminder.
- `FR-09-17`: Notification copy must be localized to the collector's own locale using the next-intl `notifications` namespace, resolved server-side at dispatch time (not with a React hook).
- `FR-09-18`: Clicking a notification must deep-link to the relevant detail surface: the order detail for payment and order-arrival reminders, and the delivery detail for delivery-arrival reminders.
- `FR-09-19`: A push endpoint that reports itself gone (HTTP `410 Gone`, and `404 Not Found`) during a send must be pruned server-side. An expired subscription is an expected outcome, not a monitored failure.
- `FR-09-20`: The dispatch route handler must be guarded by a `CRON_SECRET` bearer check. A request without the correct secret must be rejected with `401` before any query or send runs.
- `FR-09-21`: The dispatcher must load candidates through thin, dedicated due-soon / overdue queries (who has a payment or arrival inside the window), not by running the full `getDashboardData` aggregation per collector.

## Business Rules

- `BR-09-01`: Reminders are strictly opt-in. A notification is sent only when all three conditions hold: an active push subscription exists, the collector's master toggle is on, and the specific reminder type's toggle is on.
- `BR-09-02`: A reminder for a given (`userId`, `type`, subject id, due date) is delivered once. The dedup log is the source of truth; a due date that shifts (for example the collector edits an expected-arrival date) is a new dedup key and may legitimately produce a fresh reminder.
- `BR-09-03`: Windowing and "today" boundaries are computed in the collector's timezone, falling back to `UTC`, consistent with how budget cycles are computed in the settings domain.
- `BR-09-04`: The dispatcher never reuses the dashboard's full aggregation. Dashboard aggregation loads every order, payment, delivery, and derivation for a rich screen; the dispatcher needs only the small set of subjects due inside the window.
- `BR-09-05`: The three reminder subjects reuse the domains' existing definitions of "due" and "arrived": a payment reminder targets a non-cancelled order with outstanding balance greater than zero whose expected date falls in the payment window; an arrival reminder targets a not-yet-arrived non-cancelled order or delivery whose expected arrival falls in the arrival window; an overdue reminder targets a not-yet-arrived non-cancelled order or delivery whose expected arrival reference date is already past.
- `BR-09-06`: Cancelled orders and cancelled deliveries are never reminded on, matching how they are excluded from dashboard obligations and spend.
- `BR-09-07`: Pruning an expired subscription is a normal lifecycle event. It must not raise a monitored error and must not abort the rest of the dispatch batch.
- `BR-09-08`: A payment reminder is produced only when the order still has an outstanding balance (`outstanding > 0`). A fully paid order never triggers a payment reminder even if its expected date is inside the window.

## Acceptance Criteria

### `AC-09-01`

- Given a collector opens the app on a supporting mobile browser
- When the browser evaluates install criteria
- Then the manifest, a registered service worker, and a maskable icon are all present
- And the collector can install PandaTrack to the home screen and open it in standalone display

### `AC-09-02`

- Given a collector opens the Notifications section in Settings and enables the master toggle
- When the browser grants notification permission
- Then a push subscription is created and persisted server-side for that collector
- And re-enabling from the same browser upserts the same subscription rather than creating a duplicate

### `AC-09-03`

- Given a collector has permission denied at the browser level
- When they open the Notifications section
- Then the master toggle reflects the blocked state and explains how to re-enable it
- And no silent permission retry occurs

### `AC-09-04`

- Given a collector with an active subscription
- When they trigger "send test notification"
- Then one notification is delivered to their active subscriptions
- And clicking it focuses or opens the app

### `AC-09-05`

- Given a collector has an outstanding pre-order payment whose expected date falls inside the payment window and the payment reminder type is enabled
- When the daily dispatcher runs
- Then exactly one payment reminder is sent
- And a second run on the same day sends nothing for that same subject and due date

### `AC-09-06`

- Given a collector has a not-yet-arrived order or delivery whose expected arrival is already past and the overdue reminder type is enabled
- When the daily dispatcher runs
- Then one overdue-arrival reminder is sent
- And clicking it opens the correct order or delivery detail

### `AC-09-07`

- Given a subscription endpoint returns `410 Gone` during a send
- When the dispatcher processes that send
- Then that subscription is pruned server-side
- And the rest of the batch still completes without a monitored error

### `AC-09-08`

- Given the dispatch route handler receives a request
- When the `CRON_SECRET` bearer token is missing or wrong
- Then the request is rejected with `401` before any query or send runs

### `AC-09-09`

- Given a collector whose per-type toggle for a reminder type is off
- When the dispatcher would otherwise produce that reminder for them
- Then no notification of that type is sent to them

## Implementation Notes

- The service worker is hand-rolled plain JavaScript at `public/sw.js`. Do not adopt `workbox`, `serwist`, or `next-pwa`. This is consistent with the repository's hand-roll-by-default posture and the UI-primitive libraries policy spirit ([ADR 0010](../../../design/decisions/0010-ui-primitive-libraries-policy.md)). A dedicated ADR for the web-push platform decision (choosing `web-push` plus a hand-rolled worker over a PWA framework) should be created during implementation as the next available ADR number; this FRD does not author it.
- The web app manifest is a Next.js metadata route at `src/app/manifest.ts`; theme and background colors come from the design tokens. The PWA icon set is generated from `src/app/icon.svg` and placed under `public/`. `appleWebApp` and `themeColor` metadata belong on the locale layout at `src/app/[locale]/layout.tsx`, which is the top HTML layout.
- Push sending uses the `web-push` npm package. New environment variables `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `CRON_SECRET` must be added to `.env.example` in the implementing slice per [`env-example.mdc`](../../../../.agents/rules/env-example.mdc).
- New Prisma models: `PushSubscription` (`id`, `userId` FK, `endpoint` unique, `p256dh`, `auth`, `userAgent?`, `createdAt`, `lastSeenAt?`) and a send-dedup log `NotificationDelivery` keyed by (`userId`, `type`, subject id, due date). Both carry `userId` for direct authorization per [`data-layer-user-id-duplication.mdc`](../../../../.agents/rules/data-layer-user-id-duplication.mdc). Data access lives under `src/lib/data/notifications/` as `notificationQueries.ts` and `notificationMutations.ts`, following the singleton data-layer shape ([ADR 0015](../../../design/decisions/0015-data-access-layer-shape.md)).
- Per-type preferences are stored server-side. The Blueprint decides and justifies whether they live on `PushSubscription`, on `User`, or on a dedicated `NotificationPreference` model.
- Scheduled dispatch is a `vercel.json` cron entry hitting a route handler at `src/app/api/notifications/dispatch/route.ts`, guarded by a `CRON_SECRET` bearer check. Cadence is daily and windowing is timezone-aware from `User.timezone`.
- The dispatcher must reuse the _definitions_ of upcoming payment, upcoming arrival, and overdue arrival from the dashboard aggregation ([`FRD-06 dashboard`](../frd-06-dashboard/frd-06-dashboard.md)) and the delivery overdue notion from [`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md), but implement them as thin dedicated queries. Loading `getDashboardData` per collector would be disproportionate for a batch job.
- Notification copy is localized via a new next-intl `notifications` namespace registered in `src/i18n/request.ts`, resolved with `getTranslations` (framework function, not a React hook) at dispatch time.
- `Reminder` appears in the PRD's core entity list; in this design the persisted artifact of a reminder is the `NotificationDelivery` dedup record, not a user-managed reminder object. There is no user-authored reminder in MVP.

## Error Contract

Subscription and dispatch operations use typed, expected outcomes rather than noisy exceptions; only genuinely unexpected failures are captured once in monitoring.

- Opt-in (client): `PERMISSION_DENIED` (browser permission blocked, guidance shown, no silent retry) and `UNSUPPORTED` (service worker or Push API unavailable, toggle disabled with explanation).
- Subscribe / unsubscribe server actions: `SUBSCRIPTION_INVALID` (malformed subscription payload, rejected by Zod at the boundary), `SUBSCRIPTION_NOT_FOUND` (unsubscribe of an endpoint not on file). Both return typed results; the client reconciles UI state.
- Send time: an endpoint returning `410 Gone` or `404 Not Found` yields `SUBSCRIPTION_EXPIRED`, which prunes the subscription and is not a monitored error (`FR-09-19`, `BR-09-07`). A transient send failure is logged with delivery-safe context and does not abort the batch.
- Dispatch route: a missing or wrong secret returns `401 UNAUTHORIZED` before any work (`FR-09-20`). An unexpected dispatch failure (for example a database error) is captured once with Sentry, without leaking subscriber payloads, and the run reports how many reminders were attempted, sent, deduped, and pruned.

## Analytics

Notification events are namespaced under `POSTHOG_EVENTS.NOTIFICATIONS` in `src/lib/constants.ts`:

- installability: `pwa_install_prompt_shown`, `pwa_installed` (from the `appinstalled` event where the browser exposes it).
- opt-in: `notifications_enabled`, `notifications_disabled`, `notification_type_toggled` (carries the type and new on/off state), `notification_test_sent`.
- dispatch observability (server-side): a run summary event carrying attempted / sent / deduped / pruned counts by type. Events never carry order or delivery money values, the note text, or subscriber keys.

## Screens and Data Contract

All authenticated surfaces are scoped to the session user via `getSession`. A subject that does not belong to the user resolves to `404` (not `403`) on any deep link, matching the enumeration-safe rule used across the collector app.

### Notifications section: `/{locale}/settings`

- **Purpose:** opt in or out of reminders and choose which types to receive. Extends the existing settings page rather than adding a new route.
- **Data loaded:** the collector's current notification state (master on/off derived from having any active subscription, per-type preferences) alongside the existing settings snapshot.
- **Actions:** `subscribeToPushAction` (master enable; permission + subscribe + persist), `unsubscribeFromPushAction` (master disable), `setNotificationPreferenceAction` (per-type toggle), `sendTestNotificationAction`.
- **States:** default off; enabled with per-type toggles; permission-denied explanatory state; unsupported-browser disabled state.

### Dispatch route: `/api/notifications/dispatch`

- **Purpose:** the scheduled entry point that produces and sends the day's reminders. Non-UI.
- **Guard:** `CRON_SECRET` bearer check; `401` on failure before any query.
- **Data loaded:** thin due-soon / overdue candidate queries plus each candidate collector's active subscriptions and per-type preferences.
- **Output:** sends localized, deep-linked pushes; writes dedup records; prunes expired subscriptions; returns a run summary.

### Service worker (`/sw.js`) and manifest (`/manifest.webmanifest`)

- **Purpose:** `sw.js` handles `push` and `notificationclick`; the manifest describes the installable app. Both are platform artifacts, not collector-facing screens.

## State Model

### Push subscription lifecycle

| State      | How it is reached                                                        | Dispatcher behavior                       |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `NONE`     | Collector never opted in, or browser permission still `default`          | Not a target                              |
| `ACTIVE`   | Permission granted and a subscription is persisted (`FR-09-07`)          | Targeted, subject to per-type preferences |
| `DISABLED` | Collector turned the master toggle off; subscription removed/deactivated | Not a target                              |
| `EXPIRED`  | A send returned `410`/`404`; subscription pruned (`FR-09-19`)            | Removed; no longer a target               |

Permission denial at the browser level holds the collector at `NONE` and surfaces the `PERMISSION_DENIED` explanatory state; it never silently retries.

### Reminder dedup lifecycle

A reminder subject moves from "due inside window" to "sent" once a `NotificationDelivery` row exists for its (`userId`, `type`, subject id, due date) tuple. The row is the guard that makes daily re-runs idempotent (`FR-09-16`, `BR-09-02`). A changed due date is a new tuple and may reminder again.

## Confirmed

- PandaTrack ships as an installable PWA with a hand-rolled service worker at `public/sw.js`; no PWA framework is adopted.
- Push delivery uses the `web-push` package with VAPID keys supplied by environment variables.
- Reminders are opt-in from Settings, off by default, with a master toggle plus per-type toggles.
- The three MVP reminder types are upcoming payment, upcoming arrival, and overdue arrival.
- Dispatch is a daily `vercel.json` cron hitting a `CRON_SECRET`-guarded route handler, timezone-aware from `User.timezone` with a `UTC` fallback.
- Each reminder is sent once, enforced by a `NotificationDelivery` dedup log.
- The dispatcher uses thin dedicated queries, never the full dashboard aggregation.
- Notification copy is localized per collector locale via a new `notifications` next-intl namespace.
- Notification deep links open the owning order or delivery detail.

## Open Questions

- The exact lead-time windows (how many days before a payment's expected date and before an expected arrival a reminder fires) are implementation constants to tune; a sensible starting point is a few days, but the values are not yet fixed and may become collector-configurable later.
- Whether the overdue reminder repeats (a single nudge versus a periodic reminder while the arrival stays overdue) or fires once per due date; MVP leans to once per due date via the dedup key.
- Whether per-type preferences should live on `User`, on `PushSubscription`, or on a dedicated `NotificationPreference` model; the Blueprint decides and justifies this.
- Whether a lightweight timezone-capture prompt should ship alongside this FRD, given that `User.timezone` currently has no settings UI and the `UTC` fallback otherwise applies to every reminder window.

## Out of Scope

- Email and SMS notifications (this FRD is Web Push only).
- An in-app notification center or notification history surface.
- Offline data support beyond basic installability (no offline reads, writes, caching, or background sync of domain data).
- Per-order custom reminders authored by the collector (custom dates, custom messages, snooze).

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-09-reminders-and-notifications/bp-01-pwa-and-push-reminders-platform/bp-01-pwa-and-push-reminders-platform.md`
