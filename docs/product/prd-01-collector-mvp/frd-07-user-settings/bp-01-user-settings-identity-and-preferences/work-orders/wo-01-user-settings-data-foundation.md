---
id: WO-01
type: WORK_ORDER
slug: user-settings-data-foundation
title: User Settings Data Foundation
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-01 User Settings Data Foundation

## Summary

Create the persistence, validation, and shared domain contracts required for usernames, account preferences, budget defaults, and later user-settings slices.

## In Scope

- username field and uniqueness strategy
- reserved-username and blocked-token contract
- normalized username generation rules for new accounts
- user preference persistence for country, base currency, preferred product types, and budget defaults
- single-budget MVP model shaped for future multi-budget support
- shared query/action boundaries for downstream settings slices
- provider-aware settings capability model inputs

## Out of Scope

- shell UI
- settings page presentation
- avatar upload UI
- actual email-change UI or password forms
- store navigation URL wiring

## Requirements

- `FR-07-03` through `FR-07-07`
- `FR-07-19` through `FR-07-26`
- `BR-07-03` through `BR-07-05`

## Blueprints

- `BP-01` architecture decisions for username identity, budget extensibility, and URL-canonical preference consumption

## E2E Acceptance Tests

- New account creation results in a valid unique username.
- Invalid or reserved usernames cannot be persisted.
- A username collision that differs only by case is rejected.
- Country, currency, preferred product types, budget amount, and budget reset rule can be persisted and re-read correctly.
