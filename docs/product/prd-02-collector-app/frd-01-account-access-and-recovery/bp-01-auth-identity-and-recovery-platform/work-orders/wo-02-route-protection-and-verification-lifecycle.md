---
id: WO-02
type: WORK_ORDER
slug: route-protection-and-verification-lifecycle
title: Route Protection and Verification Lifecycle
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0008
implementation_status: IMPLEMENTED
---

# WO-02 Route Protection and Verification Lifecycle

## Summary

Protect the private app, enforce verification grace and blocking logic, and support resend-verification flows.

## In Scope

- private route enforcement
- verification snapshot logic (four states, grace anchor)
- day-six reminder behavior (one-time per grace window)
- verification banner (grace) and blocked gate (day 7)
- emailed-link confirm route

## Out of Scope

- advanced RBAC
- account deletion after long unverified periods

## Requirements

- `FR-01-03`
- `FR-01-04`
- `FR-01-06`
- `FR-01-07`
- `FR-01-16`
- `FR-01-17`
- `FR-01-18`
- `FR-01-19`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Anonymous dashboard access redirects to sign-in
- Blocked users see the verification-required gate
