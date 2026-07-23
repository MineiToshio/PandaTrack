---
id: WO-09
type: WORK_ORDER
slug: store-approval-and-removal
title: Store Approval and Removal
status: DRAFT
parent: BP-01
source_features: []
source_issue: TBD
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-09 Store Approval and Removal

## Summary

Add the admin inline moderation controls for a store's own state on the store detail page: approve a pending store, remove (reject) a store as a tombstone, and flag or unflag a store. These are the first store-state moderation actions, gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md). The moderation console defined by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to these controls; it does not implement them.

## In Scope

- Admin inline **approve** control on store detail: `PENDING` to `APPROVED`, persisting `approvedByUserId` and `approvedAt` (the same fields set on admin-created approval, `AC-04-02`), making the store SEO-indexable.
- Admin inline **remove (reject)** control: `PENDING` or `APPROVED` to `REJECTED`, persisting a new `removalReason` field on `Store`. Tombstone semantics, not a hard delete: the row is retained.
- `REJECTED` exclusion from all public surfaces: listing, search, direct detail URL (404), and the order-creation store picker (`getOrderableStores`).
- **Orders tombstone rendering:** collector orders that reference a `REJECTED` store keep rendering; where an order surfaces its store, it shows a neutral tombstone message by default ("Esta tienda ya no esta disponible") and sanction wording only when the `removalReason` is an abuse category.
- Admin inline **flag / unflag** control: `PENDING` or `APPROVED` to `FLAGGED` and back to the prior public state. A `FLAGGED` store stays publicly visible on listing, search, and detail, and its detail renders a stronger warning than the pending disclaimer (wire in the existing, currently-unused `flaggedDisclaimer` i18n key in `stores.json`).
- **Softened pending disclaimer copy:** reword the `PENDING` disclaimer to non-alarmist "en revision" review language so a newly created community store is not framed as suspect (`FR-04-50`).
- `requireAdmin()` gating on every mutation and an `AdminAuditLog` entry via `writeAuditEntry()` for `store.approve`, `store.remove`, `store.flag`, and `store.unflag`.
- PostHog analytics for the user-visible actions: `store_approved`, `store_removed`, `store_flagged`, `store_unflagged`, namespaced under `POSTHOG_EVENTS.STORE`.

## Out of Scope

- Report resolution, change-request review, and product-type approval (owned by `WO-10`, `WO-11`, `WO-12`).
- The administrator role, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()` themselves; consumed from [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md).
- The moderation inbox and audit-log viewer surfaces (owned by PRD-03, FRD-02).
- The creator notification on rejection: this work order fires the `REJECTED` transition and stores the `removalReason`; whether and how the creator is notified is owned by [FRD-09](../../../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md).
- Reinstating a `REJECTED` store (removal is terminal in this scope; see the FRD Open Questions).

## Requirements

- `FR-04-40`: Admin inline approve of a `PENDING` store; sets `approvedByUserId` / `approvedAt`; admin-only.
- `FR-04-41`: Admin inline remove (reject); sets `removalReason`; tombstone excluded from all public surfaces and the order picker; row retained.
- `FR-04-42`: Orders referencing a `REJECTED` store keep rendering with a neutral tombstone message by default and sanction wording only for abuse reasons.
- `FR-04-43`: Admin flag / unflag; `FLAGGED` stays visible with a stronger warning; unflag restores the prior state.
- `FR-04-50`: Softened, non-alarmist pending disclaimer copy.
- `FR-04-51`: `requireAdmin()` gating plus `AdminAuditLog` entries with stable action keys (`store.approve`, `store.remove`, `store.flag`, `store.unflag`).

Relevant business rules:

- `BR-04-22`: `REJECTED` excluded from every public surface and the order picker; row retained (tombstone).
- `BR-04-23`: Removal is a tombstone, never a hard delete; `removalReason` drives the order-side message.
- `BR-04-24`: `FLAGGED` stays publicly visible with a stronger warning; only removal hides.
- `BR-04-29`: Every moderation mutation is gated by `requireAdmin()` and writes an audit entry with a stable action key and no PII.

Relevant acceptance criteria:

- `AC-04-20` Approve a pending store inline.
- `AC-04-21` Remove a store as a tombstone.
- `AC-04-22` Order referencing a removed store still renders.
- `AC-04-23` Flag and unflag a store.
- `AC-04-30` Every moderation action is gated and audited.
- `AC-04-31` Pending disclaimer reads as non-alarmist review copy.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points:
  - data model layer: `Store.removalReason`, the `REJECTED` / `FLAGGED` transitions.
  - query layer: extend the public read models (`getStoreBySlug`, listing where-builder, `getOrderableStores`) so `REJECTED` is excluded and `FLAGGED` remains visible; add the order-side tombstone read for referenced stores.
  - server action layer: new admin moderation actions gated by `requireAdmin()`, each writing an audit entry.
  - UI flow layer: admin inline controls on `StoreDetailContent`; the `flaggedDisclaimer` warning banner; the order-detail store tombstone.
- See the [tombstone contract](../bp-01-store-public-trust-system.md#store-removal-tombstone-contract-planned) and [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-gating-contract-planned) in BP-01.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`. This work order cannot ship before that foundation.
- `WO-06 Store Governance Flows` for the store-detail governance surface these controls sit alongside.

## E2E Acceptance Tests

- An administrator approves a `PENDING` store from its detail page; it becomes `APPROVED` with `approvedByUserId` / `approvedAt` set, and an `AdminAuditLog` entry with `store.approve` is written.
- A non-administrator invoking the approve action directly is refused by `requireAdmin()` before any change runs, and no audit entry is written.
- An administrator removes a store with a `removalReason`; it becomes `REJECTED`, disappears from the listing, from search, and from the order-creation store picker, and its direct URL returns 404, while the row remains in the database.
- A collector order that references the removed store still renders, showing the neutral tombstone message by default and the sanction wording when the `removalReason` is an abuse category.
- An administrator flags a store; it stays visible in listing, search, and detail with the stronger `flaggedDisclaimer` warning; unflagging restores the prior public state. Both transitions are audited (`store.flag`, `store.unflag`).
- The `PENDING` detail disclaimer renders the softened "en revision" copy in both locales.

## Notes

- GitHub tracking: this work order needs a corresponding sub-issue under BP-01 (`source_issue: TBD`); create it and keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`.
- The `removalReason` schema addition follows the Prisma migration workflow (`prisma-migration-workflow.mdc`) and requires `prisma generate`.
