---
id: WO-01
type: WORK_ORDER
slug: auth-core-and-entry-flows
title: Auth Core and Entry Flows
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0008
implementation_status: IMPLEMENTED
---

# WO-01 Auth Core and Entry Flows

## Summary

Implement Better Auth, public auth entry pages, Google sign-in, and dashboard redirect behavior for authenticated users.

## In Scope

- Better Auth server foundation
- auto-generated username on user create
- sign-up and sign-in pages
- Google sign-in and account linking
- callback and return-to handling (with sanitization)
- redirect of authenticated users away from entry pages
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
- `FR-01-13`
- `FR-01-14`
- `FR-01-15`
- `FR-01-22`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Anonymous users can access sign-up and sign-in
- Authenticated users are redirected away from auth entry pages to the dashboard
