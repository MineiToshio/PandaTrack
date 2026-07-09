---
id: WO-05
type: WORK_ORDER
slug: order-activity-zone
title: Order Activity Zone
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 110
implementation_status: PLANNED
last_updated: 2026-07-09
---

# WO-05 Order Activity Zone

## Summary

Implement the dashboard's activity zone end-to-end: the orders-placed-vs-orders-arrived chart by month (reusing the date-range control from the spend zone), the recent-orders list (latest ~10 by order date), the upcoming-arrivals list (next 30 days), and the overdue-on-arrival list.

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md) — activity aggregation and the placed/arrived monthly series
- [`WO-04`](wo-04-disbursed-spend-zone.md) — the shared client date-range control reused by this chart

## In Scope

- the activity zone on the dashboard page
- placed-vs-arrived monthly chart over the shared selected range, where "arrived" = an order has at least one item that left `NONE` delivery state (`ARRIVED_AT_STORE` / `IN_TRANSIT` / `DELIVERED`)
- recent-orders list: latest ~10 orders by `orderDate`, each linking into order detail
- upcoming-arrivals list: orders with `expectedDeliveryFrom` within the next 30 days
- overdue-on-arrival list: orders past their expected arrival not yet arrived
- **puntualidad de llegadas**: share of arrived orders that arrived within their estimated window vs late, as a compact donut/gauge (`FR-06-17`)
- empty states for each list
- `dashboard` locale keys for this zone
- PostHog events (zone viewed, recent/upcoming/overdue item CTA clicked)
- automated tests, at minimum one E2E asserting an order with an item out of `NONE` counts as arrived in the chart, the recent list shows latest orders newest-first, and an order arriving within 30 days appears under upcoming

## Out of Scope

- introducing the date-range control (owned by [`WO-04`](wo-04-disbursed-spend-zone.md); this slice reuses it)
- spend, obligations, budget, and collection zones
- any mutation (lists link into the order and delivery surfaces)

## Requirements

- `FR-06-09`, `FR-06-10`, `FR-06-12`, `FR-06-15`, `FR-06-16`
- `BR-06-06`, `BR-06-07`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — activity contract and "arrived" definition

## E2E Acceptance Tests

- An order with at least one item out of `NONE` state is counted as "arrived" in the placed-vs-arrived chart.
- The recent-orders list shows the latest orders by order date, newest first, each linking to order detail.
- An order with an expected arrival within the next 30 days appears in upcoming arrivals.
- An order past its expected arrival and not yet arrived appears in the overdue list.

## Analytics

- PostHog event when the activity zone is viewed
- PostHog event when a recent / upcoming / overdue item CTA is clicked
