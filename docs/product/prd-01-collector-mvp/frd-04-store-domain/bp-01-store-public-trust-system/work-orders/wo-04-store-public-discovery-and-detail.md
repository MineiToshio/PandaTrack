---
id: WO-04
type: WORK_ORDER
slug: store-public-discovery-and-detail
title: Store Public Discovery and Detail
status: DONE
parent: BP-01
source_issue: 73
last_updated: 2026-03-16
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
- search/filter analytics

## Out of Scope

- review submission UI
- report flow
- change request flow
- logo upload

## Requirements

- `FR-01-11`: Public store listing must support text search by name.
- `FR-01-12`: Public store listing must support filters for product type, country, import country, and presence.
- `FR-01-13`: Public store listing must also support filters for `receivesOrders` and `hasStock`.
- `FR-01-14`: Multi-select values within one filter family must use OR logic.
- `FR-01-15`: Different filter families must combine with AND logic.
- `FR-01-16`: Public listing must include both `PENDING` and `APPROVED` stores that are `PUBLIC`.
- `FR-01-17`: Public detail must resolve through the canonical route `/{locale}/stores/[slug]`.
- `FR-01-18`: Public detail must show a pending disclaimer for `PENDING` stores.
- `FR-01-19`: Public detail must show an inactivity warning for inactive stores.
- `FR-01-20`: Business stores may expose public contact channels and public addresses.
- `FR-01-21`: Person stores must not expose logo, public contact channels, or public addresses.
- `FR-01-22`: Business-store detail payloads must include public contact and address data when present.
- `FR-01-23`: Person-store detail payloads must omit those fields from the public payload.

Relevant acceptance criteria copied from the FRD:

- `AC-01-05` Person-store visibility
- `AC-01-06` Pending visibility and SEO
- `AC-01-07` Listing filter logic

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

## Status Note

Implemented in current code, with some E2E coverage still lighter than the full requirement set.
