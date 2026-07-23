---
id: WO-04
type: WORK_ORDER
slug: store-public-discovery-and-detail
title: Store Public Discovery and Detail
status: ACTIVE
parent: BP-01
source_issue: 73
last_updated: 2026-04-26
implementation_status: IMPLEMENTED
---

# WO-04 Store Public Discovery and Detail

## Summary

Ship the public store listing and detail experience, including search, filters, pending/inactive messaging, and business-vs-person visibility rules.

## In Scope

- listing route
- detail route
- listing filters
- pagination
- detail payload shaping
- pending disclaimer
- inactive warning
- detail page visual alignment with order detail panels
- single-column detail reading order with compact post-hero sales/shopping summary
- product-type and import-country section layout in the main content column
- search/filter analytics

## Out of Scope

- review submission and private-note behavior on the same route remain owned by `WO-05`
- governance submission flows beyond the detail-page entry points owned by `WO-06`
- logo upload

## Requirements

- `FR-04-11`: Public store listing must support text search by name.
- `FR-04-12`: Public store listing must support filters for product type, country, import country, and presence.
- `FR-04-13`: Public store listing must also support filters for `receivesOrders` and `hasStock`.
- `FR-04-14`: Multi-select values within one filter family must use OR logic.
- `FR-04-15`: Different filter families must combine with AND logic.
- `FR-04-16`: Public listing must include both `PENDING` and `APPROVED` stores that are `PUBLIC`.
- `FR-04-17`: Public detail must resolve through the canonical route `/{locale}/stores/[slug]`.
- `FR-04-18`: Public detail must show a pending disclaimer for `PENDING` stores.
- `FR-04-19`: Public detail must show an inactivity warning for inactive stores.
- `FR-04-20`: `RETAILER` and `PROXY` stores may expose public contact channels and public addresses.
- `FR-04-21`: Person stores must not expose logo, public contact channels, or public addresses.
- `FR-04-22`: Business-store detail payloads must include public contact and address data when present.
- `FR-04-23`: Person-store detail payloads must omit those fields from the public payload.

Relevant acceptance criteria copied from the FRD:

- `AC-04-05` Person-store visibility
- `AC-04-06` Pending visibility and SEO
- `AC-04-07` Listing filter logic
- `AC-04-08` Detail page reading order

## Blueprints

- `BP-01` runtime component coverage:
  - query layer
  - listing/detail UI flow layer
  - verification layer

## E2E Acceptance Tests

- Stores listing page loads successfully.
- Search/filter drawer can be opened from the listing page.
- Listing supports name and filter-driven navigation.
- Store detail route resolves at `/stores/[slug]`.
- Pending stores show a disclaimer on detail.
- Person-store detail hides contact and address sections.
- Store detail sections use the same panel chrome as order detail sections, but the page should favor a single main reading column: a compact sales/shopping summary under the hero, then catalog, contact, and address sections in natural vertical order instead of a competing right rail.
- Store detail no longer shows metric-count cards for product types, import countries, contact channels, or addresses.

## Status Note

Implemented in current code, with some E2E coverage still lighter than the full requirement set.

Cross-domain note: later [FRD-07 · WO-06 (store-entry-defaults-from-user-preferences)](../../../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-06-store-entry-defaults-from-user-preferences.md) work may generate default listing query strings from saved preferences, but this listing slice still treats the resolved URL as the canonical filter state.
