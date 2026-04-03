---
id: WO-03
type: WORK_ORDER
slug: order-payments-balances-and-payment-mutation-rules
title: Order Payments, Balances, and Payment Mutation Rules
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-03 Order Payments, Balances, and Payment Mutation Rules

## Summary

Implement payment persistence and payment mutation rules so collectors can track what has been paid, what remains, and correct mistakes by deleting payments when needed.

## In Scope

- add-payment flow
- delete-payment flow
- remaining-balance guardrails
- paid amount, remaining amount, and payment percentage summaries
- detail-query shape for payment records ordered by date

## Out of Scope

- order create/edit form
- orders list UI
- delivery-cost reporting

## Requirements

- `FR-05-17` through `FR-05-20`
- `BR-05-09`
- `BR-05-10`

## Blueprints

- `BP-01` payment contract
- `BP-01` atomic-write priority

## E2E Acceptance Tests

- Users can add valid payments and see summaries update immediately.
- Users cannot add a payment larger than the remaining amount.
- Deleting a payment recalculates the order summary correctly.
