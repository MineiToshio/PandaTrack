---
id: WO-04
type: WORK_ORDER
slug: delivery-detail-actions
title: Delivery Detail Actions
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 100
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-04 Delivery Detail Actions

## Summary

Implement every mutation that can be invoked from the delivery detail view in one coherent vertical slice: inline private note edit, mark delivered, reopen, cancel, and delete. Each action re-derives `OrderStatus` for every affected order within the same transaction and updates the UI optimistically.

This slice establishes the primary / secondary / `More` menu hierarchy used by deliveries, following the same interaction pattern as orders.

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — lifecycle helpers and `deriveOrderStatus` wrapper
- [`WO-03`](wo-03-delivery-detail-read-only.md) — detail surface where these actions are invoked

## In Scope

- inline private note save flow: single textarea, saved without entering full edit mode, patterned after order and store notes
- mark-delivered action: primary action when status is `IN_TRANSIT`; marks every linked product as delivered; re-derives `OrderStatus` for each affected order within the same transaction
- reopen action: secondary action when status is `DELIVERED`; recalculates linked product states so they are editable again; re-derives `OrderStatus` for each affected order
- cancel action: destructive; sets status to `CANCELLED`; returns still-unfulfilled products to arrived-at-store; re-derives `OrderStatus`
- delete action: destructive; removes the delivery physically when delete rules allow; returns still-unfulfilled products to arrived-at-store; re-derives `OrderStatus`
- primary / secondary / `More` action hierarchy in the detail view, with cancel and delete inside `More`
- optimistic UI updates per [`optimistic-client-updates`](../../../../../.cursor/rules/optimistic-client-updates.mdc)
- confirmations for destructive actions (cancel and delete)
- PostHog analytics events for each action (note save, delivered, reopen, cancel, delete)
- automated tests covering each action's happy path and re-derivation consequences (at minimum one E2E per action, plus unit coverage for the transition logic where it is not fully covered by `WO-01`)

## Out of Scope

- delivery edit flow covered in [`WO-05`](wo-05-delivery-edit.md) (changing products, carrier, tracking, cost, dates is a different surface)
- deliveries list and filters (covered in `WO-06`, `WO-07`)
- automatic history timeline (out of scope for MVP per `BR-08-05`)

## Requirements

- `FR-08-12` (state is derived from lifecycle actions), `FR-08-13`
- `FR-08-21` through `FR-08-26`
- `BR-08-04`, `BR-08-05`, `BR-08-06`, `BR-08-07`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — lifecycle contract, action-hierarchy parity decision, detail-actions surface

## E2E Acceptance Tests

- The collector can edit and save the single private delivery note without entering full edit mode, and the saved value is shown immediately (optimistic update).
- Marking a delivery as delivered marks all linked products as delivered. Source orders whose items are all delivered transition to `COMPLETED`; orders with only some items delivered transition to `PARTIALLY_DELIVERED`.
- Reopening a delivered delivery makes linked products editable again. After reopen, each source order's `OrderStatus` re-derives correctly (for example `COMPLETED` → `IN_TRANSIT` or `PARTIALLY_IN_TRANSIT`).
- Cancelling a delivery returns its still-unfulfilled products to arrived-at-store, preserves the record with status `CANCELLED`, and re-derives each source order's `OrderStatus` to `OPEN`, `PARTIALLY_IN_TRANSIT`, or `IN_TRANSIT` based on remaining associations.
- Deleting a delivery removes the record, returns its still-unfulfilled products to arrived-at-store, and re-derives each source order's `OrderStatus` equivalently.
- Destructive actions (cancel, delete) require a confirmation step before executing.
- Primary, secondary, and `More` affordances reflect lifecycle state (for example primary becomes `Reopen` once status is `DELIVERED`).

## Analytics

- PostHog events per action: `delivery_note_saved`, `delivery_marked_delivered`, `delivery_reopened`, `delivery_cancelled`, `delivery_deleted` (final event names to be finalized under [`posthog-events`](../../../../../.cursor/rules/posthog-events.mdc) conventions)
- Each event includes delivery status before/after and counts of affected orders and products

## Notes

- All five actions share the same transactional contract: mutate the delivery, recalc product states via the helpers from `WO-01`, and invoke the `deriveOrderStatus` integration wrapper. Keeping them in one slice avoids fragmenting that shared contract across multiple Work Orders.
