---
id: WO-03
type: WORK_ORDER
slug: delivery-delivered-reopen-cancel-and-delete-lifecycle-behavior
title: Delivery Delivered, Reopen, Cancel, and Delete Lifecycle Behavior
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-03 Delivery Delivered, Reopen, Cancel, and Delete Lifecycle Behavior

## Summary

Implement the high-risk lifecycle actions that move a delivery between active, delivered, reopened, cancelled, and deleted states while keeping linked products coherent.

## In Scope

- mark delivered flow
- reopen flow
- cancel flow
- delete flow
- recalculation of affected product states after every lifecycle action
- order status re-derivation: each lifecycle action changes the delivery status of associated products, which may change the parent order's derived status; `deriveOrderStatus` (from [`FRD-05 · BP-01 · WO-02`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)) must be called for every affected order and the result persisted within the same transaction as the lifecycle mutation

## Out of Scope

- delivery list filters
- delivery private note editing
- future analytics behavior

## Requirements

- `FR-08-12` through `FR-08-24`
- `BR-08-04`
- `BR-08-07`

## Blueprints

- `BP-01` lifecycle contract
- `BP-01` correction-flow decision

## E2E Acceptance Tests

- Marking a delivery as delivered marks all linked products as delivered.
- After marking delivered, each source order whose items are now all delivered moves to `COMPLETED`.
- After marking delivered, a source order with only some items delivered moves to `PARTIALLY_DELIVERED`.
- Reopening a delivered delivery makes linked products editable again according to the recalculation rules.
- After reopening, source order status re-derives correctly (e.g. `COMPLETED` → `IN_TRANSIT` or `PARTIALLY_IN_TRANSIT`).
- Cancelling or deleting a delivery returns eligible products to arrived-at-store state.
- After cancel or delete, source order status re-derives to `OPEN`, `PARTIALLY_IN_TRANSIT`, or `IN_TRANSIT` based on remaining delivery associations.
