---
id: WO-05
type: WORK_ORDER
slug: order-detail-view-private-note-payments-panel-and-action-menu
title: Order Detail View, Private Note, Payments Panel, and Action Menu
status: DRAFT
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-05 Order Detail View, Private Note, Payments Panel, and Action Menu

## Summary

Build the order detail experience so collectors can review the order, edit one private note inline, inspect and manage payments, and use the action hierarchy without visual overload.

## In Scope

- order detail summary header
- inline private note save flow
- payment list, payment add, and payment delete interactions
- primary `Create delivery` action
- secondary `Edit` action
- `More` menu for cancel and delete
- delivered-but-unpaid warning in detail view

## Out of Scope

- order list filters
- delivery create/edit UI
- automatic history timeline rendering inside list cards

## Requirements

- `FR-05-17` through `FR-05-25`
- `FR-05-34`
- `FR-05-35`
- `BR-05-08` through `BR-05-12`

## Blueprints

- `BP-02` detail action contract
- `BP-02` note-pattern reuse decision

## E2E Acceptance Tests

- Users can edit and save the single private note without entering full edit mode.
- Users can add and delete payments from detail view and see summaries recalculate.
- The header presents `Create delivery`, `Edit`, and destructive actions in the documented hierarchy.
