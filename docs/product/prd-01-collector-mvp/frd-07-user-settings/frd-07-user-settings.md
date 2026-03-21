---
id: FRD-07
type: FRD
slug: user-settings
title: User Settings
status: DRAFT
parent: PRD-01
children:
  - BP-04
last_updated: 2026-03-21
source_features:
  - FUTURE-USER-SETTINGS
implementation_status: PLANNED
---

# FRD-07 User Settings

## Purpose

Define the minimum user configuration layer needed to support PandaTrack's MVP behavior.

## Functional Requirements

- `FR-07-01`: Each user must be able to define a base currency.
- `FR-07-02`: Each user must be able to define a monthly budget amount.
- `FR-07-03`: Each user must be able to define the currency used for the budget.
- `FR-07-04`: The base currency and budget currency should be aligned unless a later requirement explicitly separates them.
- `FR-07-05`: Each user must be able to configure email reminder preferences at least at a basic enabled or disabled level.
- `FR-07-06`: The product must use user settings as the source for dashboard summary currency and budget reporting.

## Likely Setting Groups

- profile basics
- preferred locale
- base currency
- monthly budget
- reminder preferences
- future notification channels

## Open Questions

- whether budget resets strictly on calendar month boundaries for all users
- whether users may have multiple budgets
- whether users may pause email reminders globally or by reminder type

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-07-user-settings/bp-04-user-finance-and-notification-settings/bp-04-user-finance-and-notification-settings.md`
