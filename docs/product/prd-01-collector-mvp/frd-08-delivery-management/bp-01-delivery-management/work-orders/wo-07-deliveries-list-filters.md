---
id: WO-07
type: WORK_ORDER
slug: deliveries-list-filters
title: Deliveries List Filters
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 103
last_updated: 2026-04-29
implementation_status: PLANNED
---

# WO-07 Deliveries List Filters

## Summary

Add URL-backed filters to the deliveries list with an active-deliveries default view, URL canonicalization, preserved return context, and two distinct date-filter blocks. The collector can narrow deliveries by status, one store, product-name free text, delivery date range, and expected-arrival range or preset. Active filters render as removable chips using the same collector-workspace interaction pattern as `Stores`.

This slice is separate from the list because the filter behavior now includes URL-backed defaults, status-aware preset logic, two date dimensions, chip management, and back-navigation preservation — enough complexity to be an independent vertical slice rather than a folded-in concern of the list.

## Prerequisites

- [`WO-06`](wo-06-deliveries-list.md) — the list the filters operate on

## In Scope

- filter sidebar patterned after `Stores`
- default filtered view for active deliveries only (`IN_TRANSIT`) when the route is opened without filter params
- URL canonicalization of that default so the route resolves to an explicit `?status=IN_TRANSIT`
- status filter with one grouped default chip/state for `IN_TRANSIT`
- store filter with single selection only
- product-name free-text filter applied inside the filter sidebar rather than as a separate top-level search
- product-name matching against any product included in the delivery using substring, case-insensitive, accent-insensitive search
- `deliveryDate` range filter (`from` / `to`)
- `expectedArrival` range filter (`from` / `to`) using interval-overlap semantics rather than full containment
- `expectedArrival` presets: `Overdue`, `Due today`, `Next 7 days`, `Next 14 days`, `This month`
- preset/manual synchronization for the expected-arrival block: choosing a preset updates the visible calendar range; editing the calendar manually clears the preset
- URL persistence of active filters (canonical URL state, back/forward behavior preserved)
- invalid URL-param handling: ignore invalid values, keep valid ones, and canonicalize the resulting URL
- removable chips for each active filter, following the `Stores` interaction pattern
- preserved `returnTo` navigation so detail → list returns the collector to the same filtered deliveries URL
- empty-filter state messaging
- PostHog analytics events for filter interactions
- automated tests covering the filter path (at minimum one E2E that applies filters, verifies the URL reflects the state, removes a chip, and observes the list updating, plus coverage for the default `IN_TRANSIT` state and expected-arrival presets)

## Out of Scope

- list rendering itself (covered in [`WO-06`](wo-06-deliveries-list.md))
- carrier-performance analytics or other advanced surfacing
- dashboard filters

## Requirements

- `FR-08-28`, `FR-08-29`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — list filter contract, chip pattern decision

## Route and URL Contract

The deliveries list route remains `/{locale}/deliveries`.

### Supported query params

- `status`
- `store`
- `q`
- `deliveryDateFrom`
- `deliveryDateTo`
- `expectedArrivalFrom`
- `expectedArrivalTo`
- `expectedArrivalPreset`
- `page`

### Default route behavior

When the collector opens `/{locale}/deliveries` with no filter state present, the page applies the active-deliveries default:

- `status=IN_TRANSIT`

That default must be visible in all three places:

- the canonical URL
- the filter sidebar state
- the active chip row

The route canonicalizes to the explicit query string rather than leaving the default implicit, so shared links and back/forward navigation always represent the actual visible results.

## Assumptions

- `WO-06` already owns the base list route, pagination, and card rendering. This slice extends that route instead of introducing a parallel filtered page.
- `Delivery.status` values already exist through [`WO-01`](wo-01-delivery-foundation.md) and include `IN_TRANSIT`, `DELIVERED`, and `CANCELLED`.

## UX Notes

- The filter sidebar follows the same drawer mental model already used by the collector workspace listings: the collector opens filters, changes selections, applies them, and sees the chip shell above the results update immediately.
- The deliveries list should open focused on follow-up work, not historical browsing. For that reason, the default list state is one active-status chip for `IN_TRANSIT` rather than an unfiltered all-status view.
- The status filter still allows the collector to broaden the view beyond `IN_TRANSIT`, but the no-param route should always land on active deliveries first.
- Store uses single selection only. This keeps the filter aligned with the one-delivery-one-store domain rule and avoids widening the slice into multi-store comparison behavior.
- Product-name search is scoped to products included in each delivery, not to store name, carrier, or tracking fields.
- The date UI is split into two blocks because the two date concepts answer different collector questions:
  - `Delivery date` answers when the delivery record applies operationally.
  - `Expected arrival` answers when the collector expects the package to arrive.
- Chips for `Delivery date` and `Expected arrival` render separately so the collector can see which timeline dimension is currently narrowing the list.
- When filters produce no results, keep the active chips visible, show a reset affordance, and present a clear empty-state message that explains no deliveries matched the current filters.

## Technical Notes

### Filter semantics

- `status` supports direct filtering by persisted `Delivery.status`.
- `store` is one selected store id at a time.
- `q` matches any delivery whose included products contain a product name with the submitted query as a substring.
- Product-name matching must be case-insensitive and accent-insensitive.
- A delivery appears once even when multiple included products match the same `q` value.

### `Expected arrival` range semantics

Manual `expectedArrival` range filtering uses interval overlap, not full containment.

A delivery matches the submitted filter range when its expected-arrival range shares at least one day with the user-selected filter range.

Equivalent logic:

- delivery matches if `expectedArrivalFrom <= filterTo` and `expectedArrivalTo >= filterFrom`

Examples for filter range `2026-05-01` to `2026-05-15`:

- `2026-04-01` to `2026-06-15` → matches
- `2026-05-03` to `2026-05-20` → matches
- `2026-01-01` to `2026-05-05` → matches
- `2026-04-01` to `2026-04-30` → does not match
- `2026-05-16` to `2026-06-01` → does not match

Deliveries without a complete expected-arrival range do not match manual expected-arrival range filters or expected-arrival presets in this slice.

### Expected-arrival presets

Supported presets:

- `OVERDUE`
- `DUE_TODAY`
- `NEXT_7_DAYS`
- `NEXT_14_DAYS`
- `THIS_MONTH`

Preset behavior:

- choosing a preset populates the expected-arrival calendar UI with the corresponding derived range
- the preset remains visibly selected while that derived range is still intact
- manually editing the expected-arrival calendar clears the preset and the manual range becomes the source of truth
- preset selection and manual range are mutually exclusive within the expected-arrival block

`OVERDUE` is an active-follow-up shortcut, not a historical reporting shortcut. It must constrain the result set to active deliveries that are still in progress and should also update the visible status-filter state so the collector can see that active-delivery narrowing is part of the current filter combination.

### URL canonicalization

- Invalid filter values are ignored rather than causing a hard error.
- Valid filter values from the same URL are preserved.
- After parsing, the route canonicalizes the URL to only the valid, effective filter state.
- Hydrating from a shared filtered URL should restore the same effective sidebar state and chip shell after canonicalization.

### Back navigation preservation

When a collector opens a delivery detail page from the filtered list, the detail link should carry the full current list URL through a `?returnTo=` parameter so the delivery detail back navigation can restore the same filtered deliveries view, including pagination when present.

## Accessibility Notes

- The filter drawer must preserve keyboard focus, expose a proper dialog title, and support close via keyboard and overlay dismissal, matching the existing collector listing pattern.
- Status, preset, and chip controls must remain keyboard-operable and visibly focused.
- Changes that narrow the list to zero results should continue to expose meaningful empty-state messaging and a clear reset action for assistive-technology users.

## E2E Acceptance Tests

- Opening `/{locale}/deliveries` with no filter params canonicalizes the URL to an explicit `status=IN_TRANSIT` state, shows the `IN_TRANSIT` filter as selected in the sidebar, and renders the matching default chip.
- Applying a store filter, a product-name text filter, a delivery-date range, or an expected-arrival range narrows the list and reflects the filter state in the URL.
- Reloading the page with a filtered URL restores the same filter state in the sidebar and chips.
- Removing a chip clears the corresponding filter and updates both the list and the URL.
- Multiple filters combine correctly (for example store + product-name + delivery-date range).
- Product-name search matches deliveries when at least one included product contains the query as a substring, regardless of casing or accent differences.
- Choosing an expected-arrival preset updates the visible calendar range to the derived dates for that preset.
- Manually editing the expected-arrival range after choosing a preset clears the preset selection and uses the manual range instead.
- An expected-arrival manual range matches deliveries by interval overlap rather than by full containment.
- Choosing the `Overdue` expected-arrival preset narrows the status state to active deliveries in the visible filter UI as well as in the results.
- Invalid URL params are dropped during canonicalization while valid params remain active.
- Opening a delivery from the filtered list and then returning from detail restores the same filtered deliveries URL and visible list state.

## Analytics

- PostHog event when the filter drawer is opened
- PostHog event per filter apply action, including which filter groups are active
- PostHog event when a chip is removed
- PostHog event when the filter URL is hydrated from a shared link
- PostHog event when an expected-arrival preset is chosen
