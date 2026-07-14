---
id: WO-01
type: WORK_ORDER
slug: push-platform-foundation
title: Push Platform Foundation
status: DRAFT
parent: BP-01
source_features: []
implementation_status: PLANNED
last_updated: 2026-07-13
---

# WO-01 Push Platform Foundation

## Summary

Establish the persistence, validation, transport wrapper, and environment plumbing that every downstream reminder slice depends on: the `PushSubscription`, `NotificationDelivery`, and `NotificationPreference` Prisma models, their migration, the shared Zod schemas, the `web-push` wrapper under `src/lib/push/`, and the VAPID environment variables.

This Work Order is the foundation slice for [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md). By design it ships no UI and no routes. It is validated with unit tests, not with an E2E path.

## In Scope

- Prisma model `PushSubscription`: `id`, `userId` FK (cascade delete), `endpoint` (`@unique`), `p256dh`, `auth`, `userAgent?`, `createdAt`, `lastSeenAt?`. `userId` is duplicated for direct authorization per [`data-layer-user-id-duplication.mdc`](../../../../../../.agents/rules/data-layer-user-id-duplication.mdc).
- Prisma model `NotificationDelivery` (send-dedup log): `id`, `userId` FK, `type` (`NotificationType` enum), `subjectId`, `dueDate`, `sentAt`, with a unique constraint on (`userId`, `type`, `subjectId`, `dueDate`) enforcing once-only delivery (`FR-09-16`, `BR-09-02`).
- Prisma model `NotificationPreference` keyed by `userId`, one boolean per reminder type, per the storage decision in [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#architecture-decisions).
- `NotificationType` enum (`PAYMENT_DUE`, `ARRIVAL_DUE`, `ARRIVAL_OVERDUE`).
- Prisma migration for the new models and enum, following [`prisma-migration-workflow.mdc`](../../../../../../.agents/rules/prisma-migration-workflow.mdc).
- shared Zod schemas: the browser subscription payload (`endpoint`, `keys.p256dh`, `keys.auth`, optional `userAgent`) and the preference mutation input (`type`, boolean), consumed by WO-03 and WO-04.
- `web-push` wrapper under `src/lib/push/`: initializes VAPID details from env once, sends one payload to one subscription, and returns a typed result union (`SENT`, `EXPIRED` on `410`/`404`, `TRANSIENT_FAILURE`).
- notification data-access skeleton under `src/lib/data/notifications/` (`notificationQueries.ts`, `notificationMutations.ts`) with entry points and stubs later slices fill in, singleton import per [ADR 0015](../../../../../design/decisions/0015-data-access-layer-shape.md).
- add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `CRON_SECRET` to `.env.example` with explanatory comments per [`env-example.mdc`](../../../../../../.agents/rules/env-example.mdc).
- unit tests for the send-result classification (mapping `410`/`404` to `EXPIRED`, other errors to `TRANSIENT_FAILURE`, success to `SENT`) and for the Zod schemas.

## Out of Scope

- any UI, including the settings Notifications section
- the service worker and manifest (WO-02)
- subscribe / unsubscribe / preference / test-send server actions (WO-03)
- the dispatch route, cron, and thin candidate queries (WO-04)
- PostHog events (belong to the vertical slices that introduce user-visible actions)

## Requirements

- `FR-09-10`, `FR-09-16`, `FR-09-19`
- `BR-09-01`, `BR-09-02`, `BR-09-07`
- storage decision and send contract from [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#architecture-decisions)

## Blueprints

- [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md): persistence, per-type preference storage decision, and the send contract this foundation implements

## Notes

- The `NotificationDelivery` unique constraint must be enforced at the database level, not only in code, so a same-day re-run or a mid-batch crash cannot double-send (`BR-09-02`).
- The `web-push` wrapper is the only module that imports `web-push`; VAPID details are configured once from env. The private key must never be referenced from client code.
- This foundation intentionally excludes any server action tied to a user-facing flow; those belong to WO-03 and WO-04.

## E2E Acceptance Tests

This foundation slice is exempt from the "must include an E2E acceptance path" rule because by design it ships no UI.

Validation is done via unit tests that cover, at minimum:

- the send wrapper maps a `410 Gone` and a `404 Not Found` result to `EXPIRED`, a generic failure to `TRANSIENT_FAILURE`, and a success to `SENT`
- the subscription Zod schema rejects a payload missing `endpoint` or either key, and accepts a well-formed payload with and without `userAgent`
- the preference Zod schema accepts each `NotificationType` with a boolean and rejects an unknown type
- the migration creates the (`userId`, `type`, `subjectId`, `dueDate`) unique constraint on `NotificationDelivery`
