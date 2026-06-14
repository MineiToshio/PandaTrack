---
id: FRD-04
type: FRD
slug: store-domain
title: Store Domain
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-13
source_features:
  - FEAT-0012
implementation_status: IMPLEMENTED
---

# FRD-04 Store Domain

## Overview

The store domain is the public trust and discovery layer of PandaTrack.

It exists so collectors can:

- discover sellers before buying
- understand what kind of store a seller is
- assess trust through public profile quality, moderation context, and community reviews
- connect future orders, deliveries, and reminders to a stable seller identity

This domain is implemented in production code and continues to evolve. This FRD reflects both:

- the current implemented behavior confirmed through reverse engineering of the codebase
- the remaining planned behavior already represented in linked Work Orders and mirrored in GitHub tracking

It also defines how the listing layer behaves when upstream navigation chooses to prefill the URL from user preferences.

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
- Store report submission
- Product-type request submission
- Public review create, edit, and delete flows
- Private store-note save flow
- Approved-store change-request flow
- Pending-store direct-edit permissions and route branching
- Business logo upload and public-detail rendering for business stores
- Store search/filter analytics events for listing and duplicate flows
- Store-detail single-column layout with a compact sales/shopping summary under the hero
- Private person stores (`FR-04-33` / `FR-04-34`): `Store.isPrivate` schema field, creation-form toggle shown only for `PERSON` type, and listing/search exclusion (shipped in the S6 redesign)
- Redesign UX for the store domain: filter drawer (closes only via X and Esc, not outside click), `FilterTriggerButton` with active state and applied-filter badge count, create wizard accordion with per-step `localStorage` autosave, staged-add for contact channels and addresses, logo upload with an intermediate crop-and-confirm step, and the Chip Eyebrow + Top-Accent treatment plus inline "Actions" card on store detail

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

As a collector, I want to see moderation status, activity state, and community reviews so I can judge whether a store profile feels reliable.

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
- `FR-04-13`: Public store listing must also support filters for `receivesOrders` and `hasStock`. **Redesign note:** filter inputs live in a drawer that dismisses only via its close (X) control and Esc — not via outside-click — and the listing's filter trigger shows a tinted active state with an applied-filter badge count (the free-text search does not increment that count).
- `FR-04-14`: Multi-select values within one filter family must use OR logic.
- `FR-04-15`: Different filter families must combine with AND logic.
- `FR-04-16`: Public listing must include both `PENDING` and `APPROVED` stores that are `PUBLIC`.
- `FR-04-17`: Public detail must resolve through the canonical route `/{locale}/stores/[slug]`.
- `FR-04-18`: Public detail must show a pending disclaimer for `PENDING` stores.
- `FR-04-19`: Public detail must show an inactivity warning for inactive stores.
- `FR-04-32`: Public detail should favor one main reading column, with sales channels and shopping options summarized directly under the hero before deeper catalog, contact, and address sections.

### Visibility rules

- `FR-04-20`: Business stores may expose public contact channels and public addresses.
- `FR-04-21`: Person stores must not expose logo, public contact channels, or public addresses.
- `FR-04-22`: Business-store detail payloads must include public contact and address data when present.
- `FR-04-23`: Person-store detail payloads must omit those fields from the public payload.
- `FR-04-33`: Person stores must support a `private` visibility flag at creation time. When enabled, the store is visible only to its creator; it does not appear in the public listing, public search results, or any other user's view. Private person stores retain all collector functionality for their creator (orders, deliveries, reviews, notes).
- `FR-04-34`: The private visibility flag is only available for `PERSON`-type stores. Business stores are always public.

### Trust and governance

- `FR-04-24`: Users must be able to create or edit one public review per store, and public store-detail review lists must show an initial batch of 5 reviews and allow users to reveal 5 additional reviews per action when more are available. When the signed-in viewer already has a public review for that store, that review must always appear first in the ordered list and must always count toward each batch size; remaining slots are filled with the most recently updated reviews from other users.
- `FR-04-25`: Store-level aggregate trust fields must be persisted instead of recalculated on every read.
- `FR-04-26`: Users must be able to save private notes on stores, including saving an empty value to clear an existing note without entering a full edit flow.
- `FR-04-27`: Authenticated users must be able to create and update one open report per store using one supported reason plus optional free-text context, and they may create a new report for that same store after the earlier report is resolved.
- `FR-04-28`: Authenticated users must be able to request new product types from store create and store edit flows.
- `FR-04-29`: Approved stores must support change requests instead of direct edits by normal users, and each authenticated user may keep only one open change request per store.
- `FR-04-30`: Pending stores must be directly editable only by their creator and admins; other authenticated users must use the change-request flow instead.
- `FR-04-31`: Business stores must support logo upload backed by external object storage. **Redesign note:** the upload includes an intermediate crop-and-confirm step in a modal (shared `ImageCropper`, rectangular preview) before the logo is persisted.

## Business Rules

- `BR-04-01`: Canonical public store routes use `/stores/[slug]`.
- `BR-04-02`: Store slugs are generated from the store name plus a 6-character short suffix.
- `BR-04-03`: Store slugs must not change automatically when a store name changes.
- `BR-04-04`: Pending stores are public in-app but must remain non-indexable for SEO.
- `BR-04-05`: Approved stores are public and SEO-indexable.
- `BR-04-06`: Inactive stores remain publicly viewable but must surface a warning.
- `BR-04-07`: Review publication does not require a linked order in MVP, and public review sections progressively disclose long review lists in 5-review increments instead of rendering the full list by default.
- `BR-04-20`: Pending stores support the same user interactions as approved stores — any authenticated user may write reviews, annotate orders, annotate deliveries, save notes, report, or suggest changes on a pending store. The only behavioral difference for pending stores is the moderation disclaimer shown on the detail page and the absence of SEO indexing.
- `BR-04-21`: Private person stores are excluded from all public listing and search surfaces. They remain accessible via their direct URL only to their creator.
- `BR-04-08`: Duplicate submit warnings are triggered only for same-country stores at or above the configured similarity threshold.
- `BR-04-09`: Same-name stores in different countries do not trigger the submit modal.
- `BR-04-10`: Store creation currently redirects directly to the created detail route after success.
- `BR-04-11`: Store edit routes must follow the canonical pattern `/stores/[slug]/edit`.
- `BR-04-12`: Public store-detail `Reports and suggestions` summaries may be visible to any visitor, but report and change-request submissions require authentication.
- `BR-04-13`: Public `Reports and suggestions` summaries must not expose requester identity or raw free-text report details to non-admin viewers, except that the signed-in viewer may see their own open report details and their own pending change-request comment inside the personalized summary panel.
- `BR-04-14`: A user may have only one open store report per store at a time; once the earlier report is resolved, the user may create a new report for that store.
- `BR-04-15`: A user may have only one open store change request per store at a time; once the earlier request is resolved, the user may create a new change request for that store.
- `BR-04-16`: Store change requests persist only the changed fields and must be discarded or deleted when no effective diff remains.
- `BR-04-17`: Store-country and store-type changes are not allowed through direct edit or change-request flows; store-type disputes must be raised through the report flow.
- `BR-04-18`: Product-type request names are limited to 50 characters, and free-text governance context fields are limited to 500 characters.
- `BR-04-19`: Store-detail metric counters for product-type count, import-country count, contact-channel count, and address count are not part of the implemented UI; the page prioritizes concrete values and actions instead of summary counts.

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

### `AC-04-01` Create store as non-admin

- Given an authenticated non-admin user on the create-store form
- When they submit a valid new store
- Then the store is persisted with status `PENDING`
- And the user is redirected to `/{locale}/stores/[slug]`
- And the detail page shows the pending disclaimer

### `AC-04-02` Create store as admin

- Given an authenticated admin user
- When they submit a valid new store
- Then the store is persisted with status `APPROVED`
- And `approvedByUserId` and `approvedAt` are stored

## Implementation Notes

- The store listing remains URL-driven.
- Upstream navigation may construct listing URLs with prefilled country and product-type filters from user preferences, but the listing route must continue to treat the final URL as the canonical input state.

### `AC-04-03` Blur duplicate suggestions

- Given a user enters a store name with at least 2 trimmed characters
- When the name field loses focus
- Then the system shows up to 5 duplicate candidates with positive score across all countries
- And each candidate links to the existing store detail page

### `AC-04-04` Submit duplicate confirmation

- Given a user submits a store whose name is similar enough to an existing store in the same country
- When similarity is at least the configured threshold
- Then the system blocks immediate submit
- And shows a confirmation modal with duplicate candidates
- And allows either cancel or create-anyway

### `AC-04-05` Person-store visibility

- Given a public person-store detail page
- When the page loads
- Then public contact channels, addresses, and logo are not exposed in the payload or UI

### `AC-04-06` Pending visibility and SEO

- Given a store with status `PENDING`
- When it appears in listing and detail views
- Then it remains visible in-app
- And the detail view shows a pending disclaimer
- And the route metadata is non-indexable

### `AC-04-07` Listing filter logic

- Given multiple selected filter values in one family
- When listing is queried
- Then those values are treated with OR logic
- And different filter families are combined with AND logic

### `AC-04-08` Detail page reading order

- Given a public store-detail page
- When the page loads
- Then the hero shows identity context plus status and review summary
- And a compact sales/shopping summary appears directly under the hero
- And product types and import countries appear as sibling cards before contact channels and addresses
- And the page avoids a competing metadata right rail for low-priority facts

### `AC-04-09` Public reports-and-suggestions summary visibility

- Given a public store-detail page with existing reports or change-request activity
- When any visitor opens the `Reports and suggestions` summary UI
- Then they can see two primary sections: `Community reports` and `Change requests`
- And each section is structured so personalized viewer information appears before the aggregated community summary when the viewer has an open record
- And they can see report counts grouped by supported reason
- And they can see summaries of pending or historical change requests
- But they do not see requester identity or raw free-text report details from other users

### `AC-04-10` Update open store report

- Given an authenticated user who already has one open report for a store
- When they reopen the report flow and submit new details
- Then the existing report is updated
- And a second open report is not created
- And the `Reports and suggestions` summary surfaces that same viewer report with its submitted date, selected reason, optional description, and an edit CTA that reopens the report form preloaded

### `AC-04-11` Personalized pending change request summary

- Given an authenticated user who already has one pending change request for a store
- When they open the `Reports and suggestions` summary UI
- Then the personalized change-request panel shows the latest update timestamp, changed fields, optional comment, and a CTA to continue editing
- And the aggregated community change summary remains visible as a separate block after the personalized panel

### `AC-04-12` Re-report after resolution

- Given an authenticated user whose previous report for a store is already resolved
- When they submit a new report for that same store
- Then the system creates a new report record
- And the earlier resolved report remains in history

### `AC-04-13` Approved-store change request

- Given an authenticated non-admin user on `/stores/[slug]/edit` for an approved store
- When they submit one or more allowed field changes
- Then the system persists only the changed fields as a store change request
- And direct mutation of the approved store does not occur

### `AC-04-14` No-op change request cleanup

- Given an authenticated user with an open change request for a store
- When they edit that request until it no longer differs from the persisted store
- Then no effective change request remains stored for that user and store

### `AC-04-15` Pending-store direct edit ownership

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
  - `store_review_write_clicked`
- Moderation status chips are **not** rendered on store cards in the public listing (redesign decision S6.1); status chips appear only on the store detail page for the owner/admin.
- Contact channels and addresses use a staged-add pattern in the create/edit forms: the user opens a sub-form, confirms, and the entry is appended — no empty rows are inserted automatically.

## Planned Enhancements

- _None outstanding._ `FR-04-33` / `FR-04-34` (private person stores) were implemented in the S6 redesign: `isPrivate` boolean added to `Store`, creation-form toggle shown only when type is `PERSON`, and listing/search exclusion logic. No equivalent flag exists for business stores. See the Current State list.

## Open Questions

- Moderation-state lifecycle and admin review tooling for governance records still need full downstream definition.
- Approved-store logo replacements must stage assets outside the live public object key until moderation applies them.

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
