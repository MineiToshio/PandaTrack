---
id: WO-07
type: WORK_ORDER
slug: open-order-debt-and-unrecorded-payment-figures
title: Open Order Debt and Unrecorded Payment Figures
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0016
last_updated: 2026-08-20
implementation_status: IMPLEMENTED
---

# WO-07 Open Order Debt and Unrecorded Payment Figures

## Summary

Scope every dashboard obligation and debt figure to **open orders only** (orders whose status is not `COMPLETED`), and add the **"pagos que no registraste" / "payments you never recorded"** diagnostic figure for the balance left on fully delivered orders. This is the dashboard half of a two-part decision ([`ADR 0033`](../../../../../design/decisions/0033-store-debt-scoped-to-open-orders.md)); the store-level half (mandatory assignment, parked money, the store's own debt figure) lives in `FRD-05`. Approved by the owner 2026-08-20; implemented the same day (uncommitted, staging).

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md): the aggregation layer and outstanding-balance helper this work order narrows
- [`WO-02`](wo-02-cash-and-obligations-zone.md): the cash & obligations zone this work order's new line renders inside
- `FRD-05`'s open-order debt scope, [`FR-05-61`](../../../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements), so the dashboard and the "Por tienda" view share one notion of "open"
- [`FRD-05 · BP-01 · WO-10`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md): sole owner of the canonical `openBalanceMinor(order)` helper and the `StoreAccountAdjustmentLine` model (`FRD-05 · BR-05-32`, `ADR 0034`) this work order's obligation and diagnostic figures both read; `WO-10` must land before this work order's own balance narrowing can be correct on an order that has ever been through a store reconciliation. **(round-4 arbitration):** `WO-10` was split into two work orders; this work order depends only on the narrower `WO-10` linked above (the model), not on `FRD-05 · BP-01 · WO-11` (the new "cuadrar cuenta" write action split out of the former `WO-10`), since this work order only ever reads `openBalanceMinor`, never writes an adjustment. The canonical build order across the whole package, `WO-01 → WO-02 → WO-03 → WO-10 → WO-09 → WO-11 → {WO-08, WO-07}`, is declared once in `FRD-05 · BP-01`'s own implementation plan; this bullet cites it rather than restating it — this work order (`FRD-06 · WO-07`) is one of the two terminal slices in that sequence, alongside `FRD-08 · WO-08`

## In Scope

- restricting `FR-06-02` (a pagar este mes), `FR-06-03` (próximos meses), `FR-06-04` (deuda viva total), `FR-06-05` (deuda sin fecha), and `FR-06-21` (deuda viva trend) to orders whose status is not `COMPLETED` (cancelled orders were already excluded, `BR-06-07`)
- the "pagos que no registraste" diagnostic figure (`FR-06-28`): Σ outstanding balance of `COMPLETED` orders that still carry a balance, in base currency and `FR-06-13`-compliant, rendered only when greater than 0, linking into the affected orders
- rendering the diagnostic figure as a quiet line inside the cash & obligations zone, beneath the paid-vs-pending figures, following `BR-06-12`'s placement pattern (never its own zone or card)
- leaving `FR-06-19` (pagado vs pendiente) **unscoped**, i.e. still summing every non-cancelled order regardless of delivery status, so its paid + pendiente = committed identity keeps holding
- `dashboard` locale keys for the new figure and the revised labels
- a PostHog event when the "pagos que no registraste" line is clicked / navigated
- automated tests covering the open-orders exclusion and the new diagnostic figure

## Out of Scope

- the store-level debt scope, the mandatory store-payment assignment, and parked money (owned by [`FRD-05 · WO-09`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-09-store-payment-assignment-and-open-order-debt.md))
- the reconciliation adjustment / "cuadrar cuenta" action (owned by [`FRD-05 · WO-11`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-11-store-account-reconciliation-action.md), split from the former `WO-10` in the round-4 arbitration)
- the delivery-triggered settlement checkbox and its two-transaction write (owned by [`FRD-08 · WO-08`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md))
- any mutation from the dashboard; the diagnostic figure only links into the orders surface, it never writes

## Requirements

- `FR-06-27`, `FR-06-28`, `FR-06-02`, `FR-06-03`, `FR-06-04`, `FR-06-05`, `FR-06-19`, `FR-06-21`
- `BR-06-01`, `BR-06-12`, `BR-06-13`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md): obligations contract and diagnostic contract

## Analytics

- PostHog event when the "pagos que no registraste" diagnostic line is clicked / navigated (`FR-06-27` /
  `FR-06-28`'s in-scope event, matching the pattern already established for the obligation-card CTA in
  sibling work order `WO-02`).

## Technical Notes

- The `COMPLETED` exclusion must be applied once, inside the shared outstanding-balance / obligations aggregation introduced by `WO-01`, not re-derived per zone, mirroring how the FX-reconciliation exclusion is already centralized (`FR-06-13`).
- "Open" means `Order.status != 'COMPLETED'`; cancelled orders are already excluded upstream by the existing `CANCELLED` filter (`BR-06-07`). This predicate must match the one `FRD-05`'s store-level debt scope defines, not a re-derived one, so the two surfaces can never disagree.
- **The per-order outstanding-balance helper this work order sums (`FR-06-02`, `FR-06-03`, `FR-06-04`, `FR-06-05`, `FR-06-21`, and the diagnostic figure `FR-06-28`) is the canonical `openBalanceMinor(order)` (`FRD-06 · BR-06-08`; `FRD-05 · BR-05-32`, `ADR 0034`), never the older `totalCost - allocatedAmountMinor`.** `openBalanceMinor` nets out both an order's `PaymentAllocation`s and any `StoreAccountAdjustmentLine` a store reconciliation wrote against it, owned by [`FRD-05 · BP-01 · WO-10`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md); this work order consumes that helper rather than introducing a second balance derivation. Getting this wrong has two failure directions on today's own scoping: an **open** order partially written off would read overstated in "a pagar este mes" / "deuda viva total" if the exclusion were skipped, and a **`COMPLETED`** order fully written off before delivery would be double-flagged as an unrecorded payment in `FR-06-28` if its pre-write-off balance were summed instead of its `openBalanceMinor` (which is already `0`).
- `FR-06-19` (pagado vs pendiente) keeps its existing all-orders formula unchanged, reading the older, gross `totalCost - allocatedAmountMinor` rather than `openBalanceMinor`, precisely so its own paid-plus-pendiente-equals-committed identity keeps holding; a reconciliation adjustment is not a payment, so netting it out of this one figure's "pendiente" leg would break that identity with nothing to hold the difference. Only its documentation is clarified, not its computation (`FRD-06 · BR-06-08`).
- **Declared double-count, not an oversight:** a `COMPLETED` order's own outstanding balance counts at once in two figures on the same screen: the "pendiente" leg of `FR-06-19` (which stays unscoped, see above) and the "pagos que no registraste" diagnostic of `FR-06-28`. This is deliberate, not a bug, because the two figures answer different questions (total pendiente across the whole collection, versus a registration-hygiene thermometer for delivered orders specifically), but `ADR 0027` treats two on-screen figures derived from the same underlying money as something that must be declared explicitly rather than left implicit, so this note is that declaration.
- **A reconciliation line can now target a `COMPLETED` order directly, not only an order that was already open when it was written off (added 2026-08-20, round-4 arbitration, G2, `FRD-05 · WO-11`).** Earlier scoping refused a reconciliation line against any order whose status was not open (`ORDER_NOT_OPEN`); that refusal is retired in `WO-11` and replaced with a refusal only for `CANCELLED` orders (`ORDER_CANCELLED`). This matters directly to `FR-06-28`: before this change, the only way a `COMPLETED` order's balance could ever reach `0` in this diagnostic was for the write-off to have happened while it was still open, so the 522 already-delivered orders in the collector's own history that were never going to reopen had no path to leave "pagos que no registraste" except by having the missing payment actually entered. After this change, the collector can write a reconciliation line directly against a `COMPLETED` order, and this work order's diagnostic figure (which already reads `openBalanceMinor`, unchanged by this decision) reflects that write-off the moment it is written, exactly as it already does for an open order. No formula in this work order changes: `openBalanceMinor(order)` was always net of every `StoreAccountAdjustmentLine` regardless of when it was written or what status the order held at the time; only the set of orders a line may legally target changed, and that change is owned entirely by `WO-11`.

## UX Notes

- The diagnostic line sits directly under the paid-vs-pending figures inside the cash zone, matching the visual pattern already established for "Perdido en cancelados" (`FR-06-23`, `BR-06-12`).
- It renders only when greater than 0, so a collector with perfect registration hygiene never sees an empty diagnostic line.
- Unlike the unrecoverable "lost on cancelled" figure whose placement it borrows, this gap is actionable: the line links into the affected (delivered, still-owing) orders.

## Assumptions

- `FR-06-19` (pagado vs pendiente) is deliberately left unscoped so its own arithmetic identity (paid + pendiente = committed) keeps holding. `ADR 0033` does not mention this figure, so this is a documented assumption made to preserve correctness, not an explicit directive (see the `FR-06-19` revision note in `frd-06-dashboard.md`).
- The exact destination of the diagnostic figure's link (a filtered orders list vs. a dedicated view) is left to implementation, as long as it reaches the affected orders.

## Unit Tests

- The obligations aggregation excludes `COMPLETED` orders from "a pagar este mes", "próximos meses", "deuda viva total", "deuda sin fecha", and the "deuda viva" trend.
- A `COMPLETED` order with a balance contributes to "pagos que no registraste" and to nothing else.
- The diagnostic figure sums to 0, and the zone does not render it, when no `COMPLETED` order carries a balance.
- "Pagado vs pendiente" still includes `COMPLETED` orders in its outstanding leg (regression guard against accidentally scoping it too).
- The diagnostic figure respects `FR-06-13`'s FX-reconciliation exclusion.
- An **open** order (`totalCost` 180) partially written off by a `StoreAccountAdjustmentLine` of 100 contributes only its `openBalanceMinor` (80), not its gross balance (180), to "a pagar este mes" / "deuda viva total" / the "deuda viva" trend.
- A `COMPLETED` order whose entire remaining balance was written off by a `StoreAccountAdjustmentLine` **before** it was delivered contributes `0` to "pagos que no registraste" (its `openBalanceMinor` is already `0`), never its pre-write-off balance; it does not appear among the orders the diagnostic line links into.
- A `COMPLETED` order whose balance was **partially** written off contributes only the post-write-off remainder to "pagos que no registraste".
- "Pagado vs pendiente" continues to read the older, gross per-order balance (`totalCost - allocatedAmountMinor`) even for an order carrying an adjustment line, so its paid-plus-pendiente-equals-committed identity is unaffected by this work order (regression guard against accidentally netting adjustment lines out of that one figure too).
- A `COMPLETED` order with a balance of 180 appears in "pagos que no registraste"; a reconciliation line of 180 is then written **directly against that `COMPLETED` order** (`FRD-05 · WO-11`, round-4 arbitration, G2): its `openBalanceMinor` drops to `0` and it no longer appears among the orders the diagnostic figure sums or links into, with no change to any figure scoped to open orders (`FR-06-02`–`FR-06-05`, `FR-06-21`), since a `COMPLETED` order was never counted there.
- A `COMPLETED` order's balance is written off **partially** (a line smaller than its `openBalanceMinor`) directly against that `COMPLETED` order: "pagos que no registraste" reflects only the post-write-off remainder, the same behavior already covered above for a write-off applied before delivery.

## E2E Acceptance Tests

- A fully delivered order with a lingering balance no longer appears in "a pagar este mes" or "deuda viva total", and instead surfaces in "pagos que no registraste".
- The "pagos que no registraste" line is hidden when its sum is 0.
- Clicking / navigating the diagnostic line reaches the affected orders.
- An order written off entirely in a store reconciliation, then later delivered while still carrying no recorded payment, never appears in "pagos que no registraste": the diagnostic stays a true measure of forgotten payments, not resolved write-offs.
- From the "pagos que no registraste" line, following the link into an affected `COMPLETED` order and reconciling it there directly (`FRD-05 · WO-11`, round-4 arbitration): returning to the dashboard shows that order's balance no longer contributing to the diagnostic figure, with no navigation back through an "open order" state that no longer exists for it.

## Notes

- This work order is a no-op on today's dev data: 0 delivered orders currently carry a balance and 0 reconciliation adjustments exist yet, so the exclusion, the `openBalanceMinor` narrowing, and the diagnostic figure all read the same totals as before, until a future arrival is settled without the payment being recorded or a store account is reconciled.
- Companion work: [`FRD-05 · WO-09`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-09-store-payment-assignment-and-open-order-debt.md) (store-level debt scope and mandatory assignment), [`FRD-05 · WO-10`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md) (the `openBalanceMinor` model), and [`FRD-05 · WO-11`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-11-store-account-reconciliation-action.md) (the "cuadrar cuenta" reconciliation action itself). [`FRD-08 · WO-08`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md) (delivery-triggered settlement) is the feature that, going forward, is meant to keep this diagnostic figure at zero. **(added 2026-08-20, round-4 arbitration, G2):** `WO-11` also lets a reconciliation line target an already-`COMPLETED` order directly, which is a second, more direct way this diagnostic figure gets driven toward zero on the collector's back-catalogue: see `## Technical Notes` and `## Unit Tests` below.
