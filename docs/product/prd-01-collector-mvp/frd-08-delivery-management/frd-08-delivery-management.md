---
id: FRD-08
type: FRD
slug: delivery-management
title: Delivery Management
status: ACTIVE
parent: PRD-01
children:
  - BP-01
  - BP-02
last_updated: 2026-04-03
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
- the private app shell already exposes a `Shipments` navigation surface that this FRD can later align to
- [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) now defines the order-product structure that delivery eligibility depends on

### Planned

- delivery persistence and product eligibility rules
- store-scoped product selection across multiple orders
- `arrived at store`, `in transit`, and `delivered to user` progression
- delivery create/edit/detail/list views
- delivery cancel, delete, delivered, and reopen flows
- one private note field per delivery

## User Stories

### US-08-01 Group products into one shipment

As a collector, I want to create one delivery that includes products from multiple orders of the same store so I can track the real shipment I am waiting on.

### US-08-02 Know what is already at the store

As a collector, I want to mark products as already arrived at the store before I create a delivery so I can remember what is ready to ship.

### US-08-03 Correct shipment mistakes

As a collector, I want to reopen, cancel, or edit a delivery when the store changes what is being shipped so PandaTrack stays aligned with reality.

## Functional Requirements

- `FR-08-01`: A delivery must belong to exactly one store.
- `FR-08-02`: A delivery may contain products from multiple orders of the same store.
- `FR-08-03`: Products from different stores must never appear in the same delivery.
- `FR-08-04`: A delivery must require a delivery date and prefill it with the current date on create.
- `FR-08-05`: Delivery date selection must allow only past or current dates.
- `FR-08-06`: A delivery must support a required delivery cost, including `0`.
- `FR-08-07`: A delivery must support a delivery currency selected by the user.
- `FR-08-08`: Delivery currency must default to the user's base currency when present.
- `FR-08-09`: When delivery currency differs from the user's base currency, the delivery flow must require one exchange-rate value for reporting.
- `FR-08-10`: A delivery must support an expected arrival date range.
- `FR-08-11`: Carrier and tracking fields must be optional free text.
- `FR-08-12`: Delivery state must be derived from lifecycle actions rather than edited directly through a free status field.
- `FR-08-13`: Delivery states for MVP must include `IN_TRANSIT`, `DELIVERED`, and `CANCELLED`.
- `FR-08-14`: The create-delivery flow must support starting from an order with store and eligible products preselected.
- `FR-08-15`: The standalone create-delivery flow must first choose a store and then show eligible products for that store only.
- `FR-08-16`: Delivery store options must include only stores that still have eligible products.
- `FR-08-17`: Delivery product selection must show eligible products grouped by their source order.
- `FR-08-18`: Products already delivered or already attached to another active delivery must not appear in delivery selection results.
- `FR-08-19`: If a product is added to a delivery and was not previously marked as arrived at store, it must automatically become arrived at store.
- `FR-08-20`: A product may belong to only one delivery at a time.
- `FR-08-21`: Marking a delivery as delivered must mark every associated product as delivered to the user.
- `FR-08-22`: Reopening a delivered delivery must recalculate delivery-related product states so they are editable again.
- `FR-08-23`: Removing a product from a delivery during edit must recalculate that product's delivery-related state.
- `FR-08-24`: Cancelling or deleting a delivery must return all of its still-unfulfilled products to `arrived at store`.
- `FR-08-25`: Delivery detail must expose one inline-editable private note field that can be saved without entering full edit mode.
- `FR-08-26`: Delivery detail actions must follow the same action hierarchy as orders: one primary action, one secondary action, and destructive actions inside `More`.
- `FR-08-27`: The deliveries list must support filters for store, product-name text, and date range.
- `FR-08-28`: Deliveries list filters must persist in the URL and render removable chips in the same interaction pattern used by `Stores`.
- `FR-08-29`: The deliveries list must sort from oldest date to newest by default.
- `FR-08-30`: Each delivery card in the list must show store, delivery date, expected arrival range, status, carrier, and tracking.
- `FR-08-31`: Each delivery card must expand to show the grouped products included in that delivery.

## Business Rules

- `BR-08-01`: Delivery is a separate domain from orders because it can group products from multiple orders within one store.
- `BR-08-02`: `arrived at store`, `in transit`, and `delivered to user` are separate product milestones.
- `BR-08-03`: Products that are already delivered or already attached to another active delivery are not eligible for new delivery selection and should not appear as disabled options.
- `BR-08-04`: When a delivery is reopened, the collector may edit products, carrier, tracking, cost, and dates again.
- `BR-08-05`: Delivery detail should not expose a separate automatic history timeline in MVP.
- `BR-08-06`: Delivery note follows the same single-textarea private-note pattern as orders and stores.
- `BR-08-07`: Cancel and delete remain separate:
  - cancel preserves the delivery record with `CANCELLED`
  - delete removes it physically when delete rules allow it

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
- When that product was not previously marked as arrived at store
- Then it becomes arrived at store automatically

### `AC-08-04`

- Given a collector marks a delivery as delivered
- When the operation succeeds
- Then all products linked to that delivery become delivered

### `AC-08-05`

- Given a collector cancels, deletes, or reopens a delivery
- When the action completes
- Then all affected products recalculate to the correct post-action state

## Implementation Notes

- This FRD depends on [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) for order items, delivery eligibility, and order completion derivation.
- Delivery list and detail should also prefer expandable cards over rigid tables for parity with the order workspace and better mobile behavior.
- Product grouping should surface the order identifier prominently because delivery selection spans multiple orders from one store.

## Confirmed

- delivery is one separate FRD from orders and payments
- a delivery always belongs to one store only
- one product may belong to only one delivery
- multiple active deliveries per store are allowed
- ineligible products should disappear from selection rather than showing as disabled rows
- delivery detail uses one private note and no automatic history timeline in MVP

## Open Questions

- whether delivery costs should later appear as a separate dashboard series or merge into one broader spending summary
- whether future delivery analytics should expose carrier performance by store
- whether post-MVP delivery workflows should support attachments such as screenshots or labels

## Out of Scope

- order payment capture
- dashboard implementation details
- carrier integrations or automatic tracking sync
- cross-store delivery grouping

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-08-delivery-management/bp-01-delivery-domain-and-product-allocation/bp-01-delivery-domain-and-product-allocation.md`
- `docs/product/prd-01-collector-mvp/frd-08-delivery-management/bp-02-delivery-workspace-and-list-experience/bp-02-delivery-workspace-and-list-experience.md`
