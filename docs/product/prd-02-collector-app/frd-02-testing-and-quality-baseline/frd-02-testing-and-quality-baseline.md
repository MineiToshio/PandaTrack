---
id: FRD-02
type: FRD
slug: testing-and-quality-baseline
title: Testing and Quality Baseline
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0010
implementation_status: IMPLEMENTED
---

# FRD-02 Testing and Quality Baseline

## Overview

This FRD defines PandaTrack's risk-based automated testing strategy for AI-assisted delivery.

## Functional Requirements

- `FR-02-01`: Meaningful changes must evaluate unit, integration, and E2E needs based on risk.
- `FR-02-02`: The repository must support Vitest for unit and integration coverage.
- `FR-02-03`: The repository must support React Testing Library for synchronous client-component behavior.
- `FR-02-04`: The repository must support Playwright for critical App Router workflows.
- `FR-02-05`: Existing landing and auth flows must have baseline automated coverage.
- `FR-02-06`: Planning artifacts must state testing expectations explicitly where relevant.
- `FR-02-07`: The repository must enforce design-system token constraints automatically via a Vitest guard so theme-blind color regressions are caught without a separate CI step.

## Business Rules

- `BR-02-01`: PandaTrack does not target blanket or 100% coverage.
- `BR-02-02`: Business logic prefers unit tests.
- `BR-02-03`: Cross-layer behavior prefers integration tests.
- `BR-02-04`: Critical routing and browser flows prefer E2E coverage.
- `BR-02-05`: Authenticated E2E tests are skipped (not failed) when the `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` environment variables are absent; unauthenticated redirect tests always run.
- `BR-02-06`: The Playwright suite runs a single Chromium worker (`workers: 1`, `fullyParallel: false`) with `retries: 0` unconditionally; the reporter is the only CI-conditional setting (`line` in CI; `list` + `html` locally).

## Acceptance Criteria

### `AC-02-01`

- Given a critical landing or auth flow
- When local validation runs
- Then matching automated test coverage exists and can be executed.

### `AC-02-02`

- Given a new meaningful feature slice
- When the slice is documented
- Then testing expectations can be expressed explicitly and consistently.

### `AC-02-03`

- Given a non-test source file in `src/`
- When `npm run test` runs
- Then the design-token guard fails the suite if a theme-blind Tailwind color utility (e.g. `text-white`, `bg-blue-500`) is present in a `.tsx` file, or an oklch neutral-token `color-mix` (L074) is present in a `.tsx`/`.ts`/`.css` file.

## Test Commands

| Command                                  | What it runs                                     |
| ---------------------------------------- | ------------------------------------------------ |
| `npm run test`                           | Vitest (unit + integration + design-token guard) |
| `npm run test:watch`                     | Vitest in watch mode                             |
| `npm run test:e2e`                       | Playwright full suite                            |
| `npm run test:e2e -- e2e/<spec>.spec.ts` | Single scoped Playwright spec                    |

`validate-build` (`prisma generate + next build --webpack`) is NOT `npm run build`; it skips `prisma migrate deploy` and never requires a live database. Use `validate-build` for local and agent validation; reserve `npm run build` for CI/Vercel.

## Vitest Configuration

- Config: `vitest.config.ts` — plugin `vite-tsconfig-paths`, environment `jsdom`, `css: false` (CSS imports are not processed)
- Include pattern: `src/**/*.test.{ts,tsx}` — covers all unit, integration, and component tests under `src/` (currently ~77 files spanning core, hooks, orders, deliveries, stores, user-settings, catalog, queries, and proxy; the three files in `src/test/` listed below are shared utilities, not the full suite)
- Setup file: `src/test/setup.ts` — registers `@testing-library/jest-dom/vitest` matchers and runs `cleanup()` after each test
- Shared test utilities in `src/test/`:
  - `setup.ts` — RTL global cleanup
  - `createTestUserData.ts` — Prisma `UserCreateInput` factory (derives a valid username from an email, used in integration tests)
  - `design-token-guard.test.ts` — zero-dependency static scan guard (see FR-02-07)

## Playwright Configuration

- Config: `playwright.config.ts` — `testDir: ./e2e`, single `chromium` project, `workers: 1`, `fullyParallel: false`, `retries: 0` (unconditional)
- Base URL: `http://localhost:3000` by default; overridable via `PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_HOST` / `PLAYWRIGHT_PORT` env vars
- Authenticated tests: guarded by `shouldSkipAuthenticatedE2E()` which checks `E2E_USER_EMAIL` + `E2E_USER_PASSWORD`; the shared helper lives in `e2e/_helpers/auth.ts` (`signInAndLandOnDashboard`)
- `deliveries.spec.ts` additionally skips its authenticated tests when `PLAYWRIGHT_PORT` is set to anything other than `3000`, because the authenticated flow relies on Better Auth's local trusted origin on `localhost:3000`
- Timeouts: `actionTimeout: 10 s`, `navigationTimeout: 15 s`, per-test `timeout: 30 s`
- Artifacts on failure: screenshot + video retained; trace on first retry
- `webServer` config: starts `npm run dev` on the configured port; reuses an existing server in non-CI environments

## E2E Spec Catalog

All specs live in `e2e/`. "Yes" specs skip their tests when credentials are absent; "Mixed" specs always run their unauthenticated tests (e.g. the standalone delivery-create redirect) and skip only the authenticated ones.

| Spec file                   | Domain                                                                               | Auth-gated tests |
| --------------------------- | ------------------------------------------------------------------------------------ | ---------------- |
| `e2e/landing.spec.ts`       | Landing CTAs, FAQ, waitlist                                                          | No               |
| `e2e/auth.spec.ts`          | Sign-in redirect, password recovery, sign-up error mapping                           | No               |
| `e2e/app-layout.spec.ts`    | Mobile drawer, sidebar persistence, desktop account menu, breadcrumbs                | Yes              |
| `e2e/settings.spec.ts`      | Settings tabs, currency change modal                                                 | Yes              |
| `e2e/stores.spec.ts`        | Store create form, logo control toggle, logo crop reopen, required-field validation  | Yes              |
| `e2e/store-listing.spec.ts` | Stores/store-detail unauthenticated redirect                                         | No               |
| `e2e/deliveries.spec.ts`    | Delivery create, mark delivered, reopen, delete + order re-derivation                | Mixed            |
| `e2e/orders.spec.ts`        | Order create-route auth redirect, cancelled-order edit guard, FX reconciliation flag | Mixed            |

## Design-Token Guard

`src/test/design-token-guard.test.ts` is a zero-dependency Vitest test (no ESLint plugin, no stylelint) that statically scans non-test source files in `src/` and fails if:

- **Rule A** — a theme-blind Tailwind utility class is found in component markup (e.g. `text-white`, `bg-blue-500`, `border-gray-300`). This rule scans `.tsx` files only. UI must use semantic theme tokens.
- **Rule B (L074)** — a `color-mix(in oklch, var(--<neutral-token>)…)` is found. This rule scans `.tsx`/`.ts`/`.css` files. Mixing low-chroma neutral tokens in oklch collapses the hue (salmon drift); neutral mixes must use `oklab`. High-chroma accent/status tokens may keep oklch.

Legitimate hardcoded colors (OG images, transactional emails, the `global-error` fallback, brand SVG marks) live outside Tailwind `className`s and are not matched.

## Shared E2E Helpers

`e2e/_helpers/auth.ts` exports two utilities used across authenticated specs:

- `shouldSkipAuthenticatedE2E()` — returns `true` when `E2E_USER_EMAIL` or `E2E_USER_PASSWORD` is absent; specs call `test.skip(shouldSkipAuthenticatedE2E(), …)` to skip gracefully instead of failing.
- `signInAndLandOnDashboard(page)` — clears cookies, navigates to sign-in, fills credentials, retries up to 3 times, and asserts the dashboard URL. The dev test credentials are documented in the project memory file `reference_dev_credentials.md`.

## Browser-Testing Patterns Rule

`.agents/rules/browser-testing-patterns.mdc` captures conventions established during the redesign phase and applies to any code in `src/**/*.test.tsx`, `src/**/*.test.ts`, or `e2e/**/*.spec.ts`:

- **Portal queries**: use `screen.*` (not `container.querySelector`) for Modal, Sheet, FilterDrawer, Toast, and any component that portals to `document.body`.
- **React-aware `dispatchEvent`**: use `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` before dispatching `input` events on controlled inputs from outside React's render loop; prefer `fireEvent.change` / `userEvent.type` when possible.
- **`preview_eval` navigation**: never chain `await` after `window.location.href` assignment — the evaluation context is destroyed by navigation; use a split call.
- **Mobile viewport**: set `page.setViewportSize` before navigation in viewport-specific tests.
- **Dev-login pattern**: use `signInAndLandOnDashboard` for protected `(app)/*` routes in E2E rather than ad-hoc sign-in sequences.

These conventions complement (do not replace) the risk-based strategy. They apply wherever the covered component patterns appear in tests.

## Strategy Reference

Full testing strategy: `docs/development/testing.md`

## Linked Blueprint

- `docs/product/prd-02-collector-app/frd-02-testing-and-quality-baseline/bp-01-risk-based-test-platform/bp-01-risk-based-test-platform.md`
