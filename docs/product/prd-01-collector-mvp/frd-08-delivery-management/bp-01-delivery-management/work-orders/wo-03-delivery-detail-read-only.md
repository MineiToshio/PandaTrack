---
id: WO-03
type: WORK_ORDER
slug: delivery-detail-read-only
title: Delivery Detail (Read-only)
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 99
last_updated: 2026-04-30
implementation_status: PLANNED
---

# WO-03 Delivery Detail (Read-only)

## Summary

Build the read-only delivery detail surface: the summary header, the grouped-products section, and the display of carrier, tracking, status, expected arrival range, cost, currency, and note. This slice is intentionally read-only: it helps the collector inspect one delivery quickly and understand where each received product came from without introducing mutation behavior yet.

Detail mutations (inline note edit, mark delivered, reopen, cancel, delete) live in [`WO-04`](wo-04-delivery-detail-actions.md). Delivery edit lives in [`WO-05`](wo-05-delivery-edit.md).

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — persistence and eligibility foundation
- [`WO-02`](wo-02-delivery-create.md) — deliveries must exist before there is anything to view

## In Scope

- delivery detail route and route-level layout
- delivery summary header: store, delivery identifier, shipping date, expected arrival range, status, received date when delivered, cost, currency, optional carrier, optional tracking
- one functional `Edit` entry point in the header that routes to `WO-05`; no other live actions in this slice
- grouped products section: products grouped by source order, each group open by default
- product rows that show product name, quantity, and product type when present
- source-order grouping treated as secondary traceability context, not as the primary visual unit of the screen
- read-only rendering of the private note value, with the section still shown when the note is empty
- empty/loading/error states
- tracking rendered as an external link only when the stored value is already a valid URL; otherwise it remains plain text
- no mutations and no live action menu in this slice
- PostHog analytics events for view and expansion interactions
- automated tests covering the detail read path (at minimum one E2E that opens a created delivery and verifies the summary and grouped products render correctly)

## Out of Scope

- inline note edit (covered in [`WO-04`](wo-04-delivery-detail-actions.md))
- mark delivered, reopen, cancel, delete (covered in [`WO-04`](wo-04-delivery-detail-actions.md))
- delivery edit flow (covered in [`WO-05`](wo-05-delivery-edit.md))
- automatic history timeline (out of scope for MVP per `BR-08-05`)
- dashboard aggregation

## Requirements

- `FR-08-25` (note is rendered read-only here; inline edit lives in `WO-04`)
- `FR-08-26` (this slice exposes only the edit entry point; the shared overflow hierarchy is finalized in `WO-04`)
- `BR-08-05`, `BR-08-06`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — detail read contract, grouped-products presentation decision

## UX Notes

- The delivery itself remains the primary subject of the page. Grouping by source order exists to preserve traceability when one delivery includes products from multiple orders of the same store.
- Source-order groups are expanded by default because the collector opened a single detail page to inspect what is inside that delivery. Collapsing remains available when the product list is long.
- The header exposes only one live action in this slice: `Edit`. The split secondary action plus overflow trigger pattern used by order detail is reserved for the mutation slice in [`WO-04`](wo-04-delivery-detail-actions.md).
- The private note section is always rendered. When no note exists yet, the section shows an empty-state placeholder so the collector understands the delivery supports one private note even before inline editing ships in `WO-04`.

## Technical Notes

- Implement the detail page under `src/app/[locale]/(app)/deliveries/[id]`, replacing the temporary post-create stub introduced by [`WO-02`](wo-02-delivery-create.md).
- The detail query should return the delivery summary plus products grouped by source order, including enough product metadata to render `name`, `quantity`, and optional `productTypeKey`.
- The detail read contract should continue returning action-availability context for downstream slices, but `WO-03` must not wire those actions to live buttons yet.
- Tracking should be rendered as an external link only when the persisted value parses as a valid absolute URL. Open that link in a new tab with the usual safe external-link attributes. Free-text tracking values remain plain text.

## Accessibility Notes

- Use semantic disclosure controls for grouped-order expansion so keyboard users can open and close groups predictably and screen readers can perceive expanded/collapsed state.
- Ensure the read-only note placeholder and any empty/error state remain announced meaningfully when relevant.

## E2E Acceptance Tests

- Opening a delivery shows its summary header with store, delivery identifier, shipping date, status, cost, currency, carrier, tracking, and expected arrival range as applicable.
- A delivered delivery shows the received date once `WO-04` has captured it through the mark-delivered action.
- The grouped products section lists the products of the delivery grouped by source order, with every group expanded by default and the order identifier visible for each group.
- Each product row shows name, quantity, and product type when present.
- The private note section is always visible in this slice; when a note exists it is displayed read-only, and when it does not exist the empty placeholder is shown.
- The header exposes a working entry point to the edit flow and does not exercise any live mutation menu in this slice.
- A tracking value that is already a valid URL opens in a new tab; non-URL tracking values remain plain text.

## Analytics

- PostHog event when the delivery detail view is opened, including the delivery status
- PostHog event when a grouped-order section is expanded or collapsed
