---
id: FRD-06
type: FRD
slug: dashboard
title: Dashboard
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-07-11
source_features:
  - FEAT-0016
implementation_status: IMPLEMENTED
---

# FRD-06 Dashboard

## Overview

Define the collector dashboard: the first private screen after sign-in, whose job is to turn scattered order, payment, and delivery data into the few money and collection decisions a collector actually needs to make. The dashboard is **read-only** — it aggregates existing domain data and links into the order, delivery, and store surfaces where mutations happen. Reminders and notifications are intentionally **not** part of this FRD; they move to their own future FRD (see Out of Scope).

## Domain Goal

Help a collector answer, at a glance and in their own base currency:

- how much money do I still need to have ready to pay (this month, the next months, and in total)
- how much have I actually spent this month, and how does that compare across months
- am I within my monthly budget
- what is arriving, what is late, and what did I buy recently
- how big is my collection and where is my money going (by store and by product type)

## Current State

### Implemented

Everything in this FRD is built, across [`BP-01 · WO-01…WO-06`](bp-01-dashboard-aggregation-and-surface/bp-01-dashboard-aggregation-and-surface.md):

- The read-only aggregation layer (`src/lib/data/dashboard/`) exposes one `getDashboardData(userId, rangeSelection)` entry point: timezone-aware period helpers, the centralized base-currency rollup that excludes FX-unreconciled orders, and every derived block the zones consume.
- The route `/{locale}/dashboard` renders the KPI strip, cash & obligations, budget, arrival punctuality, the scoped "Tendencias" section (gasto por mes, hechos vs llegados, deuda viva) with its single shared range control, order activity, próximos pagos, and the collection overview. It has a structure-matching `loading.tsx`; the `(app)` group's `error.tsx` covers it.
- Analytics live under `POSTHOG_EVENTS.DASHBOARD.*`; copy lives in `src/i18n/locales/{es,en}/dashboard.json`.
- The upstream domains the dashboard reads from: orders, payments, and exchange-rate context in [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md); deliveries, delivery cost, and product delivery state in [`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md); base currency, budget, and budget reset day in [`FRD-07`](../frd-07-user-settings/frd-07-user-settings.md).

Where the built screen departs from the design record, see [`fdd-06-dashboard.md` §10](fdd-06-dashboard.md).

### Planned

- Nothing.

## User Stories

### US-06-01 Know how much cash to keep ready

As a collector, I want to see how much I still have to pay this month and in the coming months so I can set money aside before a big payment lands and never get caught short.

### US-06-02 Control my spending against a budget

As a collector, I want to see how much I have disbursed this budget cycle versus my budget, with a clear color signal, so I know when to slow down.

### US-06-03 See what is late and what is arriving

As a collector, I want to see what should already have arrived and what is coming in the next 30 days so I follow up with the right store at the right time.

### US-06-04 Understand my spending and my collection over time

As a collector, I want charts of monthly spend and orders placed vs arrived, plus totals by store and product type, so I understand my habits and the shape of my collection.

## Functional Requirements

- `FR-06-01`: The dashboard must be the first private destination after sign-in.
- `FR-06-02`: The dashboard must surface, for the current calendar month, the total the collector still has to pay ("a pagar este mes"): the sum of outstanding balances of orders whose initial expected-arrival date (`Order.expectedDeliveryFrom`) falls in the current calendar month, **plus** every overdue outstanding balance (orders whose `expectedDeliveryFrom` has already passed and still carry a balance), folded into the current month.
- `FR-06-03`: The dashboard must surface a forward-looking breakdown of upcoming payment obligations for at least the next two calendar months beyond the current one, as a per-month outstanding total bucketed by the order's expected-arrival month, so the collector can plan savings ahead.
- `FR-06-04`: The dashboard must surface the collector's total outstanding debt across all non-cancelled orders ("deuda viva total").
- `FR-06-05`: The dashboard must surface, separately from and excluded from the dated obligation totals, the outstanding balance of orders that have **no** expected-arrival date ("deuda en pedidos sin fecha estimada"), as an awareness figure only.
- `FR-06-06`: The dashboard must surface budget consumption for the **current budget cycle** (defined by `User.budgetResetDayOfMonth`), comparing disbursed payments in that cycle against `User.budgetAmount`, with a status color: green below 80%, amber from 80% to 100% inclusive, red above 100%. When no budget is configured, the budget surface must show a configure-budget affordance instead of a meaningless percentage.
- `FR-06-07`: The dashboard must surface total disbursed spend for the **current calendar month** — the sum of `OrderPayment.amount` whose `paymentDate` falls in the current calendar month (including partial and advance payments), **plus** `Delivery.cost` ([`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md)) for every non-cancelled delivery whose `deliveryDate` (shipping date) falls in the current calendar month (`BR-06-04`).
- `FR-06-08`: The dashboard must provide a monthly disbursed-spend chart across a configurable date range, using the same combined definition as `FR-06-07` (order payments plus delivery shipping cost) bucketed by month.
- `FR-06-09`: The dashboard must provide an orders-placed-vs-orders-arrived chart by month across a configurable date range. "Placed" is bucketed by `Order.orderDate`; an order counts as "arrived" once at least one of its items has left the `NONE` delivery state (i.e. is `ARRIVED_AT_STORE`, `IN_TRANSIT`, or `DELIVERED`).
- `FR-06-10`: The dashboard must surface a recent-orders list (the latest ~10 orders by `orderDate`), the orders arriving in the next 30 days, and the orders overdue on arrival.
- `FR-06-11`: The dashboard must surface collection-state totals: total non-cancelled orders, total products (sum of `OrderItem.quantity` on non-cancelled orders), distribution by `OrderStatus`, spend by product type, and top stores.
- `FR-06-12`: The configurable date range must apply only to the trend charts (`FR-06-08`, `FR-06-09`, `FR-06-21`), which are grouped in a single scoped "Gráficos / Tendencias" section whose header carries one shared range control (so its scope is visually unambiguous). It must default to the last 6 months and offer presets (3 months, 6 months, 12 months, year-to-date, all) plus a custom range. Current-period metrics (this month, current budget cycle) are fixed to the active period and must not be affected by the range control.
- `FR-06-13`: Dashboard rollups denominated in the user's **current** base currency must not silently merge historical orders whose stored exchange rate was recorded against a **different** base currency. Orders flagged `Order.needsExchangeRateUpdate` must be **excluded** from single-currency base-currency totals; the affected surfaces must show a visible "totals are partial until reconciliation is completed" warning and link to the orders reconciliation flow; amounts shown per order use the **order currency** where needed.
- `FR-06-14`: All monetary summaries on the dashboard must be expressed in the user's base currency (`User.baseCurrencyCode`), subject to `FR-06-13`.
- `FR-06-15`: The dashboard must be read-only. It performs no domain mutations; every actionable element is a navigation link or CTA into the owning surface (orders, deliveries, stores, settings).
- `FR-06-16`: Any dashboard CTA that links to the public store listing (`/{locale}/stores`) must build the URL with the same preference-driven helper used by the private shell `Stores` navigation, not a hardcoded path (see Cross-domain notes).
- `FR-06-17`: The dashboard must surface arrival punctuality: among arrived orders that can be judged, the share whose arrival is **provably within** their estimated arrival window versus outside it, so the collector can gauge store reliability over time. Because no arrival timestamp is persisted, arrival is measured by the dispatch date of the order's first non-cancelled delivery. Only "within the window" is provable from that date, so the surface must name what it measures and must report arrivals it cannot judge separately, never folding them into either bucket.
- `FR-06-18`: The dashboard must surface an itemized list of upcoming payment obligations ("próximos pagos"): one row per order with its outstanding amount and due date, sorted by due date, each linking into the order. This is the per-order detail behind the aggregate obligation figures (`FR-06-02`, `FR-06-03`).
- `FR-06-19`: The dashboard must surface, across the collection, how committed value splits into paid versus still-owed ("pagado vs pendiente"): committed total = paid to date + outstanding (deuda viva), so the collector sees how much of what they bought is already covered.
- `FR-06-20`: The dashboard must surface the count of products by product type (`OrderItem.productTypeKey`), alongside the spend-by-product-type breakdown (`FR-06-11`).
- `FR-06-21`: The dashboard must provide an outstanding-debt trend over time ("deuda viva" at each month-end) among the range-controlled trend charts (`FR-06-12`), so the collector sees whether their running debt is rising or falling.
- `FR-06-22`: The dashboard must present a coherent empty / first-run state: when the collector has no data, each zone shows a calm empty or configure state (zeroed KPIs, "no debes nada", configure-budget affordance, "create your first order", "explore stores") rather than blank or broken widgets, and it must never fabricate data.
- `FR-06-23`: The dashboard must surface a dedicated "Perdido en cancelados" / "Lost on cancelled" awareness figure: the sum of `OrderPayment.amount` over `CANCELLED` orders that still carry payments (money deliberately retained on cancel, treated as sunk/lost), in base currency and subject to `FR-06-13` (`BR-06-10`). Because a cancelled order that retains payments is a rare corner case, the figure must render **only when it is greater than 0**; when there is no lost money the surface renders nothing at all and reserves no dashboard space. It must never enter the disbursed-spend series and must never change a historical rollup retroactively.

## Business Rules

- `BR-06-01`: "A pagar este mes" folds overdue unpaid balances into the current month, because for a pre-order the payment is due when the order arrives; once its arrival date has passed and a balance remains, that money is already owed now.
- `BR-06-02`: Orders without an `expectedDeliveryFrom` are excluded from every dated obligation total (`FR-06-02`, `FR-06-03`) and surfaced only in the separate "sin fecha" awareness figure (`FR-06-05`), because their payment timing cannot be predicted.
- `BR-06-03`: Budget consumption is measured over the budget cycle anchored on `User.budgetResetDayOfMonth` (`FR-06-06`); every other monthly metric on the dashboard uses the calendar month.
- `BR-06-04`: Spend is measured as **disbursed cash-out**: `OrderPayment.amount` by its `paymentDate`, plus `Delivery.cost` by its `deliveryDate` (shipping date) for every non-cancelled delivery — a shipping cost is real money spent, independent of the order's own payment schedule. A partial or advance order payment counts at the moment it is paid, never deferred to a later period; a delivery's cost counts in full in its shipping month, since it is recorded as a single amount rather than a payment ledger. Delivery cost is **merged into** the same spend figures rather than shown as its own series (`BR-06-09`).
- `BR-06-05`: "Committed" value (`Order.totalCost`) is a distinct concept from disbursed spend and outstanding balance. Where the dashboard shows it, it must be labeled distinctly and must never be summed into a disbursed-spend series.
- `BR-06-06`: An order counts as "arrived" for activity and charts (`FR-06-09`, `FR-06-10`) once any of its items has left the `NONE` delivery state. This reflects "the store has received it from the country of origin / it is ready for delivery", independent of whether the collector has physically received it.
- `BR-06-07`: Orders in `CANCELLED` status are excluded from obligation, committed-value, collection-state, spend, budget, and activity rollups. The one exception is the dedicated "lost on cancelled" figure (`BR-06-10`, `FR-06-23`), which recognizes payments deliberately retained on a cancelled order.
- `BR-06-08`: Outstanding balance per order is `Order.totalCost` minus the sum of its `OrderPayment.amount`, never negative, consistent with the payment rules in [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md).
- `BR-06-09`: Delivery shipping cost is **not** shown as its own spend series. A typical shipping cost (a few units of currency) sits on a completely different scale than a typical order total, so plotting them together, or comparing them side by side, would be disproportionate and not meaningful to the collector. What the collector actually wants to know is total money spent per month, so delivery cost is folded into the existing disbursed-spend figures instead (`FR-06-07`, `FR-06-08`).
- `BR-06-10`: Payments retained on a `CANCELLED` order are treated as sunk (lost) money and surfaced only in the dedicated "Perdido en cancelados" / "Lost on cancelled" figure (`FR-06-23`), in base currency, subject to `FR-06-13`. The cancel modal forces a keep/remove choice, so the presence of payments on a cancelled order is itself the signal that the money was lost rather than refunded or moved as credit. A cancelled order whose payments were removed at cancel time, or which never had payments, is fully excluded and contributes nothing to this figure. This figure does not enter the disbursed-spend series and does not change any historical rollup retroactively.

## Metric Definitions

The precise computation for each surface. All amounts are in minor units and base currency unless noted, and all base-currency totals exclude `needsExchangeRateUpdate` orders per `FR-06-13`.

| Metric                      | Definition                                                                                                                                                                                                  | Source                                                            | Period                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| A pagar este mes            | Σ outstanding balance of orders with `expectedDeliveryFrom` in the current month, plus Σ outstanding of all overdue orders (`expectedDeliveryFrom < today`, balance > 0)                                    | `Order`, `OrderPayment`                                           | current calendar month + overdue fold-in |
| Próximos meses              | Per-month Σ outstanding balance bucketed by `expectedDeliveryFrom` month                                                                                                                                    | `Order`, `OrderPayment`                                           | next 2+ calendar months                  |
| Deuda viva total            | Σ outstanding balance across all non-cancelled orders                                                                                                                                                       | `Order`, `OrderPayment`                                           | all-time                                 |
| Deuda sin fecha             | Σ outstanding balance of orders with no `expectedDeliveryFrom`                                                                                                                                              | `Order`, `OrderPayment`                                           | all-time                                 |
| Presupuesto consumido       | Σ `OrderPayment.amount` in the current budget cycle ÷ `budgetAmount`                                                                                                                                        | `OrderPayment`, `User.budgetAmount`, `User.budgetResetDayOfMonth` | current budget cycle                     |
| Desembolsado este mes       | Σ `OrderPayment.amount` with `paymentDate` in the current month, plus Σ `Delivery.cost` of non-cancelled deliveries with `deliveryDate` in the current month (`BR-06-04`, `BR-06-09`)                       | `OrderPayment`, `Delivery`                                        | current calendar month                   |
| Gasto por mes (chart)       | Σ `OrderPayment.amount` grouped by `paymentDate` month, plus Σ `Delivery.cost` of non-cancelled deliveries grouped by `deliveryDate` month (`BR-06-04`, `BR-06-09`)                                         | `OrderPayment`, `Delivery`                                        | selected range                           |
| Hechos vs llegados (chart)  | Count of orders by `orderDate` month (placed) vs count of orders by arrival month (arrived per `BR-06-06`)                                                                                                  | `Order`, `OrderItem.deliveryState`                                | selected range                           |
| Últimos pedidos             | Latest ~10 orders by `orderDate`                                                                                                                                                                            | `Order`                                                           | all-time                                 |
| Próximas llegadas           | Orders with `expectedDeliveryFrom` within the next 30 days                                                                                                                                                  | `Order`                                                           | next 30 days                             |
| Atrasados en llegada        | Orders past their `expectedDeliveryTo` (or `expectedDeliveryFrom` when no `to`) not yet arrived                                                                                                             | `Order`, `OrderItem.deliveryState`                                | overdue                                  |
| Total pedidos               | Count of non-cancelled orders                                                                                                                                                                               | `Order`                                                           | all-time                                 |
| Total productos             | Σ `OrderItem.quantity` on non-cancelled orders                                                                                                                                                              | `OrderItem`                                                       | all-time                                 |
| Distribución por estado     | Count of non-cancelled orders grouped by `OrderStatus`, so the split sums to "total pedidos" (`BR-06-07`)                                                                                                   | `Order`                                                           | all-time                                 |
| Gasto por tipo              | Σ disbursed (or committed, labeled) grouped by `OrderItem.productTypeKey`                                                                                                                                   | `Order`, `OrderItem`, `OrderPayment`                              | selected/all                             |
| Top tiendas                 | Stores ranked by spend / order count                                                                                                                                                                        | `Order`, `Store`                                                  | selected/all                             |
| Productos por tipo (conteo) | Σ `OrderItem.quantity` grouped by `OrderItem.productTypeKey` on non-cancelled orders                                                                                                                        | `OrderItem`                                                       | all-time                                 |
| Puntualidad de llegadas     | Share of judged arrivals whose delivery dispatch date fell on or before `expectedDeliveryTo` (else `expectedDeliveryFrom`) vs after it; arrivals with no dispatch date or no window are reported as unknown | `Order`, `Delivery.deliveryDate`                                  | all-time                                 |
| Próximos pagos (lista)      | Per-order outstanding amount + due date (`expectedDeliveryFrom`), sorted ascending by due date                                                                                                              | `Order`, `OrderPayment`                                           | upcoming                                 |
| Pagado vs pendiente         | Committed (Σ `totalCost`) split into paid (Σ payments) and outstanding (deuda viva) across non-cancelled orders                                                                                             | `Order`, `OrderPayment`                                           | all-time                                 |
| Deuda viva (tendencia)      | Outstanding balance at each month-end over the selected range                                                                                                                                               | `Order`, `OrderPayment`                                           | selected range                           |
| Perdido en cancelados       | Σ `OrderPayment.amount` over `CANCELLED` orders that still carry payments, base currency, FX-excluded per `FR-06-13` (`BR-06-10`, `FR-06-23`); rendered only when > 0                                       | `Order`, `OrderPayment`                                           | all-time                                 |

## Acceptance Criteria

### `AC-06-01`

- Given an order whose `expectedDeliveryFrom` is in the current month with an outstanding balance
- And another order whose `expectedDeliveryFrom` already passed and still has a balance
- When the collector opens the dashboard
- Then "a pagar este mes" includes both outstanding balances

### `AC-06-02`

- Given an order with no `expectedDeliveryFrom` and an outstanding balance
- When the collector opens the dashboard
- Then that balance is shown only in the "deuda sin fecha" figure and is excluded from "a pagar este mes" and the forward months

### `AC-06-03`

- Given the collector has disbursed 80% or more of their budget in the current cycle
- When the dashboard renders the budget surface
- Then the status color is amber at 80–100% and red above 100%

### `AC-06-04`

- Given the collector recorded a partial payment this month
- When the dashboard renders disbursed spend
- Then that partial payment is counted in the current month's disbursed total

### `AC-06-05`

- Given at least one order is flagged `needsExchangeRateUpdate`
- When the dashboard renders base-currency totals
- Then the flagged order is excluded from those totals
- And a "totals are partial until reconciliation" warning is shown with a link to reconcile

### `AC-06-06`

- Given the collector changes the chart date range to a preset or custom range
- When the charts re-render
- Then only the trend charts change; the current-month and budget-cycle metrics stay fixed

### `AC-06-07`

- Given an order has at least one item that is `ARRIVED_AT_STORE`, `IN_TRANSIT`, or `DELIVERED`
- When the orders-placed-vs-arrived chart renders
- Then that order is counted as "arrived"

## Implementation Notes

- The dashboard depends on already-shipped query/derivation logic: payment summaries (`calculatePaymentSummary`) and order state from [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md), and persisted `OrderItem.deliveryState` from [`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md). It should reuse these rather than re-deriving balances or states.
- Money is stored in minor units (`Order.totalCost`, `OrderPayment.amount`, `User.budgetAmount`); all aggregation stays in minor units until formatting.
- The single source of FX-pending eligibility is the persisted `Order.needsExchangeRateUpdate` flag (plus `currencyCode != base`, `status != CANCELLED`), the same signal the orders list and `FxReconciliationModal` already use ([`FRD-05 · BP-02 · WO-07`](../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md)).
- Calendar-month and budget-cycle boundaries must be computed in the user's timezone (`User.timezone`) to avoid off-by-one period bucketing.
- The dashboard is a Server Component that loads one aggregation payload; the date-range control is the only interactive (client) boundary and drives the two trend charts.

## Confirmed

- The dashboard is dashboard-only; reminders and notifications are a separate future FRD.
- "A pagar este mes" folds overdue balances into the current month; orders without an expected-arrival date are excluded and shown only as a separate awareness figure.
- Spend means disbursed cash-out by payment date, including partial payments, **plus** delivery shipping cost by shipping date; "committed" (order total) is a distinct, separately labeled concept.
- Delivery shipping cost ([`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md) `Delivery.cost`) is folded into the disbursed-spend figures rather than charted as its own series — a shipping cost sits on a completely different scale than an order total, so a shared series or axis would be disproportionate, and "how much did I spend this month" is naturally the sum of both (`BR-06-04`, `BR-06-09`).
- "Arrived" means an item has reached the store (left `NONE` delivery state), not necessarily received by the collector.
- Budget uses the budget cycle; all other monthly metrics use the calendar month.
- Trend charts default to the last 6 months with presets 3/6/12 months, year-to-date, all, and a custom range; current-period metrics are not affected by the range control.
- Base-currency totals exclude FX-unreconciled orders and show a partial-totals warning.
- The three range-controlled trend charts (gasto por mes, hechos vs llegados, deuda viva) live in one scoped "Gráficos / Tendencias" section whose header owns the single shared range control.
- Beyond the aggregate obligation figures, the dashboard also shows the per-order **próximos pagos** list, the **pagado vs pendiente** split of committed value, **arrival punctuality**, **product count by type**, and the **deuda viva** trend.
- The dashboard is fully responsive: the same zones and values restack into a single-column mobile view, and it has a coherent empty / first-run state per zone with first-action CTAs.
- Design record (layout, states, responsive, visual treatment) lives in [`fdd-06-dashboard.md`](fdd-06-dashboard.md) and the self-contained [`prototype/dashboard.html`](prototype/dashboard.html).

## Resolved during work-order enrichment

Decisions applied by [`BP-01 · WO-01`](bp-01-dashboard-aggregation-and-surface/work-orders/wo-01-dashboard-aggregation-foundation.md) (aggregation foundation):

- Payments on an order later moved to `CANCELLED` are **excluded** from the disbursed-spend series and every rollup, consistent with `BR-06-07` — with one exception: payments **deliberately retained** on a cancelled order (the cancel modal offers a keep/remove choice at cancel time) are surfaced in the dedicated **"Perdido en cancelados" / "Lost on cancelled"** awareness figure (`FR-06-23`, `BR-06-10`), in base currency and FX-excluded like every other total. A cancelled order whose payments were removed at cancel time, or which never had payments, stays fully excluded. This reverses the earlier "refund-vs-sunk accounting is out of MVP scope" call for this single, non-retroactive figure only; see [`decision-cancelled-order-payments.md`](decision-cancelled-order-payments.md).
- "Gasto por tipo" and "top tiendas" use **committed value**, **all-time** (not driven by the chart range), in base currency with FX-excluded orders dropped. Committed money lives on the order (`Order.totalCost`), so each order's committed value is **distributed across its items** — weighted by `unitPrice × quantity` when the items carry prices, by quantity alone when they do not. Summing `unitPrice × quantity` directly would report nothing for the many orders priced only at order level. Top stores use `Σ totalCost` per store. Committed is used because payments are order-level and cannot be attributed to a single product type; it is labeled distinctly per `BR-06-05`.
- "Arrived" in the hechos-vs-llegados chart and arrival punctuality (`FR-06-17`) are anchored on **dated delivery evidence**: the dispatch date of an order's first non-cancelled delivery, since the store can only dispatch what it already holds. Punctuality judges an order only when it carries both an expected window and that evidence; arrivals with neither are reported separately as unknown rather than guessed. Orders flagged arrived by hand carry no delivery and therefore no timestamp, so the chart falls back to their expected-arrival start (then their order date) for bucketing only. Resolved by [`BP-01 · WO-05`](bp-01-dashboard-aggregation-and-surface/work-orders/wo-05-order-activity-zone.md).

## Out of Scope

- Reminders and notifications of any kind (in-app, email, push). These are owned by **FRD-09 Reminders and Notifications** ([frd-09-reminders-and-notifications](../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md)), delivered as an installable PWA with Web Push.
- An explicit pre-order vs direct-purchase order type. The product treats everything as an order; a direct purchase is modeled as an order whose expected arrival equals its order date. A future order-domain enhancement (an order-level "mark received immediately" affordance, owned by [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md)) may make this explicit; it is not part of this FRD.
- Any mutation of orders, payments, deliveries, or settings from the dashboard.
- Wishlist, full collection management, and advanced finance/accounting features (per PRD-02 scope).

## Cross-domain notes

**Cross-FRD** means this FRD depends on a requirement, blueprint, or work order owned by another FRD.

- When the dashboard adds a link or CTA to the **public store listing** (`/{locale}/stores`), that href **must** use the same **preference-driven URL construction** as the private shell `Stores` nav item (`FR-06-16`). Source of truth: requirement [`FR-07-28`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements) in **FRD-07**, with detail in [**FRD-07 · BP-01**](../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/bp-01-user-settings-identity-and-preferences.md) and [**FRD-07 · WO-06** _store-entry-defaults-from-user-preferences_](../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-06-store-entry-defaults-from-user-preferences.md). Use the **shared helper**, not a bare `/stores` path.
- Multi-currency rollups must follow the order-domain rule that changing base currency does not rewrite stored orders; per-order exchange rate is interpreted relative to the base currency at save time. See [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) (`FR-05-14`–`FR-05-16`, `BR-05-07`) and the reconciliation flow in [`FRD-05 · BP-02 · WO-07`](../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md).

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/bp-01-dashboard-aggregation-and-surface.md`
