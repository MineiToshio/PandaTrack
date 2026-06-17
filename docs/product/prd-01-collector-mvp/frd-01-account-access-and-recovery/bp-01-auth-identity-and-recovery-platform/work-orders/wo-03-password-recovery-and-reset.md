---
id: WO-03
type: WORK_ORDER
slug: password-recovery-and-reset
title: Password Recovery and Reset
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0009
implementation_status: IMPLEMENTED
---

# WO-03 Password Recovery and Reset

## Summary

Ship forgot-password and reset-password flows with neutral account handling, single-use tokens, and localized feedback.

## In Scope

- forgot-password request flow (neutral, anti-enumeration)
- reset-password token flow with repeat-password match guard
- escalating recovery throttle (server + client)
- single-use tokens + session revocation on reset
- localized recovery + verification emails
- token expiry and invalid-link states

## Out of Scope

- 2FA recovery
- support-led manual recovery

## Requirements

- `FR-01-09`
- `FR-01-10`
- `FR-01-11`
- `FR-01-20`
- `FR-01-21`
- `FR-01-23`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Recovery request stays neutral
- Invalid token shows recovery path
- Valid token updates password successfully
