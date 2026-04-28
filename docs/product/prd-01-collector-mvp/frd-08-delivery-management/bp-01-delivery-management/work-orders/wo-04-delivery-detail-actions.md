---
id: WO-04
type: WORK_ORDER
slug: delivery-detail-actions
title: Delivery Detail Actions
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 100
last_updated: 2026-04-27
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

- inline private note save flow: single textarea, saved without entering full edit mode, patterned after order and store notes, including saving an empty trimmed value to clear the note
- mark-delivered action: primary action when status is `IN_TRANSIT`; marks every linked product as delivered; re-derives `OrderStatus` for each affected order within the same transaction
- reopen action: primary action when status is `DELIVERED` or `CANCELLED`; recalculates linked product states so they are editable again; re-derives `OrderStatus` for each affected order
- cancel action: destructive; sets status to `CANCELLED`; returns still-unfulfilled products to arrived-at-store; re-derives `OrderStatus`
- delete action: destructive; removes the delivery physically only while the delivery is `IN_TRANSIT` or `CANCELLED`; returns still-unfulfilled products to arrived-at-store; re-derives `OrderStatus`
- primary / secondary / `More` action hierarchy in the detail view, with cancel and delete inside `More`
- status-aware action matrix:
  - `IN_TRANSIT`: primary `Mark delivered`, visible secondary `Edit`, overflow `Cancel` and `Delete`
  - `DELIVERED`: primary `Reopen`, with additional secondary / overflow actions; `Delete` remains visible but requires reopening first
  - `CANCELLED`: primary `Reopen`, overflow `Delete`
- reuse of the existing order-detail split secondary pattern: labeled secondary action plus adjacent chevron overflow trigger, extracted into a shared component instead of duplicated inside orders and deliveries
- optimistic UI updates per [`optimistic-client-updates`](../../../../../.cursor/rules/optimistic-client-updates.mdc)
- confirmations for destructive actions (cancel and delete), with delete explicitly described as permanent and not reversible
- redirect to the deliveries list route after a successful delete
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
- Clearing an existing delivery note and saving persists an empty value as note removal, keeping the inline-note pattern aligned with orders and stores.
- Marking a delivery as delivered marks all linked products as delivered. Source orders whose items are all delivered transition to `COMPLETED`; orders with only some items delivered transition to `PARTIALLY_DELIVERED`.
- Reopening a delivered delivery makes linked products editable again. After reopen, each source order's `OrderStatus` re-derives correctly (for example `COMPLETED` → `IN_TRANSIT` or `PARTIALLY_IN_TRANSIT`).
- Reopening a cancelled delivery returns the detail view to an editable lifecycle state and re-enables the action hierarchy used for active deliveries.
- Cancelling a delivery returns its still-unfulfilled products to arrived-at-store, preserves the record with status `CANCELLED`, and re-derives each source order's `OrderStatus` to `OPEN`, `PARTIALLY_IN_TRANSIT`, or `IN_TRANSIT` based on remaining associations.
- Deleting a delivery from `IN_TRANSIT` or `CANCELLED` removes the record, returns its still-unfulfilled products to arrived-at-store, re-derives each source order's `OrderStatus` equivalently, and redirects the collector to the deliveries list.
- A delivered delivery keeps `Delete` visible in the action UI, but the affordance explains that deletion is only allowed while the delivery is `IN_TRANSIT` or `CANCELLED` and that the collector must reopen first.
- Destructive actions (cancel, delete) require a confirmation step before executing.
- The delete confirmation modal states that the action is permanent and cannot be undone.
- Primary, secondary, and `More` affordances reflect lifecycle state, including `Reopen` as the primary action in both `DELIVERED` and `CANCELLED`.

## Analytics

- PostHog events per action: `delivery_note_saved`, `delivery_marked_delivered`, `delivery_reopened`, `delivery_cancelled`, `delivery_deleted` (final event names to be finalized under [`posthog-events`](../../../../../.cursor/rules/posthog-events.mdc) conventions)
- Each event includes delivery status before/after and counts of affected orders and products

## Notes

- All five actions share the same transactional contract: mutate the delivery, recalc product states via the helpers from `WO-01`, and invoke the `deriveOrderStatus` integration wrapper. Keeping them in one slice avoids fragmenting that shared contract across multiple Work Orders.
- The action chrome should follow the same interaction pattern already used by order detail: one visible labeled action plus an adjacent overflow trigger that reveals additional actions. Implement that pattern as a shared component for detail heroes so orders and deliveries stay aligned.
- `Delete` should remain discoverable even when blocked in `DELIVERED`, because hiding the affordance would make the rule opaque. The disabled state must explain that only `IN_TRANSIT` and `CANCELLED` deliveries can be deleted, and that `Reopen` is the required path back from `DELIVERED`.
