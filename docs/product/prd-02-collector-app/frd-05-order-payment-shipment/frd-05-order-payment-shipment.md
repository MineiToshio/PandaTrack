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
last_updated: 2026-06-16
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
- private app navigation already exposes `Orders` and `Pre-orders` entry points
- [`FRD-07`](../frd-07-user-settings/frd-07-user-settings.md) already defines a user-level base currency preference that this domain can consume
- store discovery and store detail flows already exist, which makes store selection a prerequisite rather than a parallel domain problem
- order persistence and human-readable order identifiers (`ORD-YYYYMMDD-NN`)
- create flow as a 3-step wizard (data → products and costs → confirm) with forward gating and free backward navigation, plus a reactive summary rail; edit flow as an all-open form with store and currency locked
- spreadsheet-style item entry with quantity, optional unit price, and optional product type
- required total-cost capture with discrepancy confirmation when item totals do not match (two-option modal — see `FR-05-13`)
- one exchange-rate context per order when order currency differs from the user's base currency, with a Frankfurter-backed "Today" prefill helper (`FR-05-16`)
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
- `FR-05-08a`: Each order item is an **atomic shippable unit**: it is either fully included in an `entrega` or not included at all. Fractional fulfillment of a single order item across multiple `entrega`s is not supported in the MVP. Collectors who expect units of the same SKU to arrive in separate `entrega`s must register them as separate order items with `quantity = 1`. Quantity greater than `1` is reserved for units that will arrive together. The order form must surface this rule contextually (for example a tooltip in the products section) when at least one order item has `quantity > 1`, so the collector has the chance to split before saving. See `docs/product/glossary.md` for the canonical statement of the rule and the upgrade path if partial fulfillment is later prioritized.
- `FR-05-09`: Each order item may store an optional unit price.
- `FR-05-10`: Each order item may store an optional product type selected from the shared catalog.
- `FR-05-11`: Each order must store a required total cost.
- `FR-05-12`: The system must derive the itemized total as the sum of `quantity x unit price` across all items that have prices.
- `FR-05-13`: When every order item has a unit price and the derived itemized total differs from the entered total cost, the save flow must present a modal that lets the user either go back and correct the order or save with the entered total anyway. **Redesign change (CB-02, 2026-05-17):** the modal now offers **two** options ("Go back and correct" / "Save anyway") instead of three. The "replace with the derived total" option was dropped because the entered total is always authoritative; auto-replacing it created confusion.
- `FR-05-14`: Each order must store an order currency selected by the user.
- `FR-05-15`: The order currency field must default to the user's saved base currency when present.
- `FR-05-16`: When the order currency differs from the user's base currency, the order form must require one exchange-rate value that converts from order currency into base currency. **Redesign note:** the field offers a "Today" prefill helper that calls the Frankfurter API (no API key, 5s timeout) from the client to suggest the current rate; the collector can still edit the value.
- `FR-05-17`: Order detail must let the user add and delete multiple payment records over time. **Redesign note:** "Add payment" is implemented as an inline expand inside the payments card (not a separate modal); the amount field offers quick-picks for the remaining balance and half of it.
- `FR-05-18`: Each payment record must store amount and payment date.
- `FR-05-19`: The payment flow must prevent creating a payment whose amount exceeds the current remaining balance.
- `FR-05-20`: The order detail view must show paid amount, remaining amount, and payment percentage.
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
- `FR-05-31`: Each order card must expand to show the order items associated with the order. Payment progress is communicated through the collapsed card's paid-versus-total summary and percentage; individual payment records are accessible from the order detail view.
- `FR-05-32`: Order status must be derived from fulfillment outcomes rather than directly edited by the user.
- `FR-05-33`: Payment state must remain conceptually distinct from order fulfillment state.
- `FR-05-34`: When all products linked to an order are delivered, the order must move to `COMPLETED` even if payment is still pending.
- `FR-05-35`: Completed orders with pending payment must still show a visible unpaid signal in both list and detail surfaces.
- `FR-05-36`: The orders workspace must support a `Needs currency update` filter that returns orders requiring exchange-rate reconciliation to the collector's current base currency.
- `FR-05-37`: Exchange-rate reconciliation eligibility must be based on budget-impact periods from the current month onward, not only order status; completed orders that still impact current/future payment periods remain eligible.
- `FR-05-38`: When the collector changes base currency, the product must support bulk exchange-rate reconciliation grouped by currency pair (`from -> to`) and allow deferring reconciliation for manual per-order updates later.
- `FR-05-39`: Order detail must let the collector flip each order item between `pending in store` (`NONE`) and `ready at store` (`ARRIVED_AT_STORE`) directly from the item's state pill, as a pre-delivery readiness marker. The toggle is available only while the item is **not** linked to a non-cancelled delivery and the order is **not** `CANCELLED`; in those cases the pill is read-only with an explanatory disabled label (delivery-owned `in_transit` / `delivered` states must not be editable from the order, and a cancelled order is frozen). This state is the same `OrderItemDeliveryState` that delivery eligibility reads (`NONE` / `ARRIVED_AT_STORE` are both eligible) and that `FRD-08` consumes; flipping it does not by itself change the derived `OrderStatus` (both values map to `open`).
- `FR-05-40`: The edit flow must refuse to lower an order's `totalCost` below the sum of payments already recorded. The form blocks it client-side and the `editOrder` mutation enforces the same guard server-side (rejecting with `TOTAL_BELOW_PAID`), so `remainingAmount` can never be driven negative. To reduce the total past what is paid, the collector must first delete payments.

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
- `BR-05-10`: Payments may be deleted and the paid-versus-remaining summary must recalculate immediately after deletion. **As implemented:** deletion is guarded by a destructive confirmation modal (`role="alertdialog"`) on the pay-row and is awaited — the row is removed and the summary recalculates only after the server confirms. There is no optimistic delete and no undo toast.
- `BR-05-11`: Changing an order's store is allowed only while the order remains `OPEN` and has no associated deliveries.
- `BR-05-12`: Cancelled orders remain visible in historical lists and filter results when the chosen filters include them.
- `BR-05-15`: Cancellation **preserves** the order's `OrderPayment` records (the order is archived, not destroyed), and does not cascade into deliveries because cancellation is only permitted when no item is linked to a non-cancelled delivery (`FR-05-25`). Physical **deletion** is the destructive path: it follows the same eligibility rule (`FR-05-24`) and, when permitted, cascades payment records, history, and any residual links to already-cancelled deliveries together with the order row. **As implemented (`cancelOrder` / `deleteOrder` in `src/lib/data/orders/orderMutations.ts`):** cancel keeps payments so the reactivate flow (`BR-05-17`) can show the payment trail; only delete removes them. (This corrects an earlier statement that cancel deleted payments — that behavior was a bug that broke `Reactivar pedido` and was removed. **Confirmed intended behavior (Sergio, 2026-06-16):** preserve-on-cancel is correct.)
- `BR-05-16`: Cancel and delete require a confirmation modal that names the order. Only the **delete** modal states that the order's payments and history will be removed (delete is irreversible — see the FDD delete-modal copy); the **cancel** modal does not promise payment removal because cancellation preserves payments (`BR-05-15`). The delete modal additionally gates its CTA behind a type-to-confirm input (the literal `"eliminar"`). Neither modal mentions delivery-link removal because the cancel/delete affordances are disabled (with an explanatory tooltip) when non-cancelled delivery links exist. (Earlier text said both modals warn about payment removal; corrected to match implementation. The cancel-modal copy is consistent — `cancelModal.descriptionBase` says "Los pagos y el historial se conservan". **Fixed in this pass:** the cancelled-order hero copy `detail.hero.cancelledOn` previously appended a false "Sin pagos registrados" / "No payments recorded" suffix — a leftover from the delete-on-cancel era — now reduced to just the cancellation date, since payments are preserved.)
- `BR-05-17`: An order in `CANCELLED` state may be returned to `OPEN` without preconditions. Payment records are preserved through cancellation (`BR-05-15`), so they remain attached to the order and stay visible after reactivation. **Redesign note:** reactivation runs directly without a confirmation modal because it is a reversible action.
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
- Recorded order totals, item prices, and payment rows remain denominated in the **order currency** (`FR-05-14`); changing the collector's base currency in settings does not rewrite stored order rows. Per-order exchange-rate context (`FR-05-16`, `BR-05-07`) is interpreted relative to the base currency **at the time the order was saved**, which matters for dashboard rollups ([`FR-06-13`](../frd-06-dashboard/frd-06-dashboard.md#functional-requirements); [`FRD-06`](../frd-06-dashboard/frd-06-dashboard.md)).
- The orders list exposes filter label `Needs currency update`, chip label `Currency update needed`, and query-state parameter `fxPending=true`. FX-pending eligibility is the **persisted `Order.needsExchangeRateUpdate` flag** (plus `currencyCode != base` and `status != CANCELLED`). The implementation (`FR-05-36`, `FR-05-37`, `FR-05-38`) is owned by [`BP-02 · WO-07`](bp-02-order-workspace-and-list-experience/work-orders/wo-07-currency-reconciliation-filter-and-bulk-fx-reconciliation.md). As shipped, `FxReconciliationModal` lives at `src/app/[locale]/(app)/orders/_components/FxReconciliationModal.tsx` (rendered via `FxAnnouncer`) and is triggered from the orders list banner. The Settings currency-change in [**FRD-07 · BP-01 · WO-05**](../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-05-preferences-currency-country-product-types-and-budget.md) is the **trigger** that flags the affected orders (via `flagOrdersForFxReconciliation`) and, on Path A, redirects the collector to the orders list to reconcile.
- Store selection should reuse the existing shared searchable-select interaction pattern rather than invent a new picker.
- The order identifier format should remain stable across locales even if the human-readable date display changes.
- Orders and deliveries should use expandable cards rather than dense tables because the card format better fits status signals, actions, and mobile layouts.
- The difference between order fulfillment and payment status must remain explicit so dashboard logic can later reason about them independently.

## Lifecycle Interaction Model

Each detail action has a distinct confirmation and feedback contract. The visual treatment of toasts, the undo affordance, the inline Acciones card, and the mobile sticky-bar chrome are owned by the [order FDD](fdd-05-order-payment-shipment.md); this section fixes only the functional behavior. (Mirrors the FRD-08 model so the two workspaces stay consistent.)

| Action                | Confirmation                                                                               | Apply / feedback model                                                                                                                                                       | Post-action target                                 |
| --------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Save private note     | none (inline autosave on blur, ~800ms debounce)                                            | **not optimistic** — waits for server confirmation, then shows `"Guardada hace Ns"`; a `NOTE_SAVED` / `NOTE_DELETED` event fires only when the stored value actually changed | stays on detail                                    |
| Add payment           | none (inline expand in the Pagos card; mobile sheet)                                       | optimistic; the hero/ledger update locally and revert with a toast on failure; clearing the balance fires a celebratory toast                                                | stays on detail                                    |
| Delete payment        | confirmation modal (`tone-destructive`, `role="alertdialog"`) on the pay-row delete button | awaited (not optimistic): the modal stays open until the server confirms, then the row is removed and the paid/remaining summary recalculates; no undo affordance            | stays on detail                                    |
| Toggle item readiness | none (direct on the item state pill)                                                       | optimistic flip `NONE` ↔ `ARRIVED_AT_STORE`; reverts on failure                                                                                                              | stays on detail                                    |
| Cancel                | confirmation modal (`tone-warning`; optional reason)                                       | optimistic confirmation: the modal closes on submit and the cancelled state shows immediately; rolls back on failure. **Payments are preserved.**                            | stays on detail                                    |
| Reactivate            | none (reversible, `BR-05-17`)                                                              | executes directly; returns the order to `OPEN` and re-derives the FX-pending count naturally                                                                                 | stays on detail                                    |
| Delete                | confirmation modal (`tone-destructive`; type-to-confirm)                                   | awaited (not optimistic, because it is irreversible): the modal stays until the server confirms                                                                              | redirects to the orders list                       |
| Edit                  | (separate `/[id]/edit` route)                                                              | discard-changes guard modal on cancel-with-pending-changes; save is awaited                                                                                                  | back to detail                                     |
| Create delivery       | (navigates to `FRD-08` create flow)                                                        | navigation only — no order mutation                                                                                                                                          | delivery create (`/deliveries/new?sourceOrderId=`) |

Disabled-action rules: `Cancelar` and `Eliminar` share one eligibility gate (`FR-05-24` / `FR-05-25`) — both render disabled with a `title` tooltip when any item is linked to a non-cancelled delivery. In `CANCELLED` state, `Editar` and `Crear entrega` are disabled with an explanatory helper, and `Cancelar` is absent (the order is already cancelled). A `COMPLETED` order has no `Cancelar`.

## Error Contract

Order mutations return typed, expected error codes (string results, not exceptions) so flows can recover without noisy monitoring; unexpected failures are caught once with `Sentry.captureException` and surfaced as `server_error`. Every action also returns `unauthorized` when there is no session. The Zod validation layer (`src/lib/orders/orderValidation.ts`) rejects malformed input before the mutation runs (returning `validation`). Expected domain codes by mutation:

- **create order** (`createOrder`): `STORE_NOT_FOUND`, `INVALID_PRODUCT_TYPE`.
- **edit order** (`editOrder`): `ORDER_NOT_FOUND`, `ORDER_NOT_EDITABLE` (the order is `CANCELLED`), `STORE_NOT_FOUND`, `STORE_CHANGE_BLOCKED` (store change attempted while the order is not `OPEN` or already has delivery links, per `BR-05-11`), `INVALID_PRODUCT_TYPE`, `ITEM_HAS_LIVE_DELIVERY` (an edited/removed item is linked to a non-cancelled delivery), `TOTAL_BELOW_PAID` (`FR-05-40`).
- **cancel order** (`cancelOrder`): `ORDER_NOT_FOUND`, `HAS_LIVE_DELIVERY_LINKS` (`FR-05-25`).
- **delete order** (`deleteOrder`): `ORDER_NOT_FOUND`, `HAS_LIVE_DELIVERY_LINKS` (`FR-05-24`).
- **reactivate order** (`reactivateOrder`): `ORDER_NOT_FOUND`, `ORDER_NOT_CANCELLED` (only a `CANCELLED` order may be reactivated).
- **add payment** (`addOrderPayment`): `ORDER_NOT_FOUND`, `EXCEEDS_BALANCE` (`FR-05-19`), `DATE_BEFORE_ORDER` (payment date earlier than the order date).
- **delete payment** (`deleteOrderPayment`): `NOT_FOUND`.
- **toggle item readiness** (`setOrderItemArrivedAtStore`): `ITEM_NOT_FOUND`, `ITEM_HAS_LIVE_DELIVERY` (delivery owns the state), `ORDER_CANCELLED`.
- **save note** (`saveOrderNote`): `ORDER_NOT_FOUND`.
- **bulk FX reconciliation** (`updateExchangeRatesAction`): `unauthorized`, `invalid` (Zod: 1–500 updates, each a positive finite rate), `server_error`.

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

## Screens and Data Contract

Each order route lives under `/{locale}/(app)/orders`. All routes are authenticated: a missing session redirects to `/{locale}/sign-in`. An order that does not belong to the session user resolves to **404** (`notFound()`), never 403, to avoid enumeration. Visual layout is owned by the [FDD](fdd-05-order-payment-shipment.md); this section fixes purpose, data loaded, actions, and states.

### List — `/{locale}/orders`

- **Purpose:** the central collector workspace, opened on the most-recent orders.
- **Data loaded:** chrome first (renders instantly): `getOrderableStores()` for the filter drawer/chips, plus a suspended heading count (`prisma.order.count` total and closed `COMPLETED`/`CANCELLED`). The suspended data region loads `getOrdersList(userId, filters)` (paginated, 30/page — `ORDER_LIST_PAGE_SIZE`) which also returns `pendingFxCount`, and the user's `baseCurrencyCode`. When `pendingFxCount > 0`, it additionally fetches up to 500 FX-pending orders (`id`, `humanReadableId`, `totalCost`, `currencyCode`) to seed the reconciliation modal.
- **Filters (URL params):** `q` (name / `ORD-…`), `productType[]`, `store`, `status[]`, `payment[]` (`paid`/`partial`/`unpaid`/`overdue`), `dateFrom`/`dateTo` (order date), and a single delivery-date mode — `deliveryFrom`/`deliveryTo` (expected-delivery overlap), `delOverdue=true` ("Por recibir": window started and still pending, i.e. in-window or overdue), **or** `delLate=true` ("Entrega atrasada": window fully closed and still pending, the strict overdue subset that mirrors the dashboard's "Atrasados" tab). The three delivery modes are mutually exclusive; the drawer surfaces "Por recibir" and "Entrega atrasada" as a deselectable single-select chip pair (both-off is valid), worded to distinguish "Entrega atrasada" from the payment `overdue` state. Also `fxPending=true`, and `sort`. **Status is never auto-applied** — the "Solo activas" entry point hard-codes the four active statuses (`OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`) in its href; a bare `/orders` URL applies no status filter. Sort options: `recent` (default, omitted from the URL), `oldest`, `store-asc`, `total-desc`, `payment-asc` (the last is computed + paginated in memory because Prisma cannot `orderBy` a derived ratio). The `payment[]` filter is also applied in memory after the query.
- **Actions:** navigation only — `Nuevo pedido` → `/new`; each row/card → detail carrying the current list URL via `?returnTo=`. The FX banner opens the bulk reconciliation modal (`updateExchangeRatesAction`). No order mutation happens on the list.
- **States:** chrome renders immediately; the data region shows a layout-matching skeleton (table desktop / cards mobile, `aria-busy`). Empty initial (`MascotBubble sleeping`, create CTA); empty-filtered (`MascotBubble confused`, "Limpiar filtros" → bare `/orders`, chips/toolbar retained).

### Detail — `/{locale}/orders/[id]` (optional `?returnTo=`)

- **Purpose:** inspect one order, track payments, run lifecycle actions, and launch delivery creation.
- **Data loaded:** `getOrderDetail(orderId, userId)` → order summary, store `{id,name,slug}`, items with a derived per-item `deliveryState` (`open` / `arrived_at_store` / `in_transit` / `delivered`, computed from non-cancelled delivery links + own `OrderItem.deliveryState`), payments (with `paidAmount` / `remainingAmount` / `paymentPercentage` / `hasUnpaidBalance`), read-only history (newest-first), `eligibility` (`canDelete` / `canCancel` / `blockReason`), and `flags` (`hasPayments`, `hasNonCancelledDeliveryLinks`); plus the user's `baseCurrencyCode` for FX display. A `returnTo` is sanitized via `safeRelativeReturnTo` and threaded into the back link and downstream store/edit links.
- **Actions:** `addPaymentAction`, `deletePaymentAction`, `setOrderItemArrivedAction`, `saveOrderNoteAction`, `cancelOrderAction`, `reactivateOrderAction`, `deleteOrderAction` (behavior per Lifecycle Interaction Model); `Editar` → `/[id]/edit`; `Crear entrega` → the `FRD-08` create flow; `Ver tienda` → the store page (with `returnTo`).
- **States:** per-status hero (active / overdue / partially-paid / completed-unpaid / cancelled — see the FDD per-state table); read-only History subcard (desktop only); disabled-action helpers for the cancelled and delivery-linked cases; route loading skeleton (`loading.tsx`); 404 when the order is not owned.

### Create — `/{locale}/orders/new` (optional store context, e.g. `?storeId=`)

- **Purpose:** create one store-scoped order via the 3-step wizard (Datos → Productos y costos → Confirmar).
- **Data loaded:** `getOrderableStores()`, the active store product-type keys (`listActiveStoreProductTypeKeys`), and the user's `baseCurrencyCode` (to default the currency field).
- **Actions:** `createOrderAction` (FormData + Zod). On success, navigates to the new order detail (view-transition `order-{id}`).
- **States:** **no-eligible-stores gate** — when the user has zero orderable stores, the route renders `OrderCreateEmptyStores` (CTA → create first store) instead of the form; forward-gated wizard validation; the discrepancy modal (`FR-05-13`, two options) when every item has a unit price and the itemized total differs from the entered total; the Frankfurter "Hoy" exchange-rate prefill (`FR-05-16`).

### Edit — `/{locale}/orders/[id]/edit`

- **Purpose:** adjust an existing order with the all-open (non-wizard) form.
- **Data loaded:** `getOrderById(orderId, userId)` for current values (including `paidAmount` derived from payments to drive the total-below-paid guard), `getOrderableStores()`, product-type keys, and `baseCurrencyCode`.
- **Guard:** store and currency are **immutable** in edit (rendered read-only with a `lock` icon, `BR-05-11`). A `CANCELLED` order is not editable: the edit route **redirects to detail** (parity with delivery-edit) so the collector must reactivate the order first; `editOrderAction` also rejects with `ORDER_NOT_EDITABLE` as a server-side safety net. The total cannot be lowered below `paidAmount` (client + server, `FR-05-40` / `TOTAL_BELOW_PAID`).
- **Actions:** `editOrderAction` (bound to the order id). Cancelling with pending changes opens the discard-changes guard modal.
- **States:** 404 when the order is not owned; field validation; discard-changes guard; reactive Resumen rail rendered in the editing (`--warning`) accent.

## State Model

### Order status (`OrderStatus`)

`OrderStatus` is **derived from item fulfillment, never edited through a free field** (`FR-05-32` / `BR-05-03`). The pure `deriveOrderStatus(items)` (in `src/lib/orders/orderState.ts`) maps each item's display delivery state (`open` / `arrived_at_store` / `in_transit` / `delivered`; `arrived_at_store` collapses to `open`) and picks the highest-priority outcome:

`COMPLETED` (all delivered) → `PARTIALLY_DELIVERED` (some delivered) → `IN_TRANSIT` (all in transit) → `PARTIALLY_IN_TRANSIT` (some in transit) → `OPEN` (otherwise / no items).

`CANCELLED` is **never returned by the derivation** — it is set exclusively by the cancel mutation and cleared by reactivate:

| From                | Action                                    | To                                 | Side effects                                                                                                                            |
| ------------------- | ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| —                   | create                                    | `OPEN`                             | order + items persisted; `ORDER_CREATED` history entry                                                                                  |
| any non-`CANCELLED` | cancel                                    | `CANCELLED`                        | **payments preserved**; `cancellationReason` stored; `ORDER_CANCELLED` history; blocked when any item has a live delivery link          |
| `CANCELLED`         | reactivate                                | `OPEN`                             | `cancellationReason` cleared; `ORDER_REACTIVATED` history; **payments were preserved through cancellation** and remain attached/visible |
| (derived)           | delivery state change (owned by `FRD-08`) | re-derived via `deriveOrderStatus` | `FRD-08` invokes the pure function and persists the result in the same transaction                                                      |
| any (eligible)      | delete                                    | (removed)                          | cascades payments, history, items, and residual cancelled-delivery links; blocked when any item has a live delivery link                |

The cancel / delete eligibility gate is identical (`FR-05-24` / `FR-05-25` / `BR-05-18`): both are blocked when any item is linked to a **non-cancelled** delivery.

### Item delivery state (`OrderItemDeliveryState`)

`OrderItem.deliveryState` is a four-value enum: `NONE`, `ARRIVED_AT_STORE`, `IN_TRANSIT`, `DELIVERED`. Within the order domain the collector can only flip `NONE` ↔ `ARRIVED_AT_STORE` (`FR-05-39`); the `IN_TRANSIT` / `DELIVERED` transitions are owned by `FRD-08` (delivery membership). For display, the detail/list queries derive a richer `ItemDeliveryState` (`open` / `arrived_at_store` / `in_transit` / `delivered`) by combining the stored value with live (non-cancelled) delivery links: a live link wins (`delivered` if any linked delivery is `DELIVERED`, else `in_transit`), otherwise the stored `ARRIVED_AT_STORE` shows as `arrived_at_store`, else `open`.

### Payment state (distinct from fulfillment)

Payment progress is tracked separately from `OrderStatus` (`FR-05-33`) and is **never persisted as a status** — `paidAmount` / `remainingAmount` / `paymentPercentage` / `hasUnpaidBalance` are computed at query time from `totalCost` and the payment rows (`calculatePaymentSummary` + `deriveHasUnpaidBalance`). This is why a `COMPLETED` order can still carry a visible unpaid signal (`FR-05-34` / `FR-05-35`). A new payment may never exceed the current remaining balance (`FR-05-19` / `EXCEEDS_BALANCE`); editing the total below the amount already paid is refused (`FR-05-40` / `TOTAL_BELOW_PAID`).

## Confirmed

- Monetary amounts on an order stay anchored to the order's stored currency; the collector's later base currency preference alone does not retroactively change historical amounts.
- `Order` remains the canonical product term
- the initial order state is `OPEN`
- one exchange-rate value per order is the MVP model
- order note is one inline-editable textarea, not a list of note records
- payment records store amount and date and may be deleted
- discrepancy handling is a save-time modal, not a passive warning
- order actions in detail view follow the pattern: primary action (`Create delivery`) plus an inline "Actions" card that groups secondary navigation and destructive actions (ADR 0011 replaced the earlier "single More menu" affordance — see `FR-05-23`)
- the order detail header displays store name and order date as the primary title; the human-readable identifier (`ORD-YYYYMMDD-NN`) appears as secondary metadata
- when the collector opens store detail from order detail, the store page back link honors the encoded `?returnTo=` order-detail URL so the collector can return to the same order context instead of falling back to the store listing
- a cancelled order may be reactivated to `OPEN`; payments are preserved through cancellation and remain attached and visible after reactivation
- cancel and delete share the same eligibility rule: both are blocked when any item is linked to a non-cancelled delivery, so the collector must unlink the item from its delivery before cancelling or deleting the order
- monetary amounts are stored as `Int` in minor currency units (cents × 100); `exchangeRate` uses `Decimal`
- order currency is validated against the same hardcoded allowlist as the user's base currency preference (`ALLOWED_COLLECTOR_BASE_CURRENCY_CODES` in `src/lib/catalog/collectorCountries.ts`); no separate `Currency` database table exists
- reconciliation eligibility is bounded to the current month: when the collector changes base currency, only orders where `orderDate >= first day of the current month` AND `currencyCode !== newBaseCurrencyCode` AND `status != CANCELLED` are marked for reconciliation; orders from prior months are preserved in the database but are not included in reconciliation scope or dashboard rollups denominated in the new base currency
- reconciliation state is **persisted per order** via the boolean `Order.needsExchangeRateUpdate` (default `false`; migration `20260616230000_add_order_needs_exchange_rate_update`). An order is "needs currency update" when `needsExchangeRateUpdate = true` AND `currencyCode != user.baseCurrencyCode` AND `status != CANCELLED` (`buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts`). The flag is **set** when the collector changes their base currency — `flagOrdersForFxReconciliation(userId, newBase)` marks every order whose currency differs from the new base (and unmarks those that now match it); this only sets the flag, it never mutates `exchangeRate`. The flag is **cleared** when the rate is (re)entered: on order create (fresh rate), on edit when an `exchangeRate` is submitted, and on bulk reconciliation (`updateExchangeRatesAction` writes the rate **and** sets `needsExchangeRateUpdate = false`). So reconciling an order removes it from the pending set, and the banner/count converges to zero as the collector works through it. Cancelled orders are excluded from the pending view but keep their flag, so reactivating one re-surfaces it. (This is the design earlier drafts assumed; it was implemented in S16 after Sergio chose per-order tracking over a non-converging monthly heuristic.) The flag also surfaces as a **per-order indicator**: a `warning` chip (`detail.hero.chipFxPending`) on the order-detail hero next to the status chips (hidden on cancelled orders), and an inline `warning` (`form.exchangeRateOutdatedWarning`) under the edit-form exchange-rate field.
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

- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/bp-01-order-domain-foundation.md`
- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/bp-02-order-workspace-and-list-experience.md`
