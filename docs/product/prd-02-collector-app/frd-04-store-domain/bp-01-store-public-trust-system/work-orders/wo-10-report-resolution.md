---
id: WO-10
type: WORK_ORDER
slug: report-resolution
title: Report Resolution
status: ACTIVE
parent: BP-01
source_features: []
source_issue: 132
implementation_status: IN_PROGRESS
last_updated: 2026-07-23
---

# WO-10 Report Resolution

## Summary

Add the admin inline resolution of store reports from the governance panel: move an open `StoreReport` from `OPEN` to `REVIEWED` or `DISMISSED`, and give administrators a secure, admin-only view of the raw report details and reporter identity through a new server-only admin data-access layer. These actions are gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), and the moderation console defined by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to them.

## In Scope

- Admin inline **resolve / dismiss** control on the governance panel: `StoreReport` `OPEN` to `REVIEWED` or `DISMISSED`.
- Resolution frees the reporter to file a new report for that store, exactly as `AC-04-12` already specifies (the re-report path after resolution already exists; this work order is what causes a report to reach a resolved state).
- A **new server-only admin data-access layer** that exposes raw report free-text and reporter identity to administrators only. This is additive and must never widen the public governance read model (`getStoreGovernanceSummary`); the existing non-admin guarantee (`BR-04-13`) stays honored unchanged.
- `requireAdmin()` gating on the resolve / dismiss mutations and on the admin report read, with an `AdminAuditLog` entry via `writeAuditEntry()` for `report.resolve` and `report.dismiss`.
- PostHog analytics for the user-visible actions: `store_report_resolved`, `store_report_dismissed`, namespaced under `POSTHOG_EVENTS.STORE`, carrying identifiers only (`store_slug`, `report_id`), never raw report text or reporter identity.

This slice ships with **no schema migration** (see Decision D1). The `StoreReportStatus` enum already carries `REVIEWED` and `DISMISSED`, `StoreReport.status` already exists with a default of `OPEN`, and the audit vocabulary already defines `report.resolve` / `report.dismiss` and the `report` target type, so no Prisma change is required.

## Out of Scope

- Store-state moderation (approve, remove, flag/unflag) owned by `WO-09`.
- Change-request review (`WO-11`) and product-type approval (`WO-12`).
- The public community reports summary and the reporter-side report create/update flow, both already shipped by `WO-06`.
- The moderation inbox that aggregates open reports across stores (owned by PRD-03, FRD-02); this work order provides the inline resolution the inbox links to.
- Any change to the one-open-report-per-user invariant (`BR-04-14`) or the re-report acceptance (`AC-04-12`), which already exist.

## Requirements

- `FR-04-44`: Admin inline resolve / dismiss of an open store report; `OPEN` to `REVIEWED` or `DISMISSED`; frees the reporter to re-report (`AC-04-12`).
- `FR-04-45`: Raw report free-text and reporter identity are admin-only, read through a server-only admin data-access layer, never by widening the public governance read model.
- `FR-04-51`: `requireAdmin()` gating plus `AdminAuditLog` entries with stable action keys (`report.resolve`, `report.dismiss`).

Relevant business rules:

- `BR-04-13`: Public governance summaries must not expose requester identity or raw free-text to non-admin viewers; this stays honored.
- `BR-04-14`: One open report per (user, store); once resolved, the user may file a new report.
- `BR-04-25`: Raw report free-text and reporter identity are admin-only and read through a server-only admin data-access layer; the public read model must not be widened.
- `BR-04-29`: Every moderation mutation is gated by `requireAdmin()` and writes an audit entry with a stable action key and no PII.

Relevant acceptance criteria:

- `AC-04-24` Resolve or dismiss a report inline.
- `AC-04-25` Raw report details are admin-only.
- `AC-04-12` Re-report after resolution (already covered; the resolution here is what enables it).
- `AC-04-30` Every moderation action is gated and audited.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points:
  - data model layer: the `StoreReport` `OPEN` to `REVIEWED` / `DISMISSED` transition.
  - query layer: a new server-only admin read (for example under `src/lib/data/admin/`) for raw report detail and reporter identity, kept strictly separate from `getStoreGovernanceSummary`.
  - server action layer: resolve / dismiss actions gated by `requireAdmin()`, each writing an audit entry.
  - UI flow layer: the admin-only resolution affordance inside the governance panel on store detail.
- See the [admin data-access-layer contract](../bp-01-store-public-trust-system.md#admin-data-access-layer-contract-planned) and [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-gating-contract-planned) in BP-01.

## Confirmed Decisions

These decisions were resolved during the enrichment pass and are binding for implementation.

- **D1 · No reviewer columns on `StoreReport`; accountability is audit-only.** `StoreReport` keeps its current shape (`status` with values `OPEN` / `REVIEWED` / `DISMISSED`, default `OPEN`, and no reviewer column). The actor and timestamp of a resolution live in the `report.resolve` / `report.dismiss` `AdminAuditLog` entry (`actorId`, `createdAt`, `targetType: report`, `targetId`), and are not read on any public or SEO path. This mirrors [WO-09](wo-09-store-approval-and-removal.md) Decision D2 (removal is audited, not denormalized onto the row). It deliberately differs from `StoreChangeRequest.reviewedByUserId` / `reviewedAt`, which are denormalized only because [WO-11](wo-11-change-request-review.md) reads them during the rebase-apply; report resolution has no equivalent downstream reader. **Consequence: this slice requires no Prisma migration.**
- **D2 · Admin read layer at `src/lib/data/admin/adminStoreReportQueries.ts`.** A new server-only module exposes `getAdminOpenStoreReports(storeId)`, returning each `OPEN` report as `{ id, reason, details, createdAt, reporter: { id, username, name, image } }`, newest first. It is grouped under `src/lib/data/admin/` (beside the existing `adminAuditMutations.ts` / `adminAuditQueries.ts`) because the admin-only, server-only security boundary is the stronger grouping signal than domain colocation; this follows the BP-01 admin data-access-layer contract, which names `src/lib/data/admin/` explicitly. The name is store-report specific (not `adminModerationQueries` / `moderationQueueQueries`) to avoid colliding with the cross-store moderation inbox module owned by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md). The public governance read model (`getStoreGovernanceSummary`) is never widened (`BR-04-25`).
- **D3 · Admin section inside the existing `StoreGovernanceSummaryModal`.** The report-resolution surface is an admin superset of the current public governance modal, exactly as [FDD-04 §s6-store-detail-admin-governance](../../fdd-04-store-domain.md#s6-store-detail-admin-governance) specifies. `StoreGovernanceSummaryModal` gains an optional `adminReports` prop that is populated server-side only when the viewer is an administrator. When present, the modal renders an admin-only section listing each `OPEN` report with its reason, raw free-text, a `"Reportado por @username"` line, and an admin-only lock caption, plus per-row "Resolver" (primary) / "Descartar" (ghost) actions. When the prop is absent (every non-admin viewer), the section does not render and no admin read runs, so the public modal and the public read model stay untouched. The store-state controls remain in the `DetailSidebar` `Gestion` slot ([WO-09](wo-09-store-approval-and-removal.md) LR4); report resolution lives in the governance modal, so the two admin surfaces do not conflict.
- **D4 · Transition logic added to `storeModerationMutations.ts`.** `resolveStoreReport` and `dismissStoreReport` join the existing `src/lib/data/stores/storeModerationMutations.ts` (same conceptual family and audit pattern as the store-state transitions, and a single import for the future moderation console). Each runs as one `prisma.$transaction`: update the `StoreReport` `OPEN → REVIEWED` / `DISMISSED` after validating the current status is `OPEN`, then `writeAuditEntry({ action, targetType: "report", targetId: reportId, actorId, reason }, tx)` in the same transaction. Invalid state or a missing row raise `StoreModerationError` (`invalidTransition` / a new `reportNotFound` code), which is an expected outcome and is not reported to Sentry.
- **D5 · No required resolution reason; no note input in the UI.** The FDD surface is just "Resolver" / "Descartar". The mutation accepts an optional non-sensitive `note` (parity with the store-state moderation pattern and future console reuse) that this slice's UI does not send. Keeping the resolution minimal avoids an unused form field.
- **D6 · Optimistic inline resolution.** Per `.agents/rules/optimistic-client-updates.mdc`, pressing "Resolver" / "Descartar" removes the row from the open-report list immediately; on failure the row is restored and an error toast is shown; on success a success toast is shown. The modal stays open (this is not a submit-and-close flow), so an administrator can resolve several reports in a row.
- **D7 · Admin read lists all `OPEN` reports, fetched only when admin.** `getAdminOpenStoreReports` returns every `OPEN` report for the store, newest first. `REVIEWED` / `DISMISSED` reports are history and are not listed here. The read is added to the `page.tsx` parallel load and gated by `getIsAdmin(session)`, so a non-admin request never triggers it.
- **D8 · PostHog events.** Add `POSTHOG_EVENTS.STORE.REPORT_RESOLVED = "store_report_resolved"` and `REPORT_DISMISSED = "store_report_dismissed"`. They are emitted server-side in the resolve / dismiss actions (mirroring `store_approved` in `moderateStore.ts`), carrying `store_slug` and `report_id` only, never raw report text or reporter identity.
- **D9 · Code placement.** New thin Server Actions in `src/app/[locale]/(app)/stores/[slug]/_actions/moderateStoreReport.ts` (`resolveStoreReportAction` / `dismissStoreReportAction`, mirroring `moderateStore.ts`); a new boundary schema `src/app/[locale]/(app)/stores/[slug]/_schemas/storeReportModerationSchema.ts` (`{ slug, locale, reportId }`); new i18n keys under `stores.moderation` in both locales, reusing `governance.report.reasonOptions.*` for the reason label.

## Assumptions

- The admin platform (`requireAdmin()` returning the resolved session, `AdminAccessError`, `writeAuditEntry(input, tx?)`, and the `AUDIT_ACTIONS` vocabulary already including `report.resolve` / `report.dismiss` plus the `report` target type) is available and is consumed, not modified.
- `StoreDetailContent` and `StoreGovernanceSummaryModal` already exist; the admin section is added inside the existing client boundary rather than as a new modal.
- `getIsAdmin(session)` already gates admin-only reads on the store detail page; the resolve / dismiss actions independently re-verify with `requireAdmin()` server-side, so the read gate is defense-in-depth, not the authorization boundary.
- No enum, column, or index changes are needed (Decision D1), so the standard `migrate dev` flow does not run for this slice.

## UX Notes

- The admin report section is admin-only and sits inside the same governance modal the community summary uses; its entry point is the existing governance banner, which already renders when the store has any reports (`totalReports > 0`).
- Each open-report row shows the reason chip, the raw free-text quote, `"Reportado por @username"`, and an admin-only lock caption (`"Detalles y autor visibles solo para administradores."`). Severity and identity are never color-only.
- "Resolver" and "Descartar" are real `<button>`s with accessible names; the row leaves the list optimistically and the modal stays open for the next report.

## Technical Notes

- `resolveStoreReport` / `dismissStoreReport` each run as one `prisma.$transaction`: the `StoreReport.update` plus the matching `writeAuditEntry(input, tx)`, so no orphaned or missing audit rows are possible. The actor id comes from the session returned by `requireAdmin()`, never from the client.
- The admin read (`getAdminOpenStoreReports`) is the only path that exposes reporter identity and raw free-text, and it is server-only; the public `getStoreGovernanceSummary` continues to return counts only.
- The resolve / dismiss actions call `revalidatePath` for the store detail so the governance summary and admin section reflect the new state after each action.

## Security Notes

- Every mutation authorizes with `requireAdmin()` before any read or write; `AdminAccessError` is an expected authorization outcome and must not be reported to Sentry.
- Audit entries store identifiers plus an optional non-sensitive note only, never raw report text or reporter identity (`BR-04-29`).
- The admin read model is server-only and reached only when the store detail page has already established `isAdmin`; the public read model (`BR-04-13`, `BR-04-25`) is never widened to carry identity or free-text.

## Observability Notes

- The two PostHog events fire on successful transitions and carry `store_slug` and `report_id` only, never raw report free-text or reporter identity.
- Unexpected mutation failures are captured with Sentry via the existing server wrappers; expected authorization and invalid-transition rejections are not.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`.
- `WO-06 Store Governance Flows` for the governance panel and the `StoreReport` model these controls operate on.
- Parallelizable with `WO-09` and `WO-12` once the FRD-01 foundation exists.

## Test Scope

Unit and integration (`vitest`):

- Transition units in `storeModerationMutations.test.ts`: `resolveStoreReport` moves `OPEN → REVIEWED` and `dismissStoreReport` moves `OPEN → DISMISSED`, each writing an `AdminAuditLog` entry with the matching action key and `targetType: report` inside the same transaction; a non-`OPEN` report raises `invalidTransition` without writing anything; a missing report raises `reportNotFound`.
- DAL redaction-boundary unit: `getAdminOpenStoreReports` returns reporter identity and raw free-text for the admin path, while `getStoreGovernanceSummary` for the same store exposes neither (the public read model is not widened, `BR-04-13` / `BR-04-25`).

E2E (`playwright`, admin flows sign in with the `signInAsAdmin` helper and are skipped when no admin credentials are configured, per [WO-09](wo-09-store-approval-and-removal.md) Decision D7):

- An administrator resolves an open report from the governance panel; the `StoreReport` moves to `REVIEWED`, and an `AdminAuditLog` entry with `report.resolve` is written.
- An administrator dismisses an open report; it moves to `DISMISSED`, and an `AdminAuditLog` entry with `report.dismiss` is written.
- After a report is resolved, its reporter can file a new report for the same store (`AC-04-12`), and the earlier resolved report remains in history.
- An administrator can see the raw free-text and reporter identity through the admin data-access layer; a non-admin viewer of the same store sees neither in the public governance summary.
- A non-administrator invoking the resolve or dismiss action directly is refused by `requireAdmin()` before any change runs, and no audit entry is written.

## Notes

- GitHub tracking: linked to slice issue `#132` under Epic `#68`, parallelizable with `WO-09` and `WO-12` once the FRD-01 foundation exists; keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`.
- The admin data-access layer must be a distinct server-only module; do not add reporter identity or raw text to any read model reachable from a public route.
