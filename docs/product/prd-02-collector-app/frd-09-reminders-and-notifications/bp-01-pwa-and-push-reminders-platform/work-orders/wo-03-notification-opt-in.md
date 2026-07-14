---
id: WO-03
type: WORK_ORDER
slug: notification-opt-in
title: Notification Opt-in
status: DRAFT
parent: BP-01
source_features: []
implementation_status: PLANNED
last_updated: 2026-07-13
---

# WO-03 Notification Opt-in

## Summary

Let a collector opt in to reminders from Settings and prove the channel works. This slice adds the Notifications section to the existing settings page, the permission-and-subscribe flow, subscribe / unsubscribe / set-preference / send-test server actions, and the service worker's `push` and `notificationclick` handlers, including deep-linking. No scheduled dispatch yet.

## Prerequisites

- [`WO-01`](wo-01-push-platform-foundation.md): models, Zod schemas, and the `web-push` wrapper
- [`WO-02`](wo-02-pwa-installability.md): the registered service worker these handlers attach to

## In Scope

- a Notifications section inside the existing settings page (`/{locale}/settings`), extending the [`FRD-07`](../../../frd-07-user-settings/frd-07-user-settings.md) settings surface rather than adding a route
- master enable flow: request browser notification permission, and on grant subscribe with the public VAPID key and persist the subscription server-side (`FR-09-07`), upserting by `endpoint` (`FR-09-10`)
- master disable flow: unsubscribe the browser and deactivate/remove the server-side subscription (`FR-09-09`)
- per-type toggles for `PAYMENT_DUE`, `ARRIVAL_DUE`, `ARRIVAL_OVERDUE`, persisted server-side via `NotificationPreference` (`FR-09-08`)
- server actions: `subscribeToPushAction`, `unsubscribeFromPushAction`, `setNotificationPreferenceAction`, `sendTestNotificationAction`, each validating input with the WO-01 Zod schemas and scoped to the session user via `getSession`
- "send test notification" delivering one push to the collector's own active subscriptions immediately (`FR-09-11`)
- service worker `push` handler (render a notification from the payload) and `notificationclick` handler (focus/open the app and navigate to the payload deep link) (`FR-09-05`, `FR-09-18`)
- graceful degradation: `PERMISSION_DENIED` explanatory state with re-enable guidance and no silent retry; `UNSUPPORTED` disabled state when service worker or Push API is unavailable (`FR-09-12`)
- optimistic client updates for the toggles per [`optimistic-client-updates`](../../../../../../.agents/rules/optimistic-client-updates.mdc), reverting on failure
- new next-intl `notifications` namespace registered in `src/i18n/request.ts`, with the test-notification copy (dispatch reminder copy is added in WO-04)
- PostHog events: `notifications_enabled`, `notifications_disabled`, `notification_type_toggled`, `notification_test_sent` under `POSTHOG_EVENTS.NOTIFICATIONS`
- unit tests for the server actions (auth scoping, upsert-by-endpoint, preference persistence, denied/unsupported handling) and at least one E2E covering enable → test send → receive

## Out of Scope

- the scheduled dispatcher, thin candidate queries, cron, and dedup log usage (WO-04)
- reminder-specific localized payloads for the three types (WO-04)
- email or SMS channels
- an in-app notification center

## Requirements

- `FR-09-05`, `FR-09-06`, `FR-09-07`, `FR-09-08`, `FR-09-09`, `FR-09-10`, `FR-09-11`, `FR-09-12`, `FR-09-18`
- `BR-09-01`
- browser subscription contract and preference contract from [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#contracts)

## Blueprints

- [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md): subscription lifecycle, preference storage decision, and the service-worker handler contract

## Analytics

- `notifications_enabled`, `notifications_disabled`, `notification_type_toggled` (carries the type and new state), `notification_test_sent`, finalized per [`posthog-events`](../../../../../../.agents/rules/posthog-events.mdc). Events never carry subscriber keys.

## Notes

- The master on/off is derived from having at least one active subscription, not a stored flag (per the [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#architecture-decisions) decision), so the UI must read subscription state to render the master toggle.
- Re-enabling from the same browser must upsert the existing subscription row, not create a duplicate (`FR-09-10`).
- The `push` / `notificationclick` handlers replace the placeholder body scaffolded in WO-02; the worker version must bump so the update takes effect cleanly.
- On iOS, the collector must have installed the app to the home screen (WO-02) before subscribe can succeed; the denied/unsupported states must communicate this clearly.

## E2E Acceptance Tests

- A collector can open the Notifications section, enable the master toggle, grant permission, and a subscription is persisted server-side.
- With an active subscription, "send test notification" delivers one notification, and clicking it focuses or opens the app.
- Toggling a per-type preference persists server-side and reflects immediately (optimistic), reverting on a forced server failure.
- Disabling the master toggle unsubscribes the browser and removes the server-side subscription so it is no longer targetable.
- A permission-denied browser shows the explanatory blocked state with no silent retry; an unsupported browser shows the disabled state.
