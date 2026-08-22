---
id: FRD-06
type: FRD
slug: dashboard
title: Dashboard
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-08-20
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

Everything in this FRD is built, across [`BP-01 · WO-01…WO-07`](bp-01-dashboard-aggregation-and-surface/bp-01-dashboard-aggregation-and-surface.md):

- The read-only aggregation layer (`src/lib/data/dashboard/`) exposes one `getDashboardData(userId, rangeSelection)` entry point: timezone-aware period helpers, the centralized base-currency rollup that excludes FX-unreconciled orders, and every derived block the zones consume.
- The route `/{locale}/dashboard` renders the KPI strip, cash & obligations, budget, arrival punctuality, the scoped "Tendencias" section (gasto por mes, comprometido por mes, deuda viva, hechos vs llegados) with its single shared range control, order activity, próximos pagos, and the collection overview. It has a structure-matching `loading.tsx`; the `(app)` group's `error.tsx` covers it.
- Open-order debt scoping and the unrecorded-payments diagnostic figure (`FR-06-27`, `FR-06-28`, `BR-06-13`, `ADR 0033`/`0034`, [`BP-01 · WO-07`](bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md)): every obligation/debt rollup ("a pagar este mes", "próximos meses", "deuda viva total", "deuda sin fecha", the "deuda viva" trend) counts only open orders and reads each order's canonical `openBalanceMinor`; a fully delivered order with a lingering balance surfaces instead in the "pagos que no registraste" / "payments you never recorded" diagnostic line inside the cash zone.
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

As a collector, I want charts of monthly spend, what I committed to each month, my running debt, and orders placed vs arrived, plus totals by store and product type, so I understand my habits and the shape of my collection.

## Functional Requirements

- `FR-06-01`: The dashboard must be the first private destination after sign-in.
- `FR-06-02` **(revised 2026-08-20, `ADR 0033`):** The dashboard must surface, for the current calendar month, the total the collector still has to pay ("a pagar este mes"): the sum of outstanding balances of **open** orders (status other than `COMPLETED`; cancelled orders were already excluded, `BR-06-07`) whose initial expected-arrival date (`Order.expectedDeliveryFrom`) falls in the current calendar month, **plus** every overdue outstanding balance of an open order (an order whose `expectedDeliveryFrom` has already passed, is not yet fully delivered, and still carries a balance), folded into the current month. A fully delivered order with a lingering balance no longer counts here; it feeds the diagnostic figure instead (`FR-06-27`, `FR-06-28`).
- `FR-06-03` **(revised 2026-08-20, `ADR 0033`):** The dashboard must surface a forward-looking breakdown of upcoming payment obligations for at least the next two calendar months beyond the current one, as a per-month outstanding total of **open** orders (status other than `COMPLETED`) bucketed by the order's expected-arrival month, so the collector can plan savings ahead (`FR-06-27`).
- `FR-06-04` **(revised 2026-08-20, `ADR 0033`):** The dashboard must surface the collector's total outstanding debt across all **open**, non-cancelled orders ("deuda viva total"): orders whose status is neither `COMPLETED` nor `CANCELLED`. A fully delivered order that still carries a balance is excluded from this figure and counted instead in the diagnostic "pagos que no registraste" (`FR-06-27`, `FR-06-28`).
- `FR-06-05` **(revised 2026-08-20, `ADR 0033`):** The dashboard must surface, separately from and excluded from the dated obligation totals, the outstanding balance of **open** orders that have **no** expected-arrival date ("deuda en pedidos sin fecha estimada"), as an awareness figure only. A fully delivered order with no expected-arrival date and a lingering balance is excluded here too, for the same reason as `FR-06-04` (`FR-06-27`).
- `FR-06-06`: The dashboard must surface budget consumption for the **current budget cycle** (defined by `User.budgetResetDayOfMonth`), comparing disbursed payments in that cycle against `User.budgetAmount`, with a status color: green below 80%, amber from 80% to 100% inclusive, red above 100%. When no budget is configured, the budget surface must show a configure-budget affordance instead of a meaningless percentage.
- `FR-06-07` **(revised 2026-08-08, store-level payments — `docs/design/decisions/0025-store-level-payments-declared-allocations.md`):** The dashboard must surface total disbursed spend for the **current calendar month** — the sum of `PaymentAllocation.amountMinor` (declared against this collector's own orders, dated by the parent `StorePayment.paymentDate`) whose payment date falls in the current calendar month (including partial and advance payments), **plus** `Delivery.cost` ([`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md)) for every non-cancelled delivery whose `deliveryDate` (shipping date) falls in the current calendar month (`BR-06-04`).
- `FR-06-08`: The dashboard must provide a monthly disbursed-spend chart across a configurable date range, using the same combined definition as `FR-06-07` (order payments plus delivery shipping cost) bucketed by month.
- `FR-06-09`: The dashboard must provide an orders-placed-vs-orders-arrived chart by month across a configurable date range. "Placed" is bucketed by `Order.orderDate`; an order counts as "arrived" once at least one of its items has left the `NONE` delivery state (i.e. is `ARRIVED_AT_STORE`, `IN_TRANSIT`, or `DELIVERED`).
- `FR-06-10`: The dashboard must surface a recent-orders list (the latest ~10 orders by `orderDate`), the orders arriving in the next 30 days, and the orders overdue on arrival.
- `FR-06-10a`: Each **arrival** row (upcoming and overdue, not the recent-orders list) must expose the quick-arrival action defined in [`FR-08-36`](../frd-08-delivery-management/frd-08-delivery-management.md), so the collector can log that the box arrived without leaving the dashboard. This is what makes the arrival lists actionable rather than merely informative: the same lists back the `ARRIVAL_DUE` / `ARRIVAL_OVERDUE` reminders of [`FRD-09`](../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md), and until now the nearest action was a four-step wizard two navigations away.
  - The row's navigation target and the action must remain independently operable: a control nested inside the row link would be invalid markup and unreachable by keyboard, so the row uses the full-bleed link overlay already used by the order list.
  - The row carries the products its modal would offer, filtered by the delivery domain's own eligibility predicate, so opening the modal costs no extra round trip and can never offer a product `createDelivery` would refuse. Only the arrival lists carry them, which keeps the dashboard payload bounded.
  - Logging an arrival is **not** patched optimistically into these lists: membership is server-derived (`BR-06-06`), so the dashboard refreshes and the row leaves on its own.
  - Below the `sm` breakpoint the status chip moves under the order code instead of sharing the line with the control. A chip and a trailing button together leave the store name and order code roughly 18px on a 375px screen, and those two strings are the only way to tell one row from another. The control keeps the system's 44px mobile tap target.
- `FR-06-11`: The dashboard must surface collection-state totals: total non-cancelled orders, total products (sum of `OrderItem.quantity` on non-cancelled orders), distribution by `OrderStatus`, spend by product type, product count by product type, product distribution by `OrderItem.deliveryState` (`NONE`, `ARRIVED_AT_STORE`, `IN_TRANSIT`, `DELIVERED`), and top stores.
- `FR-06-12`: The configurable date range must apply only to the trend charts (`FR-06-08`, `FR-06-09`, `FR-06-21`, `FR-06-24`), which are grouped in a single scoped "Gráficos / Tendencias" section whose header carries one shared range control (so its scope is visually unambiguous). It must default to the last 6 months and offer presets (3 months, 6 months, 12 months, year-to-date, all) plus a custom range. Current-period metrics (this month, current budget cycle) are fixed to the active period and must not be affected by the range control.
- `FR-06-13`: Dashboard rollups denominated in the user's **current** base currency must not silently merge historical orders whose stored exchange rate was recorded against a **different** base currency. Orders that need FX reconciliation must be **excluded** from single-currency base-currency totals; the affected surfaces must show a visible "totals are partial until reconciliation is completed" warning and link to the orders reconciliation flow; amounts shown per order use the **order currency** where needed. The excluded set is **derived**, not read from a stored flag: an order is pending when its currency differs from the base currency and its stored `exchangeRate` is missing or was recorded against a different base (`exchangeRateBaseCode`). The dashboard must use the same shared derivation as the orders list and its `?fxPending=true` filter (`needsFxReconciliation` in `src/lib/fx/reconciliation.ts`, [ADR 0024](../../../design/decisions/0024-fx-reconciliation-derived-from-rate-base.md)) so the two surfaces can never disagree about which orders are excluded.
- `FR-06-14`: All monetary summaries on the dashboard must be expressed in the user's base currency (`User.baseCurrencyCode`), subject to `FR-06-13`.
- `FR-06-15`: The dashboard must be read-only. It performs no domain mutations; every actionable element is a navigation link or CTA into the owning surface (orders, deliveries, stores, settings).
- `FR-06-16`: Any dashboard CTA that links to the public store listing (`/{locale}/stores`) must build the URL with the same preference-driven helper used by the private shell `Stores` navigation, not a hardcoded path (see Cross-domain notes).
- `FR-06-17`: The dashboard must surface arrival punctuality: among arrived orders that can be judged, the share whose arrival is **provably within** their estimated arrival window versus outside it, so the collector can gauge store reliability over time. Because no arrival timestamp is persisted, arrival is measured by the dispatch date of the order's first non-cancelled delivery. Only "within the window" is provable from that date, so the surface must name what it measures and must report arrivals it cannot judge separately, never folding them into either bucket.
- `FR-06-18` **(revised 2026-08-11):** The dashboard must surface an itemized list of upcoming payment obligations ("próximos pagos"): one row per order with its outstanding amount and due date, sorted ascending by due date, each linking into the order. This is the per-order detail behind the aggregate obligation figures (`FR-06-02`, `FR-06-03`).
- `FR-06-18a` **(added 2026-08-11):** The list must exclude `COMPLETED` orders, **without** excluding them from the obligation totals it details. A delivered pedido that still owes money is real debt, so it has to keep counting in `totalOutstanding` / `overdue` / "a pagar este mes"; but its expected arrival is in the past, so sorted ascending it sits permanently at the top of the list and pushes out everything the collector actually has coming. This is not hypothetical: the widget was once observed showing five rows, all five of them delivered pedidos from 2022. Those balances have their own surfaces instead: the orders list "Solo con saldo pendiente" filter (`FRD-05 · FR-05-47`) and the per-row "Saldo pendiente" chip (`FRD-05 · FR-05-35a`).
- `FR-06-18b` **(added 2026-08-11):** Each row's due-date chip must state a fact about **that row's date**, never about its position in the list. Three states: `vencido {fecha}` (warning) when the date is past, `vence pronto, {fecha}` (warning) when it falls within the same lookahead window "próximas llegadas" uses (`DASHBOARD_UPCOMING_ARRIVAL_DAYS`, 30 days), and `vence {fecha}` (info) otherwise. The previous rule labelled row index 0 "vence pronto" unconditionally, so the topmost row claimed a payment was near while being months overdue; at the time of this change **13 of the 21** rows the widget could draw from had a due date in the past, including all five it displayed.
- `FR-06-19` **(revised 2026-08-20, `ADR 0033`, clarifies scope only; the formula is unchanged):** The dashboard must surface, across the collection, how committed value splits into paid versus still-owed ("pagado vs pendiente"): committed total = paid to date + outstanding, across **every non-cancelled order, open or fully delivered**, so the collector sees how much of what they bought is already covered. Unlike the standalone "deuda viva total" headline (`FR-06-04`), this split's "pendiente" leg deliberately keeps fully delivered orders with a lingering balance, so the identity paid + pendiente = committed always holds; the slice of "pendiente" that belongs to fully delivered orders is exactly what the diagnostic figure isolates (`FR-06-28`).
- `FR-06-20`: The dashboard must surface the count of products by product type (`OrderItem.productTypeKey`), alongside the spend-by-product-type breakdown (`FR-06-11`).
- `FR-06-21` **(revised 2026-08-20, `ADR 0033`):** The dashboard must provide an outstanding-debt trend over time ("deuda viva" at each month-end, **open orders only**) among the range-controlled trend charts (`FR-06-12`), so the collector sees whether their running debt is rising or falling (`FR-06-27`).
- `FR-06-22`: The dashboard must present a coherent empty / first-run state: when the collector has no data, each zone shows a calm empty or configure state (zeroed KPIs, "no debes nada", configure-budget affordance, "create your first order", "explore stores") rather than blank or broken widgets, and it must never fabricate data.
- `FR-06-23` **(revised 2026-08-08, store-level payments):** The dashboard must surface the "lost on cancelled" awareness figure: the sum of `PaymentAllocation.amountMinor` over `CANCELLED` orders that still carry at least one allocation (the collector chose `lost`, not `credit`, at cancel time — `BR-05-15`; money deliberately left declared against the order, treated as sunk/lost), in base currency and subject to `FR-06-13` (`BR-06-10`). It must render **only when it is greater than 0**, and must never enter the disbursed-spend series or change a historical rollup retroactively. It must be presented as a **quiet line inside the cash zone**, directly under the paid-versus-pending figures, not as a zone of its own (`BR-06-12`), with a link to the cancelled orders so the amount stays explorable.

- `FR-06-24`: The dashboard must provide a **committed-value-per-month** chart ("comprometido por mes") among the range-controlled trend charts (`FR-06-12`): the sum of `Order.totalCost` bucketed by `Order.orderDate` month, in base currency, excluding cancelled orders (`BR-06-07`) and FX-unreconciled orders (`FR-06-13`). It answers what the collector **took on** in a month, the counterpart of the disbursed-spend series (`FR-06-08`), which answers what they actually paid out. It must be labeled distinctly and must never be summed into, or plotted as a second series of, the disbursed-spend chart (`BR-06-05`). The card must also state the committed total across the selected range.
- `FR-06-25`: Every trailing-window preset (3, 6, and 12 months) and the year-to-date preset must be **clamped forward to the month of the collector's first recorded activity**, so the trend charts never plot months that predate the collector's history (`BR-06-11`). A custom range is exempt, because the collector named those bounds explicitly. When a preset window is shortened this way, the trends section must disclose it under its header, naming the month the series actually starts, so the preset label never silently promises more history than is shown.
- `FR-06-26`: Changing the trend range is a server round trip, so the trend charts must show a **scoped loading state** for its duration: the chart grid is replaced by placeholders matching its own layout, and the pending state is announced assistively. Only the range-controlled section may blank; the fixed current-period metrics are unaffected by the range (`FR-06-12`) and must stay legible throughout.
- `FR-06-27` **(added 2026-08-20, `ADR 0033`; revised 2026-08-20, `ADR 0034`):** Every obligation and debt figure on the dashboard ("a pagar este mes" `FR-06-02`, "próximos meses" `FR-06-03`, "deuda viva total" `FR-06-04`, "deuda sin fecha" `FR-06-05`, the "deuda viva" trend `FR-06-21`) must count only **open** orders: orders whose status is not `COMPLETED` (cancelled orders were already excluded, `BR-06-07`), and each order's own contribution must be its `openBalanceMinor` (`BR-06-08`: `totalCost` net of both its allocations and any `StoreAccountAdjustmentLine` a store reconciliation wrote against it), never the older, adjustment-blind `totalCost - allocatedAmountMinor`. A fully delivered order that still carries a saldo pendiente is not live debt, because in this market a store never hands the product over before it is paid in full; it is a gap in the collector's own registration instead (the axiom underlying [`ADR 0032`](../../../design/decisions/0032-delivery-triggered-settlement.md)). This mirrors the store-level debt scope defined in [`FRD-05 · FR-05-61`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements), so the dashboard and the store aside can never disagree about what counts as live debt. The "pagado vs pendiente" split (`FR-06-19`) is a deliberate exception, kept scoped to every non-cancelled order and to the older, gross per-order balance, so its own paid-plus-outstanding identity holds (`BR-06-08`).
- `FR-06-28` **(added 2026-08-20, `ADR 0033`; revised 2026-08-20, `ADR 0034`; revised again 2026-08-20, round-4 arbitration, G2):** The dashboard must surface a diagnostic figure, "pagos que no registraste" / "payments you never recorded": the sum of the `openBalanceMinor` (`BR-06-08`) across orders whose status is `COMPLETED` (fully delivered) and still carry a balance, in base currency and subject to `FR-06-13`. An order whose remaining balance was already resolved by a store reconciliation adjustment contributes `0` here, not its pre-write-off balance, **whether that adjustment was written while the order was still open or directly against the order after it was already `COMPLETED`** (round-4 arbitration, `FRD-05 · FR-05-64`/`WO-11`: a reconciliation line may now target any non-cancelled order, open or completed, not only an order that was open at write-off time): a write-off is not a payment the collector forgot to record, it is the opposite, a gap the collector already closed by other means, so it must not be double-flagged by this diagnostic regardless of when the write-off happened. This is also this figure's own tool for clearing itself against the collector's back-catalogue of already-delivered orders, which have no other path back to an "open" state to be reconciled through. It must render **only when it is greater than 0**, must never enter the disbursed-spend series, and must never change a historical rollup retroactively. It links into the affected orders so the collector can register the missing payment or reconcile it directly from there.

## Business Rules

- `BR-06-01` **(revised 2026-08-20, `ADR 0033`):** "A pagar este mes" folds overdue unpaid balances into the current month, because for a pre-order the payment is due when the order arrives; once its arrival date has passed and a balance remains **on an order that is still open**, that money is already owed now. A fully delivered order with a lingering balance is the one exception: the axiom is that a store never hands over the product unpaid, so that balance is a registration gap rather than money still owed (`BR-06-13`).
- `BR-06-02`: Orders without an `expectedDeliveryFrom` are excluded from every dated obligation total (`FR-06-02`, `FR-06-03`) and surfaced only in the separate "sin fecha" awareness figure (`FR-06-05`), because their payment timing cannot be predicted.
- `BR-06-03`: Budget consumption is measured over the budget cycle anchored on `User.budgetResetDayOfMonth` (`FR-06-06`); every other monthly metric on the dashboard uses the calendar month.
- `BR-06-04` **(revised 2026-08-08, store-level payments):** Spend is measured as **disbursed cash-out**: `PaymentAllocation.amountMinor` by its parent `StorePayment.paymentDate`, plus `Delivery.cost` by its `deliveryDate` (shipping date) for every non-cancelled delivery — a shipping cost is real money spent, independent of the order's own payment schedule. A partial or advance order payment counts at the moment it is paid, never deferred to a later period; a delivery's cost counts in full in its shipping month, since it is recorded as a single amount rather than a payment ledger. Delivery cost is **merged into** the same spend figures rather than shown as its own series (`BR-06-09`). Only the **declared** slice of a payment is read (`PaymentAllocation`, not `StorePayment.amount`): an undeclared slice — money that left the collector's hands but was never assigned to an order — is real spend, but the dashboard has no order to attribute it to and does not guess; it stays visible instead as the store's own debt going down without a matching order balance (`FR-05-43`).
- `BR-06-05`: "Committed" value (`Order.totalCost`) is a distinct concept from disbursed spend and outstanding balance. Where the dashboard shows it, it must be labeled distinctly and must never be summed into a disbursed-spend series. In the KPI strip it is labeled **"Valor de pedidos" / "Order value"** (a fixed label — the word "committed" is deliberately avoided as confusing) with an always-available tooltip explaining it is the total of the collector's active orders (what is already paid **plus** what is still owed). The partial/complete distinction is carried **only by the trigger icon** (info when complete, warning when FX-unreconciled orders are excluded — the warning tooltip also names the excluded count), never by changing the label. This single affordance replaces the former standalone "excludes N orders" caption, which duplicated it. Dashboard money figures use thousand separators.
- `BR-06-06`: An order counts as "arrived" for activity and charts (`FR-06-09`, `FR-06-10`) once any of its items has left the `NONE` delivery state. A consequence worth naming: the arrival lists therefore only ever hold orders whose products are **all** still `NONE`, so an order already partly at the store never appears there and never offers the quick-arrival action of `FR-06-10a`. Widening that definition is a deliberate future decision, not an oversight. This reflects "the store has received it from the country of origin / it is ready for delivery", independent of whether the collector has physically received it.
- `BR-06-07`: Orders in `CANCELLED` status are excluded from obligation, committed-value, collection-state, spend, budget, and activity rollups. The one exception is the dedicated "lost on cancelled" figure (`BR-06-10`, `FR-06-23`), which recognizes payments deliberately retained on a cancelled order.
- `BR-06-08` **(revised 2026-08-08, store-level payments; revised again 2026-08-20, `ADR 0034`; revised again 2026-08-20, round-4 arbitration, `BR-05-32` wins):** Outstanding balance per order, for every obligation and debt figure scoped to **open** orders (`FR-06-02`, `FR-06-03`, `FR-06-04`, `FR-06-05`, `FR-06-21`, `FR-06-27`, `FR-06-28`), is the order's canonical `openBalanceMinor` ([`FRD-05` · `BR-05-32`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#business-rules): `Order.totalCost` minus its `PaymentAllocation`s minus its `StoreAccountAdjustmentLine`s), **rendered exactly as computed, never clamped at zero.** An earlier revision of this rule clamped it in presentation; that clamp is **retracted**, because `BR-05-32` explicitly forbids it: `openBalanceMinor` cannot be negative by construction (each of its three terms — allocations, adjustment lines, and the total itself — is bounded before being written, via `EXCEEDS_BALANCE`, `ADJUSTMENT_EXCEEDS_ORDER_BALANCE`, and `TOTAL_BELOW_PAID` respectively), so a negative reading on screen can only mean one of those ceilings was bypassed somewhere and the same money was counted twice. Clamping it to zero would convert that one loud, visible symptom into silence, which is the exact failure class `BR-05-28` names as the one that erodes the books unnoticed; a dashboard that hides the symptom removes the only chance of catching the defect before it compounds. Before reconciliation adjustments existed this was `Order.totalCost` minus its `Order.allocatedAmountMinor` alone; the dashboard must not hold that older, adjustment-blind formula as a second derivation now that `BR-05-32` exists. This rule is **order-level presentation only** and does not extend to the store: a store's own debt (`Σ totalCost` of its non-cancelled orders `− Σ` its payments, per currency) was already, and remains, **not** clamped, because a negative value there is real money the store holds on the collector's behalf ("a favor") and clamping would erase that signal (`FR-05-43`, `docs/design/decisions/0025-store-level-payments-declared-allocations.md`) — this dashboard rule now simply matches that same "never clamp" posture instead of contradicting it for the order-level figure. **`FR-06-19`'s "pendiente" leg is the one deliberate exception**: it keeps reading `Order.totalCost` minus `Order.allocatedAmountMinor` alone, not net of adjustment lines, precisely so its own paid-plus-pendiente-equals-committed identity keeps holding across every non-cancelled order, open or `COMPLETED` (an adjustment line is not a payment, so subtracting it there would break that identity without a matching bucket to hold the difference). This is the same kind of declared exception `ADR 0027` requires whenever two on-screen figures could otherwise be assumed to share one formula and do not.
- `BR-06-09`: Delivery shipping cost is **not** shown as its own spend series. A typical shipping cost (a few units of currency) sits on a completely different scale than a typical order total, so plotting them together, or comparing them side by side, would be disproportionate and not meaningful to the collector. What the collector actually wants to know is total money spent per month, so delivery cost is folded into the existing disbursed-spend figures instead (`FR-06-07`, `FR-06-08`).
- `BR-06-10` **(revised 2026-08-08, store-level payments):** Money declared (allocated) against a `CANCELLED` order is treated as sunk (lost) and surfaced only in the dedicated "Perdido en cancelados" / "Lost on cancelled" figure (`FR-06-23`), in base currency, subject to `FR-06-13`. The cancel modal forces a `lost` / `credit` choice, so the presence of a `PaymentAllocation` on a cancelled order is itself the signal that the money was lost rather than freed as store credit: `lost` leaves the allocation in place; `credit` deletes it (the underlying `StorePayment` survives either way, undeclared money against the store — see `BR-05-15`). A cancelled order whose allocations were freed (`credit`) at cancel time, or which never had one, is fully excluded and contributes nothing to this figure. This figure does not enter the disbursed-spend series and does not change any historical rollup retroactively.

- `BR-06-12`: The "lost on cancelled" figure (`FR-06-23`, `BR-06-10`) is presented as a line inside the cash zone rather than as its own surface. It is **unrecoverable by definition**, so it earns no call to action, and a standing card would hold constant visual weight while its relevance decays: a loss from three years ago reads as loudly as one from yesterday. It is not dropped either, because the paid and committed figures are computed from non-cancelled orders only, so this is exactly the money missing from them; the note therefore belongs next to the figure it corrects. The moment of loss is already surfaced where it happens, by the keep/remove choice the cancel modal forces (`BR-06-10`), so the dashboard does not need to repeat it.
- `BR-06-13` **(added 2026-08-20, `ADR 0033`; revised 2026-08-20, `ADR 0034`; revised again 2026-08-20, round-4 arbitration, G2):** The "pagos que no registraste" figure (`FR-06-28`) is **not** debt. It is a thermometer of how current the collector's own registration is: because a store in this market never hands the product over before it is paid in full, a delivered order that still shows a saldo pendiente is, by definition, a payment the collector forgot to record rather than money genuinely owed. This reading only holds for the money a store reconciliation has not already resolved: an order whose balance was written off is neither owed nor forgotten, it is closed, so `FR-06-28` reads its `openBalanceMinor` (`BR-06-08`), not its pre-write-off balance, and contributes nothing once that balance is `0`, **whether the write-off happened before the order was delivered or directly against it afterward** (round-4 arbitration: a reconciliation line is no longer restricted to open orders, `FRD-05 · FR-05-64`/`WO-11`). This figure is therefore net of reconciliation adjustment lines by construction, at every point in an order's lifecycle, never only the ones written while it was still open. The precedent for this pattern is already in this document: `BR-06-10` and `FR-06-23` exclude money declared on `CANCELLED` orders from every total while still surfacing it in its own dedicated "Perdido en cancelados" / "Lost on cancelled" figure; this rule applies the identical pattern to fully delivered orders instead of cancelled ones. It also follows `BR-06-12`'s placement decision, presenting as a quiet line inside the cash zone rather than a surface of its own, next to the figures it corrects. Unlike the cancelled-money figure, this gap is actionable, so its line links into the affected orders rather than only staying explorable, and now that path includes reconciling the order directly instead of only registering the missing payment.
- `BR-06-11`: Months preceding the collector's first recorded activity are **trimmed** from a preset trend window (`FR-06-25`), because they are outside the series' domain rather than months where nothing happened: a collector one month into the product asking for "last 12 months" would otherwise spend 11/12 of the plot on months that predate their account. **Interior gaps are never trimmed.** An empty month between two active ones is real data, and closing it up would put unequal intervals on a time axis, misrepresenting the slope between the points it joins (Stephen Few, _Line Graphs and Irregular Intervals: An Incompatible Partnership_, Perceptual Edge 2008: connecting values along unequal or non-adjacent time intervals is misleading, and a time scale represents reality only when its intervals are equal, in order, and recorded for all).

## Metric Definitions

The precise computation for each surface. All amounts are in minor units and base currency unless noted, and all base-currency totals exclude orders that need FX reconciliation per `FR-06-13`.

| Metric                       | Definition                                                                                                                                                                                                           | Source                                                                 | Period                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| A pagar este mes             | Σ `openBalanceMinor` (`BR-06-08`) of **open** orders (`FR-06-27`) with `expectedDeliveryFrom` in the current month, plus Σ of all overdue open orders (`expectedDeliveryFrom < today`, balance > 0)                  | `Order`, `PaymentAllocation`, `StoreAccountAdjustmentLine`             | current calendar month + overdue fold-in |
| Próximos meses               | Per-month Σ `openBalanceMinor` (`BR-06-08`) of **open** orders (`FR-06-27`) bucketed by `expectedDeliveryFrom` month                                                                                                 | `Order`, `PaymentAllocation`, `StoreAccountAdjustmentLine`             | next 2+ calendar months                  |
| Deuda viva total             | Σ `openBalanceMinor` (`BR-06-08`) across all **open**, non-cancelled orders (`FR-06-27`; excludes `COMPLETED`, diverted to "Pagos que no registraste")                                                               | `Order`, `PaymentAllocation`, `StoreAccountAdjustmentLine`             | all-time                                 |
| Deuda sin fecha              | Σ `openBalanceMinor` (`BR-06-08`) of **open** orders with no `expectedDeliveryFrom` (`FR-06-27`)                                                                                                                     | `Order`, `PaymentAllocation`, `StoreAccountAdjustmentLine`             | all-time                                 |
| Presupuesto consumido        | Σ `PaymentAllocation.amountMinor` in the current budget cycle ÷ `budgetAmount`                                                                                                                                       | `PaymentAllocation`, `User.budgetAmount`, `User.budgetResetDayOfMonth` | current budget cycle                     |
| Desembolsado este mes        | Σ `PaymentAllocation.amountMinor` with `paymentDate` in the current month, plus Σ `Delivery.cost` of non-cancelled deliveries with `deliveryDate` in the current month (`BR-06-04`, `BR-06-09`)                      | `PaymentAllocation`, `Delivery`                                        | current calendar month                   |
| Gasto por mes (chart)        | Σ `PaymentAllocation.amountMinor` grouped by `paymentDate` month, plus Σ `Delivery.cost` of non-cancelled deliveries grouped by `deliveryDate` month (`BR-06-04`, `BR-06-09`)                                        | `PaymentAllocation`, `Delivery`                                        | selected range                           |
| Comprometido por mes (chart) | Σ `Order.totalCost` grouped by `orderDate` month, non-cancelled, base currency and FX-excluded (`FR-06-24`, `BR-06-05`, `BR-06-07`)                                                                                  | `Order`                                                                | selected range                           |
| Hechos vs llegados (chart)   | Count of orders by `orderDate` month (placed) vs count of orders by arrival month (arrived per `BR-06-06`)                                                                                                           | `Order`, `OrderItem.deliveryState`                                     | selected range                           |
| Últimos pedidos              | Latest ~10 orders by `orderDate`                                                                                                                                                                                     | `Order`                                                                | all-time                                 |
| Próximas llegadas            | Orders with `expectedDeliveryFrom` within the next 30 days                                                                                                                                                           | `Order`                                                                | next 30 days                             |
| Atrasados en llegada         | Orders past their `expectedDeliveryTo` (or `expectedDeliveryFrom` when no `to`) not yet arrived                                                                                                                      | `Order`, `OrderItem.deliveryState`                                     | overdue                                  |
| Total pedidos                | Count of non-cancelled orders                                                                                                                                                                                        | `Order`                                                                | all-time                                 |
| Total productos              | Σ `OrderItem.quantity` on non-cancelled orders                                                                                                                                                                       | `OrderItem`                                                            | all-time                                 |
| Distribución por estado      | Count of non-cancelled orders grouped by `OrderStatus`, so the split sums to "total pedidos" (`BR-06-07`)                                                                                                            | `Order`                                                                | all-time                                 |
| Gasto por tipo               | Σ disbursed (or committed, labeled) grouped by `OrderItem.productTypeKey`                                                                                                                                            | `Order`, `OrderItem`, `PaymentAllocation`                              | selected/all                             |
| Top tiendas                  | Stores ranked by spend / order count                                                                                                                                                                                 | `Order`, `Store`                                                       | selected/all                             |
| Productos por tipo (conteo)  | Σ `OrderItem.quantity` grouped by `OrderItem.productTypeKey` on non-cancelled orders                                                                                                                                 | `OrderItem`                                                            | all-time                                 |
| Puntualidad de llegadas      | Share of judged arrivals whose delivery dispatch date fell on or before `expectedDeliveryTo` (else `expectedDeliveryFrom`) vs after it; arrivals with no dispatch date or no window are reported as unknown          | `Order`, `Delivery.deliveryDate`                                       | all-time                                 |
| Próximos pagos (lista)       | Per-order outstanding amount + due date (`expectedDeliveryFrom`), sorted ascending by due date                                                                                                                       | `Order`, `PaymentAllocation`                                           | upcoming                                 |
| Pagado vs pendiente          | Committed (Σ `totalCost`) split into paid (Σ payments) and outstanding across **every non-cancelled order, open or `COMPLETED`** (`FR-06-19`; deliberately not scoped to open orders, so the split stays exhaustive) | `Order`, `PaymentAllocation`                                           | all-time                                 |
| Deuda viva (tendencia)       | `openBalanceMinor` (`BR-06-08`) of **open** orders at each month-end over the selected range (`FR-06-27`)                                                                                                            | `Order`, `PaymentAllocation`, `StoreAccountAdjustmentLine`             | selected range                           |
| Perdido en cancelados        | Σ `PaymentAllocation.amountMinor` over `CANCELLED` orders that still carry payments, base currency, FX-excluded per `FR-06-13` (`BR-06-10`, `FR-06-23`); rendered only when > 0                                      | `Order`, `PaymentAllocation`                                           | all-time                                 |
| Pagos que no registraste     | Σ `openBalanceMinor` (`BR-06-08`) of `COMPLETED` orders that still carry a balance, base currency, FX-excluded per `FR-06-13` (`FR-06-28`, `BR-06-13`); rendered only when > 0                                       | `Order`, `PaymentAllocation`, `StoreAccountAdjustmentLine`             | all-time                                 |

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

- Given at least one order whose stored exchange rate cannot convert it into the current base currency (missing, or recorded against a different base)
- When the dashboard renders base-currency totals
- Then that order is excluded from those totals
- And a "totals are partial until reconciliation" warning is shown with a link to reconcile
- And the excluded set matches exactly what the orders list `?fxPending=true` filter shows, because both read the same derivation

### `AC-06-06`

- Given the collector changes the chart date range to a preset or custom range
- When the charts re-render
- Then only the trend charts change; the current-month and budget-cycle metrics stay fixed

### `AC-06-07`

- Given an order has at least one item that is `ARRIVED_AT_STORE`, `IN_TRANSIT`, or `DELIVERED`
- When the orders-placed-vs-arrived chart renders
- Then that order is counted as "arrived"

### `AC-06-08`

- Given an order placed in a month with no payment recorded in that month
- When the trends section renders
- Then that order's full total is counted in "comprometido por mes" for its `orderDate` month
- And "gasto por mes" for that month is unchanged by it

### `AC-06-09`

- Given the collector's first recorded activity is 4 months ago
- When they select the "last 12 months" preset
- Then the trend charts start at the month of that first activity, not 12 months back
- And the section discloses the shortened window naming that month
- And a month in between with no activity is still plotted as a zero, not removed

### `AC-06-10`

- Given an order is fully delivered (`COMPLETED`) and still carries an outstanding balance
- When the collector opens the dashboard
- Then that balance is excluded from "a pagar este mes", "próximos meses", and "deuda viva total"
- And it is counted instead in "pagos que no registraste"
- And "pagado vs pendiente" still counts that balance in its "pendiente" leg, so paid plus pendiente continues to equal committed

### `AC-06-11`

- Given an **open** order whose balance was partially written off by a store reconciliation adjustment (`FRD-05 · FR-05-64`)
- When the collector opens the dashboard
- Then "a pagar este mes" / "próximos meses" / "deuda viva total" / "deuda sin fecha" (whichever applies) count only that order's `openBalanceMinor`, the post-write-off remainder, never its pre-write-off balance

### `AC-06-12`

- Given an order whose entire balance was written off by a store reconciliation adjustment before it was later fully delivered (`COMPLETED`)
- When the collector opens the dashboard
- Then that order contributes `0` to "pagos que no registraste", not its pre-write-off balance
- And it does not appear among the orders the diagnostic line links into

### `AC-06-13`

- Given a `COMPLETED` order that already appears in "pagos que no registraste" with its outstanding balance
- When the collector reconciles that order directly, writing a reconciliation adjustment line against it after it was already delivered
- Then the collector's dashboard shows that order contributing `0` to "pagos que no registraste", not its pre-write-off balance
- And it does not appear among the orders the diagnostic line links into
- And no figure scoped to open orders (`FR-06-02`, `FR-06-03`, `FR-06-04`, `FR-06-05`, `FR-06-21`) changes, since a `COMPLETED` order was never counted in any of them

## Implementation Notes

- The dashboard depends on already-shipped query/derivation logic: payment summaries (`calculatePaymentSummary`) and order state from [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md), and persisted `OrderItem.deliveryState` from [`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md). It should reuse these rather than re-deriving balances or states.
- Money is stored in minor units (`Order.totalCost`, `PaymentAllocation.amountMinor`, `User.budgetAmount`); all aggregation stays in minor units until formatting.
- The single source of FX-pending eligibility is the shared derivation in `src/lib/fx/reconciliation.ts` (`currencyCode != base` and the stored `exchangeRate` missing or recorded against a different `exchangeRateBaseCode`, plus `status != CANCELLED`), the same rule the orders list and `FxReconciliationModal` use ([`FRD-05 · BP-02 · WO-07`](../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md)). The dashboard must not re-implement it: the two used to differ, which let a foreign-currency order with no rate be dropped from every dashboard total while staying invisible to the list built to fix it ([ADR 0024](../../../design/decisions/0024-fx-reconciliation-derived-from-rate-base.md)).
- Calendar-month and budget-cycle boundaries must be computed in the user's timezone (`User.timezone`) to avoid off-by-one period bucketing.
- The dashboard is a Server Component that loads one aggregation payload; the date-range control is the only interactive (client) boundary and drives the two trend charts.

## Confirmed

- The dashboard is dashboard-only; reminders and notifications are a separate future FRD.
- "A pagar este mes" folds overdue balances into the current month; orders without an expected-arrival date are excluded and shown only as a separate awareness figure.
- **(approved 2026-08-20, implemented, `ADR 0033`):** every obligation/debt figure ("a pagar este mes", "próximos meses", "deuda viva total", "deuda sin fecha", the "deuda viva" trend) will count only open orders, i.e. exclude orders whose status is `COMPLETED`; a fully delivered order that still carries a balance will move into a dedicated "pagos que no registraste" / "payments you never recorded" diagnostic instead, never into the debt totals (`FR-06-27`, `FR-06-28`, `BR-06-13`).
- **(approved 2026-08-20, implemented, `ADR 0034`):** every one of those same figures reads each order's canonical `openBalanceMinor` (`BR-06-08`, net of both allocations and any store-reconciliation adjustment line), not the older `totalCost - allocatedAmountMinor`; an order whose balance a reconciliation already wrote off contributes `0`, whether it is still open or has since been delivered, and "pagado vs pendiente" (`FR-06-19`) is the one figure that deliberately keeps the older, gross formula so its own paid-plus-pendiente identity holds (`FR-06-27`, `FR-06-28`).
- Spend means disbursed cash-out by payment date, including partial payments, **plus** delivery shipping cost by shipping date; "committed" (order total) is a distinct, separately labeled concept.
- Delivery shipping cost ([`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md) `Delivery.cost`) is folded into the disbursed-spend figures rather than charted as its own series — a shipping cost sits on a completely different scale than an order total, so a shared series or axis would be disproportionate, and "how much did I spend this month" is naturally the sum of both (`BR-06-04`, `BR-06-09`).
- "Arrived" means an item has reached the store (left `NONE` delivery state), not necessarily received by the collector.
- Budget uses the budget cycle; all other monthly metrics use the calendar month.
- Trend charts default to the last 6 months with presets 3/6/12 months, year-to-date, all, and a custom range; current-period metrics are not affected by the range control.
- Base-currency totals exclude FX-unreconciled orders and show a partial-totals warning.
- The four range-controlled trend charts (gasto por mes, comprometido por mes, deuda viva, hechos vs llegados) live in one scoped "Gráficos / Tendencias" section whose header owns the single shared range control, laid out two per row.
- "Comprometido por mes" (`FR-06-24`) is the counterpart of "gasto por mes": what the collector took on in a month versus what they disbursed. It is a separate chart, never a second series on the spend plot, per `BR-06-05`.
- Preset trend windows are clamped forward to the collector's first recorded activity and the shortened window is disclosed; interior empty months are always kept (`FR-06-25`, `BR-06-11`).
- Beyond the aggregate obligation figures, the dashboard also shows the per-order **próximos pagos** list, the **pagado vs pendiente** split of committed value, **arrival punctuality**, **product count by type**, and the **deuda viva** trend.
- The dashboard is fully responsive: the same zones and values restack into a single-column mobile view, and it has a coherent empty / first-run state per zone with first-action CTAs.
- Design record (layout, states, responsive, visual treatment) lives in [`fdd-06-dashboard.md`](fdd-06-dashboard.md) and the self-contained [`prototype/dashboard.html`](prototype/dashboard.html).

## Resolved during work-order enrichment

Decisions applied by [`BP-01 · WO-01`](bp-01-dashboard-aggregation-and-surface/work-orders/wo-01-dashboard-aggregation-foundation.md) (aggregation foundation):

- Allocations on an order later moved to `CANCELLED` are **excluded** from the disbursed-spend series and every rollup, consistent with `BR-06-07` — with one exception: allocations **deliberately kept** on a cancelled order (the cancel modal offers a `lost` / `credit` choice at cancel time — `credit` now the default) are surfaced in the dedicated **"Perdido en cancelados" / "Lost on cancelled"** awareness figure (`FR-06-23`, `BR-06-10`), in base currency and FX-excluded like every other total. A cancelled order whose allocations were freed as store credit at cancel time, or which never had one, stays fully excluded. This reverses the earlier "refund-vs-sunk accounting is out of MVP scope" call for this single, non-retroactive figure only; see [`decision-cancelled-order-payments.md`](decision-cancelled-order-payments.md) (§8 for the store-level-payments update to this mechanism).
- "Gasto por tipo" and "top tiendas" use **committed value**, **all-time** (not driven by the chart range), in base currency with FX-excluded orders dropped. Committed money lives on the order (`Order.totalCost`), so each order's committed value is **distributed across its items** — weighted by `unitPrice × quantity` when the items carry prices, by quantity alone when they do not. Summing `unitPrice × quantity` directly would report nothing for the many orders priced only at order level. Top stores use `Σ totalCost` per store. Committed, not disbursed, is used here because a payment allocation can be declared at the order level with no product named (no `orderItemId`), which cannot be attributed to a single product type; it is labeled distinctly per `BR-06-05`.
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
- The dashboard's open-orders debt scope (`FR-06-27`) must reuse the same notion of "open order" as the store-level debt figure it mirrors, owned by [`FRD-05 · FR-05-61`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements) ([`ADR 0033`](../../../design/decisions/0033-store-debt-scoped-to-open-orders.md)), so the dashboard and the "Por tienda" view never disagree about which orders still count as debt.
- The dashboard's per-order outstanding-balance helper (`BR-06-08`) must reuse the same canonical `openBalanceMinor(order)` definition owned by [`FRD-05 · BR-05-32`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#business-rules) ([`ADR 0034`](../../../design/decisions/0034-store-account-reconciliation-adjustment.md)), rather than deriving a second, adjustment-blind balance: [`FRD-05 · BP-01 · WO-10`](../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md) is the module of record for that helper and for the `StoreAccountAdjustmentLine` model it reads.

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/bp-01-dashboard-aggregation-and-surface.md`
