---
id: BP-01
type: BLUEPRINT
slug: delivery-management
title: Delivery Management
status: ACTIVE
parent: FRD-08
children:
  - WO-01
  - WO-02
  - WO-03
  - WO-04
  - WO-05
  - WO-06
  - WO-07
last_updated: 2026-04-30
implementation_status: PLANNED
---

# BP-01 Delivery Management

## Purpose

Define the end-to-end delivery experience: persistence, eligibility, product-state transitions, create/edit flows, detail view, detail actions, list, and filtering. One single blueprint covers the full vertical of the delivery domain for the collector MVP.

## Runtime Components

- Prisma models for deliveries and delivery-linked product state
- delivery query and mutation modules under `src/lib/data/deliveries/`
- shared eligibility query (products by store, excluding ineligible)
- shared product-state transition helpers (arrived-at-store, in-transit, delivered)
- `deriveOrderStatus` integration wrapper (calls the pure function from [`FRD-05 · BP-01 · WO-02`](../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md) within the same transaction as any delivery mutation)
- delivery routes under `src/app/[locale]/(app)/deliveries`
- delivery detail route and route-level components
- delivery create and edit routes (single form, mode-aware)
- expandable delivery cards in the list
- filter sidebar patterned after `Stores`
- inline private-note component patterned after order and store notes

## Architecture Decisions

- The delivery domain is one coherent vertical, cut as a single blueprint with a thin foundation slice followed by vertical user-facing slices. There is no separate "backend blueprint" and "frontend blueprint".
- Delivery operates on order products, not whole orders, because partial grouping across orders is fundamental to the domain.
- Eligibility is query-driven: ineligible products never appear in the selector instead of being shown as disabled options.
- Product delivery state is recalculated from delivery actions. There are no manual repair steps.
- Cancel and delete stay separate: cancel preserves the delivery with `CANCELLED`, delete removes the record entirely where delete rules allow it.
- Reopen is explicit so delivered deliveries can be corrected without inventing a second "edit after delivered" mode.
- Reopen is also the primary visible recovery action for cancelled deliveries, so the collector can return the record to an editable state before making further corrections.
- Delivery detail uses grouped source-order sections, one private note section, and no automatic history timeline in MVP, for visual and interaction parity with orders.
- Source-order grouping in delivery detail exists for traceability of product origin, but the delivery remains the primary visual subject of the page.
- Product-name search remains a list-filter concern rather than a separate top-level search surface.
- The deliveries list opens in an active-deliveries default state: when no filter params are present, the route canonicalizes to an explicit `status=IN_TRANSIT` query, the sidebar shows that status selected, and the chip row reflects the same visible default.
- Deliveries list filtering uses two distinct date concepts instead of one combined date control: shipping date (`Delivery.deliveryDate`) uses a manual range, while `expectedArrival` supports both a manual range and collector-oriented presets (`Overdue`, `Due today`, `Next 7 days`, `Next 14 days`, `This month`).
- Expected-arrival presets and manual expected-arrival ranges are mutually exclusive within the same filter block. Choosing a preset updates the visible calendar range; manually editing that range clears the preset.
- Expected-arrival manual range filtering uses interval-overlap semantics: a delivery matches when any portion of its expected-arrival range overlaps the user-selected filter range.
- The deliveries detail back link should reuse the same `?returnTo=` pattern already established by orders so the collector can return from detail to the same filtered deliveries list state.
- Every delivery mutation that changes product-to-delivery associations (create, edit, mark delivered, reopen, cancel, delete) must call `deriveOrderStatus` for every affected order and persist the result within the same transaction.
- The detail-action hierarchy should reuse the existing order-detail split secondary pattern: a labeled secondary action plus an adjacent overflow trigger for additional actions.
- Delivery private notes follow the same inline-note rule as orders and stores: saving an empty trimmed value clears the stored note.
- Delete is discoverable but state-gated: a `DELIVERED` delivery keeps the `Delete` affordance visible, but the action is blocked with explanatory feedback until the collector reopens the delivery. Physical delete always requires a confirmation modal and returns to the deliveries list on success.
- `Delivery.deliveryDate` is presented to collectors as the shipping date. The actual received date is captured by the mark-delivered flow and is required when moving a delivery to `DELIVERED`.

## Contracts

- eligibility contract
  - input: store id, (optional) source order id for preselection
  - output: eligible products grouped by source order, excluding products that are already delivered or already attached to another active delivery
- create/edit contract
  - input: store, shipping date, expected arrival range, cost, currency, optional FX, selected product ids
  - invariant: both create and edit require at least one selected product at save time; a delivery with zero linked products is invalid and must not be persisted
  - output: persisted delivery, recalculated product states, and re-derived `OrderStatus` for every affected order
  - edit-specific guard: if the delivery is no longer in an editable lifecycle state, edit must redirect back to detail with feedback telling the collector to reopen first
  - product-selector search: an in-section product-name search input filters the already-loaded eligible products in place. Matching is case- and accent-insensitive, source-order groups with no matches are hidden, and a no-results empty state replaces the product list when nothing matches the current query. Filtering is entirely client-side and never refetches eligible products. The query resets when the collector switches stores.
- lifecycle contract
  - input: `markDelivered` with required received date, `reopen`, `cancel`, `delete`, `updatePrivateNote`, and `updateProductMembership` (from edit)
  - output: updated delivery state, updated product states, and re-derived `OrderStatus` for every affected order
  - mark-delivered guard: received date is required, must be past or current, and is persisted with the delivered state
- detail action chrome contract
  - `IN_TRANSIT`: primary `Mark delivered`, visible `Edit`, overflow `Cancel` and `Delete`
  - `DELIVERED`: primary `Reopen`; additional actions remain in the secondary / overflow affordances
  - `CANCELLED`: primary `Reopen`, overflow `Delete`
  - `Delete` remains visible in `DELIVERED` but is disabled until the collector reopens the delivery
- detail read contract
  - input: delivery id
  - output: delivery summary, grouped products by source order, current lifecycle state, action availability flags, received date when delivered, and the private note value
  - grouped source-order sections are expanded by default in the read-only detail view
- deliveries list contract
  - route: `/{locale}/deliveries`
  - visible primary action: `New delivery`, following the same collector-listing hero pattern used by orders and stores
  - output: paginated delivery cards sorted from oldest date to newest by default
  - each card shows store, shipping date, expected arrival range, and status; delivered cards also show received date
  - card expansion renders a flat product list only; it does not group by source order and does not show source-order secondary metadata in this slice
- list filter contract
  - input: status, one store, product-name text, shipping-date range, `expectedArrival` manual range or preset
  - output: URL-canonical filter state and removable chips patterned after `Stores`
  - default state: `status=IN_TRANSIT` is applied and materialized in the URL when no filter params are present
  - product-name query matches any included product by substring, case-insensitive and accent-insensitive
  - expected-arrival manual range matches by interval overlap rather than full containment
  - `OVERDUE` expected-arrival preset is an active-follow-up shortcut and must keep the visible status-filter state aligned to active deliveries

## Operational Priorities

- strict one-store boundary per delivery
- minimum-one-product invariant for every persisted delivery
- safe and centralized product-state recalculation
- predictable eligibility
- easy correction flows (edit and reopen)
- visual parity with orders
- filter persistence through the URL
- canonical collector route naming under `/deliveries`

## Dependencies

- order-product model from [`FRD-05`](../../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md)
- `deriveOrderStatus` pure function from [`FRD-05 · BP-01 · WO-02`](../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md) — must be called and the result persisted within every delivery mutation that changes product delivery associations
- user base-currency preference from [`FRD-07`](../../frd-07-user-settings/frd-07-user-settings.md)
- private app route shell from [`FRD-03`](../../frd-03-collector-app-shell/frd-03-collector-app-shell.md)

## Risks

- reopen and edit flows can create inconsistent product states if the recalculation logic is not centralized in shared helpers consumed by every mutation
- stale edit submissions can create hidden partial saves if eligibility and lifecycle status are not revalidated atomically at save time
- eligibility queries can become expensive if grouped order-product loading is not shaped carefully
- delete and cancel semantics can confuse users if the state rollback is not visible enough in the UI
- grouped product cards can become visually noisy if order identifiers and eligibility signals are not compact
- reopening delivered deliveries can create misleading UI if action affordances do not reflect the new editable state immediately
- re-implementing the split secondary plus overflow pattern separately in each detail screen would create inconsistent action hierarchy and duplicate accessibility work

## Extension Points

- future carrier integrations
- future delivery-cost analytics
- future delivery milestones beyond `IN_TRANSIT` and `DELIVERED`
- future dashboard deep links and saved filtered views
- future delivery history timeline if collector demand justifies it

## Implementation Plan

```mermaid
flowchart LR
  WO01["WO-01 Delivery Foundation<br/>(persistence, eligibility, transitions, deriveOrderStatus wrapper)"]
  WO02["WO-02 Delivery Create<br/>(from-order and standalone)"]
  WO03["WO-03 Delivery Detail (Read-only)"]
  WO04["WO-04 Delivery Detail Actions<br/>(note edit, delivered, reopen, cancel, delete)"]
  WO05["WO-05 Delivery Edit"]
  WO06["WO-06 Deliveries List"]
  WO07["WO-07 Deliveries List Filters"]

  WO01 --> WO02
  WO02 --> WO03
  WO02 --> WO05
  WO02 --> WO06
  WO03 --> WO04
  WO06 --> WO07
```

- `WO-01` is the foundation slice: Prisma schema, enums, Zod schemas, eligibility helpers, product-state transition helpers, and the `deriveOrderStatus` integration wrapper. No UI, no routes. It is the only slice exempt from the "must include an E2E acceptance path" rule because by design it ships no UI; it is validated with unit tests.
- `WO-02` Delivery Create must happen immediately after `WO-01` because every downstream slice assumes delivery records can exist.
- After `WO-02`, three slices unlock in parallel: `WO-03` (detail read-only), `WO-05` (edit), and `WO-06` (list). They can be implemented concurrently.
- `WO-04` (detail actions) depends on `WO-03` because it operates from the detail view surface.
- `WO-07` (filters) depends on `WO-06` (list).

## Linked Work Orders

- `work-orders/wo-01-delivery-foundation.md`
- `work-orders/wo-02-delivery-create.md`
- `work-orders/wo-03-delivery-detail-read-only.md`
- `work-orders/wo-04-delivery-detail-actions.md`
- `work-orders/wo-05-delivery-edit.md`
- `work-orders/wo-06-deliveries-list.md`
- `work-orders/wo-07-deliveries-list-filters.md`
