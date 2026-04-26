---
id: FRD-05
type: FRD
slug: order-payment-shipment
title: Order and Payment Tracking
status: ACTIVE
parent: PRD-01
children:
  - BP-01
  - BP-02
last_updated: 2026-04-24
source_features:
  - FEAT-0014
implementation_status: IN_PROGRESS
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
- private app navigation already exposes `Orders` and `Pre-orders` entry points
- [`FRD-07`](../frd-07-user-settings/frd-07-user-settings.md) already defines a user-level base currency preference that this domain can consume
- store discovery and store detail flows already exist, which makes store selection a prerequisite rather than a parallel domain problem

### Planned

- order persistence and human-readable order identifiers
- spreadsheet-style item entry with quantity, optional unit price, and optional product type
- required total-cost capture with discrepancy confirmation when item totals do not match
- one exchange-rate context per order when order currency differs from the user's base currency
- payment records with remaining-balance guidance and delete support
- order detail view with inline private note editing
- orders list with filters, overdue-delivery signals, and payment-progress summaries

## User Stories

### US-05-01 Track what I committed to buy

As a collector, I want to save an order with store, dates, currency, and products so I stop depending on memory or chat history.

### US-05-02 Mix quoted totals and itemized totals

As a collector, I want to either enter a full quoted total manually or derive it from item prices so PandaTrack still fits stores that quote orders in different ways.

### US-05-03 Understand what I still owe

As a collector, I want to register payments over time and immediately see paid amount, remaining amount, and payment percentage so surprise balances do not catch me off guard.

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
- `FR-05-09`: Each order item may store an optional unit price.
- `FR-05-10`: Each order item may store an optional product type selected from the shared catalog.
- `FR-05-11`: Each order must store a required total cost.
- `FR-05-12`: The system must derive the itemized total as the sum of `quantity x unit price` across all items that have prices.
- `FR-05-13`: When every order item has a unit price and the derived itemized total differs from the entered total cost, the save flow must present a modal that lets the user keep the entered total, replace it with the derived total, or stop saving.
- `FR-05-14`: Each order must store an order currency selected by the user.
- `FR-05-15`: The order currency field must default to the user's saved base currency when present.
- `FR-05-16`: When the order currency differs from the user's base currency, the order form must require one exchange-rate value that converts from order currency into base currency.
- `FR-05-17`: Order detail must let the user add and delete multiple payment records over time.
- `FR-05-18`: Each payment record must store amount and payment date.
- `FR-05-19`: The payment flow must prevent creating a payment whose amount exceeds the current remaining balance.
- `FR-05-20`: The order detail view must show paid amount, remaining amount, and payment percentage.
- `FR-05-21`: The order detail view must expose one inline-editable private note field that can be saved without entering full order edit mode.
- `FR-05-22`: The order detail view must expose an automatic history list that records major order lifecycle events. **As implemented (2026-04-24):** the list is **read-only**; users cannot delete individual history entries from the UI (aligned with [`WO-05`](bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md) and migration `20260423000000_simplify_order_history_event_types`).
- `FR-05-23`: The order detail view must expose `Create delivery` as the primary action, `Edit` as the secondary action, and `Cancel` plus `Delete` inside an action menu.
- `FR-05-24`: An order may be physically deleted only when none of its items is linked to a non-cancelled delivery. When the rule is not met, the delete affordance must be rendered as disabled with a tooltip that explains the collector must first unlink the affected items from their delivery.
- `FR-05-25`: An order may be cancelled only when none of its items is linked to a non-cancelled delivery. When the rule is not met, the cancel affordance must be rendered as disabled with a tooltip that explains the collector must first unlink the affected items from their delivery. Cancelling an order moves it to `CANCELLED` without removing its historical record.
- `FR-05-26`: The orders list must support filters for order-date range, store, product type, status, and free-text product-name matching.
- `FR-05-27`: Orders list filters must persist in the URL and render removable chips in the same interaction pattern used by `Stores`.
- `FR-05-28`: The orders list must sort by oldest order date first by default.
- `FR-05-29`: Each order card in the list must show store identity, order date, status, expected delivery range, total cost, and payment progress.
- `FR-05-30`: The orders list must visually indicate when an order has passed its expected delivery range without being completed.
- `FR-05-31`: Each order card must expand to show the order items associated with the order. Payment progress is communicated through the collapsed card's paid-versus-total summary and percentage; individual payment records are accessible from the order detail view.
- `FR-05-32`: Order status must be derived from fulfillment outcomes rather than directly edited by the user.
- `FR-05-33`: Payment state must remain conceptually distinct from order fulfillment state.
- `FR-05-34`: When all products linked to an order are delivered, the order must move to `COMPLETED` even if payment is still pending.
- `FR-05-35`: Completed orders with pending payment must still show a visible unpaid signal in both list and detail surfaces.
- `FR-05-36`: The orders workspace must support a `Needs currency update` filter that returns orders requiring exchange-rate reconciliation to the collector's current base currency.
- `FR-05-37`: Exchange-rate reconciliation eligibility must be based on budget-impact periods from the current month onward, not only order status; completed orders that still impact current/future payment periods remain eligible.
- `FR-05-38`: When the collector changes base currency, the product must support bulk exchange-rate reconciliation grouped by currency pair (`from -> to`) and allow deferring reconciliation for manual per-order updates later.

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
- `BR-05-10`: Payments may be deleted and the paid-versus-remaining summary must recalculate immediately after deletion.
- `BR-05-11`: Changing an order's store is allowed only while the order remains `OPEN` and has no associated deliveries.
- `BR-05-12`: Cancelled orders remain visible in historical lists and filter results when the chosen filters include them.
- `BR-05-15`: When an order is cancelled, its `OrderPayment` records are deleted. Cancellation does not cascade into deliveries because cancellation is only permitted when no item is linked to a non-cancelled delivery (`FR-05-25`). Physical deletion follows the same eligibility rule (`FR-05-24`) and, when permitted, cascades payment records and any residual links to already-cancelled deliveries together with the order row.
- `BR-05-16`: Cancel and delete require a confirmation modal. The modal must name the order and, when payment records exist, state that those payments will be removed as part of the operation. The modal never mentions delivery-link removal because the cancel/delete affordances are blocked when non-cancelled delivery links exist.
- `BR-05-17`: An order in `CANCELLED` state may be returned to `OPEN` without preconditions. Payment records removed during cancellation are not restored.
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
- And the user can keep the entered total, replace it with the derived total, or go back without saving

### `AC-05-03`

- Given an order has an unpaid balance
- When the user adds valid payment records over time
- Then the detail view updates paid amount, remaining amount, and payment percentage
- And a payment larger than the remaining balance is rejected

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
- Recorded order totals, item prices, and payment rows remain denominated in the **order currency** (`FR-05-14`); changing the collector's base currency in settings does not rewrite stored order rows. Per-order exchange-rate context (`FR-05-16`, `BR-05-07`) is interpreted relative to the base currency **at the time the order was saved**, which matters for dashboard rollups ([`FR-06-13`](../frd-06-dashboard-reminders/frd-06-dashboard-reminders.md#functional-requirements); [`FRD-06`](../frd-06-dashboard-reminders/frd-06-dashboard-reminders.md)).
- The orders list exposes filter label `Needs currency update`, chip label `Currency update needed`, and query-state parameter `fxStatus=needs_reconciliation`. The implementation (`FR-05-36`, `FR-05-37`, `FR-05-38`) is owned by [`BP-02 · WO-07`](bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md). The `FxReconciliationModal` shared component lives at `src/components/modules/FxReconciliationModal.tsx` and is triggered from both the orders list banner and the Settings currency-change confirmation in [**FRD-07 · BP-01 · WO-05**](../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-05-preferences-currency-country-product-types-and-budget.md).
- Store selection should reuse the existing shared searchable-select interaction pattern rather than invent a new picker.
- The order identifier format should remain stable across locales even if the human-readable date display changes.
- Orders and deliveries should use expandable cards rather than dense tables because the card format better fits status signals, actions, and mobile layouts.
- The difference between order fulfillment and payment status must remain explicit so dashboard logic can later reason about them independently.

## Confirmed

- Monetary amounts on an order stay anchored to the order's stored currency; the collector's later base currency preference alone does not retroactively change historical amounts.
- `Order` remains the canonical product term
- the initial order state is `OPEN`
- one exchange-rate value per order is the MVP model
- order note is one inline-editable textarea, not a list of note records
- payment records store amount and date and may be deleted
- discrepancy handling is a save-time modal, not a passive warning
- order actions in detail view follow the pattern: primary action, secondary action, destructive actions in `More`
- the order detail header displays store name and order date as the primary title; the human-readable identifier (`ORD-YYYYMMDD-NN`) appears as secondary metadata
- a cancelled order may be reactivated to `OPEN`; payment records removed during cancellation are not restored
- cancel and delete share the same eligibility rule: both are blocked when any item is linked to a non-cancelled delivery, so the collector must unlink the item from its delivery before cancelling or deleting the order
- monetary amounts are stored as `Int` in minor currency units (cents × 100); `exchangeRate` uses `Decimal`
- order currency is validated against the same hardcoded allowlist as the user's base currency preference (`ALLOWED_COLLECTOR_BASE_CURRENCY_CODES` in `src/lib/catalog/collectorCountries.ts`); no separate `Currency` database table exists
- reconciliation eligibility is bounded to the current month: when the collector changes base currency, only orders where `orderDate >= first day of the current month` AND `currencyCode !== newBaseCurrencyCode` AND `status != CANCELLED` are marked for reconciliation; orders from prior months are preserved in the database but are not included in reconciliation scope or dashboard rollups denominated in the new base currency
- `Order` carries a `needsExchangeRateUpdate: Boolean @default(false)` field (added in BP-01 WO-01) that tracks per-order reconciliation state; it is set to `true` by FRD-07 WO-05 on currency change and cleared to `false` by the bulk reconciliation action (WO-07) or by a manual `exchangeRate` save in WO-04; when a `CANCELLED` order is reactivated, the reactivation action re-evaluates and sets the flag when applicable
- exchange rate validation for manual input: `min(0.01)`, `max(99999.99)` — consistent with WO-04 and WO-07

## Open Questions

- whether future dashboard reporting will break delivery costs out separately from product spending or combine them into one spending signal
- whether future post-MVP finance reporting should move exchange-rate context from order level to payment level

## Out of Scope

- delivery grouping across orders
- carrier and tracking management
- shipment-level lifecycle behavior
- automatic dashboard implementation
- attachment support in order notes

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-01-order-domain-foundation/bp-01-order-domain-foundation.md`
- `docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md`
