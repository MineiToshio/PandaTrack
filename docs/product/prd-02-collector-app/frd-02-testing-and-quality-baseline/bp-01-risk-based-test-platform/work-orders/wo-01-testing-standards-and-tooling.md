---
id: WO-01
type: WORK_ORDER
slug: testing-standards-and-tooling
title: Testing Standards and Tooling
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0010
implementation_status: IMPLEMENTED
---

# WO-01 Testing Standards and Tooling

## Summary

Define the repository testing strategy and establish the base tooling for unit, integration, and E2E coverage.

## In Scope

- testing strategy documentation (`docs/development/testing.md`)
- Vitest baseline (`vitest.config.ts`, `src/test/setup.ts`)
- React Testing Library baseline (via `@testing-library/react` + `@testing-library/jest-dom`)
- Playwright baseline (`playwright.config.ts`, `e2e/_helpers/auth.ts`)
- design-token guard (`src/test/design-token-guard.test.ts`, `FR-02-07`)
- shared test factory (`src/test/createTestUserData.ts`)
- browser-testing patterns rule (`.cursor/rules/browser-testing-patterns.mdc`)

## Out of Scope

- exhaustive product coverage

## Requirements

- `FR-02-01`
- `FR-02-02`
- `FR-02-03`
- `FR-02-04`
- `FR-02-07`

## Blueprints

- `BP-01`

## Acceptance Tests

- `npm run test` exits 0 with Vitest unit/integration/guard suite
- `npm run test:e2e` exits 0 with Playwright suite (unauthenticated specs only when credentials absent)
- The repository documents where each test type belongs (`docs/development/testing.md`)
