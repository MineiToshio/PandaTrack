---
id: WO-06
type: WORK_ORDER
slug: store-governance-flows
title: Store Governance Flows
status: ACTIVE
parent: BP-01
source_issue: 75
last_updated: 2026-03-21
implementation_status: PLANNED
---

# WO-06 Store Governance Flows

## Summary

Add the first store-governance flows so the public store layer can improve over time without uncontrolled direct editing.

## In Scope

- store report submission
- product-type request submission
- approved-store change request submission
- persistence of moderation-ready metadata
- localized success and validation states

## Out of Scope

- admin moderation dashboard
- automatic report-based takedowns
- subcategory management
- dynamic metadata authoring

## Requirements

- `FR-01-27`: Users must be able to report stores.
- `FR-01-28`: Users must be able to request new product types.
- `FR-01-29`: Approved stores must support change requests instead of direct edits by normal users.

Relevant acceptance signals:

- users can report a store for supported reasons
- users can submit product-type requests
- users can submit approved-store change requests
- enough metadata is stored for later moderation workflows

## Blueprints

- `BP-01` extension points:
  - data model layer
  - request validation layer
  - targeted governance UI entry points

## E2E Acceptance Tests

- User can submit a store report with a supported reason.
- User can submit a product-type request.
- User cannot directly edit an approved store when the flow should create a change request instead.
- Submission success and validation states are visible and localized.

## Status Note

Planned. Schema foundations exist, but flow implementation is still pending.
