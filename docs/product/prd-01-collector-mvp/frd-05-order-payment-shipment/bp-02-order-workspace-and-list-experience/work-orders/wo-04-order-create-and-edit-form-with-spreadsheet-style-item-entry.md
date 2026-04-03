---
id: WO-04
type: WORK_ORDER
slug: order-create-and-edit-form-with-spreadsheet-style-item-entry
title: Order Create and Edit Form With Spreadsheet-Style Item Entry
status: DRAFT
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-04 Order Create and Edit Form With Spreadsheet-Style Item Entry

## Summary

Build the order create/edit experience, including searchable store selection, date and currency defaults, item spreadsheet interactions, total-cost handling, and discrepancy confirmation.

## In Scope

- create and edit routes
- searchable store select with a path to create a store
- order date defaulting
- currency defaulting and exchange-rate prompt
- spreadsheet-style item rows with keyboard-friendly behavior
- total-cost entry and discrepancy modal

## Out of Scope

- order list filters
- detail-view action menu
- delivery allocation flows

## Requirements

- `FR-05-04` through `FR-05-16`
- `FR-05-23`
- `BR-05-04` through `BR-05-07`
- `BR-05-11`

## Blueprints

- `BP-02` form contract
- `BP-02` action hierarchy decision

## E2E Acceptance Tests

- Users can create an order from a searchable store selector with current-date defaults.
- Users can add and navigate item rows efficiently with the keyboard.
- The discrepancy modal offers the documented three-way decision when totals conflict.
