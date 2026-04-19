---
id: WO-02
type: WORK_ORDER
slug: delivery-create
title: Delivery Create
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 98
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-02 Delivery Create

## Summary

Implement the delivery creation experience end-to-end, covering both entry points defined by the FRD: creating a delivery from an order (with store and eligible products preselected) and creating a delivery from the standalone route (store selection first, then eligible products grouped by source order).

This slice delivers a demo-able create flow that persists a new delivery, marks newly selected products as arrived at store when needed, and re-derives the `OrderStatus` of every affected order within the same transaction.

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — Prisma schema, eligibility helper, product-state transition helpers, shared Zod schemas, and `deriveOrderStatus` integration wrapper

## In Scope

- create-delivery from order entry point: the create view opens with store prefilled and the eligible products of that source order preselected
- standalone create-delivery flow: store selector that only lists stores with at least one eligible product, followed by the grouped product selector
- store-scoped product selection grouped by source order, using the eligibility helper from `WO-01`
- delivery date (required, prefilled with today, past-or-current only)
- delivery cost (required, `0` allowed), delivery currency (default to user base currency when present)
- exchange-rate input when delivery currency differs from the user base currency
- optional expected arrival date range
- optional carrier and optional tracking free-text fields
- automatic promotion of newly selected products to arrived at store when they were not already there
- create mutation and server action, including the `deriveOrderStatus` call for every affected order within the same transaction
- redirect to delivery detail after a successful create
- PostHog analytics events for the create flow
- automated tests covering the create path (unit where it makes sense, plus at least one E2E path that creates a delivery and verifies the affected orders' status is re-derived)

## Out of Scope

- edit flow (covered in [`WO-05`](wo-05-delivery-edit.md))
- detail read-only view (covered in [`WO-03`](wo-03-delivery-detail-read-only.md))
- detail actions such as mark delivered, reopen, cancel, delete, note edit (covered in [`WO-04`](wo-04-delivery-detail-actions.md))
- deliveries list (covered in [`WO-06`](wo-06-deliveries-list.md))
- list filters (covered in [`WO-07`](wo-07-deliveries-list-filters.md))

## Requirements

- `FR-08-04` through `FR-08-11`
- `FR-08-14` through `FR-08-20`
- `BR-08-02`, `BR-08-03`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — create/edit contract (create side), eligibility contract, one-store boundary

## E2E Acceptance Tests

- Creating a delivery from an order entry point opens the create view with the store prefilled and the eligible products from that source order preselected.
- The standalone create flow only lists stores that have at least one eligible product, and the resulting product selector groups rows by source order.
- Newly selected products that were not previously arrived at store become arrived at store automatically when the delivery is saved.
- After creating a delivery that includes products from an order, that order's `OrderStatus` updates to reflect the new delivery association (for example `OPEN` → `PARTIALLY_IN_TRANSIT` or `IN_TRANSIT`).
- A delivery cannot be created with products from more than one store.
- Delivery currency defaults to the user base currency when present and requires an exchange-rate input when it differs.

## Analytics

- PostHog event when the create flow is opened (differentiating the from-order and standalone entry points)
- PostHog event when a delivery is successfully created, with counts of products and source orders involved
