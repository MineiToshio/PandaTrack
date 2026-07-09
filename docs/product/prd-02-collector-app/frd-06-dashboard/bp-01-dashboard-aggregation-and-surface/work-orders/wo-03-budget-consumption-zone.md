---
id: WO-03
type: WORK_ORDER
slug: budget-consumption-zone
title: Budget Consumption Zone
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 108
implementation_status: PLANNED
last_updated: 2026-06-20
---

# WO-03 Budget Consumption Zone

## Summary

Implement the dashboard's budget zone end-to-end: how much the collector has disbursed in the current budget cycle versus their configured monthly budget, with a status color (green below 80%, amber 80–100%, red above 100%) and a configure-budget affordance when no budget is set.

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md) — budget-cycle period helper and disbursed aggregation

## In Scope

- the budget consumption zone on the dashboard page
- consumed-vs-budget figure for the current budget cycle (anchored on `User.budgetResetDayOfMonth`), in base currency
- color status: green `< 80%`, amber `80%–100%` inclusive, red `> 100%`, theme-aware via semantic design variables
- over-budget state communicated clearly (not only by color, for accessibility)
- no-budget state: a configure-budget affordance linking to settings instead of a meaningless percentage
- the `FR-06-13` partial note when cycle disbursement is computed from partial rollups
- `dashboard` locale keys for this zone
- PostHog events (zone viewed, configure-budget CTA clicked)
- automated tests, at minimum one E2E asserting the color/state thresholds at <80%, 80–100%, and >100%, and the no-budget affordance

## Out of Scope

- editing the budget value (owned by settings, [`FRD-07`](../../../frd-07-user-settings/frd-07-user-settings.md))
- calendar-month spend and charts (covered in [`WO-04`](wo-04-disbursed-spend-zone.md))
- obligations (covered in [`WO-02`](wo-02-cash-and-obligations-zone.md))

## Requirements

- `FR-06-06`, `FR-06-14`, `FR-06-15`
- `BR-06-03`, `BR-06-04`, `BR-06-07`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — budget-cycle period contract

## E2E Acceptance Tests

- With disbursement below 80% of the budget, the zone shows the green state.
- With disbursement between 80% and 100%, the zone shows the amber state.
- With disbursement above 100%, the zone shows the red over-budget state with a non-color cue.
- With no budget configured, the zone shows the configure-budget affordance instead of a percentage.

## Analytics

- PostHog event when the budget zone is viewed
- PostHog event when the configure-budget CTA is clicked
