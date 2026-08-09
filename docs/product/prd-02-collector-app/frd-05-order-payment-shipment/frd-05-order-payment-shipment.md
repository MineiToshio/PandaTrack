---
id: FRD-05
type: FRD
slug: order-payment-shipment
title: Order and Payment Tracking
status: ACTIVE
parent: PRD-02
children:
  - BP-01
  - BP-02
last_updated: 2026-08-08
source_features:
  - FEAT-0014
implementation_status: IMPLEMENTED
---

# FRD-05 Order and Payment Tracking

## Overview

Define the collector-facing order and payment workflow for the PandaTrack MVP.

This FRD covers order creation, item capture, derived totals, per-order exchange-rate context, private notes, payment progress, list/detail surfaces, and the business rules that distinguish an order's financial state from its delivery state.

## Domain Goal

Give collectors one reliable place to record what they bought, what it cost, how much has been paid, and whether the order is still open, partially delivered, completed, or cancelled.

## Current State

### Implemented

- order detail at `/orders/[id]` ([`BP-02 · WO-05`](bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md)): two-column layout on `lg+` (items + private note left; payments + read-only history right, sticky rail), payments panel with optimistic updates, scroll-to-form when opening add-payment, private note; automatic order history is **read-only** (no per-entry delete; see `FR-05-22` / `BR-05-09` below).
- **Store-level payments (2026-08-08, `docs/design/decisions/0025-store-level-payments-declared-allocations.md`):** money is recorded against the **store** (`StorePayment`), with an optional, declared **allocation** to one or more orders/items (`PaymentAllocation`) rather than always to a single order. Adding a payment from the order detail still records amount + date and pre-assigns the whole thing to that order (`FR-05-17`); the **store payment sheet** (`FR-05-42`) authors a payment against several orders/products at once from the orders "Por tienda" view or the store detail page. Per-order payment percentage left the UI (`FR-05-31`, `FR-05-41`); the store's own debt, per currency, is now the primary money figure (`FR-05-43`).
- private app navigation already exposes an `Orders` entry point; pre-orders have no separate nav item or route and live inside that section (`BR-03-02`)
- [`FRD-07`](../frd-07-user-settings/frd-07-user-settings.md) already defines a user-level base currency preference that this domain can consume
- store discovery and store detail flows already exist, which makes store selection a prerequisite rather than a parallel domain problem
- order persistence and human-readable order identifiers (`ORD-YYYYMMDD-NN`)
- create flow as a 3-step wizard (data → products and costs → confirm) with forward gating and free backward navigation, plus a reactive summary rail; edit flow as an all-open form with store and currency locked
- spreadsheet-style item entry with quantity, optional unit price, and optional product type
- required total-cost capture with discrepancy confirmation when item totals do not match (two-option modal — see `FR-05-13`)
- one exchange-rate context per order when order currency differs from the user's base currency, with a "Today" prefill helper backed by the published-rates provider (`FR-05-16`)
- payment records with remaining-balance guidance and delete support; add-payment is an inline expand inside the payments card, and deletions go through a destructive confirmation modal and are awaited (no optimistic update, no undo toast)
- order detail view with inline private note editing (autosave on blur, ~800ms debounce)
- orders list with filters, overdue-delivery signals, and payment-progress summaries; default sort is most-recent first (`FR-05-28`)
- currency reconciliation: `Needs currency update` filter, `pendingFxCount` derived in `getOrdersList`, and the shared `FxReconciliationModal` bulk flow

### Redesign-owned patterns (documented in `docs/design`, not minted as FRs)

- view-transition `order-{id}` between list rows and detail hero; single-primary sticky action bar on detail/create/edit (layout varies by status); `MobilePicker` bottom sheets for store / currency / date-range; amount quick-picks in the payment form ("remaining balance" and "half"); reactive `AsideSummary` in create/edit. See `docs/design/` (interface patterns, components, ADRs) and the order design record `fdd-05-order-payment-shipment.md`.

## User Stories

### US-05-01 Track what I committed to buy

As a collector, I want to save an order with store, dates, currency, and products so I stop depending on memory or chat history.

### US-05-02 Mix quoted totals and itemized totals

As a collector, I want to either enter a full quoted total manually or derive it from item prices so PandaTrack still fits stores that quote orders in different ways.

### US-05-03 Understand what I still owe

As a collector, I want to register payments over time and immediately see the amount assigned to each order and its remaining balance, plus my overall debt with each store, so surprise balances do not catch me off guard.

### US-05-04 Spot risky orders quickly

As a collector, I want the orders list to show overdue estimated-arrival ranges and delivered-but-unpaid cases so I know which orders need attention first.

## Functional Requirements

- `FR-05-01`: The system must use `Order` as the primary tracked transaction entity for the collector workspace.
- `FR-05-02`: An order must belong to exactly one store.
- `FR-05-03`: An order must expose a human-readable identifier in the format `ORD-YYYYMMDD-NN`.
- `FR-05-04`: An order must require an order date and prefill it with the current date on create.
- `FR-05-05`: An order must support an expected delivery date range.
- `FR-05-06`: An order must support one or more order items.
- `FR-05-07`: Each order item must store name and quantity.
- `FR-05-08`: Each order item quantity must default to `1` and must be required.
- `FR-05-08a`: Each order item is an **atomic shippable unit**: it is either fully included in an `entrega` or not included at all. Fractional fulfillment of a single order item across multiple `entrega`s is not supported in the MVP. Collectors who expect units of the same SKU to arrive in separate `entrega`s must register them as separate order items with `quantity = 1`. Quantity greater than `1` is reserved for units that will arrive together. The order form must surface this rule contextually (for example a tooltip in the products section) when at least one order item has `quantity > 1`, so the collector has the chance to split before saving. See `docs/product/glossary.md` for the canonical statement of the rule and the upgrade path if partial fulfillment is later prioritized.
- `FR-05-09`: Each order item may store an optional unit price.
- `FR-05-10`: Each order item may store an optional product type selected from the shared catalog.
- `FR-05-11`: Each order must store a required total cost.
- `FR-05-12`: The system must derive the itemized total as the sum of `quantity x unit price` across all items that have prices.
- `FR-05-13`: When every order item has a unit price and the derived itemized total differs from the entered total cost, the save flow must present a modal that lets the user either go back and correct the order or save with the entered total anyway. **Redesign change (CB-02, 2026-05-17):** the modal now offers **two** options ("Go back and correct" / "Save anyway") instead of three. The "replace with the derived total" option was dropped because the entered total is always authoritative; auto-replacing it created confusion.
- `FR-05-14`: Each order must store an order currency selected by the user.
- `FR-05-15`: The order currency field must default to the user's saved base currency when present.
- `FR-05-16`: When the order currency differs from the user's base currency, the order form must require one exchange-rate value that converts from order currency into base currency. **Redesign note:** the field offers a "Today" prefill helper that calls the published-rates provider (ExchangeRate-API open endpoint, no API key, 5s timeout) from the client to suggest the current rate; the collector can still edit the value. The rate is oriented as "how many base-currency units equal 1 order-currency unit". The provider's terms require a visible credit wherever a fetched rate is shown, so every surface that offers the helper renders one.
- `FR-05-17` **(revised 2026-08-08, store-level payments — ADR 0025):** Order detail must let the user add and delete payment records over time. "Add payment" is an inline expand inside the payments card (not a separate modal); the amount field offers quick-picks for the remaining balance and half of it. What it writes is a **store payment pre-assigned to this order**: `addOrderPayment` keeps its exact name and signature but is now a thin order-scoped wrapper over `createStorePayment`, raising one `StorePayment` with a single `PaymentAllocation` covering the whole amount (narrowed to the order's own item when it has exactly one). A payment that covers more than one order, or names a specific product without covering the whole order, is authored from the **store payment sheet** (`FR-05-42`), not from this inline form.
- `FR-05-18`: Each payment record must store amount and payment date.
- `FR-05-19` **(revised 2026-08-08):** The payment flow must refuse a payment whose amount, once declared against this order, would exceed the order's current remaining balance (`EXCEEDS_BALANCE`), **and** must separately refuse a payment larger than what the collector still owes the order's **store** in that currency (`STORE_DEBT_EXCEEDED`, `FR-05-43`). Both ceilings are checked inside the same transaction, before any write (ADR 0022).
- `FR-05-20` **(revised 2026-08-08):** The order detail view must show the amount **assigned** to this order (`Order.allocatedAmountMinor`: the sum of this order's `PaymentAllocation` rows) against its total, and the remaining unassigned balance. A per-order payment **percentage** is no longer shown as a standalone figure; the hero instead shows "Asignado {X} de {Y}" with a progress bar while something is assigned, or a link into the store's own debt when nothing is (`FR-05-41`).
- `FR-05-21`: The order detail view must expose one inline-editable private note field that can be saved without entering full order edit mode, including saving an empty value to clear the note. **Redesign note:** the note autosaves on blur with a ~800ms debounce and shows a "saved Ns ago" indicator; the save waits for server confirmation (not optimistic).
- `FR-05-22`: The order detail view must expose an automatic history list that records major order lifecycle events. **As implemented (2026-04-24):** the list is **read-only**; users cannot delete individual history entries from the UI (aligned with [`WO-05`](bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md) and migration `20260423000000_simplify_order_history_event_types`).
- `FR-05-23`: The order detail view must expose `Create delivery` as the primary action plus secondary affordances for `Edit`, `View store`, `Cancel`, and `Delete` as appropriate for the order status. **Redesign change (ADR 0011, 2026-05-12):** the secondary affordances are presented as an inline "Actions" card at the foot of the detail scroll (action rows: Edit, Cancel, Delete in red), not as a split button or an overflow (`⋯`) trigger in the header. This applies on both desktop and mobile.
- `FR-05-24`: An order may be physically deleted only when none of its items is linked to a non-cancelled delivery. When the rule is not met, the delete affordance must be rendered as disabled with a tooltip that explains the collector must first unlink the affected items from their delivery.
- `FR-05-25`: An order may be cancelled only when none of its items is linked to a non-cancelled delivery. When the rule is not met, the cancel affordance must be rendered as disabled with a tooltip that explains the collector must first unlink the affected items from their delivery. Cancelling an order moves it to `CANCELLED` without removing its historical record.
- `FR-05-26`: The orders list must support filters for order-date range, store, product type, status, and free-text product-name matching.
- `FR-05-27`: Orders list filters must persist in the URL and render removable chips in the same interaction pattern used by `Stores`.
- `FR-05-28`: The orders list must sort by **most recent order date first by default**. **Redesign change (CB-01):** the original default was oldest-first; it was flipped because collectors manage recent orders first while older ones are usually closed. (The sort control still offers oldest-first and other options.)
- `FR-05-29`: Each order card in the list must show store identity, order date, status, expected delivery range, total cost, and payment progress.
- `FR-05-30`: The orders list must visually indicate when an order has passed its expected delivery range without being completed.
- `FR-05-31` **(revised 2026-08-08, store-level payments):** Each order card must expand to show the order items associated with the order. The collapsed card no longer carries a payment-progress bar, a paid-versus-total percentage, or a payment-state filter pill: individual payment records (declared allocations) are accessible from the order detail view, and the aggregate per-store, per-currency debt is accessible from the orders list's "Por tienda" view (`FR-05-44`) and the store detail page. The list still shows a **"Pago completado"** success chip, but only once (`FR-05-35`).
- `FR-05-32`: Order status must be derived from fulfillment outcomes rather than directly edited by the user.
- `FR-05-33` **(revised 2026-08-08):** Payment state must remain conceptually distinct from order fulfillment state. Under store-level payments, "payment state" for an order means how much money is **assigned** to it (`Order.allocatedAmountMinor`), not a percentage computed against a payment ledger that belongs to the order; it is still never persisted as, or allowed to influence, `OrderStatus`.
- `FR-05-34` **(revised 2026-08-08):** When all products linked to an order are delivered, the order must move to `COMPLETED` even if it still has money outstanding (`allocatedAmountMinor < totalCost`).
- `FR-05-35` **(revised 2026-08-08):** Completed orders with money outstanding must still show a visible unpaid signal in both list and detail surfaces. The "paid" signal (list chip, detail "Pago completado" chip) fires only when the order is **fully assigned** (`allocatedAmountMinor >= totalCost`), never at a partial percentage — there is no "mostly paid" success state under this model.
- `FR-05-36`: The orders workspace must support a `Needs currency update` filter that returns orders requiring exchange-rate reconciliation to the collector's current base currency.
- `FR-05-37`: Exchange-rate reconciliation eligibility must be based on budget-impact periods from the current month onward, not only order status; completed orders that still impact current/future payment periods remain eligible.
- `FR-05-38`: When the collector changes base currency, the product must support bulk exchange-rate reconciliation grouped by currency pair (`from -> to`) and allow deferring reconciliation for manual per-order updates later.
- `FR-05-39`: The collector must be able to flip each order item between `pending in store` (`NONE`) and `ready at store` (`ARRIVED_AT_STORE`) directly from the item's state chip, **on the order detail and on the orders list alike, in both the card and the table layout** _(list surfaces added 2026-08-05)_, as a pre-delivery readiness marker. The toggle is available only while the item is **not** linked to a non-cancelled delivery and the order is **not** `CANCELLED`; in those cases the pill is read-only with an explanatory disabled label (delivery-owned `in_transit` / `delivered` states must not be editable from the order, and a cancelled order is frozen). This state is the same `OrderItemDeliveryState` that delivery eligibility reads (`NONE` / `ARRIVED_AT_STORE` are both eligible) and that `FRD-08` consumes; flipping it does not by itself change the derived `OrderStatus` (both values map to `open`).
- `FR-05-39a`: The list chip is the control, not a second affordance beside it. Marking a product ready is a one-bit change a collector usually makes for several products in a row, and routing it through the order detail cost a navigation and a return trip each time; a separate button next to the chip would have said the same thing twice. The mutation is optimistic on both surfaces (`optimistic-client-updates.mdc`) and reverts on failure, because the round trip is the whole interaction when several are flipped in sequence. On the card, where the entire surface is a link to the order, the chip must not navigate.
- `FR-05-40` **(revised 2026-08-08):** The edit flow must refuse to lower an order's `totalCost` below its own `allocatedAmountMinor` (the sum of `PaymentAllocation` rows declared against it, not the store's whole payment ledger). The form blocks it client-side and the `editOrder` mutation enforces the same guard server-side (rejecting with `TOTAL_BELOW_PAID`), so the remaining/unassigned amount can never be driven negative. To reduce the total past what is assigned, the collector must first delete or reduce the relevant declarations.

### Store-level payments (added 2026-08-08 — see `docs/design/decisions/0025-store-level-payments-declared-allocations.md`)

- `FR-05-41`: The order detail hero must show, below the order's total, either (a) "Asignado {X} de {Y}" plus a progress bar (`allocated/total`) when this order has at least one `PaymentAllocation`, or (b) a link into the store's own debt in this order's currency ("Deuda de la tienda: {Z}", or "A favor: {|Z|}" in the success tone when the store owes the collector instead) when it has none. A "Pago completado" chip joins the status chips once `allocatedAmountMinor >= totalCost` (`FR-05-35`).
- `FR-05-42`: The product must offer a **store payment sheet** (`StorePaymentSheet`) that records one payment against a store and lets the collector declare it across any number of that store's standing orders and, within each order, any number of its products, in the same submission. Each order line and each product line accepts either a typed amount or a "Saldado" toggle that declares the target covered without naming an amount (`settlesTarget`). The sheet is reachable from the orders list "Por tienda" view (`FR-05-44`, one entry point per store group) and from the store detail page's "Registrar pago" action (a store-domain surface owned by `FRD-04`, not yet documented there — see the note below); it is not offered from the order detail, which keeps the simpler single-order inline form (`FR-05-17`).
- `FR-05-43` **(revised 2026-08-09):** A payment's own amount must never exceed what the collector currently owes its store in the payment's currency (`StoreDebtRow.debtMinor` = Σ `totalCost` of the store's non-cancelled orders − (Σ the store's payments − Σ `PaymentAllocation.amountMinor` left declared against one of the store's own `CANCELLED` orders, i.e. money kept as `lost` at cancel time per `BR-05-15`), in that currency); exceeding it is refused (`STORE_DEBT_EXCEEDED`) rather than silently accepted as a further credit. Money left declared lost against a cancelled order is sunk, not available to cover the store's other orders, so it must not read as paid-down debt (bug found in real data: a store showed "a favor" while its lost money was simultaneously counted in the dashboard's "Perdido en cancelados" figure). Independently, the sum of everything declared in the sheet must never exceed the payment's own amount (`ALLOCATION_SUM_EXCEEDS_PAYMENT`), and each order/product line must never exceed that order's/product's own remaining balance (`EXCEEDS_BALANCE` / `EXCEEDS_ITEM_BASE`).
- `FR-05-44`: The orders list must offer a second view, **"Por tienda"** (`?view=store`, remembered per collector via a cookie once chosen, alongside the classic "Por pedido" list), that groups every pending product (a product on a non-`CANCELLED`, non-`COMPLETED` order that has not itself been delivered) by store, with the store's own debt per currency and a "Registrar pago" entry point into the store payment sheet (`FR-05-42`) per group. Sorting is two-level: products order within their store first (default "Llegada más próxima": soonest expected arrival first, no-date last), then stores order by an aggregate of their own already-sorted products (also available: recent/oldest by order date, store name A–Z/Z–A, highest debt first). The order date on each row is a link into that order's detail.
- `FR-05-45`: The order create flow must offer an optional "¿Pagaste algo hoy?" step (in the confirm step of the wizard) with quick options "Pagué todo" / "Adelanto", an amount field, and a payment-date field (defaulting to today). Submitting it creates the order and, in the same request, records a store payment pre-assigned to the just-created order (mirroring `FR-05-17`'s single-order allocation shape); the amount must not exceed the order's own total and the payment date must not be before the order date.
- `FR-05-46`: The edit flow must refuse to change an order's store or currency while the order carries at least one `PaymentAllocation` (`STORE_CHANGE_BLOCKED`, `CURRENCY_CHANGE_BLOCKED` — extending the existing store-change guard, `BR-05-11`, to also key off allocations, not only deliveries/status), must refuse to remove an item that carries an allocation (`ITEM_HAS_ALLOCATION`), and must refuse to lower an item's own price below what is already declared against it (`ITEM_PRICE_BELOW_ALLOCATED`). A payment belongs to one store and one currency; letting a declared-against order or item move out from under it would strand the declaration against a store, currency, or price it no longer describes.

## Business Rules

- `BR-05-01`: `Open` is the initial order state.
- `BR-05-02`: Order states for MVP are `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `COMPLETED`, and `CANCELLED`. States are derived in priority order: `COMPLETED` → `PARTIALLY_DELIVERED` → `IN_TRANSIT` → `PARTIALLY_IN_TRANSIT` → `OPEN`. `CANCELLED` is set by the cancel mutation and does not re-derive. See WO-02 for the full derivation algorithm and `deriveOrderStatus` function contract.
- `BR-05-03`: Order status is system-derived and must not be edited directly through a status field.
- `BR-05-04`: The order item spreadsheet should prioritize keyboard entry and support row addition plus cell navigation.
- `BR-05-05`: Unit price remains optional because some stores quote only a single order-level total.
- `BR-05-06`: The discrepancy modal should appear only when every item has a unit price and the derived total differs from the manually entered total.
- `BR-05-07`: One exchange-rate value per order is sufficient for MVP and applies to reporting derived from that order.
- `BR-05-08`: Notes are user-authored free text and are separate from automatic history.
- `BR-05-09`: Automatic history entries are system-owned audit-style records. **As implemented (2026-04-24):** the product does **not** offer per-entry delete for history on the order detail view; the collector cannot remove individual rows from the automatic history list.
- `BR-05-10`: Payments may be deleted and the paid-versus-remaining summary must recalculate immediately after deletion. **As implemented:** deletion is guarded by a destructive confirmation modal (`role="alertdialog"`) on the pay-row and is awaited — the row is removed and the summary recalculates only after the server confirms. There is no optimistic delete and no undo toast. **Updated (2026-08-08, store-level payments):** what is deleted is this order's **declaration**, not necessarily the underlying payment. `deleteOrderPayment` removes the whole `StorePayment` whenever this order's allocation is its **sole remaining one**, regardless of whether that allocation covers the payment's full amount: a payment whose only allocation is a partial claim still has nothing else pointing at it once that allocation goes, so leaving it behind would strand it as a payment the order-detail screen can no longer reach or delete (the store detail "Pagos a esta tienda" card, `FRD-04 · FR-04-58`, is the only other door onto it). A payment **shared** with other orders survives, losing only this order's slice. The pay-row's delete-confirm copy has three variants selected by `OrderPaymentRow`: a 1:1 exact allocation (sole claim covering the full amount) uses the plain "delete this payment" copy; a shared allocation (`isShared`) states the payment itself and its other orders' declarations are kept ("Se quita la parte de {amount} asignada a este pedido. El pago de {paymentTotal} a {store} se conserva."); a sole-but-partial allocation (`isPartialClaim`) states the whole payment, including its unassigned remainder, is going ("Se eliminará el pago completo de {paymentTotal} a {store}, incluida la parte sin asignar.") — and the row's own subtitle names the payment's full amount in that case too, so the amount shown is never mistaken for the payment's entire amount.
- `BR-05-11`: Changing an order's store is allowed only while the order remains `OPEN` and has no associated deliveries.
- `BR-05-12`: Cancelled orders remain visible in historical lists and filter results when the chosen filters include them.
- `BR-05-15`: Cancellation **preserves** money declared against the order (the order is archived, not destroyed), and does not cascade into deliveries because cancellation is only permitted when no item is linked to a non-cancelled delivery (`FR-05-25`). Physical **deletion** is the destructive path: it follows the same eligibility rule (`FR-05-24`) and, when permitted, cascades payment declarations, history, and any residual links to already-cancelled deliveries together with the order row. **As implemented (`cancelOrder` / `deleteOrder` in `src/lib/data/orders/orderMutations.ts`):** cancel keeps declarations so the reactivate flow (`BR-05-17`) can show the payment trail; only delete removes them. **Updated (2026-08-08, store-level payments — supersedes the 2026-07-20 "keep/remove" wording below for mechanics; the underlying decision is unchanged, see [`decision-cancelled-order-payments.md` §8](../frd-06-dashboard/decision-cancelled-order-payments.md)):** cancel offers an explicit choice, `paymentsChoice`, between **`lost`** and **`credit`** (**`credit` is now the default** — most cancellations free money to cover another order at the same store, which is the safe, no-friction case under this model). `lost` leaves this order's `PaymentAllocation` rows untouched, still pointing at the now-cancelled order — the money reads as sunk, surfaced in FRD-06's dedicated "lost on cancelled" figure (`BR-06-10`). `credit` deletes this order's `PaymentAllocation` rows and resets `Order.allocatedAmountMinor` to `0`; the underlying `StorePayment` **survives** (payments are never deleted on cancel under this model — only the declaration is), now available as undeclared money against the store (visible as its debt going back up, or its "a favor" growing). Neither branch touches any other order's declarations against the same payment. ~~**Updated (2026-07-20, owner-approved):** cancel now offers an explicit keep/remove choice for payments. Keep (default) preserves them exactly as before... Remove deletes this order's `OrderPayment` rows inside the cancel transaction and resets the denormalized payment cache (`paidAmountMinor`/`paymentPercent`) to 0...~~ (superseded by the paragraph above; the `OrderPayment` table and its cache are frozen, not written to, under store-level payments — see `docs/design/decisions/0025-store-level-payments-declared-allocations.md`).
- `BR-05-16`: Cancel and delete require a confirmation modal that names the order. Only the **delete** modal states that the order's payments and history will be removed (delete is irreversible — see the FDD delete-modal copy); the **cancel** modal does not promise payment removal because cancellation preserves the underlying `StorePayment` either way (`BR-05-15`). The delete modal additionally gates its CTA behind a type-to-confirm input (the literal `"eliminar"`). Neither modal mentions delivery-link removal because the cancel/delete affordances are disabled (with an explanatory tooltip) when non-cancelled delivery links exist. **Updated (2026-08-08):** when the order has at least one payment allocation, the cancel modal renders a **`credit` (default) / `lost`** radio choice ("Queda a favor de {tienda}" / "Lo doy por perdido") above the reason field, with its question copy stating the assigned amount ("Pagaste {amount} de este pedido. ¿Qué hacemos con ese dinero?"); orders with no allocation cancel exactly as before, with no new friction. (Supersedes the 2026-07-20 "keep (default) / remove" radio wording — same UI slot, new choice names and new default, per `BR-05-15`.)
- `BR-05-17`: An order in `CANCELLED` state may be returned to `OPEN` without preconditions. Declarations kept at cancel time (`lost`) are preserved through cancellation (`BR-05-15`), so they remain attached to the order and stay visible after reactivation; declarations removed at cancel time (`credit`) do not reappear on this order, though the collector may re-declare the same (still-existing) `StorePayment` against it again from the order detail or the store payment sheet. **Redesign note:** reactivation runs directly without a confirmation modal because it is a reversible action.
- `BR-05-18`: Physical deletion of an order is blocked whenever at least one of its items is linked to a non-cancelled delivery, matching the cancel eligibility rule. The collector must unlink the affected items from their delivery before deleting or cancelling the order.
- `BR-05-13`: The `Needs currency update` indicator must represent reconciliation state against the collector's current base currency rather than a simple order-status proxy.
- `BR-05-14`: Bulk reconciliation may apply one entered rate to all affected orders within the same currency pair, while preserving order-level manual edits when the user chooses to defer.

## Acceptance Criteria

### `AC-05-01`

- Given a collector creates a new order
- When the create form opens
- Then the form prefills the order date with the current date
- And the currency defaults to the user's base currency when available

### `AC-05-02`

- Given an order contains quantities and unit prices for every item
- When the user saves a total cost that differs from the derived total
- Then the app shows the discrepancy modal
- And the user can either go back and correct the order or save with the entered total anyway (the entered total is authoritative; see `FR-05-13`)

### `AC-05-03`

- Given an order has an unassigned balance
- When the user adds valid payment records over time
- Then the detail view updates the assigned amount and remaining balance
- And a payment larger than the remaining balance, or larger than the store's own debt, is rejected

### `AC-05-04`

- Given an order is fully delivered but not fully paid
- When the collector views either the list or the detail page
- Then the order shows `COMPLETED`
- And the UI still exposes a clear unpaid warning

### `AC-05-05`

- Given the collector filters the orders workspace
- When they choose store, product type, status, date range, or product-name search inputs
- Then the resulting URL reflects those filters
- And the UI shows removable chips matching the active filter state

### `AC-05-06`

- Given the collector changed base currency
- When they open the orders workspace with pending reconciliation
- Then they can filter affected records using `Needs currency update`
- And completed orders are included when they still impact current or future budget periods

### `AC-05-07`

- Given there are affected orders from multiple source currencies after a base-currency change
- When the collector opens bulk reconciliation
- Then the flow groups updates by currency pair and allows applying one rate per group
- And if the collector skips reconciliation, those orders remain available for manual per-order updates later

## Implementation Notes

- This FRD consumes base-currency settings from [`FRD-07`](../frd-07-user-settings/frd-07-user-settings.md).
- Order status derivation is owned by this FRD via the pure `deriveOrderStatus` function defined in [`BP-01 · WO-02`](bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md). The function takes item delivery associations as input and returns the computed `OrderStatus`. [`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md) is responsible for invoking `deriveOrderStatus` and persisting the result whenever a delivery state change affects items linked to an order.
- Recorded order totals, item prices, and payment rows remain denominated in the **order currency** (`FR-05-14`); changing the collector's base currency in settings does not rewrite stored order rows. Per-order exchange-rate context (`FR-05-16`, `BR-05-07`) is interpreted relative to the base currency **at the time the order was saved**, which matters for dashboard rollups ([`FR-06-13`](../frd-06-dashboard/frd-06-dashboard.md#functional-requirements); [`FRD-06`](../frd-06-dashboard/frd-06-dashboard.md)).
- The orders list exposes filter label `Needs currency update`, chip label `Currency update needed`, and query-state parameter `fxPending=true`. FX-pending eligibility is **derived**, never stored: an order is pending when its stored `exchangeRate` cannot convert it into the collector's current base currency (`buildNeedsFxReconciliationWhere` in `src/lib/fx/reconciliation.ts`), plus `status != CANCELLED`. The implementation (`FR-05-36`, `FR-05-37`, `FR-05-38`) is owned by [`BP-02 · WO-07`](bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md). As shipped, `FxReconciliationModal` lives at `src/app/[locale]/(app)/orders/_components/FxReconciliationModal.tsx` (rendered via `FxAnnouncer`) and is triggered from the orders list banner. The Settings currency-change in [**FRD-07 · BP-01 · WO-05**](../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-05-preferences-currency-country-product-types-and-budget.md) writes nothing to orders; it simply moves the base currency the derivation is evaluated against, and offers the optional shortcut to the orders list to reconcile.
- Store selection should reuse the existing shared searchable-select interaction pattern rather than invent a new picker.
- The order identifier format should remain stable across locales even if the human-readable date display changes.
- Orders and deliveries should use expandable cards rather than dense tables because the card format better fits status signals, actions, and mobile layouts.
- The difference between order fulfillment and payment status must remain explicit so dashboard logic can later reason about them independently.

## Lifecycle Interaction Model

Each detail action has a distinct confirmation and feedback contract. The visual treatment of toasts, the undo affordance, the inline Acciones card, and the mobile sticky-bar chrome are owned by the [order FDD](fdd-05-order-payment-shipment.md); this section fixes only the functional behavior. (Mirrors the FRD-08 model so the two workspaces stay consistent.)

| Action                | Confirmation                                                                                                                                           | Apply / feedback model                                                                                                                                                                                                                            | Post-action target                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Save private note     | none (inline autosave on blur, ~800ms debounce)                                                                                                        | **not optimistic** — waits for server confirmation, then shows `"Guardada hace Ns"`; a `NOTE_SAVED` / `NOTE_DELETED` event fires only when the stored value actually changed                                                                      | stays on detail                                    |
| Add payment           | none (inline expand in the Pagos card; mobile sheet)                                                                                                   | optimistic; the hero/ledger update locally and revert with a toast on failure; clearing the balance fires a celebratory toast                                                                                                                     | stays on detail                                    |
| Delete payment        | confirmation modal (`tone-destructive`, `role="alertdialog"`) on the pay-row delete button                                                             | awaited (not optimistic): the modal stays open until the server confirms, then the row is removed and the paid/remaining summary recalculates; no undo affordance                                                                                 | stays on detail                                    |
| Toggle item readiness | none (direct on the item state pill)                                                                                                                   | optimistic flip `NONE` ↔ `ARRIVED_AT_STORE`; reverts on failure                                                                                                                                                                                   | stays on detail                                    |
| Cancel                | confirmation modal (`tone-warning`; optional reason; `credit`/`lost` payments choice when the order carries at least one allocation, `credit` default) | optimistic confirmation: the modal closes on submit and the cancelled state shows immediately; rolls back on failure. **Money is treated as lost and stays declared (`lost`), or is freed as store credit (`credit`, default) — see `BR-05-15`.** | stays on detail                                    |
| Reactivate            | none (reversible, `BR-05-17`)                                                                                                                          | executes directly; returns the order to `OPEN` and re-derives the FX-pending count naturally                                                                                                                                                      | stays on detail                                    |
| Delete                | confirmation modal (`tone-destructive`; type-to-confirm)                                                                                               | awaited (not optimistic, because it is irreversible): the modal stays until the server confirms                                                                                                                                                   | redirects to the orders list                       |
| Edit                  | (separate `/[id]/edit` route)                                                                                                                          | discard-changes guard modal on cancel-with-pending-changes; save is awaited                                                                                                                                                                       | back to detail                                     |
| Create delivery       | (navigates to `FRD-08` create flow)                                                                                                                    | navigation only — no order mutation                                                                                                                                                                                                               | delivery create (`/deliveries/new?sourceOrderId=`) |

Disabled-action rules: `Cancelar` and `Eliminar` share one eligibility gate (`FR-05-24` / `FR-05-25`) — both render disabled with a `title` tooltip when any item is linked to a non-cancelled delivery. In `CANCELLED` state, `Editar` and `Crear entrega` are disabled with an explanatory helper, and `Cancelar` is absent (the order is already cancelled). A `COMPLETED` order has no `Cancelar`.

## Error Contract

Order mutations return typed, expected error codes (string results, not exceptions) so flows can recover without noisy monitoring; unexpected failures are caught once with `Sentry.captureException` and surfaced as `server_error`. Every action also returns `unauthorized` when there is no session. The Zod validation layer (`src/lib/orders/orderValidation.ts`) rejects malformed input before the mutation runs (returning `validation`). Expected domain codes by mutation:

- **create order** (`createOrder`): `STORE_NOT_FOUND`, `INVALID_PRODUCT_TYPE`. With an `initialPayment` (`FR-05-45`), also every `addOrderPayment` code below, mapped back through the same create call.
- **edit order** (`editOrder`): `ORDER_NOT_FOUND`, `ORDER_NOT_EDITABLE` (the order is `CANCELLED`), `STORE_NOT_FOUND`, `STORE_CHANGE_BLOCKED` (store change attempted while the order is not `OPEN`, already has delivery links, or carries a `PaymentAllocation`, per `BR-05-11` and `FR-05-46`), `CURRENCY_CHANGE_BLOCKED` (currency change attempted while the order carries a `PaymentAllocation`, `FR-05-46`), `INVALID_PRODUCT_TYPE`, `ITEM_HAS_LIVE_DELIVERY` (an edited/removed item is linked to a non-cancelled delivery), `ITEM_HAS_ALLOCATION` (a removed item carries a `PaymentAllocation`, `FR-05-46`), `ITEM_PRICE_BELOW_ALLOCATED` (an item's price would drop below what is already declared against it, `FR-05-46`), `TOTAL_BELOW_PAID` (total would drop below `allocatedAmountMinor`, `FR-05-40`).
- **cancel order** (`cancelOrder`): `ORDER_NOT_FOUND`, `HAS_LIVE_DELIVERY_LINKS` (`FR-05-25`). Takes a `paymentsChoice` of `"lost"` or `"credit"` (`BR-05-15`); neither branch produces its own error code.
- **delete order** (`deleteOrder`): `ORDER_NOT_FOUND`, `HAS_LIVE_DELIVERY_LINKS` (`FR-05-24`).
- **reactivate order** (`reactivateOrder`): `ORDER_NOT_FOUND`, `ORDER_NOT_CANCELLED` (only a `CANCELLED` order may be reactivated).
- **add payment** (`addOrderPayment`, order-scoped wrapper over `createStorePayment` — `FR-05-17`): `ORDER_NOT_FOUND`, `EXCEEDS_BALANCE` (declared amount would exceed this order's remaining balance, `FR-05-19`), `STORE_DEBT_EXCEEDED` (payment amount would exceed the store's own debt in that currency, `FR-05-43`; surfaced to this caller as `EXCEEDS_BALANCE`), `AMOUNT_INVALID`, `AMOUNT_FRACTIONAL_SUBUNITS` (a zero-decimal currency received a fractional amount), `DATE_BEFORE_ORDER` (payment date earlier than the order date), `ORDER_CANCELLED`.
- **delete payment** (`deleteOrderPayment`): `NOT_FOUND`.
- **create store payment** (`createStorePayment`, the sheet's own mutation — `FR-05-42`): `AMOUNT_INVALID`, `AMOUNT_FRACTIONAL_SUBUNITS`, `STORE_NOT_FOUND`, `CURRENCY_REQUIRED` (the store has standing orders in more than one currency and none was named), `STORE_DEBT_EXCEEDED` (`FR-05-43`), `ALLOCATION_SUM_EXCEEDS_PAYMENT`, `ORDER_NOT_FOUND`, `STORE_MISMATCH` (a declared order belongs to a different store), `ORDER_CANCELLED`, `CURRENCY_MISMATCH`, `ALLOCATION_AMOUNT_INVALID`, `EXCEEDS_BALANCE`, `ITEM_ORDER_MISMATCH`, `EXCEEDS_ITEM_BASE`, `DATE_BEFORE_ORDER`.
- **delete store payment** (`deleteStorePayment`): `NOT_FOUND`.
- **toggle item readiness** (`setOrderItemArrivedAtStore`): `ITEM_NOT_FOUND`, `ITEM_HAS_LIVE_DELIVERY` (delivery owns the state), `ORDER_CANCELLED`.
- **save note** (`saveOrderNote`): `ORDER_NOT_FOUND`.
- **bulk FX reconciliation** (`updateExchangeRatesAction`): `unauthorized`, `invalid` (Zod: 1–500 updates, each a positive finite rate), `server_error`.

Every refusal above is decided before the mutation's first write, inside its own `$transaction` (ADR 0022); none of these codes can be produced after money has already been persisted.

Validation-layer bounds (Zod, rejected as `validation` before the mutation): `totalCost` integer in `[1, 999_999_999]` minor units; payment `amount` integer in `[1, 999_999_999]`; `exchangeRate` in `[0.01, 99_999.99]` with two-decimal precision; `currencyCode` length-3 and on the collector base-currency allowlist; order item `name` 1–500 chars, `quantity` integer `>= 1`, `unitPrice` non-negative integer or null; `expectedDeliveryTo` not before `expectedDeliveryFrom` (`DELIVERY_TO_BEFORE_FROM`); payment date not in the future (`PAYMENT_DATE_IN_FUTURE`); note `<= 2000` chars; cancellation reason truncated to 500 chars.

## Analytics

Order events are namespaced under `POSTHOG_EVENTS.ORDER` in `src/lib/constants.ts`. Mutation events carry an `orderId` (and `itemId` / `hasReason` where relevant) but never the free-text note or cancellation-reason value.

- create / edit flow: `order_created`, `order_edited`, `order_create_discarded`, `order_discrepancy_modal_opened`, `order_discrepancy_resolved`
- payments: `order_payment_added`, `order_payment_deleted`
- lifecycle: `order_cancelled`, `order_deleted`, `order_reactivated`
- item readiness: `order_item_marked_arrived`, `order_item_reverted_pending`
- note: `order_note_saved`, `order_note_deleted` (emitted only when the stored value actually changed)
- detail navigation / chrome: `order_create_delivery_clicked`, `order_view_store_clicked`, `order_detail_more_menu_opened`, `order_detail_sticky_primary_clicked`
- list: `orders_list_filtered`, `orders_list_filter_chip_removed`, `orders_list_filters_reset`, `orders_list_card_expanded`, `orders_list_card_collapsed`, `orders_list_page_changed`

(The FX reconciliation flow is not separately instrumented under `POSTHOG_EVENTS.ORDER`; it is surfaced via the list FX banner and the shared `FxReconciliationModal`.)

**Store payment sheet (added 2026-08-08, `FR-05-42`):** instrumented under `POSTHOG_EVENTS.STORE` (owned by `FRD-04`, not this FRD, since the sheet is a store-level surface reachable from both the orders "Por tienda" view and the store detail page): `store_payment_sheet_opened`, `store_payment_registered`.

## Screens and Data Contract

Each order route lives under `/{locale}/(app)/orders`. All routes are authenticated: a missing session redirects to `/{locale}/sign-in`. An order that does not belong to the session user resolves to **404** (`notFound()`), never 403, to avoid enumeration. Visual layout is owned by the [FDD](fdd-05-order-payment-shipment.md); this section fixes purpose, data loaded, actions, and states.

### List — `/{locale}/orders`

- **Purpose:** the central collector workspace, opened on the most-recent orders.
- **Data loaded:** chrome first (renders instantly): `getOrderStoreOptions(userId)` (distinct stores the user has orders with, independent of current orderability — mirrors `getDeliveryStoreOptions`) for the filter drawer/chips, plus a suspended heading count (`prisma.order.count` total and closed `COMPLETED`/`CANCELLED`). The suspended data region loads `getOrdersList(userId, filters)` (paginated, 25/page by default — `ORDER_LIST_PAGE_SIZE` = `DEFAULT_PAGE_SIZE`, user-selectable among 10/25/50/100 — `PAGE_SIZE_OPTIONS` — via `?perPage=`; **updated 2026-07-23, owner-approved**, replaces the earlier fixed `30`/page, see [ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)) which also returns `pendingFxCount`, and the user's `baseCurrencyCode`. When `pendingFxCount > 0`, it additionally fetches up to 500 FX-pending orders (`id`, `humanReadableId`, `totalCost`, `currencyCode`) to seed the reconciliation modal.
- **View toggle (`FR-05-44`, added 2026-08-08):** `?view=order` (default, "Por pedido") or `?view=store` ("Por tienda"); the collector's last choice is remembered via the `ORDER_LIST_VIEW_COOKIE_NAME` cookie, read server-side so the default renders with no client flash. `view=order` renders everything below; `view=store` renders `getPendingProductsByStore(userId)` instead (not paginated — see `FR-05-44` and the pagination-exception note in `docs/design/decisions/0025-store-level-payments-declared-allocations.md`), grouped and two-level sorted by its own `?sort=` domain (`arrival-asc` default, `recent`, `oldest`, `store-asc`, `store-desc`, `total-desc` — a distinct value set from the order-view sort below, sharing the same query param).
- **Filters (URL params, `view=order` only):** `q` (product name / `ORD-…` order code / store name), `productType[]`, `store`, `status[]`, `dateFrom`/`dateTo` (order date), and a single delivery-date mode — `deliveryFrom`/`deliveryTo` (expected-delivery overlap), `delOverdue=true` ("Por recibir": window started and still pending, i.e. in-window or overdue), **or** `delLate=true` ("Entrega atrasada": window fully closed and still pending, the strict overdue subset that mirrors the dashboard's "Atrasados" tab). The three delivery modes are mutually exclusive; the drawer surfaces "Por recibir" and "Entrega atrasada" as a deselectable single-select chip pair (both-off is valid), worded to distinguish "Entrega atrasada" from the delivery-overdue state. Also `fxPending=true`, and `sort`. **Status is never auto-applied** — the "Solo activas" entry point hard-codes the four active statuses (`OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`) in its href; a bare `/orders` URL applies no status filter. Sort options: `recent` (default, omitted from the URL), `oldest`, `store-asc`, `store-desc`, `total-desc`. All are native SQL orderings. Every ordering ends in a unique tiebreaker (`id asc`), without which tied rows can reshuffle between two paginated queries and a row is dropped from one page and repeated on the next. _(2026-08-06: `store-desc` added. The set previously offered one direction per dimension, so a collector could ask for `Tienda A–Z` but never `Z–A`.)_ **Removed 2026-08-08 (store-level payments, `FR-05-31`/`FR-05-44`):** the `payment[]` filter (`paid`/`partial`/`unpaid`/`overdue`) and the `payment-asc` sort value are gone — a bare `?payment=` or `?sort=payment-asc` in an old bookmark is silently ignored rather than erroring, falling back to the default. Store debt is now surfaced by the "Por tienda" view instead of a per-order payment-state filter.
- **Actions:** navigation only — `Nuevo pedido` → `/new`; each row/card → detail carrying the current list URL via `?returnTo=`. The FX banner opens the bulk reconciliation modal (`updateExchangeRatesAction`). In `view=store`, each group's "Registrar pago" opens the store payment sheet (`FR-05-42`), the one mutation-capable action on this route. No order mutation happens on `view=order`.
- **States:** chrome renders immediately; the data region shows a layout-matching skeleton (table desktop / cards mobile in `view=order`, group skeleton in `view=store`, `aria-busy`). Empty initial (`MascotBubble sleeping`, create CTA); empty-filtered (`MascotBubble confused`, "Limpiar filtros" → bare `/orders`, chips/toolbar retained); `view=store` has its own empty state (no store has a pending product).

### Detail — `/{locale}/orders/[id]` (optional `?returnTo=`)

- **Purpose:** inspect one order, track payments, run lifecycle actions, and launch delivery creation.
- **Data loaded:** `getOrderDetail(orderId, userId)` → order summary, store `{id,name,slug}`, items with a derived per-item `deliveryState` (`open` / `arrived_at_store` / `in_transit` / `delivered`, computed from non-cancelled delivery links + own `OrderItem.deliveryState`), payments (allocations mapped to `paidAmount` / `remainingAmount` / `paymentPercentage` / `hasUnpaidBalance` — `paidAmount` here means **assigned**, `Order.allocatedAmountMinor`), read-only history (newest-first), `eligibility` (`canDelete` / `canCancel` / `blockReason`), and `flags` (`hasPayments`: at least one `PaymentAllocation`; `hasNonCancelledDeliveryLinks`); plus the user's `baseCurrencyCode` for FX display. **Added 2026-08-08:** the page separately loads `getStoreDebtByCurrency(userId, order.storeId)` and passes the store's debt in this order's own currency (`storeDebtMinor`) into the hero, only surfaced when the order itself has no allocation yet (`FR-05-41`). A `returnTo` is sanitized via `safeRelativeReturnTo` and threaded into the back link and downstream store/edit links.
- **Actions:** `addPaymentAction`, `deletePaymentAction`, `setOrderItemArrivedAction`, `saveOrderNoteAction`, `cancelOrderAction`, `reactivateOrderAction`, `deleteOrderAction` (behavior per Lifecycle Interaction Model); `Editar` → `/[id]/edit`; `Crear entrega` → the `FRD-08` create flow; `Ver tienda` → the store page (with `returnTo`).
- **States:** per-status hero (active / overdue / partially-paid / completed-unpaid / cancelled — see the FDD per-state table); read-only History subcard (desktop only); disabled-action helpers for the cancelled and delivery-linked cases; route loading skeleton (`loading.tsx`); 404 when the order is not owned.

### Create — `/{locale}/orders/new` (optional store context, e.g. `?storeId=`)

- **Purpose:** create one store-scoped order via the 3-step wizard (Datos → Productos y costos → Confirmar).
- **Data loaded:** `getOrderableStores()`, the active store product-type keys (`listActiveStoreProductTypeKeys`), and the user's `baseCurrencyCode` (to default the currency field).
- **Actions:** `createOrderAction` (FormData + Zod). On success, navigates to the new order detail (view-transition `order-{id}`).
- **States:** **no-eligible-stores gate** — when the user has zero orderable stores, the route renders `OrderCreateEmptyStores` (CTA → create first store) instead of the form; forward-gated wizard validation; the discrepancy modal (`FR-05-13`, two options) when every item has a unit price and the itemized total differs from the entered total; the "Hoy" exchange-rate prefill (`FR-05-16`); **added 2026-08-08:** the confirm step's optional "¿Pagaste algo hoy?" toggle (`FR-05-45`) with "Pagué todo" / "Adelanto" quick options, amount and date fields.

### Edit — `/{locale}/orders/[id]/edit`

- **Purpose:** adjust an existing order with the all-open (non-wizard) form.
- **Data loaded:** `getOrderById(orderId, userId)` for current values (including `allocatedAmountMinor` to drive the total-below-allocated guard), `getOrderableStores()`, product-type keys, and `baseCurrencyCode`.
- **Guard:** store and currency are **immutable** in edit (rendered read-only with a `lock` icon, `BR-05-11`), and are refused server-side even if the field were forced open whenever the order carries a `PaymentAllocation` (`FR-05-46` / `STORE_CHANGE_BLOCKED` / `CURRENCY_CHANGE_BLOCKED`). A `CANCELLED` order is not editable: the edit route **redirects to detail** (parity with delivery-edit) so the collector must reactivate the order first; `editOrderAction` also rejects with `ORDER_NOT_EDITABLE` as a server-side safety net. The total cannot be lowered below `allocatedAmountMinor` (client + server, `FR-05-40` / `TOTAL_BELOW_PAID`); an item that carries an allocation cannot be removed (`ITEM_HAS_ALLOCATION`) or priced below what is declared against it (`ITEM_PRICE_BELOW_ALLOCATED`).
- **Actions:** `editOrderAction` (bound to the order id). Cancelling with pending changes opens the discard-changes guard modal.
- **States:** 404 when the order is not owned; field validation; discard-changes guard; reactive Resumen rail rendered in the editing (`--warning`) accent.

## State Model

### Order status (`OrderStatus`)

`OrderStatus` is **derived from item fulfillment, never edited through a free field** (`FR-05-32` / `BR-05-03`). The pure `deriveOrderStatus(items)` (in `src/lib/orders/orderState.ts`) maps each item's display delivery state (`open` / `arrived_at_store` / `in_transit` / `delivered`; `arrived_at_store` collapses to `open`) and picks the highest-priority outcome:

`COMPLETED` (all delivered) → `PARTIALLY_DELIVERED` (some delivered) → `IN_TRANSIT` (all in transit) → `PARTIALLY_IN_TRANSIT` (some in transit) → `OPEN` (otherwise / no items).

`CANCELLED` is **never returned by the derivation** — it is set exclusively by the cancel mutation and cleared by reactivate:

| From                | Action                                    | To                                 | Side effects                                                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —                   | create                                    | `OPEN`                             | order + items persisted; `ORDER_CREATED` history entry                                                                                                                                                                                                             |
| any non-`CANCELLED` | cancel                                    | `CANCELLED`                        | **declared allocations kept (`lost`) or freed as store credit (`credit`, default)** (`BR-05-15`); the underlying `StorePayment` always survives either way; `cancellationReason` stored; `ORDER_CANCELLED` history; blocked when any item has a live delivery link |
| `CANCELLED`         | reactivate                                | `OPEN`                             | `cancellationReason` cleared; `ORDER_REACTIVATED` history; **allocations kept at cancel time (`lost`) remain attached/visible; allocations freed at cancel time (`credit`) do not reappear, though the collector may re-declare the same payment**                 |
| (derived)           | delivery state change (owned by `FRD-08`) | re-derived via `deriveOrderStatus` | `FRD-08` invokes the pure function and persists the result in the same transaction                                                                                                                                                                                 |
| any (eligible)      | delete                                    | (removed)                          | cascades declared allocations (a payment shared with other orders keeps its `StorePayment` row and other declarations), history, items, and residual cancelled-delivery links; blocked when any item has a live delivery link                                      |

The cancel / delete eligibility gate is identical (`FR-05-24` / `FR-05-25` / `BR-05-18`): both are blocked when any item is linked to a **non-cancelled** delivery.

### Item delivery state (`OrderItemDeliveryState`)

`OrderItem.deliveryState` is a four-value enum: `NONE`, `ARRIVED_AT_STORE`, `IN_TRANSIT`, `DELIVERED`. Within the order domain the collector can only flip `NONE` ↔ `ARRIVED_AT_STORE` (`FR-05-39`); the `IN_TRANSIT` / `DELIVERED` transitions are owned by `FRD-08` (delivery membership). For display, the detail/list queries derive a richer `ItemDeliveryState` (`open` / `arrived_at_store` / `in_transit` / `delivered`) by combining the stored value with live (non-cancelled) delivery links: a live link wins (`delivered` if any linked delivery is `DELIVERED`, else `in_transit`), otherwise the stored `ARRIVED_AT_STORE` shows as `arrived_at_store`, else `open`.

### Payment state (distinct from fulfillment)

Payment progress is tracked separately from `OrderStatus` (`FR-05-33`) and is **never persisted as a status** — `paidAmount` / `remainingAmount` / `paymentPercentage` / `hasUnpaidBalance` are computed at query time from `totalCost` and this order's declared `PaymentAllocation` rows (`calculatePaymentSummary` + `deriveHasUnpaidBalance`; `paidAmount` here means **assigned**, `Order.allocatedAmountMinor`, not a payment ledger the order owns). This is why a `COMPLETED` order can still carry a visible unpaid signal (`FR-05-34` / `FR-05-35`). A new declaration may never exceed the current remaining balance (`FR-05-19` / `EXCEEDS_BALANCE`), nor may the underlying payment itself exceed the store's own debt (`FR-05-43` / `STORE_DEBT_EXCEEDED`); editing the total below the amount already assigned is refused (`FR-05-40` / `TOTAL_BELOW_PAID`).

## Confirmed

- Monetary amounts on an order stay anchored to the order's stored currency; the collector's later base currency preference alone does not retroactively change historical amounts.
- `Order` remains the canonical product term
- the initial order state is `OPEN`
- one exchange-rate value per order is the MVP model
- order note is one inline-editable textarea, not a list of note records
- payment records store amount and date and may be deleted
- **(2026-08-08)** payments belong to the store, not to a single order; what a payment covers is a separate, optional `PaymentAllocation` declaration (`docs/design/decisions/0025-store-level-payments-declared-allocations.md`); a payment can sit undeclared, and an order/product can be declared covered without a known price (`settlesTarget`)
- discrepancy handling is a save-time modal, not a passive warning
- order actions in detail view follow the pattern: primary action (`Create delivery`) plus an inline "Actions" card that groups secondary navigation and destructive actions (ADR 0011 replaced the earlier "single More menu" affordance — see `FR-05-23`)
- the order detail header displays store name and order date as the primary title; the human-readable identifier (`ORD-YYYYMMDD-NN`) appears as secondary metadata
- when the collector opens store detail from order detail, the store page back link honors the encoded `?returnTo=` order-detail URL so the collector can return to the same order context instead of falling back to the store listing
- a cancelled order may be reactivated to `OPEN`; allocations kept at cancel time (`lost`) remain attached and visible after reactivation, while allocations freed at cancel time (`credit`) do not reappear on this order, though the underlying payment still exists and can be re-declared (`BR-05-15`)
- cancel and delete share the same eligibility rule: both are blocked when any item is linked to a non-cancelled delivery, so the collector must unlink the item from its delivery before cancelling or deleting the order
- monetary amounts are stored as `Int` in minor currency units (cents × 100); `exchangeRate` uses `Decimal`
- order currency is validated against the same hardcoded allowlist as the user's base currency preference (`ALLOWED_COLLECTOR_BASE_CURRENCY_CODES` in `src/lib/catalog/collectorCountries.ts`); no separate `Currency` database table exists
- reconciliation eligibility is not time-bounded: every non-cancelled order whose stored rate cannot convert it into the collector's current base currency is eligible, regardless of `orderDate` (earlier drafts scoped reconciliation to the current month; that heuristic was dropped because it never converged and left older orders permanently outside both the reconciliation list and the base-currency rollups)
- reconciliation state is **derived per order, never stored**. Each order records `Order.exchangeRateBaseCode`: the base currency its stored `exchangeRate` converts INTO, written whenever a rate is persisted and `null` when there is no usable rate. An order "needs currency update" when `currencyCode != user.baseCurrencyCode` AND (`exchangeRate` is missing or `<= 0` OR `exchangeRateBaseCode != user.baseCurrencyCode`) AND `status != CANCELLED` — the single definition lives in `src/lib/fx/reconciliation.ts` (`needsFxReconciliation` plus the matching Prisma fragment `buildNeedsFxReconciliationWhere`, consumed by `buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts`). Changing the base currency **writes nothing**: it only moves the value the derivation compares against, so a round trip (`PEN → EUR → PEN`) leaves already-reconciled orders valid instead of re-marking them. Reconciling is **stamping**: order create, edit with a submitted `exchangeRate`, and bulk reconciliation (`updateExchangeRatesAction` → `applyOrderExchangeRates(userId, baseCurrencyCode, updates)`) all write the rate **and** the base it converts into, which is what removes the order from the pending set, so the banner/count converges to zero as the collector works through it. Cancelled orders are excluded from the pending view without changing anything on the row, so reactivating one re-surfaces it. Because the orders list, its count, the modal rows and the dashboard rollup all read this one derivation, they cannot disagree (see ADR 0024 at `docs/design/decisions/0024-fx-reconciliation-derived-from-rate-base.md`; migration `20260803053836_derive_fx_reconciliation_from_rate_base`). The derived state also surfaces as a **per-order indicator** — unchanged in the UI, only its source moved: a `warning` chip (`detail.hero.chipFxPending`) on the order-detail hero next to the status chips (hidden on cancelled orders), and an inline `warning` (`form.exchangeRateOutdatedWarning`) under the edit-form exchange-rate field. Query DTOs still expose a `needsExchangeRateUpdate: boolean`, computed at read time rather than read from a column.
- exchange rate validation for manual input: `min(0.01)`, `max(99999.99)` — consistent with WO-04 and WO-07
- dashboard spend reporting merges delivery shipping cost into the same disbursed-spend figures as order payments, rather than charting it as its own series (comparing the two scales side by side would be disproportionate) — see [`FRD-06 · BR-06-04`, `BR-06-09`](../frd-06-dashboard/frd-06-dashboard.md#business-rules)
- **(2026-08-08, revised 2026-08-09)** a store's debt (`Σ totalCost` of its non-cancelled orders `− (Σ` its payments `− Σ` `PaymentAllocation.amountMinor` left declared lost against one of its own cancelled orders`)`, per currency) is **not clamped at zero**: a negative value is real money the store holds on the collector's behalf and renders as "a favor" (green), never folded into or confused with the unrelated photo-quota "crédito" veto (`docs/product/glossary.md`). Money declared `lost` at cancel time (`BR-05-15`) is excluded from the paid side of this formula: it is sunk, so it must not count as available money that pays down the store's other orders or turns into "a favor".
- **(2026-08-08)** the orders "Por tienda" view (`FR-05-44`) is a deliberate, scoped exception to the app's otherwise-unified list pagination (`ADR 0018`): it loads the collector's entire pending-product set in one unpaginated, in-memory two-level sort, because at today's real data volume (tens of pending products, not hundreds) that costs nothing and the two-level sort does not translate cleanly to a flat page. See `docs/design/decisions/0025-store-level-payments-declared-allocations.md` for the revisit threshold.
- **(2026-08-08)** `OrderPayment` / `Order.paidAmountMinor` / `Order.paymentPercent` remain in the schema, `DEPRECATED`, unread and unwritten by any live code path; they are kept physically present for reversibility of the store-level-payments trial, not migrated away (`docs/design/decisions/0025-store-level-payments-declared-allocations.md`)

## Open Questions

- whether future post-MVP finance reporting should move exchange-rate context from order level to payment level

## Cross-domain requirements delivered here

- **Order-side removed-store tombstone (`FR-04-42` / `AC-04-22`, order-side portion of `BR-04-23`).** These requirements are owned by [FRD-04](../frd-04-store-domain/frd-04-store-domain.md): a collector order that references a `REJECTED` store must keep rendering, showing a neutral tombstone message by default and sanction wording only when `Store.removalReason` is the abuse category. The store-side lifecycle (`REJECTED` status, `Store.removalReason`, `isSanctionRemovalReason`) is delivered by [FRD-04 · BP-01 · WO-09](../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md); the order-side rendering is delivered in this FRD by [BP-02 · WO-08](bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md), with its design record in [FDD-05 · §5.7](fdd-05-order-payment-shipment.md). The order side only consumes `removalReason`; it never re-classifies removal reasons.
- The equivalent tombstone marker on delivery and dashboard surfaces (which also render a store name and would otherwise show a stale name for a removed store) is a documented sibling follow-up, not part of `WO-08`: `FR-04-42` is scoped to collector orders, and those surfaces will reuse the same `resolveStoreTombstone` helper and `stores.json` copy that `WO-08` introduces.

## Out of Scope

- delivery grouping across orders
- carrier and tracking management
- shipment-level lifecycle behavior
- automatic dashboard implementation
- attachment support in order notes

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/bp-01-order-domain-foundation.md`
- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md`
