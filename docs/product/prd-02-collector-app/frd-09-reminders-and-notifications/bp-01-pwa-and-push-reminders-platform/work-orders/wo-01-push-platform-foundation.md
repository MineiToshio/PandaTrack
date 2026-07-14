---
id: WO-01
type: WORK_ORDER
slug: push-platform-foundation
title: Push Platform Foundation
status: ACTIVE
parent: BP-01
source_issue: 114
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-14
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

## Assumptions

Convention decisions and the owning file path for each deliverable, resolved by inspecting existing siblings:

- **Prisma schema.** Models and enums live in `prisma/schema.prisma`. Naming mirrors existing sibling models: `cuid()` string ids, `@map`/`@@map` to snake_case table names, `onDelete: Cascade` for collector-owned child records, duplicated `userId` for direct authorization (matching `OrderItem`, `OrderPayment`, `Delivery`).
- **Zod schemas.** Placed in `src/lib/notifications/notificationValidation.ts`, following the domain-validation convention already used by `src/lib/deliveries/deliveryValidation.ts` and `src/lib/orders/orderValidation.ts` (a `src/lib/<domain>/<domain>Validation.ts` helper consumed by the data layer and server actions). The `NotificationType` union is derived from the generated Prisma enum via `z.enum(NotificationType)` so validation stays in lockstep with the schema.
- **web-push wrapper.** Placed in `src/lib/push/webPush.ts` (barrel `src/lib/push/index.ts`). It is the only module in the codebase that imports `web-push`.
- **Data-access modules.** Placed in `src/lib/data/notifications/notificationQueries.ts` and `notificationMutations.ts`, importing the `prisma` singleton from `@/lib/prisma` per ADR 0015. Tests are co-located under `src/lib/data/notifications/_tests/`, mocking `@/lib/prisma` with `vi.hoisted` exactly like `src/lib/data/deliveries/_tests/`.
- **Env plumbing.** Added to `.env.example` under a new `Web Push (reminders)` section, with placeholder values and generation guidance. No real secrets are committed.
- **"Active" subscription.** There is no `status` column on `PushSubscription`. Expired endpoints are pruned on the send path (a `410`/`404` deletes the row), so every persisted subscription row is by definition active. `getUserPushSubscriptions` therefore returns all rows for the collector.

## Schema Contract

The final Prisma definitions this slice implements:

```prisma
enum NotificationType {
  PAYMENT_DUE
  ARRIVAL_DUE
  ARRIVAL_OVERDUE
}

enum NotificationSubjectType {
  ORDER
  DELIVERY
}

model PushSubscription {
  id         String    @id @default(cuid())
  userId     String
  endpoint   String    @unique
  p256dh     String
  auth       String
  userAgent  String?
  createdAt  DateTime  @default(now())
  lastSeenAt DateTime?
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_subscription")
}

model NotificationDelivery {
  id          String                  @id @default(cuid())
  userId      String
  type        NotificationType
  subjectType NotificationSubjectType
  subjectId   String
  dueDate     DateTime
  sentAt      DateTime                @default(now())
  user        User                    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, subjectId, dueDate])
  @@index([userId])
  @@map("notification_delivery")
}

model NotificationPreference {
  userId                String   @id
  paymentDueEnabled     Boolean  @default(true)
  arrivalDueEnabled     Boolean  @default(true)
  arrivalOverdueEnabled Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_preference")
}
```

`User` gains three back-relations: `pushSubscriptions`, `notificationDeliveries`, and `notificationPreference`.

## Technical Notes

- **subjectType decision.** A `NotificationDelivery` subject is either an order (`PAYMENT_DUE`) or a delivery (`ARRIVAL_DUE`, `ARRIVAL_OVERDUE`). A dedicated `NotificationSubjectType` enum (`ORDER`, `DELIVERY`) records which domain the `subjectId` points at, so a downstream dispatcher can resolve the deep-link target without re-deriving it from the reminder type. It is not part of the dedup key (see below).
- **Dedup key shape.** The unique constraint is `(userId, type, subjectId, dueDate)`, enforced at the database level so a same-day re-run or a mid-batch crash cannot double-send (`BR-09-02`, `FR-09-16`). `subjectType` is intentionally excluded: `subjectId` is a globally unique `cuid()` and `type` already implies the subject domain, so adding `subjectType` to the key would be redundant. `recordNotificationDelivery` is dedup-safe: it catches the Prisma `P2002` unique violation and reports `recorded: false` instead of throwing, making the write idempotent.
- **onDelete choices.** All three models cascade on collector deletion (`onDelete: Cascade` on the `User` relation), matching every other collector-owned child model in the schema. When a collector is deleted their subscriptions, delivery log, and preferences are removed with them.
- **Preference storage.** Per the blueprint decision, per-type preferences live on `NotificationPreference` keyed by `userId` (one boolean column per reminder type, defaulting to `true`), not on `PushSubscription` and not on `User`. `getNotificationPreferences` returns a normalized `{ PAYMENT_DUE, ARRIVAL_DUE, ARRIVAL_OVERDUE }` boolean map, synthesizing all-true defaults when no row exists so callers never branch on a missing row.
- **Ownership on upsert.** `upsertPushSubscription` upserts by the unique `endpoint` and always writes `userId` from the session-scoped argument (never free input) on both create and update, so re-subscribing claims the browser endpoint for the current collector. `removePushSubscription` is ownership-scoped (`endpoint` plus `userId`); `pruneExpiredPushSubscription` deletes by `endpoint` alone because it is driven by the transport layer's expiry signal.
- **Payload privacy.** The `web-push` wrapper payload type carries only `title`, `body`, `url`, and `tag`. It structurally cannot carry money values, note text, or subscriber keys beyond what the transport itself requires (`BR-09-07`).
- **Validation scope.** This is the FRD-09 foundation slice: no UI, no routes. It is E2E-exempt by design and validated exclusively by unit tests (wrapper result classification, Zod schemas, and the query/mutation modules).

## E2E Acceptance Tests

This foundation slice is exempt from the "must include an E2E acceptance path" rule because by design it ships no UI.

Validation is done via unit tests that cover, at minimum:

- the send wrapper maps a `410 Gone` and a `404 Not Found` result to `EXPIRED`, a generic failure to `TRANSIENT_FAILURE`, and a success to `SENT`
- the subscription Zod schema rejects a payload missing `endpoint` or either key, and accepts a well-formed payload with and without `userAgent`
- the preference Zod schema accepts each `NotificationType` with a boolean and rejects an unknown type
- the migration creates the (`userId`, `type`, `subjectId`, `dueDate`) unique constraint on `NotificationDelivery`
