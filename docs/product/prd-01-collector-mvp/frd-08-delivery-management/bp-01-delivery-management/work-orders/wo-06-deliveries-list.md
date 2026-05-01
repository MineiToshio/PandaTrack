---
id: WO-06
type: WORK_ORDER
slug: deliveries-list
title: Deliveries List
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 102
last_updated: 2026-04-30
implementation_status: PLANNED
---

# WO-06 Deliveries List

## Summary

Implement the deliveries workspace list with expandable cards, summary metadata (store, shipping date, expected arrival range, status, received date when delivered), pagination, and the default oldest-to-newest sort. Expanded cards show a flat product list for that delivery. No filters in this slice; filters land in [`WO-07`](wo-07-deliveries-list-filters.md).

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — delivery data-access module
- [`WO-02`](wo-02-delivery-create.md) — deliveries must exist before there is anything to list

## In Scope

- deliveries list route under `src/app/[locale]/(app)/deliveries`
- visible primary create action for new deliveries, following the same listing-surface pattern used by orders and stores
- paginated list query for deliveries with their product rows
- expandable delivery cards, patterned after orders for visual parity
- summary metadata per card: store, shipping date, expected arrival range, status, received date when delivered
- expansion surface per card showing the products included in that delivery as one flat list
- default sort: oldest to newest
- empty, loading, and error states
- link from each card into the delivery detail view (`WO-03`)
- PostHog analytics events for list view and card expansion
- automated tests covering the list path (at minimum one E2E that lists existing deliveries, expands a card to show its products, and opens the delivery detail view)

## Out of Scope

- filters (covered in [`WO-07`](wo-07-deliveries-list-filters.md))
- create flow (covered in [`WO-02`](wo-02-delivery-create.md))
- edit flow (covered in [`WO-05`](wo-05-delivery-edit.md))
- detail view and actions (covered in `WO-03`, `WO-04`)
- dashboard aggregation

## Requirements

- `FR-08-29`, `FR-08-30`, `FR-08-31`
- `FR-08-32`, `FR-08-33`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — expandable-card decision, deliveries-list contract

## UX Notes

- The page hero exposes a visible primary `New delivery` action using the same collector-workspace listing pattern already established by orders and stores.
- Card expansion prioritizes scannability over traceability in this slice: products render as a flat list, without grouping or secondary source-order metadata.

## Technical Notes

- The list should follow the same pagination pattern already used by the collector workspace order and store listings rather than rendering one unbounded feed.
- The list query should return the minimal card payload needed for the collapsed view plus the flat product rows used by expansion.
- The detail link from each card is part of this slice's acceptance path, not an optional later enhancement.

## E2E Acceptance Tests

- The deliveries list renders the existing deliveries sorted from oldest to newest by default.
- The deliveries list exposes a visible primary action to create a new delivery.
- Each delivery card shows store, shipping date, expected arrival range, and status. Delivered cards also show received date.
- A card expands to show the products included in that delivery as one flat list.
- The list paginates with the same collector-workspace interaction pattern used by orders and stores.
- Clicking into a delivery opens the detail view from [`WO-03`](wo-03-delivery-detail-read-only.md).

## Analytics

- PostHog event when the deliveries list view is opened
- PostHog event when a list card is expanded or collapsed
