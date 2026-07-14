---
id: WO-03
type: WORK_ORDER
slug: notification-opt-in
title: Notification Opt-in
status: ACTIVE
parent: BP-01
source_issue: 116
source_features: []
implementation_status: IN_PROGRESS
last_updated: 2026-07-14
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

## Assumptions

- Conventions applied: the Notifications section is a `SectionCard` (M07 Chip Eyebrow + Top-Accent pattern) rendered inside the existing Preferences pane, matching how the Interface and Collector cards compose there. No new settings tab or route is added, honoring "extend the settings surface rather than adding a route".
- Owning paths:
  - UI: `src/app/[locale]/(app)/settings/_components/SettingsNotificationsSection.tsx`, wired through `SettingsPrefsPane` (new `initialNotificationPreferences` prop) and `page.tsx` (server-side preference fetch).
  - Server actions: `src/app/[locale]/(app)/settings/_actions/notificationActions.ts` (`subscribeToPushAction`, `unsubscribeFromPushAction`, `setNotificationPreferenceAction`, `sendTestNotificationAction`).
  - Browser subscription helper (extracted + unit-tested): `src/lib/pwa/pushSubscription.ts`.
  - Service worker handlers: extend `public/sw.js`.
  - i18n: settings copy under `settings.notifications.*`; the test-notification payload copy in a new `notifications` namespace (`src/i18n/locales/{es,en}/notifications.json`) registered in `src/i18n/request.ts`.
- Reuse: `Switch`, `SectionCard`, `Eyebrow`, `Button`, `SettingsRow`, `useToast` — no new visual primitives. Icons from `lucide-react` (`Bell`) per the icons rule.
- The master state is derived per browser, not stored: a stored master flag is deliberately not introduced (BP-01 decision).

## UX Notes

State matrix (support x permission x master, per-type gating):

| API support | `Notification.permission` | Master toggle                                                                    | Per-type toggles    |
| ----------- | ------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| unsupported | n/a                       | disabled, `UNSUPPORTED` explanation shown                                        | hidden/disabled     |
| supported   | `default`                 | off (state `NONE`); enabling runs the prompt                                     | disabled while off  |
| supported   | `granted` + subscribed    | on (state `ACTIVE`)                                                              | enabled, optimistic |
| supported   | `granted`, not subscribed | off (`NONE`); enabling re-subscribes + upserts                                   | disabled while off  |
| supported   | `denied`                  | off + `PERMISSION_DENIED` explanatory state, re-enable guidance, no silent retry | disabled            |

- Enabling the master toggle shows an honest pending state while the browser permission prompt and `pushManager.subscribe` resolve; it is not faked as optimistic.
- Per-type toggles (payment due / arrival due / arrival overdue) are optimistic: flip locally, revert + error toast on server failure.
- "Send test notification" is only visible when master is on (`ACTIVE`).

## Technical Notes

- Derived master state: master ON is computed client-side as `Notification.permission === "granted"` AND a live `pushManager.getSubscription()` exists for this browser. There is no `masterEnabled` column; the browser subscription set is the single source of truth (BP-01).
- Endpoint identity for this browser: the browser's own `PushSubscription.endpoint` is the identity key. `subscribeToPushAction` upserts by `endpoint` (`FR-09-10`); `unsubscribeFromPushAction` removes by `endpoint` scoped to the session user and returns `SUBSCRIPTION_NOT_FOUND` when the endpoint is not on file.
- Optimistic exceptions (per `optimistic-client-updates.mdc`): the master enable flow is inherently async because it awaits a browser permission decision and a push-service round-trip, so it reflects a real pending state rather than an optimistic flip. The disable flow and the three per-type toggles remain optimistic. This documented exception satisfies the rule's "justify non-optimistic flows" requirement.
- Analytics: `notifications_enabled` / `notifications_disabled` / `notification_type_toggled` fire client-side (user interactions); `notification_test_sent` fires server-side in `sendTestNotificationAction` where the send truth lives. No event carries subscriber keys.
- Test payload localization uses `getTranslations` against a client-supplied, `routing.locales`-validated locale in `sendTestNotificationAction`; expired endpoints are pruned inline on `410`/`404`.

## E2E Acceptance Tests

- A collector can open the Notifications section, enable the master toggle, grant permission, and a subscription is persisted server-side.
- With an active subscription, "send test notification" delivers one notification, and clicking it focuses or opens the app.
- Toggling a per-type preference persists server-side and reflects immediately (optimistic), reverting on a forced server failure.
- Disabling the master toggle unsubscribes the browser and removes the server-side subscription so it is no longer targetable.
- A permission-denied browser shows the explanatory blocked state with no silent retry; an unsupported browser shows the disabled state.
