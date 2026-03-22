---
id: FRD-04
type: FRD
slug: store-domain
title: Store Domain
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0012
implementation_status: PARTIALLY_IMPLEMENTED
---

# FRD-04 Store Domain

## Overview

The store domain is the public trust and discovery layer of PandaTrack.

It exists so collectors can:

- discover sellers before buying
- understand what kind of store a seller is
- assess trust through public profile quality and, later, reviews
- connect future orders, deliveries, and reminders to a stable seller identity

This domain is already partially implemented in production code. This FRD reflects both:

- the current implemented behavior confirmed through reverse engineering of the codebase
- the remaining planned behavior already represented in linked Work Orders and mirrored in GitHub tracking

## Current State

### Implemented

- Store persistence model and related entities
- Seeded country and store product-type catalogs
- Store creation form and server action
- Duplicate detection on blur and on submit
- Stable slug generation with 6-char suffix
- Public stores listing page
- Public store detail page
- Business vs person public visibility rules
- Pending-store in-app visibility
- Pending-store detail disclaimer
- Inactive-store warning on detail page
- Store search/filter analytics events for listing and duplicate flows

### Planned but not yet implemented

- Public review create/edit flow
- Private store notes
- Store report submission
- Product-type request submission
- Approved-store change requests
- Pending-store direct-edit permissions UI/flow
- Business logo upload pipeline
- Final analytics and error-handling hardening for remaining store flows

## Terminology

- `Store`: the main seller identity entity in PandaTrack
- `Business store`: a store representing a business or formal shop profile
- `Person store`: a store representing an individual seller
- `Pending store`: a public store created by a non-admin user that is visible in-app but not SEO-indexable
- `Approved store`: a public store approved for normal indexable public visibility
- `Presence`: where the store operates, currently `ONLINE` and/or `PHYSICAL`
- `Product type`: collector-focused product category assigned to the store
- `Import country`: country from which the store imports items
- `Duplicate candidate`: an existing store whose name appears similar enough to the new candidate to warn the user

## User Stories

### US-01 Discover stores

As a collector, I want to browse and filter stores so I can evaluate which sellers match what I buy and where I buy from.

### US-02 Create a new store safely

As an authenticated collector, I want to add a store profile with duplicate protection so I do not flood the product with near-identical seller entries.

### US-03 Understand store trust context

As a collector, I want to see moderation status, activity state, and later reviews so I can judge whether a store profile feels reliable.

### US-04 Hide sensitive fields for person sellers

As a product owner, I want person-seller profiles to hide contact and address details publicly so public visibility stays appropriate.

### US-05 Govern corrections over time

As PandaTrack grows, I want stores to support reports, requests, and change suggestions so public data can improve without uncontrolled editing.

## Functional Requirements

### Identity and modeling

- `FR-04-01`: The system must model stores as a first-class domain entity.
- `FR-04-02`: A store must support `BUSINESS` and `PERSON` types.
- `FR-04-03`: A store must support repeatable presence values `ONLINE` and `PHYSICAL`.
- `FR-04-04`: A store must support core identity fields including `name`, `slug`, `description`, `countryCode`, moderation state, and activity state.
- `FR-04-05`: A store must support related metadata for product types, import countries, contact channels, and addresses.

### Creation and moderation

- `FR-04-06`: Authenticated users must be able to create stores.
- `FR-04-07`: Admin-created stores must default to `APPROVED`.
- `FR-04-08`: Normal-user-created stores must default to public `PENDING`.
- `FR-04-09`: The create flow must validate country codes and product-type keys against seeded catalogs before persisting.
- `FR-04-10`: Store creation must support both blur-time duplicate suggestions and submit-time duplicate confirmation.

### Discovery and detail

- `FR-04-11`: Public store listing must support text search by name.
- `FR-04-12`: Public store listing must support filters for product type, country, import country, and presence.
- `FR-04-13`: Public store listing must also support filters for `receivesOrders` and `hasStock`.
- `FR-04-14`: Multi-select values within one filter family must use OR logic.
- `FR-04-15`: Different filter families must combine with AND logic.
- `FR-04-16`: Public listing must include both `PENDING` and `APPROVED` stores that are `PUBLIC`.
- `FR-04-17`: Public detail must resolve through the canonical route `/{locale}/stores/[slug]`.
- `FR-04-18`: Public detail must show a pending disclaimer for `PENDING` stores.
- `FR-01-19`: Public detail must show an inactivity warning for inactive stores.

### Visibility rules

- `FR-01-20`: Business stores may expose public contact channels and public addresses.
- `FR-01-21`: Person stores must not expose logo, public contact channels, or public addresses.
- `FR-01-22`: Business-store detail payloads must include public contact and address data when present.
- `FR-01-23`: Person-store detail payloads must omit those fields from the public payload.

### Trust and governance

- `FR-01-24`: Users must be able to create or edit one public review per store, and public store-detail review lists must show an initial batch of 5 reviews and allow users to reveal 5 additional reviews per action when more are available. When the signed-in viewer already has a public review for that store, that review must always appear first in the ordered list and must always count toward each batch size; remaining slots are filled with the most recently updated reviews from other users.
- `FR-01-25`: Store-level aggregate trust fields must be persisted instead of recalculated on every read.
- `FR-01-26`: Users must be able to save private notes on stores.
- `FR-01-27`: Authenticated users must be able to create and update one open report per store using one supported reason plus optional free-text context, and they may create a new report for that same store after the earlier report is resolved.
- `FR-01-28`: Authenticated users must be able to request new product types from store create and store edit flows.
- `FR-01-29`: Approved stores must support change requests instead of direct edits by normal users, and each authenticated user may keep only one open change request per store.
- `FR-01-30`: Pending stores must be directly editable only by their creator and admins; other authenticated users must use the change-request flow instead.
- `FR-01-31`: Business stores must support logo upload backed by external object storage.

## Business Rules

- `BR-01-01`: Canonical public store routes use `/stores/[slug]`.
- `BR-01-02`: Store slugs are generated from the store name plus a 6-character short suffix.
- `BR-01-03`: Store slugs must not change automatically when a store name changes.
- `BR-01-04`: Pending stores are public in-app but must remain non-indexable for SEO.
- `BR-01-05`: Approved stores are public and SEO-indexable.
- `BR-01-06`: Inactive stores remain publicly viewable but must surface a warning.
- `BR-01-07`: Review publication does not require a linked order in MVP, and public review sections progressively disclose long review lists in 5-review increments instead of rendering the full list by default.
- `BR-01-08`: Duplicate submit warnings are triggered only for same-country stores at or above the configured similarity threshold.
- `BR-01-09`: Same-name stores in different countries do not trigger the submit modal.
- `BR-01-10`: Store creation currently redirects directly to the created detail route after success.
- `BR-01-11`: Store edit routes must follow the canonical pattern `/stores/[slug]/edit`.
- `BR-01-12`: Public store-detail governance summaries may be visible to any visitor, but governance submissions require authentication.
- `BR-01-13`: Public governance summaries must not expose requester identity or raw free-text report details to non-admin viewers.
- `BR-01-14`: A user may have only one open store report per store at a time; once the earlier report is resolved, the user may create a new report for that store.
- `BR-01-15`: A user may have only one open store change request per store at a time; once the earlier request is resolved, the user may create a new change request for that store.
- `BR-01-16`: Store change requests persist only the changed fields and must be discarded or deleted when no effective diff remains.
- `BR-01-17`: Store-country and store-type changes are not allowed through direct edit or change-request flows; store-type disputes must be raised through the report flow.
- `BR-01-18`: Product-type request names are limited to 50 characters, and free-text governance context fields are limited to 500 characters.

## State Model

### Moderation state

- `PENDING`
- `APPROVED`
- `REJECTED`
- `FLAGGED`

### Activity state

- `ACTIVE`
- `INACTIVE`

### Store type

- `BUSINESS`
- `PERSON`

### Presence state

- `ONLINE`
- `PHYSICAL`

## Data Concepts

- `Store`
- `Country`
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

## Acceptance Criteria

### `AC-01-01` Create store as non-admin

- Given an authenticated non-admin user on the create-store form
- When they submit a valid new store
- Then the store is persisted with status `PENDING`
- And the user is redirected to `/{locale}/stores/[slug]`
- And the detail page shows the pending disclaimer

### `AC-01-02` Create store as admin

- Given an authenticated admin user
- When they submit a valid new store
- Then the store is persisted with status `APPROVED`
- And `approvedByUserId` and `approvedAt` are stored

### `AC-01-03` Blur duplicate suggestions

- Given a user enters a store name with at least 2 trimmed characters
- When the name field loses focus
- Then the system shows up to 5 duplicate candidates with positive score across all countries
- And each candidate links to the existing store detail page

### `AC-01-04` Submit duplicate confirmation

- Given a user submits a store whose name is similar enough to an existing store in the same country
- When similarity is at least the configured threshold
- Then the system blocks immediate submit
- And shows a confirmation modal with duplicate candidates
- And allows either cancel or create-anyway

### `AC-01-05` Person-store visibility

- Given a public person-store detail page
- When the page loads
- Then public contact channels, addresses, and logo are not exposed in the payload or UI

### `AC-01-06` Pending visibility and SEO

- Given a store with status `PENDING`
- When it appears in listing and detail views
- Then it remains visible in-app
- And the detail view shows a pending disclaimer
- And the route metadata is non-indexable

### `AC-01-07` Listing filter logic

- Given multiple selected filter values in one family
- When listing is queried
- Then those values are treated with OR logic
- And different filter families are combined with AND logic

### `AC-01-08` Public governance summary visibility

- Given a public store-detail page with existing governance activity
- When any visitor opens the governance summary UI
- Then they can see report counts grouped by supported reason
- And they can see summaries of pending or historical change requests
- But they do not see requester identity or raw free-text report details

### `AC-01-09` Update open store report

- Given an authenticated user who already has one open report for a store
- When they reopen the report flow and submit new details
- Then the existing report is updated
- And a second open report is not created

### `AC-01-10` Re-report after resolution

- Given an authenticated user whose previous report for a store is already resolved
- When they submit a new report for that same store
- Then the system creates a new report record
- And the earlier resolved report remains in history

### `AC-01-11` Approved-store change request

- Given an authenticated non-admin user on `/stores/[slug]/edit` for an approved store
- When they submit one or more allowed field changes
- Then the system persists only the changed fields as a store change request
- And direct mutation of the approved store does not occur

### `AC-01-12` No-op change request cleanup

- Given an authenticated user with an open change request for a store
- When they edit that request until it no longer differs from the persisted store
- Then no effective change request remains stored for that user and store

### `AC-01-13` Pending-store direct edit ownership

- Given a pending store
- When the creator or an admin opens `/stores/[slug]/edit`
- Then they can directly edit the store
- But when another authenticated user opens that route
- Then they must follow the change-request path instead

## Current Implementation Notes

- Canonical route in code today is `/stores/[slug]`, not `/store/[slug]`.
- Listing currently supports `q`, `productType`, `category`, `country`, `importCountry`, `presence`, `receivesOrders`, `hasStock`, and `page`.
- Duplicate scoring ignores generic-only terms such as `store`, `shop`, `tienda`, and similar terms unless the normalized name is effectively exact.
- Current analytics implemented for store flows are:
  - `store_created`
  - `store_duplicate_suggestions_shown`
  - `store_duplicate_submit_modal_shown`
  - `store_searched`

## Open Questions

- Review fields are still not fully specified in product detail.
- Moderation-state lifecycle and admin review tooling for governance records still need full downstream definition.
- Product-type request payload and moderation rules still need implementation.
- Approved-store change-request shape and edit-route behavior still need implementation.
- Pending-store edit UX now has approved direction but still needs implementation.
- Logo upload constraints and processing contract still need final definition.

## Source Signals Used For Reverse Engineering

- `src/queries/store.ts`
- `src/app/[locale]/(app)/stores/**/*`
- `src/lib/store/*`
- `src/queries/_tests/store.integration.test.ts`
- `e2e/stores.spec.ts`
- `e2e/store-listing.spec.ts`
- GitHub issues `#68`, `#74`, `#75`, `#76`

## Linked Blueprint

- `docs/product/prd-01-collector-mvp/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md`
