---
id: WO-05
type: WORK_ORDER
slug: deliveries-list-filters-grouped-products-and-status-visibility
title: Deliveries List, Filters, Grouped Products, and Status Visibility
status: DRAFT
parent: BP-02
source_features:
  - FEAT-0015
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-05 Deliveries List, Filters, Grouped Products, and Status Visibility

## Summary

Implement the deliveries workspace list with URL-backed filters, expandable cards, grouped-product summaries, and lifecycle status visibility.

## In Scope

- deliveries list route shell
- filter sidebar with URL persistence
- chips for active filters
- free-text product-name search
- expandable cards showing grouped products
- summary metadata for store, delivery date, expected range, status, carrier, and tracking

## Out of Scope

- create/edit delivery form
- dashboard reporting
- carrier integrations

## Requirements

- `FR-08-27` through `FR-08-31`
- `BR-08-03`

## Blueprints

- `BP-02` list filter contract
- `BP-02` expandable-card decision

## E2E Acceptance Tests

- Users can filter deliveries by store, product-name text, and date range with URL-backed state.
- Delivery cards expand to show grouped products only from that delivery.
- Delivery list surfaces status, carrier, tracking, and expected-arrival metadata clearly.
