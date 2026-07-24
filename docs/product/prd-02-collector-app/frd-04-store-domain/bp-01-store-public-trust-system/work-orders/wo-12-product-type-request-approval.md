---
id: WO-12
type: WORK_ORDER
slug: product-type-request-approval
title: Product Type Request Approval
status: ACTIVE
parent: BP-01
source_features: []
source_issue: 134
implementation_status: IN_PROGRESS
last_updated: 2026-07-23
---

# WO-12 Product Type Request Approval

## Summary

Deliver the admin approve / reject of a global `StoreProductTypeRequest` and, on approval, author the requested type into the global `StoreProductType` catalog so it is immediately usable at runtime. Because a Server Action cannot write locale files on a read-only filesystem, catalog names move to a hybrid model: admin-authored types persist their `es` / `en` names as `nameEs` / `nameEn` columns on the catalog row, while the originally seeded keys keep their names in the `storeProductTypes` i18n namespace, and a single name resolver reads the DB name first and falls back to the namespace. Rejection closes the request without a catalog write. These actions are gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md).

This slice ships the mutation, the admin data-access layer, the schema change, and the name resolver. It ships no review UI of its own: `StoreProductTypeRequest` is global (no owning store), so its review surface belongs to the moderation console (**FRD-02** · WO-02, review surface `#review-type`, [`wo-02-moderation-inbox.md`](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/work-orders/wo-02-moderation-inbox.md)). WO-12 is therefore a prerequisite of that console slice, which invokes the actions this slice exposes.

## In Scope

- Schema: add `nameEs` and `nameEn` to `StoreProductType`, with an inline backfill of the seeded rows from the current `src/i18n/locales/{es,en}/storeProductTypes.json` values before the columns become non-null.
- Name resolver: a single helper (and matching hook for client render sites) that returns the DB `nameEs` / `nameEn` when present and falls back to the `storeProductTypes` i18n namespace for seeded keys. Route the catalog render sites through it: create/edit catalog step, listing filters, listing cards, store detail, dashboard collection zone, order create/edit forms, settings preferences.
- Approve mutation (runtime, one transaction): generate a stable `key`, insert `StoreProductType { key, nameEs, nameEn, isActive: true }`, flip the request `status` to `APPROVED`, and write a `productType.approve` `AdminAuditLog` entry via `writeAuditEntry(input, tx)`.
- Reject mutation: flip the request `status` to `REJECTED` and write a `productType.reject` audit entry, with no catalog write.
- Admin data-access layer: `getAdminPendingStoreProductTypeRequests()` in a new server-only `src/lib/data/admin/adminStoreProductTypeRequestQueries.ts`.
- Thin `requireAdmin()`-gated actions `approveProductTypeRequest` / `rejectProductTypeRequest` in `src/app/[locale]/(app)/admin/_actions/`, with server-side PostHog capture (`store_product_type_request_approved` / `store_product_type_request_rejected`, namespaced under `POSTHOG_EVENTS.STORE`).
- Validation coupling: switch `collectorPreferencesValidation` from the hardcoded `STORE_PRODUCT_TYPE_KEYS` union to a DB-existence check so admin-authored types are selectable as user preferences.

## Out of Scope

- The review UI (requester, reason, `es`/`en` name inputs, generated-key preview, approve/reject buttons). Owned by the moderation console (**FRD-02** · WO-02, `#review-type`), which consumes the actions and DAL this slice ships.
- The requester-side product-type request submission from create and edit flows, already shipped by `WO-06` (`FR-04-28`).
- Store-state moderation (`WO-09`), report resolution (`WO-10`), and change-request review (`WO-11`).
- Editing or removing existing catalog product types, and any catalog subcategory management.
- Fuzzy or semantic duplicate-name detection (a semantically duplicate suggestion is an admin reject decision, not an automated merge).

## Requirements

- `FR-04-49`: Admin approve / reject of a `StoreProductTypeRequest`; approval authors a new `StoreProductType` catalog entry with a generated `key` plus `es`/`en` names persisted on the catalog row so the type is immediately usable; rejection closes it without a catalog write.
- `FR-04-51`: `requireAdmin()` gating plus `AdminAuditLog` entries with stable action keys (`productType.approve`, `productType.reject`).

Relevant business rules:

- `BR-04-18`: Product-type request names are limited to 50 characters (the source request the catalog entry derives from).
- `BR-04-28`: Approval authors a global catalog entry with a generated `key` and localized `es`/`en` names. Catalog names follow the hybrid model: authored names live in `nameEs` / `nameEn` columns, seeded keys keep the `storeProductTypes` i18n namespace, and a resolver prefers the DB name with i18n fallback.
- `BR-04-29`: Every moderation mutation is gated by `requireAdmin()` and writes an audit entry with a stable action key and no PII.

Relevant acceptance criteria:

- `AC-04-29` Product-type request approval authors the catalog and the new type is immediately selectable / filterable.
- `AC-04-30` Every moderation action is gated and audited.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points, concretized in the [product-type request approval contract](../bp-01-store-public-trust-system.md#product-type-request-approval-contract-planned):
  - data model layer: the `StoreProductType.nameEs` / `nameEn` columns plus backfill, the catalog write, and the `StoreProductTypeRequest` status flip.
  - query layer: the approval mutation (create catalog entry and resolve the request atomically) and the admin pending-request read.
  - server action layer: approve / reject actions gated by `requireAdmin()`, each writing an audit entry.
- Catalog names are hybrid: seeded keys via i18n, authored types via DB columns, unified by the name resolver (a revised architectural decision in BP-01; approval authors DB-backed names rather than writing locale files at runtime).
- See the [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-extension-planned) in BP-01.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`.
- `WO-06 Store Governance Flows` for the `StoreProductTypeRequest` model and the catalog it targets.
- Parallelizable with `WO-09` and `WO-10` once the FRD-01 foundation exists.
- Prerequisite of [PRD-03 (FRD-02) · WO-02](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/work-orders/wo-02-moderation-inbox.md): that console slice renders the review surface (`#review-type`, `FR-02-18`) and invokes the approve / reject actions this slice exposes.

## Technical Notes

- **Schema.** `StoreProductType` gains `nameEs` and `nameEn`. The Prisma migration backfills the seeded rows from the current JSON values before enforcing non-null, so no key is ever nameless. The only migration in this slice is these two columns; `StoreProductTypeRequest` gets no new columns.
- **Key generation.** The `key` is a snake_case slug of the `es` name (normalized to `[a-z0-9_]`), or the request's existing `suggestedKey` when present. Uniqueness is guaranteed by the primary key: on collision the insert is caught and translated to a typed `StoreProductTypeApprovalError("duplicateKey")` the console surfaces so the admin can adjust the name / key. The final `key` may be written back into the request's existing `suggestedKey` column for traceability.
- **Mutation placement.** The approval mutation lives in `src/lib/data/catalog/` (beside `storeProductTypeQueries.ts`) and follows the one-transaction-plus-audit pattern of `storeModerationMutations.ts` (`runModerationTransition`): load, mutate, `writeAuditEntry(input, tx)` inside a single `prisma.$transaction`.
- **Name resolver.** Prefer the DB `nameEs` / `nameEn`; fall back to `useTranslations("storeProductTypes")` / `getTranslations` for seeded keys. Client render sites consume a `useProductTypeName`-style hook fed by server-provided authored names; server render sites call the resolver directly.
- **Validation coupling.** `collectorPreferencesValidation` (`src/lib/user-settings/collectorPreferencesValidation.ts`) moves from `isStoreProductTypeKey` (the hardcoded union) to a DB-existence check, matching how store create already validates keys against the catalog (`FR-04-09`). `STORE_PRODUCT_TYPE_KEYS` stays as the seed list.

## Security Notes

- Both mutations authorize with `requireAdmin()` before any write; the actor id is resolved server-side, never taken from the client.
- Resolution is audit-only: the reviewing administrator and timestamp live in the `AdminAuditLog` entry (`actorId`, `createdAt`, `targetId` = request id), consistent with WO-09 / WO-10. The audit entry stores identifiers and an optional non-sensitive reason only, never requester identity or free text (`BR-04-29`, `BR-01-04`).

## Observability Notes

- Server-side PostHog capture on the user-visible actions (`store_product_type_request_approved` / `store_product_type_request_rejected`), matching the WO-09 server-side capture pattern.
- Expected outcomes (duplicate key, request not found or not pending) are typed errors surfaced to the console, not Sentry noise; only unexpected failures are captured with Sentry.

## Acceptance Criteria (integration)

Verified at the mutation / DAL / resolver boundary in this slice; the end-to-end flow through the review UI is exercised by the console slice (**FRD-02** · WO-02).

- Approving a product-type request creates a `StoreProductType` row with its generated `key` and `nameEs` / `nameEn`, flips the request to `APPROVED`, and writes an `AdminAuditLog` entry with `productType.approve`, all in one transaction.
- The name resolver returns the authored name for the new key (create/edit catalog step, listing filter) and the i18n name for seeded keys.
- Rejecting a product-type request flips it to `REJECTED` with no catalog write and writes an `AdminAuditLog` entry with `productType.reject`.
- A generated key that collides with an existing catalog key raises `StoreProductTypeApprovalError("duplicateKey")` and writes nothing.
- A non-administrator invoking the approve or reject action is refused by `requireAdmin()` before any change runs, and no audit entry is written.

## Tests

- Unit (mutation): atomic authoring (row + names + status flip + audit), reject audits without catalog write, duplicate-key guard, `requireAdmin()` refusal writes nothing. Placed under `src/lib/data/**/_tests/`.
- Unit (resolver): DB name preferred, i18n fallback for seeded keys.
- No new Playwright E2E in this slice (no UI shipped); the full approve-then-select flow is covered when the console review UI lands in **FRD-02** · WO-02.

## Notes

- GitHub tracking: `source_issue: 134` under BP-01; keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`, and note in the issue body that WO-12 is a prerequisite of the console inbox slice (**FRD-02** · WO-02, issue #129).
- The seeded `es` / `en` names remain a locale-file concern; only admin-authored types are DB-backed. Keep both locales in sync for any seeded-catalog change so the resolver's fallback path never renders a missing key.
