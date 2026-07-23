---
id: BP-01
type: BLUEPRINT
slug: store-public-trust-system
title: Store Public Trust System
status: ACTIVE
parent: FRD-04
children:
  - WO-01
  - WO-02
  - WO-03
  - WO-04
  - WO-05
  - WO-06
  - WO-07
  - WO-08
  - WO-09
  - WO-10
  - WO-11
  - WO-12
last_updated: 2026-07-22
implementation_status: PARTIALLY_IMPLEMENTED
---

# BP-01 Store Public Trust System

## Overview

This blueprint is the technical counterpart to [FRD-04 Store Domain](../frd-04-store-domain.md).

Its job is to explain how the current store domain is composed, where the runtime boundaries live, which parts are already implemented, and which work orders should extend which layer.

## Blueprint Goals

- trace the store domain downward from requirements into code structure
- show how listing, detail, create, and duplicate-prevention flows are split across runtime boundaries
- identify current implementation contracts already visible in code
- define where pending work should land without spreading logic arbitrarily

## Requirement Coverage

This blueprint supports at least the following FRD areas:

- identity and modeling
- creation and moderation
- discovery and detail
- visibility rules
- trust, governance, and logo-storage flows

## Runtime Components

### 1. Data model layer

Primary source:

- `prisma/schema.prisma`

Key entities already present:

- `Store`
- `StorePresence`
- `StoreContactChannel`
- `StoreAddress`
- `StoreImportCountry`
- `StoreProductType`
- `StoreProductTypeAssignment`
- `StoreReview`
- `StoreNote`
- `StoreReport`
- `StoreProductTypeRequest`
- `StoreChangeRequest`

Role:

- persist store identity and moderation state
- persist discovery metadata and future trust/governance data
- support future links to orders and deliveries

**Seller-type model (data-model decision, ADR 0016):** `Store` classifies its seller via
`Store.sellerType` (Prisma enum `SellerType`), one of `RETAILER | PERSON | PROXY`. This field
and enum were **renamed** from `Store.storeType` / `enum StoreType` (value `BUSINESS` →
`RETAILER`) to disambiguate the classification from the "Tienda" (`Store`) entity/section and
to name the seller's role rather than its legal category; `PROXY` (a forwarding/intermediary
service with no catalog of its own, e.g. ZenMarket) is a new value. The migration is a
hand-written enum rename (`ALTER TYPE … RENAME VALUE`, `ADD VALUE 'PROXY'`, `RENAME TO
"SellerType"`, `ALTER TABLE "store" RENAME COLUMN`) so existing rows are preserved in place
(the former `BUSINESS` rows become `RETAILER`). Prisma cannot auto-detect enum/column renames,
so this uses the hand-written-SQL fallback of `prisma-migration-workflow.mdc`. PROXY behavior
gating (no product types, null `hasStock` / `receivesOrders`; keeps logo, import countries,
contact channels, addresses, reviews; always public) is enforced in the create action, the
governance edit mutation, and the `getStoreBySlug` payload assembly (`sellerType !== "PERSON"`
exposes logo/contacts/addresses).

### 2. Query layer

Primary source:

- `src/lib/data/stores/storeQueries.ts`

Current responsibilities:

- duplicate-candidate queries
- listing filter construction
- listing pagination
- create-store transaction write
- store-detail read model assembly
- business vs person visibility shaping
- public reviews read model and viewer-first ordering
- viewer-context reads for review and private note
- logo URL persistence after successful upload

Role:

- keep Prisma access out of UI components
- centralize listing/detail/query rules
- centralize public payload shaping

### 3. Store utility layer

Primary sources:

- `src/lib/store/duplicateMatch.ts`
- `src/lib/store/slug.ts`

Current responsibilities:

- normalized name comparison
- token scoring and thresholding
- slugification and 6-char suffix generation

Role:

- keep store-specific algorithms reusable and testable

### 4. Server action layer

Primary sources:

- `src/app/[locale]/(app)/stores/new/_actions/createStore.ts`
- `src/app/[locale]/(app)/stores/new/_actions/getDuplicateCandidates.ts`

Current responsibilities:

- session and auth gate for create flow
- form-data extraction and normalization
- Zod validation
- catalog existence checks
- admin/non-admin status branching
- PostHog instrumentation
- duplicate-candidate action exposure for the form
- public review save/delete actions
- private-note save action
- store-report and change-request action entry points
- business-logo upload and cleanup orchestration

Role:

- bridge UI forms to domain writes and reads
- validate and enrich requests before they reach the query layer

### 5. UI flow layer

Primary sources:

- `src/app/[locale]/(app)/stores/new/_components/CreateStoreForm.tsx`
- `src/app/[locale]/(app)/stores/_components/StoreListingFilters.tsx`
- `src/app/[locale]/(app)/stores/_components/StoreListingContent.tsx`
- `src/app/[locale]/(app)/stores/[slug]/_components/StoreDetailContent.tsx`

Current responsibilities:

- create-store UX
- blur and submit duplicate UX
- listing search/filter UX
- detail-page trust and visibility UX
- pending disclaimer and inactive warning rendering
- compact post-hero summary for sales channels and shopping options
- public review management and private-note editing on store detail
- governance summary and report entry points on store detail
- business-logo rendering in create, edit, listing duplicates, and business detail pages

Role:

- convert domain payloads into user-facing flows
- keep business rules visible without embedding data access logic in components

### 6. Verification layer

Primary sources:

- `src/lib/data/stores/_tests/store.integration.test.ts`
- `src/lib/store/_tests/slug.test.ts`
- `src/lib/store/_tests/duplicateMatch.test.ts`
- `e2e/stores.spec.ts`
- `e2e/store-listing.spec.ts`

Role:

- prove query behavior
- prove store-specific algorithm rules
- validate critical UI flows and routing behavior

## Current System Contracts

### Store creation contract

- input enters as `FormData`
- server action parses and validates with `createStoreSchema`
- country codes and product types are checked against the catalog
- role determines `PENDING` vs `APPROVED`
- `createStore()` persists the store and related rows in one write path
- success redirects to `/{locale}/stores/[slug]`

### Duplicate-detection contract

- blur flow:
  - all countries
  - top 5
  - any positive score
- submit flow:
  - same country only
  - top 5
  - similarity threshold currently `70`
- analytics are emitted at both duplicate-interaction checkpoints

### Listing contract

- listing only includes `PUBLIC` stores with status `PENDING` or `APPROVED`
- inactive stores are still included
- name query is case-insensitive
- filters currently support:
  - product type
  - country
  - import country
  - presence
  - receives orders
  - has stock
- pagination defaults to page size `10`

### Detail contract

- detail read returns only public stores with status `PENDING` or `APPROVED`
- business stores include public channels, addresses, and optional logo
- person stores omit those fields from the public payload
- pending stores are shown with disclaimer
- inactive stores are shown with warning
- detail UI currently favors one main reading column
- sales channels and shopping options are summarized in a compact surface directly under the hero
- product types and import countries render as sibling cards on desktop and stack naturally on smaller screens
- contact channels and addresses remain full titled sections below the catalog summary areas

### Reviews and notes contract

- public reviews are persisted and aggregated at the store level
- when a signed-in viewer has a review, it is surfaced first in the public review list
- the public review list shows a 4-review community preview and reveals all remaining reviews in a single "Ver todas" action instead of rendering every review immediately
- one private note per signed-in viewer can be saved and edited from the detail page without entering full store edit mode
- saving an empty trimmed store-note value clears the persisted note, matching the inline-note behavior used by order and delivery detail

### Logo contract

- business stores may upload a logo during create and edit flows
- successful uploads persist a final public `logoUrl` on the store row
- approved-store edit flows stage pending logo uploads without replacing the public logo before moderation

## Architectural Decisions Already Visible

- public store route remains `/stores/[slug]`
- duplicate scoring lives in reusable utilities, not inline in the UI
- store listing and detail shaping live in query-layer read models
- create-store flow uses server actions instead of direct client writes
- catalogs are seed-backed and displayed through i18n keys, not localized DB text

## Planned Extension Points

### Governance flows

Should extend:

- data model layer
- query layer for public governance-summary reads
- request validation layer
- targeted UI entry points
- `/stores/[slug]/edit` route contract
- moderation-ready storage contracts
- reusable modal and max-length field UX patterns shared with store forms

### Remaining extension focus

Current logo-storage decision is already implemented:

- use the shared assets bucket configured for the active environment
- use the `store-logos/` asset route prefix for persisted business logos
- persist the final optimized asset with the object key `store-logos/{storeId}.webp`
- when the same persisted logo object key is overwritten, the public store `logoUrl` may append a content-version query token so browsers and CDN layers do not keep serving a stale cached asset
- when an approved-store edit is saved as a change request, stage the pending logo under `store-logos/pending/{storeId}-{userId}.webp` so the public logo does not change before moderation

## Risks and Constraints

- Review, report, and change-request flows exist in the store domain. Admin moderation actions are now defined (see [Admin Moderation Extension](#admin-moderation-extension-planned)) but are planned, not shipped; work in that area must build on the [PRD-03 (FRD-01)](../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md) platform rather than assuming a standalone dashboard already exists.
- Public governance summary reads must avoid exposing requester identity or raw free-text report details to non-admin viewers.
- Change-request persistence must stay diff-based; snapshot-style writes would make moderation review noisier and increase accidental drift.
- Pending-store direct edits and approved-store change requests now share the same route shape, so permission checks must stay explicit at the action and query boundaries.
- Remaining store work should assume the logo upload path already exists and extend it carefully rather than replacing it.

## ADR Need

Potential ADR candidates when the next store slice starts:

- write-path design for review aggregate synchronization
- permission boundary for pending direct edit vs approved change request
- governance-summary read model for public vs admin audiences

## Linked Work Orders

- `work-orders/wo-01-store-persistence-foundation.md`
- `work-orders/wo-02-store-catalog-foundation.md`
- `work-orders/wo-03-store-creation-and-duplicate-prevention.md`
- `work-orders/wo-04-store-public-discovery-and-detail.md`
- `work-orders/wo-05-store-reviews-and-private-notes.md`
- `work-orders/wo-06-store-governance-flows.md`
- `work-orders/wo-07-store-permissions-logo-and-hardening.md`
- `work-orders/wo-08-seller-type-and-proxy.md`
- `work-orders/wo-09-store-approval-and-removal.md`
- `work-orders/wo-10-report-resolution.md`
- `work-orders/wo-11-change-request-review.md`
- `work-orders/wo-12-product-type-request-approval.md`

## Admin Moderation Extension (planned)

Work orders `WO-09` through `WO-12` add the admin inline moderation actions defined by [FRD-04 `FR-04-40` through `FR-04-51`](../frd-04-store-domain.md#admin-moderation-actions). They consume the administrator platform (durable `role`, `requireAdmin()`, `AdminAuditLog`, `writeAuditEntry()`) from [PRD-03 (FRD-01)](../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), whose foundation is [FRD-01 · WO-01](../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md). The moderation console at `/[locale]/admin` ([PRD-03 (FRD-02)](../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md)) routes administrators to these inline controls; the controls themselves live here.

Sequencing:

- All four (`WO-09`, `WO-10`, `WO-11`, `WO-12`) depend on [FRD-01 · WO-01](../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) and cannot start before it.
- `WO-09` (store approval and removal), `WO-10` (report resolution), and `WO-12` (product-type request approval) are parallelizable once that foundation exists.
- `WO-11` (change-request review) follows `WO-09`, because its supersede-after-write sweep (`FR-04-48`, `BR-04-27`) must fire on the store-state moderation writes that `WO-09` introduces, not only on direct edits.

### Store removal tombstone contract (planned)

- store removal sets moderation state `REJECTED` and persists a new `Store.removalReason`; it is a tombstone, never a hard delete
- a `REJECTED` store is excluded from every public read model: listing where-builder, search, `getStoreBySlug` (direct URL 404), and `getOrderableStores` (order picker)
- the store row is retained so collector orders that reference it keep resolving; the order-side store surface reads the tombstone and shows a neutral message by default, with sanction wording only when `removalReason` is an abuse category
- the rejection transition is where FRD-04 hands off to [FRD-09](../../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md) for the creator notification; this blueprint owns the state and reason, not the notification delivery

### Change-request rebase-apply contract (planned)

- approving a `StoreChangeRequest` re-derives the diff against the store's current state at approval time (rebase), never blind-applying the stored diff
- the apply runs in one transaction and includes relation fields: `contactChannels`, `addresses`, `productTypeKeys`, `importCountries`
- `reviewedByUserId` and `reviewedAt` are persisted; `sellerType` and country stay immutable (`BR-04-17`)
- drift (the current store state diverged from what the request was authored against) is detected and surfaced to the administrator, not silently applied
- after any store write (direct edit, applied change request, or moderation transition), other open change requests on the same store whose diff is now empty are superseded (extends the author-side no-op discard, `BR-04-16`, to cross-request invalidation)

### Admin data-access-layer contract (planned)

- raw report free-text and reporter identity are exposed to administrators only, through a new server-only admin data-access module (for example under `src/lib/data/admin/`)
- the public governance read model (`getStoreGovernanceSummary`) must not be widened to carry that data; the non-admin guarantee (`BR-04-13`) stays intact
- this mirrors the moderation console's own secure-read requirement (`BR-02-03` of [PRD-03 (FRD-02)](../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md))

### Admin moderation gating contract (planned)

- every moderation mutation (approve, remove, flag, unflag, resolve report, dismiss report, apply change request, reject change request, approve product-type request, reject product-type request) authorizes with `requireAdmin()` before any write
- each writes an append-only `AdminAuditLog` entry via `writeAuditEntry()` using a stable action key (`store.approve`, `store.remove`, `store.flag`, `store.unflag`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`)
- audit entries store identifiers and an optional non-sensitive reason only, never raw report text or reporter identity
- each user-visible action also emits its PostHog event alongside the audit entry (`store_approved`, `store_removed`, `store_flagged`, `store_unflagged`, `store_report_resolved`, `store_report_dismissed`, `store_change_request_applied`, `store_change_request_rejected`, `store_product_type_request_approved`, `store_product_type_request_rejected`)
