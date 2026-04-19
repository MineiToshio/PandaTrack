---
id: WO-01
type: WORK_ORDER
slug: delivery-foundation
title: Delivery Foundation
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 97
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-01 Delivery Foundation

## Summary

Establish the delivery persistence model, enums, shared validation schemas, eligibility helpers, product-state transition helpers, and the `deriveOrderStatus` integration wrapper that every downstream delivery slice depends on.

This Work Order is the foundation slice for [`BP-01`](../bp-01-delivery-management.md). By design it ships no UI and no routes. It is validated with unit tests, not with an E2E path.

## In Scope

- Prisma models for `Delivery` and the delivery-to-product association, including cost, currency, dates, carrier, tracking, note, lifecycle state, and audit fields
- `DeliveryStatus` enum (`IN_TRANSIT`, `DELIVERED`, `CANCELLED`) with the rule that state is derived from lifecycle actions rather than edited directly
- Product delivery-state enum or derived flags (`arrived at store`, `in transit`, `delivered to user`)
- Prisma migration for the new schema
- shared Zod validation schemas for delivery create, edit, and lifecycle mutations (consumed by multiple later slices)
- shared eligibility query helper: returns eligible products grouped by source order for a given store, excluding products already delivered or already attached to another active delivery
- shared product-state transition helpers: recalculate product delivery state from delivery mutations (create, edit-add, edit-remove, mark delivered, reopen, cancel, delete)
- `deriveOrderStatus` integration wrapper that takes a set of affected orders and persists the re-derived `OrderStatus` within the caller transaction, using the pure function from [`FRD-05 · BP-01 · WO-02`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)
- delivery data-access module skeleton under `src/lib/data/deliveries/` (query and mutation entry points that later slices will fill in)
- unit tests for eligibility helper, product-state transition helpers, and the `deriveOrderStatus` integration wrapper

## Out of Scope

- any UI, including "shared" components
- delivery create, edit, detail, list, or action routes
- delivery mutation flows that a user invokes
- PostHog events (belong to the vertical slices that introduce user-visible actions)
- dashboard aggregation

## Requirements

- `FR-08-01` through `FR-08-03`
- `FR-08-12`, `FR-08-13`
- `FR-08-18` through `FR-08-24`
- `BR-08-01`, `BR-08-02`, `BR-08-03`, `BR-08-07`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — eligibility contract, lifecycle contract, and the shared-helper decisions this foundation implements

## E2E Acceptance Tests

This foundation slice is exempt from the "must include an E2E acceptance path" rule because by design it ships no UI.

Validation is done via unit tests that must cover, at minimum:

- the eligibility helper excludes delivered products and products attached to another active delivery, and groups the remaining products by source order
- product-state transition helpers recalculate product states correctly for create, edit-add, edit-remove, mark delivered, reopen, cancel, and delete
- the `deriveOrderStatus` integration wrapper, given a simulated set of affected orders, calls the pure function from [`FRD-05 · BP-01 · WO-02`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md) and persists the result within the caller transaction

## Notes

- The `Delivery` `status` field must be queryable at mutation time because order and payment rules in [`FRD-05 · BP-01 · WO-01`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md) depend on `DELIVERED` visibility.
- This foundation intentionally excludes server actions tied to a specific user-facing flow. Those belong in their respective vertical slices (`WO-02` through `WO-07`).
