---
id: WO-01
type: WORK_ORDER
slug: delivery-persistence-eligibility-rules-and-product-state-transitions
title: Delivery Persistence, Eligibility Rules, and Product-State Transitions
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-01 Delivery Persistence, Eligibility Rules, and Product-State Transitions

## Summary

Create the persistence and eligibility foundation for deliveries, including the product-state transitions that all later delivery flows depend on.

## In Scope

- delivery persistence fields including note, cost, currency, dates, and audit fields
- eligibility queries by store
- product-state transitions for arrived-at-store, in-transit, delivered, reopened, cancelled, and deleted flows
- delete-versus-cancel rule boundaries
- order status re-derivation: after any product-state transition, call `deriveOrderStatus` (from [`FRD-05 · BP-01 · WO-02`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)) for each affected order and persist the result within the same transaction

## Out of Scope

- delivery list UI
- delivery detail header interactions
- dashboard aggregation

## Requirements

- `FR-08-01` through `FR-08-13`
- `FR-08-18` through `FR-08-24`
- `BR-08-01` through `BR-08-07`

## Blueprints

- `BP-01` eligibility contract
- `BP-01` lifecycle contract

## E2E Acceptance Tests

- Eligible products exclude delivered products and products attached to another active delivery.
- Cancel, delete, and reopen operations recalculate linked product states correctly.
- Delivery persistence stores the required cost, date, and store boundary fields.
- After any product-state transition, the parent order's status reflects the correct derived state (`OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, or `COMPLETED`).
