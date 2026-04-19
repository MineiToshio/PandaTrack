---
id: WO-03
type: WORK_ORDER
slug: delivery-detail-read-only
title: Delivery Detail (Read-only)
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 99
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-03 Delivery Detail (Read-only)

## Summary

Build the read-only delivery detail surface: the summary header, the grouped-products section, and the display of carrier, tracking, status, expected arrival range, cost, currency, and note. Read-only; no mutations from this slice.

Detail mutations (inline note edit, mark delivered, reopen, cancel, delete) live in [`WO-04`](wo-04-delivery-detail-actions.md). Delivery edit lives in [`WO-05`](wo-05-delivery-edit.md).

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — persistence and eligibility foundation
- [`WO-02`](wo-02-delivery-create.md) — deliveries must exist before there is anything to view

## In Scope

- delivery detail route and route-level layout
- delivery summary header: store, delivery date, expected arrival range, status, cost, currency, optional carrier, optional tracking
- grouped products section: products grouped by source order, each showing the order identifier prominently because delivery selection spans multiple orders from one store
- read-only rendering of the private note value (editing is covered in `WO-04`)
- empty/loading/error states
- entry point to the edit flow (link to `WO-05` surface)
- no mutations and no action menu in this slice
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
- `FR-08-26` (the action hierarchy surface is introduced here, but action wiring happens in `WO-04`)
- `BR-08-05`, `BR-08-06`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — detail read contract, grouped-products presentation decision

## E2E Acceptance Tests

- Opening a delivery shows its summary header with store, date, status, cost, currency, carrier, tracking, and expected arrival range as applicable.
- The grouped products section lists the products of the delivery grouped by source order, with the order identifier visible for each group.
- The private note value is displayed read-only in this slice.
- No action menu wiring is exercised in this slice (menu affordance may be present but has no behavior yet, or is added in `WO-04`).

## Analytics

- PostHog event when the delivery detail view is opened, including the delivery status
- PostHog event when a grouped-order section is expanded or collapsed
