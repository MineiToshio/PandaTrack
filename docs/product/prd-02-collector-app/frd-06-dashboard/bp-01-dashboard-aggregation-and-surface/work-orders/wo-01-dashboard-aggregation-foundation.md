---
id: WO-01
type: WORK_ORDER
slug: dashboard-aggregation-foundation
title: Dashboard Aggregation Foundation
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 106
implementation_status: IMPLEMENTED
last_updated: 2026-07-10
---

# WO-01 Dashboard Aggregation Foundation

## Summary

Establish the read-only dashboard data layer that every dashboard zone depends on: shared period helpers (calendar month and budget cycle), the centralized base-currency rollup that excludes FX-unreconciled orders, the outstanding-balance aggregation, and the single `getDashboardData` query entry point. This Work Order is the foundation slice for [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md). By design it ships no UI and no routes; it is validated with unit tests, not an E2E path.

## In Scope

- dashboard data-access module under `src/lib/data/dashboard/` (queries + aggregation only; no mutations)
- shared period helpers: `getCalendarMonthRange(now, timezone)` and `getBudgetCycleRange(now, timezone, resetDay)` returning half-open `{ start, end }` intervals in the user's timezone
- centralized base-currency rollup helper: given orders/payments with `currencyCode` + `exchangeRate` + `needsExchangeRateUpdate`, returns `{ totalMinor, isPartial, excludedOrderCount }`, excluding flagged orders (`FR-06-13`)
- outstanding-balance aggregation reusing the order domain's payment-summary logic (`totalCost − Σ payments`, never negative)
- the `getDashboardData(userId, range)` entry point returning the single `DashboardData` shape consumed by all zones (cash/obligations, budget, spend, activity, collection); [`WO-04`](wo-04-disbursed-spend-zone.md) later widened `range` into a range **selection** (preset or custom), resolved server-side because presets depend on the collector's timezone and `all` depends on their data
- shared TypeScript types for `DashboardData` and its blocks
- unit tests for the period helpers (including month/cycle edges and timezone correctness), the FX-exclusion rollup, the outstanding-balance and overdue-fold-in logic, and the bucketing helpers

## Out of Scope

- any UI, including shared components and charts
- the dashboard route/page wiring (each zone slice composes into it)
- the date-range control (introduced by the disbursed-spend slice)
- PostHog events (belong to the vertical zone slices)
- reminders, notifications, or any mutation

## Requirements

- `FR-06-02` through `FR-06-14` (data/computation portions)
- `BR-06-01` through `BR-06-08`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — aggregation, base-currency rollup, and period contracts this foundation implements

## Computation Contract

- "a pagar este mes" = Σ outstanding of orders with `expectedDeliveryFrom` in the current calendar month + Σ outstanding of all overdue orders (`expectedDeliveryFrom < today`, balance > 0), folded into the current month (`FR-06-02`, `BR-06-01`); the overdue portion is also exposed on its own so the cash zone can name how much is already owed
- forward months = per-month Σ outstanding bucketed by `expectedDeliveryFrom` month (`FR-06-03`)
- deuda viva total = Σ outstanding across all non-cancelled orders (`FR-06-04`)
- deuda sin fecha = Σ outstanding of orders with no `expectedDeliveryFrom`, returned separately and excluded from the dated totals (`FR-06-05`, `BR-06-02`)
- budget consumption = Σ `OrderPayment.amount` in the current budget cycle ÷ `budgetAmount` (`FR-06-06`, `BR-06-03`)
- disbursed this month = Σ `OrderPayment.amount` with `paymentDate` in the current calendar month (`FR-06-07`, `BR-06-04`)
- monthly disbursed series = Σ payments grouped by `paymentDate` month over the range (`FR-06-08`)
- placed vs arrived = orders by `orderDate` month vs orders by arrival month, "arrived" = any item left `NONE` state (`FR-06-09`, `BR-06-06`)
- collection totals = non-cancelled order count, Σ item quantity, status distribution, by-product-type, top stores (`FR-06-11`)
- all base-currency totals exclude `needsExchangeRateUpdate` orders and carry the partial flag (`FR-06-13`); `CANCELLED` orders excluded from rollups (`BR-06-07`)

## E2E Acceptance Tests

This foundation slice is exempt from the "must include an E2E acceptance path" rule because by design it ships no UI. Validation is done via unit tests covering, at minimum:

- calendar-month and budget-cycle boundaries are correct, including the reset-day edge and a non-UTC timezone
- the FX rollup excludes flagged orders, returns `isPartial = true` and the correct excluded count, and sums only reconciled orders
- outstanding balance never goes negative and overdue balances fold into the current month while future-dated and no-date balances do not
- disbursed totals count partial payments in the month of their `paymentDate`
- `CANCELLED` orders are excluded from every rollup, and "arrived" is true once any item leaves `NONE`

## Notes

- Reuse existing order/payment derivations from [`FRD-05`](../../../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) and persisted `OrderItem.deliveryState` from [`FRD-08`](../../../frd-08-delivery-management/frd-08-delivery-management.md); do not re-implement balance or delivery-state logic.
- The FX-pending signal is the persisted `Order.needsExchangeRateUpdate` flag, consistent with [`FRD-05 · BP-02 · WO-07`](../../../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md).
- All money stays in minor units through aggregation.
- No base-currency conversion helper existed before this slice; the direction is fixed by the order form copy (`exchangeRate` = "how many base-currency units equal 1 order-currency unit"), so base = `round(orderMinor × exchangeRate)`.

## Implementation Decisions

Resolutions for the parent FRD's open questions, applied by this foundation slice:

- **Payments on later-`CANCELLED` orders**: excluded from the disbursed-spend series and every rollup. `BR-06-07` (cancelled orders excluded from all rollups) governs; refund-vs-sunk accounting is out of MVP scope.
- **"Gasto por tipo" and "top tiendas"**: use **committed value**, all-time, base-currency, FX-excluded. [`WO-06`](wo-06-collection-overview-zone.md) later refined by-type to distribute each order's `totalCost` across its items (weighted by line value, falling back to quantity), because summing `unitPrice × quantity` reported zero for orders priced only at order level. Top stores rank by `Σ totalCost`. Labeled as committed per `BR-06-05`; neither surface is driven by the trend range.
- **"Arrived" bucketing date and arrival punctuality (`FR-06-17`)**: originally approximated here against `expectedDeliveryFrom` and against the current date. [`WO-05`](wo-05-order-activity-zone.md) replaced both with dated delivery evidence (the dispatch date of the order's first non-cancelled delivery) before surfacing them, because judging the window against _today_ reclassified every past arrival as late over time.
