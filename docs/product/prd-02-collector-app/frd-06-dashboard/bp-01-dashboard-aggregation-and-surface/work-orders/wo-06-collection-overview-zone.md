---
id: WO-06
type: WORK_ORDER
slug: collection-overview-zone
title: Collection Overview Zone
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 111
implementation_status: PLANNED
last_updated: 2026-07-09
---

# WO-06 Collection Overview Zone

## Summary

Implement the dashboard's collection-overview zone end-to-end: total non-cancelled orders, total products (sum of item quantity), order-status distribution, spend by product type, and top stores by spend / order count.

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md) — collection totals, by-type, and top-stores aggregation

## In Scope

- the collection-overview zone on the dashboard page
- total non-cancelled orders and total products (Σ `OrderItem.quantity` on non-cancelled orders)
- order-status distribution across `OrderStatus`
- spend by product type (`OrderItem.productTypeKey`), in base currency
- **product count by type**: Σ `OrderItem.quantity` grouped by product type, shown alongside the spend-by-type breakdown (`FR-06-20`)
- top stores by spend and/or order count, each linking into the store surface (store CTAs must use the shared preference-driven URL helper per `FR-06-16`)
- empty state when the collector has no collection data yet
- the `FR-06-13` partial note on money-based breakdowns
- `dashboard` locale keys for this zone
- PostHog events (zone viewed, top-store CTA clicked, product-type segment clicked)
- automated tests, at minimum one E2E asserting totals exclude cancelled orders, products sum item quantity, and top stores render with working links

## Out of Scope

- obligations, budget, spend, and activity zones
- per-store or per-type drill-down views (future extension)
- any mutation

## Requirements

- `FR-06-11`, `FR-06-14`, `FR-06-15`, `FR-06-16`
- `BR-06-05`, `BR-06-07`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — collection-totals contract

## E2E Acceptance Tests

- Total orders and total products exclude `CANCELLED` orders; products equal the sum of item quantities.
- The status distribution reflects the collector's orders by `OrderStatus`.
- Spend by product type renders in base currency.
- Top stores render ranked, and each store link uses the shared preference-driven URL helper.

## Analytics

- PostHog event when the collection zone is viewed
- PostHog event when a top-store CTA is clicked
- PostHog event when a product-type segment is clicked
