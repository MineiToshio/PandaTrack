---
id: WO-06
type: WORK_ORDER
slug: store-governance-flows
title: Store Governance Flows
status: ACTIVE
parent: BP-01
source_issue: 75
last_updated: 2026-03-21
implementation_status: IN_PROGRESS
---

# WO-06 Store Governance Flows

## Summary

Add the first store-governance submission flows so the public store layer can improve over time without uncontrolled direct editing of approved stores.

## In Scope

- public governance summary visibility on store detail
- store report create and update flow
- product-type request submission from store forms
- store change-request create and update flow
- direct-edit vs change-request branching based on store status and actor
- persistence of moderation-ready metadata and request history
- route and validation contracts for `/stores/[slug]/edit`
- reusable modal and field-character-count support needed by these flows
- localized success and validation states
- analytics for governance entry points and submissions

## Out of Scope

- admin moderation dashboard
- admin review actions that approve, reject, or dismiss governance records
- automatic report-based takedowns
- subcategory management
- dynamic metadata authoring

## Requirements

- `FR-01-27`: Users must be able to report stores.
- `FR-01-28`: Users must be able to request new product types.
- `FR-01-29`: Approved stores must support change requests instead of direct edits by normal users.
- `FR-01-30`: Pending stores must be editable only by their creator and admins.

Relevant acceptance signals:

- public store detail shows a governance summary note and modal without exposing sensitive free-text submissions
- authenticated users can report a store with one supported reason plus free-text context
- authenticated users can submit product-type requests from create and edit flows
- users can submit or update one open change request per store when direct edit is not allowed
- pending stores remain directly editable only for their creator and admins
- enough metadata and history are stored for later moderation workflows and abuse review

## Blueprints

- `BP-01` extension points:
  - data model layer
  - query layer for public governance summary reads
  - request validation layer
  - targeted governance UI entry points
  - `/stores/[slug]/edit` route contract

## Assumptions

- Store detail remains publicly viewable, so governance summary signals must be safe for unauthenticated visitors.
- Governance submission flows require authentication even though governance summary visibility is public.
- Moderation decisions, reviewer identity, and raw free-text report details belong to future admin tooling, not this work order.

## UX Notes

- Store detail must expose:
  - a public governance note
  - a CTA that opens a modal with governance summary data
- The public governance modal must:
  - show aggregate report counts grouped by supported reason
  - show change-request summaries without exposing requester identity
  - avoid rendering raw free-text report details for non-admin viewers
- Store report submission should begin from store detail with a lightweight modal or dialog flow.
- Product-type request submission should open inside store forms (`stores/new` and `/stores/[slug]/edit`) using a reusable modal pattern.
- Editing a store through `/stores/[slug]/edit` should feel like the create-store form with preloaded data, while still saving a change request when direct edit is not allowed.
- Field components used by these flows should surface a live character counter whenever `maxLength` is configured.

## Technical Notes

- `StoreReport` should keep a single supported reason plus optional free-text details.
- A user may have only one open report per store at a time.
- Reopening the report flow while that report is still open must update the same record instead of creating a new one.
- Once an earlier report is resolved (`REVIEWED` or `DISMISSED`), the same user may create a new report for the same store.
- `StoreProductTypeRequest` should collect:
  - `suggestedName` with `maxLength` `50`
  - optional justification text with `maxLength` `500`
- `StoreChangeRequest` must persist only the changed fields, not a full snapshot of the store.
- A user may have only one open change request per store at a time.
- Reopening `/stores/[slug]/edit` while the viewer already has an open change request for that store should preload the pending request values.
- If the resulting diff becomes empty, the system must not create a new change request and must delete an existing pending change request for that user/store pair.
- Store fields editable through direct edit and change-request flows should stay aligned, except:
  - `country` is not editable
  - `storeType` is not editable
- If a user wants to challenge `storeType`, they must use the report flow and explain the issue in free text.
- Pending-store direct edits and approved-store change requests should reuse the same route shape: `/stores/[slug]/edit`.

## Security Notes

- Governance submission flows require an authenticated session.
- Public governance summaries must not expose requester identity or raw user-submitted free text.
- The persistence model must preserve historical records so future admin tooling can identify repeated report or change-request activity by the same user on the same store.
- Max-length validation must be enforced server-side as well as in the UI.

## Observability Notes

- Track meaningful governance events for:
  - report CTA opened
  - report submitted
  - product-type request CTA opened
  - product-type request submitted
  - change-request edit flow entered
  - change request submitted
  - no-op change request discarded or deleted
- Unexpected failures in governance write paths should remain eligible for Sentry capture in later hardening work.

## Dependencies

- `WO-03 Store Creation and Duplicate Prevention` for shared create-store field definitions and validation patterns.
- `WO-04 Store Public Discovery and Detail` for the store-detail entry point and public summary rendering.
- `WO-07 Store Permissions, Logo, and Hardening` for future admin-side moderation completion and final hardening.

## E2E Acceptance Tests

- User can submit a store report with a supported reason.
- User can reopen and update their still-open store report instead of creating a second open report.
- User can submit a product-type request.
- User can open the product-type request modal from both create-store and edit-store flows.
- Approved-store edit uses `/stores/[slug]/edit` and persists only the changed fields as a change request.
- User can reopen and update an existing pending change request for the same store.
- If a pending change request becomes identical to the persisted store, it is removed instead of being kept as a no-op request.
- Pending-store creator can directly edit the store from `/stores/[slug]/edit`.
- Non-owner viewer of a pending store cannot directly edit it and must use the change-request path instead.
- After a successful save from `/stores/[slug]/edit` (direct edit, change request saved, or no-op discard), the user is redirected to the store detail `/stores/[slug]` for the active locale.
- The store-detail governance summary modal must surface the signed-in viewer’s own pending change request (fields and last updated) when one exists, not only the anonymous recent-requests list.
- Public governance summary visibility does not expose raw report details or requester identity.
- Validation and error feedback remain on the edit form when submission fails; copy stays localized.

## Status Note

In progress. Governance schema foundations exist and the slice implementation is wiring the public summary, report flow, product-type request flow, and `/stores/[slug]/edit` route contract.
