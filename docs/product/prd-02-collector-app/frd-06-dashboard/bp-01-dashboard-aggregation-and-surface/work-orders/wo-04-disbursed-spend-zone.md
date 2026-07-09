---
id: WO-04
type: WORK_ORDER
slug: disbursed-spend-zone
title: Disbursed Spend Zone
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 109
implementation_status: PLANNED
last_updated: 2026-07-09
---

# WO-04 Disbursed Spend Zone

## Summary

Implement the dashboard's spend zone end-to-end: the disbursed-this-month figure (sum of payments in the current calendar month, including partial/advance payments) and a monthly disbursed-spend chart over a configurable date range. This slice introduces the shared client date-range control (default last 6 months; presets 3/6/12 months, year-to-date, all; custom range) that the order-activity charts reuse.

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md) — disbursed aggregation and monthly series

## In Scope

- the spend zone on the dashboard page
- "desembolsado este mes" figure in base currency (current calendar month, partial payments included)
- monthly disbursed-spend chart over the selected range
- the shared client date-range control: default last 6 months, presets (3/6/12 months, year-to-date, all), and a custom range; it drives only the trend charts and never the fixed current-period metrics
- the range control lives in the header of one scoped "Gráficos / Tendencias" section so its scope (the trend charts only) is visually unambiguous (`FR-06-12`)
- **deuda viva trend** line: outstanding balance at each month-end over the selected range, in the same scoped section (`FR-06-21`)
- the current-month disbursed value is unified with the budget-cycle consumed figure (it is the same money) rather than duplicated as a separate standalone tile; the trend chart is the month-by-month view of that spend
- a charting primitive consistent with `ui-libs-policy.mdc` (hand-rolled or an approved dependency), theme-aware and responsive
- the `FR-06-13` partial-totals note where the series is partial
- chart empty/loading states
- `dashboard` locale keys for this zone and the range control
- PostHog events (zone viewed, range preset selected, custom range applied)
- automated tests, at minimum one E2E asserting the current-month figure counts a partial payment, the chart renders monthly buckets, and changing the range updates the chart but not the current-month figure

## Out of Scope

- obligations and budget (covered in [`WO-02`](wo-02-cash-and-obligations-zone.md), [`WO-03`](wo-03-budget-consumption-zone.md))
- the placed-vs-arrived chart and activity lists (covered in [`WO-05`](wo-05-order-activity-zone.md), which reuses this slice's range control)
- collection totals (covered in [`WO-06`](wo-06-collection-overview-zone.md))

## Requirements

- `FR-06-07`, `FR-06-08`, `FR-06-12`
- `FR-06-13`, `FR-06-14`, `FR-06-15`
- `BR-06-04`, `BR-06-05`, `BR-06-07`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — date-range scoping decision and server/client boundary

## E2E Acceptance Tests

- A partial payment made this month is counted in "desembolsado este mes".
- The monthly disbursed-spend chart renders one bucket per month across the default 6-month range.
- Selecting a range preset (e.g. 12 months) updates the chart but leaves the current-month figure unchanged.
- Applying a custom range updates the chart accordingly.

## Analytics

- PostHog event when the spend zone is viewed
- PostHog event when a range preset is selected
- PostHog event when a custom range is applied
