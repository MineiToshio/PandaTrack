---
id: WO-01
type: WORK_ORDER
slug: auth-core-and-entry-flows
title: Auth Core and Entry Flows
status: ACTIVE
parent: BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0008
implementation_status: IMPLEMENTED
---

# WO-01 Auth Core and Entry Flows

## Summary

Implement Better Auth, public auth entry pages, Google sign-in, and dashboard redirect behavior for authenticated users.

## In Scope

- Better Auth server foundation
- sign-up and sign-in pages
- Google sign-in
- callback and return-to handling
- Kit sync on authenticated session creation

## Out of Scope

- password recovery
- collector-domain business logic

## Requirements

- `FR-01-01`
- `FR-01-02`
- `FR-01-05`
- `FR-01-08`
- `FR-01-12`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Anonymous users can access sign-up and sign-in
- Authenticated users are redirected away from auth entry pages to the dashboard
