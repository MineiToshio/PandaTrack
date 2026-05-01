---
id: FRD-08
type: FRD
slug: delivery-management
title: Delivery Management
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-04-30
source_features:
  - FEAT-0015
implementation_status: PLANNED
---

# FRD-08 Delivery Management

## Overview

Define the store-scoped delivery workflow that groups eligible order products into one delivery, tracks the delivery lifecycle, and resolves delivered product state back into the order domain.

## Domain Goal

Give collectors a reliable way to consolidate products from one store into deliveries, track what is already at the store, and mark what has finally reached them.

## Current State

### Implemented

- no delivery implementation exists yet in PandaTrack
- the private app shell will expose a `Deliveries` navigation surface aligned to this FRD under `/{locale}/deliveries`
- [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) now defines the order-product structure that delivery eligibility depends on

### Planned

- delivery persistence and product eligibility rules
- store-scoped product selection across multiple orders
- `arrived at store`, `in transit`, and `delivered to user` progression
- delivery create/edit/detail/list views
- delivery cancel, delete, delivered, and reopen flows
- one private note field per delivery

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
- `FR-08-23`: Reopening a delivered or cancelled delivery must recalculate delivery-related product states so they are editable again, restoring the detail view to an editable lifecycle state.
- `FR-08-24`: Removing a product from a delivery during edit must recalculate that product's delivery-related state.
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
