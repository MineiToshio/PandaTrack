---
id: WO-03
type: WORK_ORDER
slug: store-creation-and-duplicate-prevention
title: Store Creation and Duplicate Prevention
status: DONE
parent: BP-01
source_issue: 72
last_updated: 2026-03-16
---

# WO-03 Store Creation and Duplicate Prevention

## Summary

Ship the end-to-end create-store flow with validation, duplicate warnings, stable slug generation, and moderation defaults.

## In Scope

- create-store form
- server-side validation
- catalog validation
- admin vs non-admin moderation branching
- blur duplicate suggestions
- submit duplicate confirmation modal
- create success redirect
- creation analytics

## Out of Scope

- public listing and detail rendering itself
- store reviews
- reports and change requests
- business logo upload

## Requirements

- `FR-01-06`: Authenticated users must be able to create stores.
- `FR-01-07`: Admin-created stores must default to `APPROVED`.
- `FR-01-08`: Normal-user-created stores must default to public `PENDING`.
- `FR-01-09`: The create flow must validate country codes and product-type keys against seeded catalogs before persisting.
- `FR-01-10`: Store creation must support both blur-time duplicate suggestions and submit-time duplicate confirmation.

Relevant acceptance criteria copied from the FRD:

- `AC-01-01` Create store as non-admin
- `AC-01-02` Create store as admin
- `AC-01-03` Blur duplicate suggestions
- `AC-01-04` Submit duplicate confirmation

## Blueprints

- `BP-01` runtime component coverage:
  - store utility layer
  - server action layer
  - create UI flow layer

## E2E Acceptance Tests

- Authenticated user can open the create-store page and see the form.
- Required-field validation blocks invalid submission without persisting data.
- Valid store creation should redirect to `/{locale}/stores/[slug]`.
- Duplicate submit behavior should show confirmation when same-country similarity threshold is met.

## Status Note

Mostly implemented in current code. E2E coverage exists for form visibility and required validation, but duplicate-confirm and successful create happy path can still be expanded.
