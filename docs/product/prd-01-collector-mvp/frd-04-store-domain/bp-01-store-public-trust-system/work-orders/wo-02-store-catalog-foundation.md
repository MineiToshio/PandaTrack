---
id: WO-02
type: WORK_ORDER
slug: store-catalog-foundation
title: Store Catalog Foundation
status: DONE
parent: BP-01
source_issue: 70
last_updated: 2026-03-16
---

# WO-02 Store Catalog Foundation

## Summary

Seed the baseline country and store product-type catalogs so store creation, listing, and future trust signals rely on stable IDs instead of temporary hardcoded values.

## In Scope

- country catalog
- store product-type catalog
- review aggregate baseline fields
- i18n-driven label strategy

## Out of Scope

- dynamic metadata systems
- subcategories
- admin catalog authoring UI

## Requirements

- `FR-01-09`: The create flow must validate country codes and product-type keys against seeded catalogs before persisting.
- `FR-01-11`: Public store listing must support text search by name.
- `FR-01-12`: Public store listing must support filters for product type, country, import country, and presence.
- `FR-01-25`: Store-level aggregate trust fields must be persisted instead of recalculated on every read.

Relevant acceptance signals:

- countries and product types are seed-backed
- labels are resolved through i18n keys
- new stores start with correct review aggregate defaults

## Blueprints

- `BP-01` runtime component coverage:
  - data model layer
  - seed-backed catalog assumptions used by create and listing flows

## E2E Acceptance Tests

No standalone E2E test is required for this work order because the primary deliverable is seed-backed domain support rather than a complete user-facing flow.

## Status Note

Implemented and documented in seeded catalog references.
