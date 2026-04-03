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
- Reopening a delivered delivery makes linked products editable again according to the recalculation rules.
- Cancelling or deleting a delivery returns eligible products to arrived-at-store state.
