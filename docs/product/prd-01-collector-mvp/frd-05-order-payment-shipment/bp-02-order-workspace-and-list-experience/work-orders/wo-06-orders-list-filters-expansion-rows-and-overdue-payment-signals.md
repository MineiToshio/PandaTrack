---
id: WO-06
type: WORK_ORDER
slug: orders-list-filters-expansion-rows-and-overdue-payment-signals
title: Orders List, Filters, Expansion Rows, and Overdue Payment Signals
status: DRAFT
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-06 Orders List, Filters, Expansion Rows, and Overdue Payment Signals

## Summary

Implement the orders workspace list with URL-backed filters, expandable cards, overdue-delivery visibility, and payment-progress summaries.

## In Scope

- orders list route shell
- filter sidebar with URL persistence
- chips for active filters
- free-text product-name search
- expandable cards showing items and payments
- overdue estimated-arrival signal
- paid-versus-total summary on each order card

## Out of Scope

- order form entry
- delivery allocation screens
- dashboard rollups

## Requirements

- `FR-05-26` through `FR-05-31`
- `FR-05-35`
- `BR-05-12`

## Blueprints

- `BP-02` list filter contract
- `BP-02` expandable-card decision

## Notes

- The status filter must reflect all six order states: `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `COMPLETED`, and `CANCELLED`. Filter option labels must use their Spanish display names as defined in [`FRD-05 · BP-01 · WO-02`](../../bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md).

## E2E Acceptance Tests

- Users can filter orders by date range, store, product type, status, and product-name text with URL-backed state.
- The status filter exposes all six order states as selectable options.
- Order cards expand to show items and payments only.
- Overdue orders and delivered-but-unpaid orders are visually distinguishable in the list.
