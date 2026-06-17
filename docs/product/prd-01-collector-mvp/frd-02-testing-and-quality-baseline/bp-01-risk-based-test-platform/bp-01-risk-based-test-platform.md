---
id: BP-01
type: BLUEPRINT
slug: risk-based-test-platform
title: Risk-based Test Platform
status: ACTIVE
parent: FRD-02
children:
  - WO-01
  - WO-02
  - WO-03
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# BP-01 Risk-based Test Platform

## Purpose

Describe how PandaTrack chooses test types, organizes test files, and validates critical workflows.

## Runtime Components

- `vitest.config.ts` — Vitest config (`jsdom`, `vite-tsconfig-paths`, `src/**/*.test.{ts,tsx}`)
- `playwright.config.ts` — Playwright config (single Chromium worker, `e2e/` test dir)
- `src/test/setup.ts` — RTL global cleanup setup file
- `src/test/createTestUserData.ts` — shared Prisma `UserCreateInput` factory for integration tests
- `src/test/design-token-guard.test.ts` — static scan guard for theme-blind colors and oklch/oklab neutral-token misuse (FR-02-07)
- `e2e/_helpers/auth.ts` — `shouldSkipAuthenticatedE2E()` guard and `signInAndLandOnDashboard()` helper
- `e2e/` domain-based specs (7 spec files across landing, auth, app-layout, settings, stores, store-listing, deliveries)
- colocated `_tests/` folders inside feature modules
- strategy doc: `docs/development/testing.md`
- browser-testing patterns rule: `.cursor/rules/browser-testing-patterns.mdc`

## Architecture Notes

- tests are chosen by risk, not by blanket policy
- App Router limitations push critical route behavior toward Playwright
- tests stay close to the feature they protect
- authenticated E2E tests are skip-guarded (not fail-guarded) on missing credentials so the suite remains safe in CI without a live test account
- the design-token guard runs inside Vitest (zero additional CI tooling) and covers the entire `src/` tree on every `npm run test` invocation

## Linked Work Orders

- `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/bp-01-risk-based-test-platform/work-orders/wo-01-testing-standards-and-tooling.md`
- `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/bp-01-risk-based-test-platform/work-orders/wo-02-landing-and-auth-baseline-coverage.md`
- `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/bp-01-risk-based-test-platform/work-orders/wo-03-critical-e2e-workflow-baseline.md`
