---
id: WO-07
type: WORK_ORDER
slug: store-permissions-logo-and-hardening
title: Store Logo and Hardening
status: ACTIVE
parent: BP-01
source_issue: 76
last_updated: 2026-03-29
implementation_status: PLANNED
---

# WO-07 Store Logo and Hardening

## Summary

Finish the remaining hardening work required for the store MVP after governance delivery: business-logo upload across both create and edit flows, observability, error handling, validation depth, and regression coverage.

## In Scope

- business logo upload pipeline
- business logo upload UI and processing in both `stores/new` and `/stores/[slug]/edit`
- business logo preview, replace, and remove interactions
- analytics completion for remaining flows
- Sentry coverage for unexpected failures
- validation hardening for logo and remaining store write paths
- regression coverage improvements for logo and store-governance integrations

## Out of Scope

- report submission flow
- product-type request flow
- approved-store change-request flow
- pending-store direct-edit permissions and route branching
- asset library management
- person-store logo support
- admin moderation dashboard UI

## Requirements

- `FR-01-31`: Business stores must support logo upload backed by external storage.

Relevant business rules:

- `BR-01-11`: Store edit routes must follow the canonical pattern `/stores/[slug]/edit`.

Relevant acceptance signals:

- business logo upload works with storage-backed references
- business-store create and edit flows share a coherent logo experience without reopening governance scope
- analytics cover the remaining store hardening touchpoints without duplicating events already shipped in governance flows
- unexpected failures are captured without noisy duplication
- validation rejects unsupported logo formats before persistence
- validation rejects source files larger than `5 MB`
- accepted logo uploads are processed into the required optimized and cropped asset shape before storage
- failed logo processing or upload blocks the overall form submission and keeps the user informed so they can retry or remove the pending logo
- regression coverage protects the existing governance/edit flows while logo support is added

## Blueprints

- `BP-01` extension points:
  - server action layer
  - storage integration layer
  - query read model for logo reference
  - verification layer

## Assumptions

- Governance flows, report submission, and change-request behavior are already covered by `WO-06 Store Governance Flows` and are not redefined here.
- The existing `/stores/[slug]/edit` route remains the edit entry point, and `stores/new` is also in scope for business-logo upload.
- Logo upload applies only to `BUSINESS` stores.

## UX Notes

- Business stores should support a consistent logo experience in both create and edit flows.
- In both flows, the logo control should live in step 1 (`base information`) so it is visible as part of the primary store identity block.
- The initial state should render a clearly visible placeholder that makes the logo slot obvious even when no image exists yet.
- The empty state should include a clear upload affordance such as click-to-upload guidance while also supporting drag and drop.
- The logo interaction should support:
  - click to open file selection
  - drag and drop into the logo area or modal entry point
  - preview before save
  - replacing an already selected or persisted logo
  - removing the current logo
- After the user selects a file, the system should open a modal-style editor before any upload occurs.
- The editor should let the user:
  - see the image inside a square `1:1` crop frame
  - drag the image to reposition it
  - adjust zoom with a slider
- Even when the original image is already square, the same editor should appear so the user can confirm framing.
- After the user confirms the crop, the placeholder/logo slot in the form should update to the in-memory preview immediately, but the file must not be uploaded until the final form submission succeeds.
- Person-store flows must not expose logo-upload controls.

## Technical Notes

- Logo persistence should store only the resulting external object reference in the store record, not the raw file payload.
- Logo upload is owned by this work order for both the create-store flow and the edit-store flow.
- Accepted input formats are `png`, `jpg`, `jpeg`, and `webp`. `svg` is not allowed.
- Source files must be limited to `5 MB` before they are accepted into the crop/edit flow.
- Accepted uploads may start from arbitrary original dimensions, but the client-side editor should keep the image in memory first, allow manual square cropping, and only upload the optimized result during final submit.
- The optimized output should target a lightweight asset suitable for store listing and detail usage without requiring any paid media-processing service.
- The storage prefix for persisted business logos should be `store-logos/`.
- The final persisted object key should follow the convention `store-logos/{storeId}.webp`.
- Logo validation must run at the server boundary and reject unsupported MIME types, malformed uploads, and oversize source files before storage is attempted.
- If logo processing or upload fails, the store create/edit submission must fail as a whole, surface a localized error, and leave the user able to retry or remove the logo selection.
- Adding logo support must not regress the current direct-edit vs change-request behavior already implemented in the shared edit flow.

## Observability Notes

- Add analytics only for hardening-specific touchpoints that are still missing after `WO-06`, especially:
  - logo upload started
  - logo upload succeeded
  - logo upload failed
  - logo removed
- Unexpected failures in logo upload or related persistence should be eligible for Sentry capture with safe, non-sensitive context.

## Dependencies

- `WO-06 Store Governance Flows` for the existing `/stores/[slug]/edit` route contract, direct-edit vs change-request branching, and baseline governance analytics.
- `WO-03 Store Creation and Duplicate Prevention` for the existing `stores/new` form structure and validation patterns that now also need business-logo support.

## E2E Acceptance Tests

- Business logo upload accepts valid images and rejects unsupported formats.
- Source files larger than `5 MB` are rejected before final submission.
- Create-store flow supports business-logo preview and persists only the processed storage reference after a successful save.
- Edit-store flow supports business-logo preview, replace, and remove interactions while preserving existing route behavior.
- End-to-end upload flow processes the accepted logo into the required optimized and cropped asset shape before persisting the resulting storage reference.
- If logo processing or upload fails during submit, the form stays on the current screen, shows localized feedback, and lets the user retry or remove the logo.
- Existing store-edit flows continue to behave correctly after logo support is added.
- Unexpected logo-upload failures surface localized feedback without breaking the rest of the edit experience.

## Status Note

Planned. This work order is the release-hardening pass for store logo support and the remaining observability, validation, and regression depth around the store domain.
