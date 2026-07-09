---
id: WO-02
type: WORK_ORDER
slug: cash-and-obligations-zone
title: Cash and Obligations Zone
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 107
implementation_status: PLANNED
last_updated: 2026-07-09
---

# WO-02 Cash and Obligations Zone

## Summary

Implement the dashboard's cash-planning zone end-to-end: "a pagar este mes" (current-month outstanding with overdue folded in), the forward per-month obligations breakdown for the next two-plus months, "deuda viva total", and the separate "deuda en pedidos sin fecha" awareness figure. This is the highest-value surface for the collector and the first zone to replace the placeholder page shell.

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md) — obligations, outstanding-balance, and FX-rollup data layer

## In Scope

- the cash & obligations zone rendered on `src/app/[locale]/(app)/dashboard/page.tsx`, replacing the placeholder shell
- "a pagar este mes" headline figure in base currency (current-month outstanding + overdue fold-in)
- forward obligations: per-month outstanding for at least the next two calendar months
- "deuda viva total" figure
- "deuda en pedidos sin fecha estimada" figure, visually separated and excluded from the dated totals
- **pagado vs pendiente** bar: committed total split into paid-to-date and outstanding / deuda viva (`FR-06-19`)
- **próximos pagos** itemized list: one row per order with its outstanding amount and due date, sorted ascending by due date, each linking into the order (`FR-06-18`)
- the `FR-06-13` partial-totals warning (with a link to the reconciliation flow) when any rollup is partial
- empty state when the collector has no orders/obligations yet
- `dashboard` locale keys for this zone in `src/i18n/locales/{es,en}/dashboard.json`
- PostHog events for this zone (zone viewed, reconcile-warning CTA clicked, obligation card → orders CTA clicked)
- automated tests, at minimum one E2E asserting that an order due this month and an overdue order both appear in "a pagar este mes", a no-date order appears only in "deuda sin fecha", and the partial-totals warning shows when an order is FX-flagged

## Out of Scope

- budget consumption (covered in [`WO-03`](wo-03-budget-consumption-zone.md))
- disbursed spend and charts (covered in [`WO-04`](wo-04-disbursed-spend-zone.md))
- activity lists and the placed-vs-arrived chart (covered in [`WO-05`](wo-05-order-activity-zone.md))
- collection totals (covered in [`WO-06`](wo-06-collection-overview-zone.md))
- any mutation or the reconciliation flow itself (links into the order domain)

## Requirements

- `FR-06-02`, `FR-06-03`, `FR-06-04`, `FR-06-05`
- `FR-06-13`, `FR-06-14`, `FR-06-15`
- `BR-06-01`, `BR-06-02`, `BR-06-07`, `BR-06-08`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — obligations contract and the centralized FX-exclusion rollup

## E2E Acceptance Tests

- An order due in the current month with a balance and an overdue order with a balance both contribute to "a pagar este mes".
- An order with no expected-arrival date appears only in "deuda sin fecha" and not in the dated totals.
- The forward breakdown shows per-month outstanding for the next months.
- When an order is FX-flagged, the affected totals exclude it and the partial-totals warning is shown with a reconcile link.
- With no orders, the zone shows its empty state.

## Analytics

- PostHog event when the dashboard cash zone is viewed
- PostHog event when the partial-totals reconcile CTA is clicked
- PostHog event when an obligation card CTA navigates into the orders surface
