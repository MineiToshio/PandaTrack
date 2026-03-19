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
last_updated: 2026-03-16
---

# BP-01 Store Public Trust System

## Overview

This blueprint is the technical counterpart to `FRD-04 Store Domain`.

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
- future trust and governance flows

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

### 2. Query layer

Primary source:

- `src/queries/store.ts`

Current responsibilities:

- duplicate-candidate queries
- listing filter construction
- listing pagination
- create-store transaction write
- store-detail read model assembly
- business vs person visibility shaping

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

Role:

- convert domain payloads into user-facing flows
- keep business rules visible without embedding data access logic in components

### 6. Verification layer

Primary sources:

- `src/queries/_tests/store.integration.test.ts`
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

## Architectural Decisions Already Visible

- public store route remains `/stores/[slug]`
- duplicate scoring lives in reusable utilities, not inline in the UI
- store listing and detail shaping live in query-layer read models
- create-store flow uses server actions instead of direct client writes
- catalogs are seed-backed and displayed through i18n keys, not localized DB text

## Planned Extension Points

### Reviews and notes

Should extend:

- data model layer
- query layer
- server action layer
- detail UI and authenticated context entry points

### Governance flows

Should extend:

- data model layer
- request validation layer
- targeted UI entry points
- moderation-ready storage contracts

### Logo upload

Should extend:

- server action layer
- storage integration layer
- query read model for logo reference

## Risks and Constraints

- Review, report, and change-request flows are not implemented yet, so future work must not assume those payloads already exist in UI or query shape.
- Cloudflare R2 integration is planned but not present in current store code paths.

## ADR Need

Potential ADR candidates when the next store slice starts:

- storage strategy for business logos
- write-path design for review aggregate synchronization
- permission boundary for pending direct edit vs approved change request

## Linked Work Orders

- `work-orders/wo-01-store-persistence-foundation.md`
- `work-orders/wo-02-store-catalog-foundation.md`
- `work-orders/wo-03-store-creation-and-duplicate-prevention.md`
- `work-orders/wo-04-store-public-discovery-and-detail.md`
- `work-orders/wo-05-store-reviews-and-private-notes.md`
- `work-orders/wo-06-store-governance-flows.md`
- `work-orders/wo-07-store-permissions-logo-and-hardening.md`
