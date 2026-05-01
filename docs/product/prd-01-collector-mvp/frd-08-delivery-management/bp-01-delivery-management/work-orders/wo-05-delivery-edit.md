---
id: WO-05
type: WORK_ORDER
slug: delivery-edit
title: Delivery Edit
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 101
last_updated: 2026-04-30
implementation_status: PLANNED
---

# WO-05 Delivery Edit

## Summary

Implement the delivery edit flow: modify the product membership (add or remove eligible products), change shipping date, expected arrival range, cost, currency, and FX. Every edit that changes product-to-delivery associations re-derives `OrderStatus` for each affected order within the same transaction.

Edit is a separate slice from create because the invariants differ: create persists a new delivery from zero; edit must reconcile changes against an existing delivery, handle a discard-changes confirmation when there are unsaved edits, and recalculate product states when memberships change.

This slice also defines the edit-time guardrails that keep the delivery lifecycle coherent: a delivery can never be saved without at least one product, non-editable lifecycle states must be redirected back to detail instead of edited in place, and stale eligibility/state conflicts must fail atomically rather than partially saving a changed selection.

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — persistence, eligibility, transition helpers, shared Zod schemas, `deriveOrderStatus` wrapper
- [`WO-02`](wo-02-delivery-create.md) — the shared form implementation and the eligibility-driven product selector are first introduced by create; edit reuses them in a different mode

## In Scope

- edit-delivery route and form, reusing the form implementation introduced in `WO-02` in edit mode
- product membership changes: add eligible products from the same store; remove currently linked products
- minimum-one-product invariant on save: the edited delivery must still contain at least one product
- recalculation of product delivery state whenever membership changes: newly added products become arrived at store when they were not already there; removed products are returned to arrived-at-store when still unfulfilled
- shipping date, expected arrival range, cost, currency, and FX editing
- discard-changes confirmation when there are unsaved edits
- `deriveOrderStatus` invocation within the edit transaction for every affected order
- redirect back to the same delivery detail route after a successful edit
- server-side edit guard: when the delivery is no longer in an editable lifecycle state, the collector is redirected back to detail with feedback explaining that the delivery must be reopened first
- final save-time revalidation of delivery status and product eligibility so stale edits fail atomically and do not partially persist
- PostHog analytics events for the edit flow
- automated tests covering the edit path (unit where it makes sense, plus at least one E2E path that edits a delivery's product membership and verifies the affected orders' status is re-derived correctly)

## Out of Scope

- create entry points (covered in [`WO-02`](wo-02-delivery-create.md))
- detail view (covered in [`WO-03`](wo-03-delivery-detail-read-only.md))
- detail actions such as mark delivered, reopen, cancel, delete, note edit (covered in [`WO-04`](wo-04-delivery-detail-actions.md))
- deliveries list and filters (covered in `WO-06`, `WO-07`)

## Requirements

- `FR-08-04` through `FR-08-11`
- `FR-08-16`, `FR-08-17`, `FR-08-19`, `FR-08-20`, `FR-08-23`
- `FR-08-34`
- `BR-08-02`, `BR-08-03`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — create/edit contract (edit side), eligibility contract, one-store boundary

## UX Notes

- The edit route returns to the same delivery detail screen after a successful save so the collector can immediately verify the updated delivery contents and metadata.
- The unsaved-changes confirmation should reuse the existing form pattern already established in the private app, adapted to delivery copy and routing.
- Removing products during edit is allowed only while at least one product remains selected. The edit flow must not become a hidden shortcut for creating an empty delivery record.
- Edit reuses the create form's product selector, including the in-section product-name search input. Filtering remains client-side over the already-loaded eligible products and follows the same case- and accent-insensitive matching defined for create.

## Technical Notes

- The edit route should follow the canonical collector route convention: `src/app/[locale]/(app)/deliveries/[id]/edit`.
- The edit flow reuses the shared form introduced by [`WO-02`](wo-02-delivery-create.md) in edit mode, but it must load the current delivery membership and call the shared eligibility helper with `excludeDeliveryId` so the delivery's existing products remain selectable while the collector adjusts the selection.
- Save-time validation must enforce that the final `productIds` set contains at least one product. A delivery with zero linked products is invalid and must not be persisted through edit.
- The edit mutation must re-check the delivery lifecycle status inside the server-side transaction entry point. If the delivery is already `DELIVERED` or `CANCELLED`, the mutation must fail with an expected non-capture error and the UI must redirect back to detail with a toast instructing the collector to reopen the delivery before editing.
- The edit mutation must perform a final eligibility revalidation for every submitted product inside the same transactional flow used to persist the edit. If any submitted product is no longer eligible, or if the delivery state changed while the collector was editing, the mutation must fail atomically: no membership change, no metadata change, and no partial save.
- When the membership changes, the mutation must update `OrderItem.deliveryState` for newly added and removed products, then invoke `persistDerivedOrderStatuses()` for every affected source order within the same transaction.
- Successful save redirects to `/{locale}/deliveries/[id]`. The edit slice does not introduce return-to-list or return-to-origin branching.

## Error Handling Notes

- Expected edit-time conflicts include:
  - submitted selection becomes empty
  - submitted products are no longer eligible for this delivery
  - the delivery is no longer in an editable lifecycle state
- These errors should not be captured as unexpected Sentry exceptions. They should remain user-facing validation or form-level errors, except for the non-editable lifecycle guard that redirects back to detail with toast feedback.
- Unexpected failures should still be captured once with delivery-safe context, without logging sensitive payloads.

## E2E Acceptance Tests

- Editing a delivery cannot be saved with zero selected products; the collector remains in the form and sees clear validation feedback.
- Editing a delivery to add a newly eligible product marks that product as arrived at store when it was not previously there and re-derives the source order's `OrderStatus` accordingly.
- Editing a delivery to remove a product returns that product to arrived-at-store when it is still unfulfilled and re-derives the source order's `OrderStatus` accordingly.
- Changing dates, cost, currency, or FX persists the change without affecting product state or order status.
- Saving a valid edit returns the collector to the same delivery detail route and the updated values are visible there.
- Discarding edits returns the delivery to its previous state and the collector is warned before losing unsaved changes.
- A delivery's one-store boundary is preserved: eligible products from other stores are not offered in the edit selector.
- Attempting to open or submit edit for a delivery that is no longer editable redirects the collector back to detail and explains that the delivery must be reopened first.
- If submitted products become ineligible while the collector is editing, the save fails atomically and no partial changes are persisted.

## Analytics

- PostHog event when the edit flow is opened
- PostHog event when a delivery edit is successfully saved, including whether product membership changed and counts of affected orders
