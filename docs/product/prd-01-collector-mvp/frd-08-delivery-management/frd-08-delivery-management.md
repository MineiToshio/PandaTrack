---
id: FRD-08
type: FRD
slug: delivery-management
title: Delivery Management
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-12
source_features:
  - FEAT-0015
implementation_status: IMPLEMENTED
---

# FRD-08 Delivery Management

## Overview

Define the store-scoped delivery workflow that groups eligible order products into one delivery, tracks the delivery lifecycle, and resolves delivered product state back into the order domain.

## Domain Goal

Give collectors a reliable way to consolidate products from one store into deliveries, track what is already at the store, and mark what has finally reached them.

## Current State

### Implemented

- the full delivery vertical ships under `/{locale}/deliveries`: list (filters, removable URL chips, oldest-first sort, pagination, loading/empty/empty-filtered states), detail (per-status hero, source-order-grouped products, summary, private note), create (from-order and standalone entry points, eligibility empty state), and edit
- delivery lifecycle actions: mark delivered (with required received date), reopen, cancel, delete, plus inline private-note save — each re-derives affected `OrderStatus` in the same transaction
- delivery persistence, eligibility queries, and `arrived at store` / `in transit` / `delivered to user` progression (data foundation from BP-01 WO-01/WO-02, lifecycle UI from the S9 redesign)
- `Delivery.receivedDate` column added (migration `20260612224123_add-delivery-received-date`) to back FR-08-22 and FR-08-31
- human-readable delivery id format `DLV-YYYYMMDD-NN`
- [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) defines the order-product structure that delivery eligibility depends on

### Known issues

- shipping/received dates can display one day early in negative timezones (domain dates persisted at UTC midnight formatted without `timeZone: "UTC"`); systemic across orders and deliveries — tracked for a dedicated fix
- mobile list action row overflows the viewport by a few pixels at 390px (shared pattern with the order list)

## User Stories

### US-08-01 Group products into one delivery

As a collector, I want to create one delivery that includes products from multiple orders of the same store so I can track the real delivery I am waiting on.

### US-08-02 Know what is already at the store

As a collector, I want to mark products as already arrived at the store before I create a delivery so I can remember what is ready to ship.

### US-08-03 Correct delivery mistakes

As a collector, I want to reopen, cancel, or edit a delivery when the store changes what is being sent so PandaTrack stays aligned with reality.

## Functional Requirements

- `FR-08-01`: A delivery must belong to exactly one store.
- `FR-08-02`: A delivery may contain products from multiple orders of the same store.
- `FR-08-03`: Products from different stores must never appear in the same delivery.
- `FR-08-04`: A delivery must contain at least one product when it is created or saved through edit.
- `FR-08-04a`: Each order product is treated as an **atomic shippable unit** and is either fully included in this `entrega` or not included at all. The create and edit flows must not expose a per-product quantity selector; the selection control is a single boolean per order product. Collectors who expect units of the same SKU to arrive separately must split them at order creation time per [`FR-05-08a`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md). The canonical rule and the upgrade path for future partial fulfillment live in `docs/product/glossary.md`.
- `FR-08-05`: A delivery must require a shipping date and prefill it with the current date on create.
- `FR-08-06`: Shipping date selection must allow only past or current dates.
- `FR-08-07`: A delivery must support a required delivery cost, including `0`.
- `FR-08-08`: A delivery must support a delivery currency selected by the user.
- `FR-08-09`: Delivery currency must default to the user's base currency when present.
- `FR-08-10`: When delivery currency differs from the user's base currency, the delivery flow must require one exchange-rate value for reporting.
- `FR-08-11`: A delivery must support an expected arrival date range.
- `FR-08-13`: Delivery state must be derived from lifecycle actions rather than edited directly through a free status field.
- `FR-08-14`: Delivery states for MVP must include `IN_TRANSIT`, `DELIVERED`, and `CANCELLED`.
- `FR-08-15`: The create-delivery flow must support starting from an order with store and eligible products preselected.
- `FR-08-16`: The standalone create-delivery flow must first choose a store and then show eligible products for that store only.
- `FR-08-17`: Delivery store options must include only stores that still have eligible products.
- `FR-08-18`: Delivery product selection must show eligible products grouped by their source order.
- `FR-08-19`: Products already delivered or already attached to another active delivery must not appear in delivery selection results.
- `FR-08-20`: When a product is added to a delivery, it must automatically become `IN_TRANSIT` regardless of its prior state (`NONE` or `ARRIVED_AT_STORE`).
- `FR-08-21`: A product may belong to only one delivery at a time.
- `FR-08-22`: Marking a delivery as delivered must require the collector to select the received date, then mark every associated product as delivered to the user.
- `FR-08-23`: Reopening a delivered or cancelled delivery must recalculate delivery-related product states so they are editable again, restoring the detail view to an editable lifecycle state. Reopen returns the delivery to `IN_TRANSIT`, returns its products to `IN_TRANSIT`, and clears the stored received date. Reopen is only valid from `DELIVERED` or `CANCELLED`; reopening an `IN_TRANSIT` delivery is rejected. When reopening a `CANCELLED` delivery, any product that was re-attached to another active (non-cancelled) delivery while this one was cancelled blocks the reopen (the one-delivery-per-product rule in `BR-08-08`); the collector must resolve that conflict first.
- `FR-08-24`: Removing a product from a delivery during edit must recalculate that product's delivery-related state. The delivery's store is immutable in edit mode (its products depend on the store); changing stores requires deleting the delivery and creating a new one. Edit is only permitted while the delivery is `IN_TRANSIT`; a `DELIVERED` or `CANCELLED` delivery must be reopened first (the edit route redirects to detail otherwise).
- `FR-08-25`: Cancelling or deleting a delivery must return all of its still-unfulfilled products to `arrived at store`. Physical delete is allowed only while the delivery is `IN_TRANSIT` or `CANCELLED`; a `DELIVERED` delivery must be reopened first.
- `FR-08-26`: Delivery detail must expose one inline-editable private note field that can be saved without entering full edit mode, including saving an empty value to clear the note.
- `FR-08-27`: Delivery detail actions must follow the same action hierarchy as orders: one primary action, one secondary action, and destructive actions inside `More`.
- `FR-08-28`: The deliveries list must support filters for store, product-name text, and date range.
- `FR-08-29`: Deliveries list filters must persist in the URL and render removable chips in the same interaction pattern used by `Stores`.
- `FR-08-30`: The deliveries list must sort from oldest date to newest by default and paginate with the same collector-workspace pattern used by the order and store lists.
- `FR-08-31`: Each delivery card in the list must show store, shipping date, expected arrival range, and status. Delivered cards must also show the received date.
- `FR-08-32`: Each delivery card must expand to show the products included in that delivery as one flat list, without source-order grouping.
- `FR-08-33`: The deliveries list must expose a visible primary action to create a new delivery, following the collector-workspace listing pattern used by orders and stores.
- `FR-08-34`: The delivery product selector must expose an in-section product-name search input that filters the already-loaded eligible products in place. Matching must be case-insensitive and accent-insensitive. Source-order groups with no matching products must be hidden, and when no products match the current query the section must show an empty-state message instead of the product list. Filtering must be entirely client-side and must not refetch eligible products.
- `FR-08-35`: The deliveries list must expose a user-selectable sort control inside the filter surface with four options: `oldest` (shipping date ascending — the default per `FR-08-30`), `recent` (shipping date descending), `eta-asc` (expected-arrival start ascending, deliveries without an expected arrival sorted last), and `store-asc` (store name ascending). The active sort persists in the URL via a `sort` param, which is omitted from the URL when it equals the default (`oldest`).

## Business Rules

- `BR-08-01`: Delivery is a separate domain from orders because it can group products from multiple orders within one store.
- `BR-08-02`: `arrived at store`, `in transit`, and `delivered to user` are separate product milestones.
- `BR-08-03`: Products that are already delivered or already attached to another active delivery are not eligible for new delivery selection and should not appear as disabled options.
- `BR-08-04`: When a delivery is reopened, the collector may edit products, cost, and dates again.
- `BR-08-05`: Delivery detail should not expose a separate automatic history timeline in MVP.
- `BR-08-06`: Delivery note follows the same single-textarea private-note pattern as orders and stores, including the ability to clear the note by saving an empty value.
- `BR-08-07`: Cancel and delete remain separate:
  - cancel preserves the delivery record with `CANCELLED`
  - delete removes it physically when delete rules allow it
  - delete must stay visible in the detail action menu so the collector can discover the rule, but a `DELIVERED` delivery cannot be deleted until it is reopened
- `BR-08-08`: A product belongs to at most one active (non-cancelled) delivery at a time (`FR-08-21`). Because cancelling a delivery returns its products to `arrived at store`, those products can be selected into a new delivery while the original stays `CANCELLED`. Reopening the original cancelled delivery is therefore blocked when any of its products now belongs to another active delivery, so reopen can never resurrect a duplicate delivery membership. The blocked reopen is surfaced as an expected, non-destructive error, not a silent failure.

## Acceptance Criteria

### `AC-08-01`

- Given the collector creates a delivery from an order
- When the create-delivery view opens
- Then the store is prefilled
- And eligible products from that source order are already selected

### `AC-08-02`

- Given a collector opens the standalone delivery create flow
- When they choose a store
- Then only eligible products from that store appear
- And those products are grouped by source order

### `AC-08-03`

- Given a collector adds a product to a delivery
- When that product was in state `NONE` or `ARRIVED_AT_STORE`
- Then it becomes `IN_TRANSIT` automatically

### `AC-08-04`

- Given a collector marks a delivery as delivered
- When the operation succeeds
- Then all products linked to that delivery become delivered
- And the selected received date is saved on the delivery

### `AC-08-05`

- Given a collector cancels, deletes, or reopens a delivery
- When the action completes
- Then all affected products recalculate to the correct post-action state

### `AC-08-06`

- Given a cancelled delivery whose products were re-added to another active delivery
- When the collector tries to reopen the original cancelled delivery
- Then the reopen is blocked with an expected error
- And the original delivery stays `CANCELLED`

### `AC-08-07`

- Given the collector opens the deliveries list
- When they change the sort control to `recent`, `eta-asc`, or `store-asc`
- Then the list re-orders accordingly
- And the selected sort persists in the URL (and is omitted when it is the default `oldest`)

## Implementation Notes

- This FRD depends on [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) for order items, delivery eligibility, and order completion derivation.
- When a delivery mutation changes the status of any delivery (create, mark delivered, cancel, delete, reopen), this FRD's implementation is responsible for calling the pure `deriveOrderStatus` function defined in [`FRD-05 · BP-01 · WO-02`](../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md) for each affected order, and persisting the resulting `OrderStatus` within the same transaction.
- Delivery list and detail should also prefer expandable cards over rigid tables for parity with the order workspace and better mobile behavior.
- The deliveries list should expose a visible primary create action and reuse the same pagination pattern already established by the collector workspace order and store listings.
- Deliveries-list expansion should optimize for scannability in this MVP slice: products render as a flat list without source-order grouping or source-order secondary metadata.
- In delivery detail, that source-order grouping is traceability context rather than the primary content hierarchy: the collector is still reading one delivery first, then the origin of its products.
- Delivery routes in the collector app use `/{locale}/deliveries`. Deleting a delivery from detail returns the collector to the deliveries list.
- In UI copy, `Delivery.deliveryDate` is presented as shipping date. It is the date the shipment is created/sent, not the date the collector receives it.
- The received date is captured only by the mark-delivered flow, is required for that action, and must allow only past or current dates.

## Lifecycle Interaction Model

Each detail action has a distinct confirmation and feedback contract. The visual treatment of toasts, the undo affordance, and the mobile sticky-bar / actions-sheet chrome are owned by the [delivery FDD](fdd-08-delivery-management.md); this section fixes only the functional behavior.

| Action            | Confirmation                                | Apply / feedback model                                                                                                                      | Post-action target               |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Save private note | none (inline)                               | inline save; a toast is shown only when the stored value actually changed                                                                   | stays on detail                  |
| Mark delivered    | modal (captures the required received date) | optimistic confirmation: the modal closes on submit and the new state shows immediately; on server failure it rolls back and shows an error | stays on detail                  |
| Cancel            | confirmation modal                          | optimistic confirmation; rolls back on failure                                                                                              | stays on detail                  |
| Reopen            | none (not destructive)                      | executes directly with a neutral undo affordance; undo runs the inverse mutation within a short window                                      | stays on detail                  |
| Delete            | confirmation modal (stated as permanent)    | awaited (not optimistic, because it is irreversible): the modal stays until the server confirms                                             | redirects to the deliveries list |

## Error Contract

Delivery mutations return typed, expected error codes (not exceptions) so flows can recover without noisy monitoring. Unexpected failures are captured once with delivery-safe context. Expected codes:

- create / edit: `STORE_NOT_FOUND`, `NO_PRODUCTS_SELECTED`, `PRODUCTS_FROM_DIFFERENT_STORE`, `PRODUCT_NOT_ELIGIBLE` (carries the offending product ids so the selector can refresh), `EXCHANGE_RATE_REQUIRED` (currency differs from base and no rate was supplied), and — edit only — `INVALID_STATUS` (the delivery is no longer `IN_TRANSIT`). A concurrent product-state change is reconciled into `PRODUCT_NOT_ELIGIBLE`.
- mark delivered / cancel / delete / reopen / note: `DELIVERY_NOT_FOUND`; lifecycle guards return `INVALID_STATUS` (mark delivered and cancel require `IN_TRANSIT`; delete rejects `DELIVERED`; reopen rejects `IN_TRANSIT`); reopen additionally returns `PRODUCTS_IN_OTHER_DELIVERY` per `BR-08-08`.
- The validation layer rejects malformed input before these run (future shipping/received dates, `expectedArrivalTo` before `expectedArrivalFrom`, negative or over-cap cost, unsupported currency, out-of-range exchange rate, empty product set).

## Analytics

Delivery events are namespaced under `POSTHOG_EVENTS.DELIVERY` in `src/lib/constants.ts`:

- create/edit flow: `delivery_create_flow_opened`, `delivery_created`, `delivery_edit_flow_opened`, `delivery_edited`
- lifecycle: `delivery_marked_delivered`, `delivery_reopened`, `delivery_cancelled`, `delivery_deleted`, `delivery_note_saved`, `delivery_note_deleted`
- list: `deliveries_list_filtered`, `deliveries_list_filter_chip_removed`, `deliveries_list_filters_reset`, `deliveries_list_card_expanded`, `deliveries_list_card_collapsed`
- mobile detail chrome: `delivery_detail_sticky_primary_clicked`, `delivery_detail_actions_sheet_opened`

Mutation events carry counts (product / affected-order / added / removed) but never the free-text note value.

## Screens and Data Contract

Each delivery route under `/{locale}/(app)/deliveries`. All routes are authenticated and scoped to the session user; a delivery that does not belong to the user resolves to 404 (not 403) to avoid enumeration. Visual layout is owned by the [FDD](fdd-08-delivery-management.md); this section fixes purpose, data loaded, actions, and states.

### List — `/{locale}/deliveries`

- **Purpose:** the deliveries workspace, opened focused on active follow-up work.
- **Data loaded:** `getDeliveriesList(userId, filters)` (paginated cards with aggregated product count, 30/page); `getDeliveryStoreOptions(userId)` (distinct stores that appear in the user's deliveries, for the filter picker); heading counts for `IN_TRANSIT` and `DELIVERED`.
- **Actions:** navigation only — `New delivery` → `/new`; each card → detail carrying the current list URL via `?returnTo=`. No mutations.
- **States:** loading skeleton; empty (`noDeliveries`, with create / browse-orders CTAs); empty-filtered (`noResults`, keeps chips, offers reset). Default URL canonicalizes to `?status=IN_TRANSIT` (see filter contract).

### Detail — `/{locale}/deliveries/[id]`

- **Purpose:** inspect one delivery and run its lifecycle actions.
- **Data loaded:** `getDeliveryDetail(deliveryId, userId)` → summary, products grouped by source order (sorted by order date then item position), aggregated product count, current lifecycle state, action-availability flags, `receivedDate` when delivered, and the private note; plus the user's base currency for FX display.
- **Actions:** `saveDeliveryNoteAction`, `markDeliveredAction`, `reopenDeliveryAction`, `cancelDeliveryAction`, `deleteDeliveryAction` (behavior per Lifecycle Interaction Model); `Edit` → `/[id]/edit`.
- **States:** per-status hero (IN_TRANSIT = expected-arrival window + overdue signal; DELIVERED = received + shipped + cost; CANCELLED = shipped + products-returned note); 404 when not owned.

### Create — `/{locale}/deliveries/new` (optional `?sourceOrderId=`)

- **Purpose:** create one store-scoped delivery from eligible products, via two entry points (`FR-08-15`/`FR-08-16`).
- **Data loaded:** `getStoresWithEligibleProducts(userId)` (stores with ≥1 product in `NONE`/`ARRIVED_AT_STORE`); from-order entry additionally validates and loads `getDeliverySourceOrder(orderId, userId)`; once a store is known, `getEligibleProductsForStore(storeId, userId)` (grouped by source order, ineligible excluded entirely per `BR-08-03`).
- **Actions:** `createDeliveryAction`.
- **States:** eligibility empty state when no store has eligible products and no `sourceOrderId` (`FR-08-17`); in-section client-side product search (`FR-08-34`); field validation errors; concurrent-ineligible recovery (`PRODUCT_NOT_ELIGIBLE` carries product ids so the selector can refresh).

### Edit — `/{locale}/deliveries/[id]/edit`

- **Purpose:** adjust an existing delivery's product membership and metadata.
- **Guard:** editable only while `IN_TRANSIT`; a `DELIVERED`/`CANCELLED` delivery redirects to detail with a reopen-first message (`FR-08-24`).
- **Data loaded:** `getDeliveryDetail` for current values; `getEligibleProductsForStore(storeId, userId, excludeDeliveryId)` so the delivery's own products stay selectable alongside other eligible products of the same store. The store itself is immutable (read-only display, never re-selected).
- **Actions:** `editDeliveryAction`.
- **States:** unsaved-changes navigation guard; field validation; atomic stale-edit failure (membership/metadata revalidated inside the transaction — no partial save).

## State Model

### Delivery lifecycle (`DeliveryStatus`)

A delivery is created `IN_TRANSIT` and never has its status edited through a free field (`FR-08-13`); status moves only through lifecycle actions:

| From                       | Action            | To           | Product effect                                     | Order re-derivation         |
| -------------------------- | ----------------- | ------------ | -------------------------------------------------- | --------------------------- |
| —                          | create            | `IN_TRANSIT` | selected products → `IN_TRANSIT`                   | yes                         |
| `IN_TRANSIT`               | mark delivered    | `DELIVERED`  | all products → `DELIVERED`; sets `receivedDate`    | yes                         |
| `IN_TRANSIT`               | cancel            | `CANCELLED`  | products → `ARRIVED_AT_STORE`                      | yes                         |
| `IN_TRANSIT`               | edit (add/remove) | `IN_TRANSIT` | added → `IN_TRANSIT`; removed → `ARRIVED_AT_STORE` | yes                         |
| `DELIVERED`                | reopen            | `IN_TRANSIT` | products → `IN_TRANSIT`; clears `receivedDate`     | yes                         |
| `CANCELLED`                | reopen            | `IN_TRANSIT` | products → `IN_TRANSIT`; clears `receivedDate`     | yes (blocked by `BR-08-08`) |
| `IN_TRANSIT` / `CANCELLED` | delete            | (removed)    | still-unfulfilled products → `ARRIVED_AT_STORE`    | yes                         |

`DELIVERED` cannot be deleted directly and cannot be edited directly — reopen first (`BR-08-07`, `FR-08-24`).

### Product delivery state (`OrderItemDeliveryState`)

Persisted on `OrderItem.deliveryState`. Four values: `NONE`, `ARRIVED_AT_STORE`, `IN_TRANSIT`, `DELIVERED`. Eligibility for a new/edited delivery = `NONE` or `ARRIVED_AT_STORE` only. Once a product has been in a delivery it never returns to `NONE`; its resting state after cancel/delete/edit-remove is `ARRIVED_AT_STORE`.

### Order-status re-derivation

Every delivery mutation that changes product-to-delivery associations re-derives, within the same transaction, the `OrderStatus` of each affected order by mapping product states (`NONE`/`ARRIVED_AT_STORE` → `open`, `IN_TRANSIT` → `in_transit`, `DELIVERED` → `delivered`) into the pure `deriveOrderStatus` from [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md). Orders already `CANCELLED` are skipped (the order lifecycle owns that status), and a write happens only when the derived status differs from the stored one.

## Confirmed

- delivery is one separate FRD from orders and payments
- a delivery always belongs to one store only
- one product may belong to only one delivery
- multiple active deliveries per store are allowed
- ineligible products should disappear from selection rather than showing as disabled rows
- delivery detail uses one private note and no automatic history timeline in MVP
- delivery detail uses these visible lifecycle actions by status:
  - `IN_TRANSIT`: primary `Mark delivered`, visible secondary `Edit`, overflow `Cancel` and `Delete`
  - `DELIVERED`: primary `Reopen`, with additional actions in secondary / overflow chrome
  - `CANCELLED`: primary `Reopen`, overflow `Delete`

## Open Questions

- whether delivery costs should later appear as a separate dashboard series or merge into one broader spending summary
- whether post-MVP delivery workflows should reintroduce carrier and tracking-number capture if integrated with deep-link tracking, courier-reliability analytics, or arrival alerts
- whether post-MVP delivery workflows should support attachments such as screenshots or labels

## Out of Scope

- order payment capture
- dashboard implementation details
- carrier integrations or automatic tracking sync
- cross-store delivery grouping

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md`
