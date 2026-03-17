---
id: WO-03
type: WORK_ORDER
slug: password-recovery-and-reset
title: Password Recovery and Reset
status: DONE
parent: BP-01
last_updated: 2026-03-16
source_features:
  - FEAT-0009
---

# WO-03 Password Recovery and Reset

## Summary

Ship forgot-password and reset-password flows with neutral account handling, single-use tokens, and localized feedback.

## In Scope

- forgot-password request flow
- reset-password token flow
- localized recovery UI
- token expiry and invalid-link states

## Out of Scope

- 2FA recovery
- support-led manual recovery

## Requirements

- `FR-01-09`
- `FR-01-10`
- `FR-01-11`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Recovery request stays neutral
- Invalid token shows recovery path
- Valid token updates password successfully
