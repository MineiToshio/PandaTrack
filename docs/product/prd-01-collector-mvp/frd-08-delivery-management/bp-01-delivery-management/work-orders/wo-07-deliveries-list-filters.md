---
id: WO-07
type: WORK_ORDER
slug: deliveries-list-filters
title: Deliveries List Filters
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 103
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-07 Deliveries List Filters

## Summary

Add URL-backed filters to the deliveries list: store, product-name free text, and date range. Surface active filters as removable chips using the same interaction pattern as `Stores`.

This slice is separate from the list because filters here involve three dimensions, URL persistence, and chip management — enough complexity to be an independent vertical slice rather than a folded-in concern of the list.

## Prerequisites

- [`WO-06`](wo-06-deliveries-list.md) — the list the filters operate on

## In Scope

- filter sidebar patterned after `Stores`
- store filter (single or multi-select as defined by the sidebar pattern)
- product-name free-text filter applied inside the filter sidebar rather than as a separate top-level search
- date range filter
- URL persistence of active filters (canonical URL state, back/forward behavior preserved)
- removable chips for each active filter, following the `Stores` interaction pattern
- empty-filter state messaging
- PostHog analytics events for filter interactions
- automated tests covering the filter path (at minimum one E2E that applies filters, verifies the URL reflects the state, removes a chip, and observes the list updating)

## Out of Scope

- list rendering itself (covered in [`WO-06`](wo-06-deliveries-list.md))
- carrier-performance analytics or other advanced surfacing
- dashboard filters

## Requirements

- `FR-08-27`, `FR-08-28`
- `BR-08-03`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — list filter contract, chip pattern decision

## E2E Acceptance Tests

- Applying a store filter, a product-name text filter, or a date range filter narrows the list and reflects the filter state in the URL.
- Reloading the page with a filtered URL restores the same filter state in the sidebar and chips.
- Removing a chip clears the corresponding filter and updates both the list and the URL.
- Multiple filters combine correctly (for example store + product-name + date range) to narrow results.

## Analytics

- PostHog event per filter applied (with filter type)
- PostHog event when a chip is removed
- PostHog event when the filter URL is hydrated from a shared link
