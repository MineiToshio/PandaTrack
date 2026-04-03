---
id: WO-01
type: WORK_ORDER
slug: currency-catalog-order-identifiers-and-persistence-contracts
title: Currency Catalog, Order Identifiers, and Persistence Contracts
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-01 Currency Catalog, Order Identifiers, and Persistence Contracts

## Summary

Establish the currency catalog, order identifier strategy, persistence fields, and delete-versus-cancel contracts needed for the rest of the order domain.

## In Scope

- `Currency` catalog table with `code` and `symbol`
- order persistence fields including human-readable identifier, currency, exchange rate, note, and audit timestamps
- payment and history persistence contracts
- delete and cancel rule boundaries

## Out of Scope

- spreadsheet form UX
- order list filtering
- delivery eligibility and product allocation

## Requirements

- `FR-05-03` through `FR-05-05`
- `FR-05-14` through `FR-05-16`
- `FR-05-21` through `FR-05-25`
- `BR-05-07` through `BR-05-12`

## Blueprints

- `BP-01` currency contract
- `BP-01` delete-versus-cancel decision

## E2E Acceptance Tests

- New orders receive a stable human-readable identifier.
- The order form can default to a persisted currency catalog entry.
- Cancel and delete paths respect the documented dependency rules.
