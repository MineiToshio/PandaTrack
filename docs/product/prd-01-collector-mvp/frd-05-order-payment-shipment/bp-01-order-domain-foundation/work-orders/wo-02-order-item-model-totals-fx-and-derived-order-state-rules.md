---
id: WO-02
type: WORK_ORDER
slug: order-item-model-totals-fx-and-derived-order-state-rules
title: Order Item Model, Totals, FX, and Derived Order-State Rules
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-02 Order Item Model, Totals, FX, and Derived Order-State Rules

## Summary

Implement the order item shape, total-cost validation rules, one-FX-per-order model, and the derived order-state rules that later list and detail views depend on.

## In Scope

- item fields for name, quantity, optional unit price, and optional product type
- derived total calculation using `quantity x unit price`
- discrepancy modal rule inputs and save-time decisions
- `OPEN`, `PARTIALLY_DELIVERED`, `COMPLETED`, and `CANCELLED` state derivation rules
- completed-but-unpaid detection

## Out of Scope

- payment entry UI
- delivery creation UI
- orders workspace list rendering

## Requirements

- `FR-05-06` through `FR-05-16`
- `FR-05-32` through `FR-05-35`
- `BR-05-01` through `BR-05-07`

## Blueprints

- `BP-01` order create contract
- `BP-01` state-transition rules

## E2E Acceptance Tests

- Saving an itemized order derives totals correctly from quantity and unit price.
- The discrepancy modal appears only under the documented conditions.
- Fully delivered orders move to `COMPLETED` even when money is still owed.
