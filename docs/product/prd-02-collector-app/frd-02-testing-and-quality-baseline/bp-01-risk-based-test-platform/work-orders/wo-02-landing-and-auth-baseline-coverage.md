---
id: WO-02
type: WORK_ORDER
slug: landing-and-auth-baseline-coverage
title: Landing and Auth Baseline Coverage
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0010
implementation_status: IMPLEMENTED
---

# WO-02 Landing and Auth Baseline Coverage

## Summary

Add the first high-value unit and integration coverage for landing and auth behavior.

## In Scope

- analytics helper tests (`src/lib/analytics/posthogDataAttributes.test.ts`)
- auth redirect and session logic tests (`src/lib/auth/_tests/`)
- auth verification, password recovery, and throttle tests (`src/lib/auth/_tests/`)
- account-capabilities and cooldown tests (`src/lib/auth/_tests/`)

## Out of Scope

- future collector-domain logic not yet implemented

## Requirements

- `FR-02-05`

## Blueprints

- `BP-01`

## Acceptance Tests

- High-value landing and auth module behavior is covered through Vitest tests under `src/lib/auth/_tests/` and `src/lib/analytics/`
