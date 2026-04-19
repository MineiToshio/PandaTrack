---
id: WO-02
type: WORK_ORDER
slug: delivery-create-edit-flow-with-store-scoped-product-selection
title: Delivery Create/Edit Flow With Store-Scoped Product Selection
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-02 Delivery Create/Edit Flow With Store-Scoped Product Selection

## Summary

Implement the create and edit experience for deliveries, including store selection, order-grouped product selection, automatic arrived-at-store promotion, and preselection from an order entry point.

## In Scope

- create-delivery from order flow
- standalone create-delivery flow
- store-scoped product selection grouped by source order
- automatic preselection from source order
- automatic arrived-at-store marking when newly selected
- edit flow that can add or remove products
- order status re-derivation: adding or removing products from a delivery changes the associated orders' status; `deriveOrderStatus` (from [`FRD-05 · BP-01 · WO-02`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)) must be called for each affected order and the result persisted within the create/edit transaction

## Out of Scope

- delivered and reopen action UX
- delivery list cards
- dashboard reporting

## Requirements

- `FR-08-04` through `FR-08-20`
- `BR-08-02`
- `BR-08-03`

## Blueprints

- `BP-01` create/edit contract
- `BP-01` one-store boundary decision

## E2E Acceptance Tests

- Creating from an order preselects that order's eligible products.
- Standalone create flow shows only stores with eligible products.
- Product selection groups rows by source order and auto-marks newly selected products as arrived at store.
- After creating a delivery with products from an order, that order's status updates to reflect the new delivery association (e.g. `OPEN` → `PARTIALLY_IN_TRANSIT` or `IN_TRANSIT`).
- Removing a product from a delivery during edit recalculates the source order's status correctly.
