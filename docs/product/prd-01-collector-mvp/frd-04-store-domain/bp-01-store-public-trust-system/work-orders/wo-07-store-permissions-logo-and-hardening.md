---
id: WO-07
type: WORK_ORDER
slug: store-permissions-logo-and-hardening
title: Store Permissions, Logo, and Hardening
status: PLANNED
parent: BP-01
source_issue: 76
last_updated: 2026-03-16
---

# WO-07 Store Permissions, Logo, and Hardening

## Summary

Finish the remaining hardening work required for the store MVP: edit permissions, business-logo upload, observability, and validation depth.

## In Scope

- pending-store direct-edit permissions
- approved-store guard behavior
- business logo upload pipeline
- analytics completion for remaining flows
- Sentry coverage for unexpected failures
- regression coverage improvements

## Out of Scope

- asset library management
- person-store logo support
- admin moderation dashboard UI

## Requirements

- `FR-01-30`: Pending stores must be editable only by their creator and admins.
- `FR-01-31`: Business stores must support logo upload backed by external storage.

Relevant business rules:

- `BR-01-04`: Pending stores are public in-app but must remain non-indexable for SEO.
- `BR-01-10`: Store creation currently redirects directly to the created detail route after success.

Relevant acceptance signals:

- pending-store edit rules match creator/admin expectations
- approved-store direct edits are blocked or rerouted to the correct flow
- business logo upload works with storage-backed references
- unexpected failures are captured without noisy duplication

## Blueprints

- `BP-01` extension points:
  - server action layer
  - storage integration layer
  - verification layer

## E2E Acceptance Tests

- Pending-store creator can access the allowed direct-edit flow.
- Non-owner cannot directly edit a pending store when not authorized.
- Approved-store edit attempt follows the guarded behavior.
- Business logo upload accepts valid images and rejects invalid inputs.
- End-to-end upload flow persists only the resulting storage reference.

## Status Note

Planned. This work order is the release-hardening pass for the store domain.
