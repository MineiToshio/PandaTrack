---
id: WO-04
type: WORK_ORDER
slug: delivery-detail-view-private-note-and-action-menu
title: Delivery Detail View, Private Note, and Action Menu
status: DRAFT
parent: BP-02
source_features:
  - FEAT-0015
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-04 Delivery Detail View, Private Note, and Action Menu

## Summary

Build the delivery detail experience with one private note field, grouped products, and the same primary-secondary-more action hierarchy used by orders.

## In Scope

- delivery detail summary header
- grouped product rendering
- inline private note save flow
- primary and secondary actions according to lifecycle state
- `More` menu for cancel and delete

## Out of Scope

- delivery list filters
- automatic history timeline
- dashboard reporting

## Requirements

- `FR-08-21` through `FR-08-26`
- `BR-08-05`
- `BR-08-06`
- `BR-08-07`

## Blueprints

- `BP-02` detail contract
- `BP-02` action-hierarchy parity decision

## E2E Acceptance Tests

- Users can edit and save the single private delivery note without entering full edit mode.
- Delivery detail shows grouped products clearly under the summary header.
- Action hierarchy matches the documented order-detail pattern.
