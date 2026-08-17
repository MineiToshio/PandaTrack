---
id: WO-04
type: WORK_ORDER
slug: disbursed-spend-zone
title: Disbursed Spend Zone
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 109
implementation_status: IMPLEMENTED
last_updated: 2026-08-03
---

# WO-04 Disbursed Spend Zone

## Summary

Implement the dashboard's spend zone end-to-end: the disbursed-this-month figure (sum of order payments plus delivery shipping cost in the current calendar month, including partial/advance payments) and a monthly disbursed-spend chart over a configurable date range. This slice introduces the shared client date-range control (default last 6 months; presets 3/6/12 months, year-to-date, all; custom range) that the order-activity charts reuse, and owns the scoped "Gráficos / Tendencias" section it lives in, which now carries four charts laid out two per row: gasto por mes, comprometido por mes, deuda viva, and (from [`WO-05`](wo-05-order-activity-zone.md)) hechos vs llegados.

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md) — disbursed aggregation and monthly series

## In Scope

- the spend zone on the dashboard page
- "desembolsado este mes" figure in base currency (current calendar month, order payments plus non-cancelled delivery shipping cost, partial payments included)
- monthly disbursed-spend chart over the selected range
- the shared client date-range control: default last 6 months, presets (3/6/12 months, year-to-date, all), and a custom range; it drives only the trend charts and never the fixed current-period metrics
- the range control lives in the header of one scoped "Gráficos / Tendencias" section so its scope (the trend charts only) is visually unambiguous (`FR-06-12`)
- **deuda viva trend** line: outstanding balance at each month-end over the selected range, in the same scoped section (`FR-06-21`)
- **comprometido por mes** chart: Σ `Order.totalCost` bucketed by `orderDate` month over the selected range, with the range total as its card figure, in the same scoped section (`FR-06-24`)
- the first-activity clamp disclosure: when a preset window is shortened to the collector's first recorded month, the section says so under its header (`FR-06-25`)
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
- `FR-06-21`, `FR-06-24`, `FR-06-25`
- `BR-06-04`, `BR-06-05`, `BR-06-07`, `BR-06-11`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — date-range scoping decision and server/client boundary

## E2E Acceptance Tests

- A partial payment made this month is counted in "desembolsado este mes".
- The monthly disbursed-spend chart renders one bucket per month across the default 6-month range.
- Selecting a range preset (e.g. 12 months) updates the chart but leaves the current-month figure unchanged.
- Applying a custom range updates the chart accordingly.
- An order placed this month with no payment yet appears in "comprometido por mes" but not in "gasto por mes".
- A collector whose history is shorter than the selected preset sees the shortened window disclosed under the section header.

## Analytics

- PostHog event when the spend zone is viewed
- PostHog event when a range preset is selected
- PostHog event when a custom range is applied

## Implementation Decisions

- **"Desembolsado este mes" lives in the head of the "Gasto por mes" chart card**, not as a standalone tile and not folded into the budget figure. The FDD folds it into the budget card on the assumption that the budget cycle equals the calendar month, which only holds when `budgetResetDayOfMonth` is 1. `FR-06-07` requires the **calendar-month** disbursed total, and `BR-06-03` keeps the budget on its own cycle, so the two figures can legitimately differ. Placing the calendar-month figure above its own month-by-month chart satisfies `FR-06-07` without duplicating the budget zone.
- **The range control is URL-driven.** The selection is written to the `range` (plus `from`/`to`) search params and resolved server-side, so the page stays a Server Component and the selection is shareable and back-button friendly. Because the fixed current-period metrics are computed from `now`, they are structurally immune to the range (`FR-06-12`).
- **The range transition is hoisted above both the control and the charts, and the charts show skeletons while it resolves.** Because the range lives in the URL and the series are resolved on the server, picking a preset is a round trip, and React holds the previous render for the duration of a transition. The control alone knowing it was busy left the stale charts sitting there looking settled, so the selection appeared to do nothing until the new series arrived (measured at roughly 3.7s in dev). `DashboardTrendsRangeProvider` now owns the `useTransition` and shares one pending flag; `DashboardTrendsChartsSurface` swaps the grid for four card placeholders that reuse the same grid class and card chrome, so nothing jumps on arrival. The placeholder carries `aria-busy` / `aria-live="polite"` with a localized label, so the wait is announced rather than visual-only. This is the scoped counterpart of the route-level skeleton in ADR 0013: the range only affects this section, so only this section may blank.
- **Presets are resolved server-side.** `3m` / `6m` / `12m` / `ytd` anchor on the current month in the collector's timezone; `all` starts at the month of their earliest order or payment and falls back to the default window when they have no activity; a custom range is snapped outward to whole months because every trend series is bucketed by month.
- **Charting is hand-rolled** (`DashboardLineChart`, an SVG line/area chart with gridlines, markers, axis labels, a hover crosshair + tooltip, and a `role="img"` label). No charting dependency was added, per `ui-libs-policy.mdc`. Formatted values are passed in from the server so no formatter function crosses the RSC boundary.
- **The chart renders 1:1.** The `viewBox` tracks the container's measured pixel width (a `ResizeObserver` behind a `useMeasuredWidth` hook), so one SVG user unit is one CSS pixel and a declared 12px label really renders at 12px. The original fixed `600×220` viewBox with `width:100%` scaled the type along with the drawing: axis labels came out at 5.5px in the three-column grid and 5.0px on a 375px phone. A measured width of `0` means "not laid out" (`display:none`, jsdom), never "0px wide", so it is discarded in favour of a fallback and the plot can never collapse. The axis font was raised 11px → 12px, the design-system floor for chart text. Both rules are system-level, see [interface-patterns.md § 16](../../../../../design/interface-patterns.md).
- **The charts grid derives its column count from a minimum card width**, `grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))]`, not from viewport breakpoints. The container also narrows when the app sidebar expands, so a viewport rule handed an 820px tablet two 320px plots. Measured: 1440px → 2 columns at 478px of plot, 820px → 1 column at 692px, 375px → 1 column at 271px with no horizontal overflow. The page's `max-w-6xl` cap means the rule never resolves to three columns, which is the intent; at two columns a plot is ~2.18:1, inside the readable band for a trend line.
- **A fourth chart was added rather than stretching the third full width.** With three charts the two-column grid left a half-empty trailing row. Stretching the trailing card would have made it read as a different kind of thing and as more important than its siblings (Gestalt similarity: an item differing in size within a group reads as not belonging). "Comprometido por mes" (`FR-06-24`) is an honest fourth metric, the counterpart of "gasto por mes", so the row closes evenly. The house rule is recorded in [interface-patterns.md § 16](../../../../../design/interface-patterns.md).
- **Markers and axis labels are density-aware.** Point markers are dropped once the spacing between points falls under 14px (the markers are 8px across and start touching); below the threshold only the hovered point keeps a marker so the crosshair still has a target. Axis labels thin to the capacity implied by a 36px minimum spacing, always keeping the final month. When the range spans more than one year the axis prints the year at the first tick and wherever the year changes, and the tooltip header carries it too, so a multi-year range never shows the same month name twice with nothing to tell them apart.
- **The clamp disclosure is derived, not stored.** The section compares the number of months the preset asked for against the number of months the resolved series actually has; when it is short, `trends.clampedNote` names the first month. No flag crosses the aggregation boundary.
- **The custom-range calendar reuses `DateRangePickerInput`** (core), whose trigger + popover + preset rail already match the design record. No parallel calendar was built.
- **The deuda-viva trend (`FR-06-21`)** reconstructs the balance at each month-end: an order contributes once placed, and only payments settled by that month-end reduce it. Cancelled and FX-unreconciled orders are excluded, and the series carries the partial flag.
- **Delivery shipping cost is merged into the spend figures, not charted separately** (`BR-06-04`, `BR-06-09`, resolving the FRD-06/FRD-08 open question). Each non-cancelled [`FRD-08`](../../../frd-08-delivery-management/frd-08-delivery-management.md) `Delivery.cost` is bucketed by its `deliveryDate` (shipping date) exactly like an order payment is bucketed by `paymentDate`, and rolled into the same base-currency total via the existing FX-pending rollup — a delivery's own `currencyCode` / `exchangeRate` / `exchangeRateBaseCode` are run through the same `needsFxReconciliation` derivation an order's are, so an FX-pending delivery is excluded from the total and flips `SpendBlock.currentMonthIsPartial` / `monthlySeriesIsPartial` like an FX-pending order does.
