---
id: WO-05
type: WORK_ORDER
slug: delivery-edit
title: Delivery Edit
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 101
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-05 Delivery Edit

## Summary

Implement the delivery edit flow: modify the product membership (add or remove eligible products), change carrier, tracking, delivery date, expected arrival range, cost, currency, and FX. Every edit that changes product-to-delivery associations re-derives `OrderStatus` for each affected order within the same transaction.

Edit is a separate slice from create because the invariants differ: create persists a new delivery from zero; edit must reconcile changes against an existing delivery, handle a discard-changes confirmation when there are unsaved edits, and recalculate product states when memberships change.

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — persistence, eligibility, transition helpers, shared Zod schemas, `deriveOrderStatus` wrapper
- [`WO-02`](wo-02-delivery-create.md) — the shared form implementation and the eligibility-driven product selector are first introduced by create; edit reuses them in a different mode

## In Scope

- edit-delivery route and form, reusing the form implementation introduced in `WO-02` in edit mode
- product membership changes: add eligible products from the same store; remove currently linked products
- recalculation of product delivery state whenever membership changes: newly added products become arrived at store when they were not already there; removed products are returned to arrived-at-store when still unfulfilled
- carrier, tracking, delivery date, expected arrival range, cost, currency, and FX editing
- discard-changes confirmation when there are unsaved edits
- `deriveOrderStatus` invocation within the edit transaction for every affected order
- redirect or return-to-detail after a successful edit
- PostHog analytics events for the edit flow
- automated tests covering the edit path (unit where it makes sense, plus at least one E2E path that edits a delivery's product membership and verifies the affected orders' status is re-derived correctly)

## Out of Scope

- create entry points (covered in [`WO-02`](wo-02-delivery-create.md))
- detail view (covered in [`WO-03`](wo-03-delivery-detail-read-only.md))
- detail actions such as mark delivered, reopen, cancel, delete, note edit (covered in [`WO-04`](wo-04-delivery-detail-actions.md))
- deliveries list and filters (covered in `WO-06`, `WO-07`)

## Requirements

- `FR-08-04` through `FR-08-11`
- `FR-08-16`, `FR-08-17`, `FR-08-19`, `FR-08-20`, `FR-08-23`
- `BR-08-02`, `BR-08-03`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — create/edit contract (edit side), eligibility contract, one-store boundary

## E2E Acceptance Tests

- Editing a delivery to add a newly eligible product marks that product as arrived at store when it was not previously there and re-derives the source order's `OrderStatus` accordingly.
- Editing a delivery to remove a product returns that product to arrived-at-store when it is still unfulfilled and re-derives the source order's `OrderStatus` accordingly.
- Changing carrier, tracking, dates, cost, currency, or FX persists the change without affecting product state or order status.
- Discarding edits returns the delivery to its previous state and the collector is warned before losing unsaved changes.
- A delivery's one-store boundary is preserved: eligible products from other stores are not offered in the edit selector.

## Analytics

- PostHog event when the edit flow is opened
- PostHog event when a delivery edit is successfully saved, including whether product membership changed and counts of affected orders
