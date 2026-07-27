---
id: WO-09
type: WORK_ORDER
slug: store-approval-and-removal
title: Store Approval and Removal
status: ACTIVE
parent: BP-01
source_features: []
source_issue: 131
implementation_status: IN_PROGRESS
last_updated: 2026-07-27
---

# WO-09 Store Approval and Removal

> **Partially superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** Every flag/unflag element of this slice (the `FLAGGED` status, the manual flag control, the `flaggedDisclaimer` copy, and the `FLAGGED` `noindex` rule) is superseded: the public report notice became automatic and derived from open reports, and `FLAGGED` was removed from `StoreStatus`. The approve and remove (tombstone) scope stands unchanged. The individual superseded bullets are marked inline below. See [ADR 0019](../../../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md).

## Summary

Add the admin inline moderation controls for a store's own moderation state on the store detail page: approve a pending store, remove (reject) a store as a tombstone, and flag or unflag a store. These are the first store-state moderation actions, gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md). The moderation console defined by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to these controls; it does not implement them.

This slice owns the store-side transitions and the persistence of `removalReason`. The order-side rendering of a removed store (the neutral tombstone line and the sanction wording for abuse reasons, `FR-04-42` / `AC-04-22`) lives in the collector order domain and is delivered as a separate follow-up slice: [FRD-05 · BP-02 · WO-08](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md). Keeping that rendering out of this slice keeps WO-09 focused on the store moderation lifecycle; the follow-up depends only on `removalReason` and the `REJECTED` status this slice introduces.

## In Scope

- Admin inline **approve** control on store detail: `PENDING` to `APPROVED`, persisting `approvedByUserId` and `approvedAt` (the same fields set on admin-created approval, `AC-04-02`), making the store SEO-indexable.
- Admin inline **remove (reject)** control: `PENDING` or `APPROVED` to `REJECTED`, persisting a new `removalReason` field on `Store`. Tombstone semantics, not a hard delete: the row is retained.
- **New `Store.removalReason` enum column** (`StoreRemovalReason`) with the four FDD reasons and a shared `isSanctionRemovalReason` helper (see Decision D1).
- **Shared public-visibility helper** (`PUBLIC_VISIBLE_STORE_STATUSES`) applied to every public read model so `REJECTED` is excluded consistently and `FLAGGED` is included (see Decision D3). This both hides removed stores and makes flagged stores visible, correcting the current query behavior that filters `status: { in: ["PENDING", "APPROVED"] }` and therefore hides `FLAGGED` today. **Superseded in part by [WO-13](wo-13-derived-report-notice-and-flag-removal.md):** the constant stays and remains the single point that excludes `REJECTED`, but its value is `["PENDING", "APPROVED"]` because `FLAGGED` no longer exists.
- `REJECTED` exclusion from all public surfaces: listing, search, direct detail URL (404), and the order-creation store picker (`getOrderableStores`).
- **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md):** ~~Admin inline flag / unflag control~~. There is no manual flag control and no `FLAGGED` status. The public "has reports" notice is derived at read time from the store's open-report count (threshold 1) and is cleared by resolving or dismissing the reports themselves (`FR-04-43`, `FR-04-44`). The `flaggedDisclaimer` i18n key is replaced by `reportNoticeTitle` / `reportNoticeMessage` with rewritten copy (Decision LR1 retired); the `approvedAt` prior-state derivation (Decision D5) survives only as the expression the enum-removal migration uses to map any surviving `FLAGGED` row back to a lifecycle value.
- **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md):** ~~`FLAGGED` SEO handling~~. Reports never affect indexing; `noindex` stays scoped to `PENDING` alone (Decision LR2 retired). Rationale in [ADR 0019](../../../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md): re-indexing after removing a `noindex` takes days or weeks, so a false report would outlive its own dismissal.
- **Softened pending disclaimer copy:** reword the `PENDING` disclaimer to non-alarmist "en revision" review language so a newly created community store is not framed as suspect (`FR-04-50`).
- `requireAdmin()` gating on every mutation and an `AdminAuditLog` entry via `writeAuditEntry()` (inside the same transaction) for `store.approve` and `store.remove`. (`store.flag` / `store.unflag` were part of this slice and are superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md); the keys stay in the vocabulary as retired from writing.)
- PostHog analytics for the user-visible actions: `store_approved` and `store_removed`, namespaced under `POSTHOG_EVENTS.STORE`. `store_removed` carries the `removalReason` category, never raw report text. (`store_flagged` / `store_unflagged` are superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md) and removed from `POSTHOG_EVENTS`.)

## Out of Scope

- **Order-side removed-store tombstone rendering (`FR-04-42`, `AC-04-22`, order-side portion of `BR-04-23`):** the neutral tombstone message on collector orders that reference a `REJECTED` store, and the sanction wording for abuse reasons, are delivered by [FRD-05 · BP-02 · WO-08](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md). This slice only persists the `removalReason` that follow-up consumes.
- Report resolution, change-request review, and product-type approval (owned by `WO-10`, `WO-11`, `WO-12`).
- The administrator role, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()` themselves; consumed from [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md).
- The moderation inbox and audit-log viewer surfaces (owned by PRD-03, FRD-02).
- The creator notification on rejection: this work order fires the `REJECTED` transition and stores the `removalReason`; whether and how the creator is notified is owned by [FRD-09](../../../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md). See the notification seam in Technical Notes.
- Reinstating a `REJECTED` store (removal is terminal in this scope; see the FRD Open Questions).

## Requirements

- `FR-04-40`: Admin inline approve of a `PENDING` store; sets `approvedByUserId` / `approvedAt`; admin-only.
- `FR-04-41`: Admin inline remove (reject); sets `removalReason`; tombstone excluded from all public surfaces and the order picker; row retained.
- `FR-04-43`: **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** The requirement now defines a derived report notice with no manual control and no `FLAGGED` status; nothing in this slice implements it.
- `FR-04-50`: Softened, non-alarmist pending disclaimer copy.
- `FR-04-51`: `requireAdmin()` gating plus `AdminAuditLog` entries with stable action keys (`store.approve`, `store.remove`). The `store.flag` / `store.unflag` writers are superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md); the keys stay in the vocabulary as retired from writing.

`FR-04-42` (order-side tombstone rendering) is a requirement of FRD-04 but is delivered by [FRD-05 · BP-02 · WO-08](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md); this slice provides the `removalReason` it depends on.

Relevant business rules:

- `BR-04-22`: `REJECTED` excluded from every public surface and the order picker; row retained (tombstone).
- `BR-04-23`: Removal is a tombstone, never a hard delete; `removalReason` is persisted here and drives the order-side message rendered by the FRD-05 follow-up.
- `BR-04-24`: **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** The rule now states that the "has reports" signal is derived, never persisted, and never affects indexing; only removal hides a store.
- `BR-04-29`: Every moderation mutation is gated by `requireAdmin()` and writes an audit entry with a stable action key and no PII.

Relevant acceptance criteria:

- `AC-04-20` Approve a pending store inline.
- `AC-04-21` Remove a store as a tombstone (store-side: disappears from listing, search, order picker; direct URL 404s; row retained).
- `AC-04-23` **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** The criterion now covers the derived notice appearing and clearing automatically.
- `AC-04-30` Every moderation action is gated and audited.
- `AC-04-31` Pending disclaimer reads as non-alarmist review copy.

`AC-04-22` (order referencing a removed store still renders) is verified by the FRD-05 follow-up slice.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points:
  - data model layer: `Store.removalReason` (`StoreRemovalReason` enum), the `REJECTED` transition (the `FLAGGED` transition is superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md)).
  - query layer: the shared `PUBLIC_VISIBLE_STORE_STATUSES` constant applied to `getStoreBySlug`, the listing where-builder, and `getOrderableStores` so `REJECTED` is excluded (the `FLAGGED` inclusion is superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md)).
  - server action layer: new admin moderation actions gated by `requireAdmin()`, each writing an audit entry inside the transaction; core transition logic in a reusable `storeModerationMutations.ts` data-layer module so the PRD-03 FRD-02 console can invoke it later.
  - UI flow layer: `StoreAdminModerationPanel` inline controls on `StoreDetailContent`; the removal modal with grouped reason radiogroups. (The `flaggedDisclaimer` warning banner is superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).)
- See the [tombstone contract](../bp-01-store-public-trust-system.md#store-removal-tombstone-contract-planned) and [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-gating-contract-planned) in BP-01.

## Confirmed Decisions

These decisions were resolved during the enrichment pass and are binding for implementation.

- **D1 · `removalReason` data shape.** Add a Prisma enum `StoreRemovalReason` with four values mapped to the FDD reasons: `DUPLICATE` (Tienda duplicada), `CLOSED_OR_INACTIVE` (Tienda cerrada o inactiva), `FALSE_INFO` (Informacion falsa o enganosa), and `ABUSE` (Abuso, estafa o fraude). A shared helper `isSanctionRemovalReason(reason) => reason === "ABUSE"` drives the neutral-vs-sanction branch consumed by the order-side follow-up. Rationale: a closed, low-churn taxonomy that gates sanction wording is safer as a typed enum than as a validated string, matching the `StoreStatus` / `SellerType` precedent.
- **D2 · No `removedAt` / `removedByUserId` columns.** Only `Store.removalReason` is added. The actor and timestamp of a removal are already captured by the `store.remove` `AdminAuditLog` entry (`actorId`, `createdAt`, `reason`); denormalizing them onto `Store` is unnecessary because, unlike `approvedByUserId` / `approvedAt`, they are not read on any public or SEO path.
- **D3 · Centralized public-visibility set.** **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** The constant and its single-point role survive; its value is `["PENDING", "APPROVED"]` because `FLAGGED` no longer exists. Original text: Introduce `PUBLIC_VISIBLE_STORE_STATUSES = ["PENDING", "APPROVED", "FLAGGED"]` and use it in `buildPublicStoreListingWhere`, `getStoreBySlug`, and `getOrderableStores`. This is the single point that (a) excludes `REJECTED` consistently and (b) opens `FLAGGED` to public reads. Behavior change: `FLAGGED` stores currently 404 / are hidden; after this slice they are visible, which is intended per `FR-04-43`.
- **D4 · `FLAGGED` stays orderable.** **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** Moot: a store with open reports is never a distinct status, so it was always orderable. Original text: `FLAGGED` is included in `getOrderableStores` (via the shared set), so a collector can still record orders against a flagged-but-operational store; the warning is informational, not a lock.
- **D5 · Unflag prior-state derivation.** **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** Retained only as the migration expression that maps a surviving `FLAGGED` row back to a lifecycle value. Original text: Unflag restores `APPROVED` when `approvedAt` (or `approvedByUserId`) is set, otherwise `PENDING`. No new column is needed because `approvedAt` already distinguishes the two prior public states.
- **D6 · Split of the order-side tombstone.** `FR-04-42` / `AC-04-22` are delivered by a separate FRD-05 follow-up slice ([WO-08](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md)), keeping WO-09 cohesive around store-side moderation.
- **D7 · E2E admin account.** The moderation E2E flows sign in as a dedicated administrator using new `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` environment variables (registered in `.env.example`) plus a `signInAsAdmin` helper. The existing E2E account stays a plain user, used for the negative `requireAdmin()` test.
- **D8 · FRD-09 notification seam.** The `REJECTED` transition is the future trigger for the creator notification owned by [FRD-09](../../../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md). This slice adds no speculative notification code and no ticket-id comments; the removal transition logic is factored into `storeModerationMutations.ts` so a post-commit notification enqueue can slot in cleanly when FRD-09 lands.
- **LR1 · `flaggedDisclaimer` copy.** **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** The key is replaced by `reportNoticeTitle` / `reportNoticeMessage` and the copy is rewritten: "acumula reportes con credibilidad" asserted a validation that never happened. Original text: The existing `stores.json` `flaggedDisclaimer` value is a placeholder ("Tienda con reportes pendientes. Procede con precaucion."). Replace it with the FDD-04 §6.1 copy ("Tienda con reportes" title plus "Esta tienda acumula reportes con credibilidad. Sigue visible, pero revisa la informacion con atencion antes de operar.") in both locales, and wire it into the flagged banner.
- **LR2 · `noindex` for `FLAGGED`.** **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** Reports never affect indexing; `noindex` stays scoped to `PENDING`. Original text: Extend the `generateMetadata` noindex condition from `status === "PENDING"` to also cover `FLAGGED`.
- **LR3 · Code placement.** Transitions live in a new `src/lib/data/stores/storeModerationMutations.ts` (importable by the future console); thin Server Actions under `src/app/[locale]/(app)/stores/[slug]/_actions/`; a new client component `StoreAdminModerationPanel` rendered in the detail aside when the viewer is an admin, with `page.tsx` passing a `canModerate` flag into `StoreDetailContent`.
- **LR4 · UI composition.** The flag / unflag buttons in this bullet are superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md). A "Moderacion" card for admins; approve as an inline optimistic button; "Retirar tienda" opens a canonical modal (ADR 0008 / M01-B) reusing the `ReportReasonPicker` pattern with two labeled `radiogroup`s (neutral reasons vs the single sanction reason) and an optional internal note that feeds the audit entry. Optimistic Confirmation: the modal closes synchronously on submit and the parent coordinates rollback plus toast.
  - **Implementation reconciliation (aside slot).** The card is rendered in the `DetailSidebar` **Gestion** slot (the component's dedicated governance/admin slot), not in a bespoke slot above Resumen. `DetailSidebar`'s slot order is inviolable per [ADR 0003 · Decision 7](../../../../../design/decisions/0003-demo-decisions.md) (Resumen · Acciones · Nota privada · Gestion), so the admin cluster uses the sanctioned Gestion slot rather than a new top slot. This supersedes the FDD-04 §2.4 "top slot of the sticky aside rail (above Resumen)" wording.

## Assumptions

- The admin platform (`requireAdmin()` returning the resolved session, `AdminAccessError`, `writeAuditEntry(input, tx?)`, the `AUDIT_ACTIONS` vocabulary including `store.approve` / `store.remove`, and the durable `User.role`) is already available and is consumed, not modified.
- `StoreDetailContent` is a Server Component; the interactive moderation cluster and removal modal are new Client Components composed into it, mirroring the existing `StoreReportModal` / `StoreGovernanceSummaryModal` client boundaries.
- Adding an enum and a nullable column is auto-detectable by Prisma, so the standard `migrate dev` flow applies (not the hand-written-SQL fallback used by the `SellerType` rename), followed by `prisma generate` and a green `type-check`.

## UX Notes

- The moderation cluster is admin-only and sits beside the existing viewer governance surface (report / change-request entry points), which stay unchanged for admins.
- Every moderation control is a real `<button>` with an accessible name; severity is never color-only (icon plus label). The removal modal is a focus-trapped dialog; the two reason groups are `radiogroup`s with roving `aria-checked` state.
- The softened pending disclaimer keeps the "Tienda en revision" title and replaces the alarmist message with review-oriented copy (`FR-04-50`, `AC-04-31`).

## Technical Notes

- Each transition runs as one `prisma.$transaction`: the `store.update` plus the matching `writeAuditEntry(input, tx)` so no orphaned or missing audit rows are possible. The actor id comes from the session returned by `requireAdmin()`, never from the client.
- Approve sets `status = APPROVED`, `approvedByUserId`, `approvedAt`. Remove sets `status = REJECTED` and `removalReason`. (The flag / unflag transitions are superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).)
- The public-visibility set (D3) is the only place the `REJECTED` rule is encoded (the `FLAGGED` half is superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md)); per-query duplication is avoided so the surfaces cannot diverge.
- FRD-09 seam (D8): the removal transition is factored so a future notification enqueue can run after the transaction commits without restructuring the mutation.

## Security Notes

- Every mutation authorizes with `requireAdmin()` before any read or write; `AdminAccessError` is an expected authorization outcome and must not be reported to Sentry.
- Audit entries store identifiers plus an optional non-sensitive reason only, never raw report text or reporter identity (`BR-04-29`).
- `removalReason` and the optional internal note are validated at the boundary with Zod before the transition runs.

## Observability Notes

- The four PostHog events fire on successful transitions and carry `store_slug` plus an action-scoped context (`store_removed` carries the `removalReason` category), never raw report free-text or reporter identity.
- Unexpected mutation failures are captured with Sentry via the existing server wrappers; expected authorization and validation rejections are not.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`. This work order cannot ship before that foundation.
- `WO-06 Store Governance Flows` for the store-detail governance surface these controls sit alongside.
- Downstream: [FRD-05 · BP-02 · WO-08](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md) depends on this slice for the `removalReason` field and the `REJECTED` status it introduces.

## E2E Acceptance Tests

These flows sign in as a dedicated administrator (D7).

- An administrator approves a `PENDING` store from its detail page; it becomes `APPROVED` with `approvedByUserId` / `approvedAt` set, and an `AdminAuditLog` entry with `store.approve` is written.
- A non-administrator (the plain E2E account) invoking the approve action directly is refused by `requireAdmin()` before any change runs, and no audit entry is written.
- An administrator removes a store with a `removalReason`; it becomes `REJECTED`, disappears from the listing, from search, and from the order-creation store picker, and its direct URL returns 404, while the row remains in the database. An `AdminAuditLog` entry with `store.remove` is written.
- ~~An administrator flags a store.~~ **Superseded by [WO-13](wo-13-derived-report-notice-and-flag-removal.md).** Replaced by the WO-13 flows: a store with one open report shows the derived notice to every viewer, resolving the last open report clears it, and an `APPROVED` store with reports is never `noindex`.
- The `PENDING` detail disclaimer renders the softened "en revision" copy in both locales.

The E2E that a collector order referencing a removed store still renders (`AC-04-22`) belongs to [FRD-05 · BP-02 · WO-08](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md).

## Notes

- GitHub tracking: linked to slice issue `#131` under Epic `#68` (FEAT-0012). The order-side follow-up is tracked by slice issue `#136` under Epic `#84` (FEAT-0014).
- The `removalReason` schema addition follows the Prisma migration workflow (`prisma-migration-workflow.mdc`) and requires `prisma generate`.
