---
id: WO-06
type: WORK_ORDER
slug: deliveries-list
title: Deliveries List
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 102
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-06 Deliveries List

## Summary

Implement the deliveries workspace list with expandable cards that group products by delivery, summary metadata (store, date, expected arrival range, status, carrier, tracking), and the default oldest-to-newest sort. No filters in this slice; filters land in [`WO-07`](wo-07-deliveries-list-filters.md).

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — delivery data-access module
- [`WO-02`](wo-02-delivery-create.md) — deliveries must exist before there is anything to list

## In Scope

- deliveries list route under `src/app/[locale]/(app)/deliveries`
- list query for deliveries with their grouped products
- expandable delivery cards, patterned after orders for visual parity
- summary metadata per card: store, delivery date, expected arrival range, status, carrier, tracking
- expansion surface per card showing the products included in that delivery
- default sort: oldest to newest
- empty, loading, and error states
- link from each card into the delivery detail view (`WO-03`)
- PostHog analytics events for list view and card expansion
- automated tests covering the list path (at minimum one E2E that lists existing deliveries and expands a card to show its products)

## Out of Scope

- filters (covered in [`WO-07`](wo-07-deliveries-list-filters.md))
- create flow (covered in [`WO-02`](wo-02-delivery-create.md))
- edit flow (covered in [`WO-05`](wo-05-delivery-edit.md))
- detail view and actions (covered in `WO-03`, `WO-04`)
- dashboard aggregation

## Requirements

- `FR-08-29`, `FR-08-30`, `FR-08-31`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — expandable-card decision, list query contract

## E2E Acceptance Tests

- The deliveries list renders the existing deliveries sorted from oldest to newest by default.
- Each delivery card shows store, delivery date, expected arrival range, status, carrier, and tracking.
- A card expands to show the products grouped under that delivery.
- Clicking into a delivery opens the detail view from [`WO-03`](wo-03-delivery-detail-read-only.md).

## Analytics

- PostHog event when the deliveries list view is opened
- PostHog event when a list card is expanded or collapsed
