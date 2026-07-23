---
id: WO-12
type: WORK_ORDER
slug: product-type-request-approval
title: Product Type Request Approval
status: DRAFT
parent: BP-01
source_features: []
source_issue: TBD
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-12 Product Type Request Approval

## Summary

Add the admin inline approval or rejection of a `StoreProductTypeRequest`. On approval, author the requested product type into the global `StoreProductType` catalog: its `key` plus localized names in both `es` and `en` in the `storeProductTypes` i18n namespace. Rejection closes the request without a catalog write. These actions are gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), and the moderation console defined by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to them.

## In Scope

- Admin inline **approve** control for an open `StoreProductTypeRequest`:
  - Create a new `StoreProductType` catalog entry with a stable `key`.
  - Author localized names in both `es` and `en` in the `storeProductTypes` i18n namespace (`src/i18n/locales/es/storeProductTypes.json` and `src/i18n/locales/en/storeProductTypes.json`), consistent with the existing catalog convention of i18n keys rather than localized database text.
  - Mark the request resolved.
- Admin inline **reject** control: close the request without writing to the catalog.
- `requireAdmin()` gating on the approve / reject mutations, with an `AdminAuditLog` entry via `writeAuditEntry()` for `productType.approve` and `productType.reject`.
- PostHog analytics for the user-visible actions: `store_product_type_request_approved`, `store_product_type_request_rejected`, namespaced under `POSTHOG_EVENTS.STORE`.

## Out of Scope

- The requester-side product-type request submission from create and edit flows, already shipped by `WO-06` (`FR-04-28`).
- Store-state moderation (`WO-09`), report resolution (`WO-10`), and change-request review (`WO-11`).
- Editing or removing existing catalog product types, and any catalog subcategory management.
- The moderation inbox that aggregates pending product-type requests (owned by PRD-03, FRD-02).

## Requirements

- `FR-04-49`: Admin approve / reject of a `StoreProductTypeRequest`; approval authors a new `StoreProductType` catalog entry with `key` plus `es`/`en` names; rejection closes it without a catalog write.
- `FR-04-51`: `requireAdmin()` gating plus `AdminAuditLog` entries with stable action keys (`productType.approve`, `productType.reject`).

Relevant business rules:

- `BR-04-18`: Product-type request names are limited to 50 characters (the source request the catalog entry derives from).
- `BR-04-28`: Approval authors a global catalog entry with `key` and localized `es`/`en` names in the `storeProductTypes` i18n namespace, not localized database text.
- `BR-04-29`: Every moderation mutation is gated by `requireAdmin()` and writes an audit entry with a stable action key and no PII.

Relevant acceptance criteria:

- `AC-04-29` Product-type request approval authors the catalog.
- `AC-04-30` Every moderation action is gated and audited.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points:
  - data model layer: the `StoreProductType` catalog write and the `StoreProductTypeRequest` resolution.
  - query layer: a mutation that creates the catalog entry and resolves the request atomically.
  - server action layer: approve / reject actions gated by `requireAdmin()`, each writing an audit entry.
  - UI flow layer: the admin-only approve / reject affordance in the governance surface.
- Catalog names are seed-backed and displayed through i18n keys (an existing architectural decision in BP-01); approval extends that convention rather than introducing localized DB text.
- See the [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-gating-contract-planned) in BP-01.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`.
- `WO-06 Store Governance Flows` for the `StoreProductTypeRequest` model and the catalog it targets.
- Parallelizable with `WO-09` and `WO-10` once the FRD-01 foundation exists.

## E2E Acceptance Tests

- An administrator approves a product-type request; a new `StoreProductType` entry exists with its `key` and localized names in both `es` and `en`, and an `AdminAuditLog` entry with `productType.approve` is written.
- The newly authored product type is then selectable in the store create / edit catalog step and usable as a listing filter value.
- An administrator rejects a product-type request; it is closed with no catalog write, and an `AdminAuditLog` entry with `productType.reject` is written.
- A non-administrator invoking the approve or reject action directly is refused by `requireAdmin()` before any change runs, and no audit entry is written.

## Notes

- GitHub tracking: this work order needs a corresponding sub-issue under BP-01 (`source_issue: TBD`); create it and keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`.
- Authoring the `es`/`en` names is a locale-file change (`storeProductTypes` namespace); keep both locales in sync in the same change so the catalog never renders a missing key.
