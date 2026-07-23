---
id: WO-07
type: WORK_ORDER
slug: store-rejection-notification
title: Store Rejection Notification
status: DRAFT
parent: BP-01
source_features: []
source_issue: 135
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-07 Store Rejection Notification

## Summary

Add a fourth notification type so a store creator is told when an administrator rejects or removes their store. Unlike the three existing reminder types, which are produced in batch by the daily dispatcher (`WO-04`), this one is event-driven: it fires once, at the moment the admin decision is made, from the store-moderation mutation defined in [`PRD-02 FRD-04` · `WO-09 store-approval-and-removal`](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md), whose admin-facing routing surface is [`PRD-03 FRD-02 moderation console`](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) sitting on the admin identity platform in [`PRD-03 FRD-01`](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md). `WO-09`'s `FR-04-41` fires the `REJECTED` tombstone transition and stores `Store.removalReason`, and its `FR-04-42` already establishes the neutral-by-default, sanction-for-abuse copy pattern this slice mirrors for push copy. `WO-09`'s own Out of Scope names this FRD as the owner of whether and how the creator is notified. Approval never notifies; this slice is rejection-only, per product decision. The slice extends the schema (`NotificationType.STORE_REJECTED`, `NotificationSubjectType.STORE`, a new `NotificationPreference` toggle), reuses the existing subscription/preference/dedup model this FRD already defines, and adds localized copy and a deep link that still resolves after the store itself becomes unreachable.

## In Scope

- Prisma migration adding `STORE_REJECTED` to `NotificationType` and `STORE` to `NotificationSubjectType`, plus `storeRejectedEnabled Boolean @default(true)` on `NotificationPreference`.
- A narrow send helper (for example `notifyStoreRejected(userId, storeId, removalReason)`) in `src/lib/data/notifications/` alongside the existing `notificationMutations.ts`, invoked directly by `WO-09`'s store-removal mutation. It performs the same checks the daily dispatcher performs per candidate (active subscription, master state, `storeRejectedEnabled`) before sending, then writes the `NotificationDelivery` dedup row.
- A localized `storeRejected` (neutral) and `storeRejectedAbuse` (sanction-toned) pair of keys in the `notifications` next-intl namespace (`es` default, `en`), each with `title` / `body`, following the `{ title, body }` shape the namespace already uses for `paymentDue` / `arrivalDue` / `arrivalOverdue`.
- Wiring the per-type toggle into the existing Notifications section in Settings (a fourth row next to the other three), reusing `setNotificationPreferenceAction`.
- A deep link to the store listing (`/{locale}/stores`), chosen because the store's own detail page 404s once it leaves `PENDING`/`APPROVED` (`getStoreBySlug` filters to those two statuses; see [`FRD-04`](../../../frd-04-store-domain/frd-04-store-domain.md#screens-and-data-contract)), so it is not a valid deep-link target after rejection.
- A new PostHog event for the send.
- Unit test coverage for the migration-adjacent data layer, the send helper's gating logic, and the localized copy selection; an E2E scenario exercising the trigger-to-push path at the level this FRD's other slices are tested.

## Out of Scope

- Any change to `FR-09-13` through `FR-09-21`'s daily dispatcher, its thin due-soon/overdue queries, or the `vercel.json` cron. `STORE_REJECTED` never runs through that batch path (`BR-09-10`).
- The admin moderation action itself: the `requireAdmin()` gate, the moderation console inbox, the reject/remove mutation, the audit log, and `Store.removalReason` all belong to [`PRD-02 FRD-04` · `WO-09`](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) and [`PRD-03 FRD-01`](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md) / [`PRD-03 FRD-02`](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md). This slice only defines the notification contract those domains call into (`userId`, `storeId`, `removalReason`) and consumes.
- A `FLAGGED` transition. Only a transition into `StoreStatus.REJECTED` triggers this notification; being flagged for review is not a removal and does not notify the creator.
- Any notification for approval, or for any other store status transition.
- An in-app notification center or notification history surface (still out of scope for the whole FRD, per its own [Out of Scope](../../frd-09-reminders-and-notifications.md#out-of-scope)).
- Defining the abuse-vs-other classification of `removalReason` itself. That classification is produced and owned by `WO-09`; this slice only consumes the resulting value and selects copy from it.

## Requirements

- `FR-09-24`, `FR-09-25`: schema support for the new type, subject, and preference column.
- `FR-09-26`, `FR-09-27`: event-driven send at the moment of rejection, gated by the same opt-in model, deduplicated by the existing `NotificationDelivery` tuple.
- `FR-09-28`: localized, reason-aware copy (neutral default, sanction variant for abuse).
- `FR-09-29`: deep link to the store listing, not the store detail.
- `BR-09-01` (existing): still governs, requiring a subscription, the master state, and the per-type toggle to all hold before any send, including this new type.
- `BR-09-09` through `BR-09-12` (new): rejection-only trigger, event-driven (not batch) delivery, reason-driven copy selection owned by the caller, and no opt-in bypass for this type.
- `AC-09-12` through `AC-09-17` (new): see [`FRD-09` Acceptance Criteria](../../frd-09-reminders-and-notifications.md#acceptance-criteria).

## Blueprints

- [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md): extends the Runtime Components list (a fourth `NotificationType`, the `NotificationPreference` toggle) and the Contracts section (preference contract gains a fourth type; a new event-driven send contract sits alongside the existing dispatch-route contract). Per-type preference storage stays on the dedicated `NotificationPreference` model per the blueprint's existing decision; this slice only adds a column, it does not revisit that decision.
- The send helper reuses the `web-push` wrapper and the `SENT` / `EXPIRED` / `TRANSIENT_FAILURE` result union already defined for the dispatch route, so pruning an expired subscription behaves identically whether the send came from the cron or from this event-driven path.
- Dependency: this slice can only be implemented after [`PRD-02 FRD-04` · `WO-09 store-approval-and-removal`](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) ships its store-removal mutation (the trigger call site) and after the admin platform in [`PRD-03 FRD-01` · `WO-01`](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) exists to gate who can call it. It is otherwise independent of, and can proceed in parallel with, `WO-05` and `WO-06`.

## E2E Acceptance Tests

- An administrator rejects a store whose creator has an active push subscription, the master notification state on, and `storeRejectedEnabled` on: the creator receives one `STORE_REJECTED` push, and clicking it opens the store listing for their locale.
- The same rejection is processed a second time (for example a retried mutation): no second push is sent, because the `NotificationDelivery` dedup row already exists for that (`userId`, `STORE_REJECTED`, storeId) tuple.
- An administrator approves a store: no notification of any kind is sent.
- A rejection whose `removalReason` is abuse-related renders the sanction-toned copy; a rejection with any other `removalReason` renders the neutral copy; both are correctly localized in `es` and `en`.
- A creator with no active subscription, or with the master toggle off, or with `storeRejectedEnabled` off, receives nothing when their store is rejected, exactly as the existing per-type gating already behaves for the other three types.
- The Notifications section in Settings shows a fourth toggle for store-rejection notices and persists it through the existing preference action.

## Assumptions

- **The `removalReason` value is supplied by the caller, not derived here.** `WO-09`'s moderation action decides and passes `Store.removalReason`, including whether it is abuse-related; this slice only branches copy on that value. If `WO-09` ships before its own abuse-vs-other classification is fully settled, the neutral copy is the safe default until one is added.
- **Removal and rejection are the same trigger for this slice.** "Reject" and "remove" both land the store in `StoreStatus.REJECTED` per `WO-09`; there is one notification path for that one terminal transition, not two.
- **The store listing, not a "my stores" surface, is the deep-link target**, because no creator-scoped store list exists in the product today (the `/stores` route is the general public listing). Linking to the store's own detail is not viable, since `getStoreBySlug` already 404s any non-`PENDING`/`APPROVED` store. If a creator-scoped surface ships later, this deep link should move to it.
- **This Work Order takes the next available number in this blueprint (`WO-07`)**, independent of `PRD-02 FRD-04`'s own local numbering (whose blueprint is currently at `WO-09` for `store-approval-and-removal`). `BP-NN` / `WO-NN` numbering is local to each FRD's blueprint tree, so the two sequences are unrelated.

## Technical Notes

- Data layer: the send helper lives in `src/lib/data/notifications/notificationMutations.ts` next to the existing subscribe/unsubscribe/preference writers, keeping the notifications domain self-contained per [`project-structure.mdc`](../../../../../../.agents/rules/project-structure.mdc).
- Dedup key: (`userId`, `type: STORE_REJECTED`, `subjectId: storeId`, `dueDate`), reusing the existing `NotificationDelivery` unique constraint. `dueDate` here holds the rejection decision's date (not a future due date), which is enough to make a retried mutation call idempotent without widening the schema.
- The send helper never throws into the calling mutation: a failure to notify must not block or roll back the moderation action. It follows the same typed-result, single-Sentry-capture discipline as the rest of this FRD's send path.
- Copy resolution uses `getTranslations` server-side at send time, exactly like the daily dispatcher, never a client hook.

## Analytics

- A new event, `POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATION_STORE_REJECTED_SENT` (`notification_store_rejected_sent`), fired server-side on a successful send. It carries whether the copy variant was neutral or sanction-toned but never the store name, the admin's identity, `removalReason`'s free text (if any), or subscriber keys, matching this FRD's existing payload-privacy posture.

## Testing

- Unit: migration-adjacent Prisma client typing (new enum values compile), the send helper's gating branches (subscription/master/per-type on and off, dedup hit, expired-subscription pruning), and the copy-selection branch (abuse vs other, `es` vs `en`).
- E2E: one scenario driving the trigger call site through to a delivered push, covering the acceptance scenarios above, at the same depth [`WO-04`](wo-04-scheduled-reminders.md) uses for its own dispatch scenarios.
