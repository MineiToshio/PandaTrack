---
id: WO-05
type: WORK_ORDER
slug: preferences-currency-country-product-types-and-budget
title: Preferences: Currency, Country, Product Types, and Budget
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-05 Preferences: Currency, Country, Product Types, and Budget

## Summary

Implement the `Preferences` section of settings so each user can define the baseline collector preferences and budget defaults that the MVP depends on.

## In Scope

- base currency
- preferred country
- preferred product types using the shared autocomplete pattern
- budget amount
- budget reset mode and specific-day selection
- month-end fallback behavior for missing days

## Out of Scope

- multiple active budgets in MVP
- email delivery preferences inside settings
- provider-aware account settings
- store navigation URL generation

## Requirements

- `FR-07-19` through `FR-07-26`
- `BR-07-01`
- `BR-07-08`
- `BR-07-09`

## Blueprints

- `BP-01` preference contract
- `BP-01` budget extensibility decision

## E2E Acceptance Tests

- User can save country, base currency, preferred product types, and budget amount.
- User can choose month-end reset or a specific day.
- A reset day beyond the number of days in a month is interpreted as the month end.
