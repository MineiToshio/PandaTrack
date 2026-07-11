# Testing Strategy

This document defines how PandaTrack should use automated tests in a risk-based way.

The goal is not full coverage. The goal is to protect the product areas where regressions would be expensive: business rules, money-related calculations, state transitions, and the main user workflows.

## Principles

- Prefer high-value tests over high test counts.
- Match the test type to the risk.
- Keep tests deterministic and focused on stable behavior.
- Avoid tests that mostly duplicate implementation details.
- Avoid exact-copy assertions for normal UX text. Prefer stable signals like role, visibility, state changes, URLs, disabled/enabled state, and side effects.
- Use automated checks as a baseline on every meaningful change.

Exception:

- Exact text assertions are allowed only when the text itself is contractual or product-critical, such as legal copy, compliance requirements, or intentionally fixed security wording.

## Test pyramid for PandaTrack

### Unit tests

Use unit tests for isolated logic that should remain correct regardless of UI or infrastructure.

Typical candidates:

- payment calculations
- remaining balance logic
- order or shipment status resolution
- totals and dashboard aggregates
- parsers, mappers, and pure validation helpers

Why they matter:

- fastest feedback
- easiest place to lock down bug fixes
- strong fit for logic that AI can implement incorrectly in subtle ways

### Integration tests

Use integration tests when correctness depends on multiple pieces working together.

Typical candidates:

- server actions that validate input and persist data
- query/data modules that map Prisma results into app-facing structures
- route handlers with validation, auth, and response shaping
- third-party integration boundaries where request/response handling must stay stable

Why they matter:

- catch contract mismatches between layers
- verify data flow instead of isolated functions
- reduce false confidence from unit tests that pass while the real stack is broken

### End-to-end tests

Use E2E tests for the few workflows that must work from the user perspective.

Typical candidates:

- create an order
- register a partial payment
- verify remaining amount
- register shipment or split shipment
- confirm dashboard updates

Why they matter:

- validate routing, rendering, forms, persistence, and UI feedback together
- catch real regressions in App Router flows
- provide confidence for release-critical paths

## Next.js App Router guidance

PandaTrack uses Next.js App Router. That has an important implication:

- prefer unit and integration tests for isolated logic and module contracts
- use component tests mainly for Client Components and synchronous UI behavior
- do not depend on component tests alone for async Server Component flows
- cover critical async server-rendered flows with E2E tests

## Recommended stack

When adding test infrastructure, use:

- `Vitest` for unit and integration tests
- `React Testing Library` for component tests on Client Components and synchronous UI behavior
- `Playwright` for E2E coverage of critical workflows

This stack balances fast local feedback with realistic coverage for App Router behavior.

## Current baseline

The repository now includes a Vitest + React Testing Library baseline for fast unit and integration checks on isolated modules and Client Components, plus a small Playwright suite for cross-route landing and auth flows.

Use these commands locally:

1. `npm run test`
2. `npm run test:watch`
3. `npm run test:e2e`

Current representative coverage:

- unit coverage for isolated analytics helper behavior
- landing waitlist coverage for server-action contracts, client validation/submission behavior, and share interactions
- Playwright coverage for critical landing CTA, auth entry, password recovery, and unauthenticated dashboard access flows

## Running the authenticated E2E suite off port 3000

Authenticated specs (`app-layout`, `dashboard`, `deliveries`, `orders`, `settings`, `stores`) sign in
through Better Auth, which only accepts requests from an origin listed in `trustedOrigins` (see
`src/lib/auth/auth.ts`). Locally, port `3000` is often occupied by an unrelated project's dev
server, so Playwright needs to run on a different port that Better Auth is told to trust.

Mechanism:

- `playwright.config.ts` loads `.env` then `.env.local` (gitignored) directly, so both the
  Playwright process and the spec files see the same env vars the Next.js dev server sees.
- `PLAYWRIGHT_PORT` (gitignored, in `.env`) selects the port for `baseURL` and the spawned dev
  server. It defaults to `7100` — PandaTrack's fixed project dev port (see `.claude/launch.json`,
  `.claude/dev-server.sh`) — instead of `3000`.
- `BETTER_AUTH_EXTRA_ORIGINS` (gitignored, in `.env.local`) must list `http://localhost:<port>` for
  any non-3000 port used. `e2e/_helpers/auth.ts` exports `isAuthenticatedPortTrusted()`, which
  every authenticated spec calls (via `skipUnlessAuthenticatedEnv()`) to skip itself instead of
  failing when the configured port isn't 3000 and isn't in that allow-list.
- `webServer.reuseExistingServer` (true outside CI) means if a dev server is already running on
  the configured port — e.g. one started through `.claude/launch.json` for interactive preview —
  Playwright reuses it instead of spawning a conflicting second instance on the same port.

Credentials: `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` (gitignored, in `.env`) must be a real account's
credentials; `signInAndLandOnDashboard()` drives the actual sign-in form. `.env.example` documents
the variable names (`PLAYWRIGHT_PORT`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`,
`BETTER_AUTH_EXTRA_ORIGINS`) with placeholders only — never commit real values.

To run the full authenticated suite locally: ensure `.env`/`.env.local` have the vars above, then
run `npm run test:e2e` as usual (`PLAYWRIGHT_PORT` already defaults to `7100` via `.env`).

## Test file organization

PandaTrack keeps tests close to the code they protect, but not mixed indiscriminately with implementation files.

Use this convention:

- feature- or component-specific tests go in **`_tests/`** inside the relevant multi-file folder
- Playwright E2E specs go in **`e2e/`** and must be split by domain or workflow area such as `landing.spec.ts`, `auth.spec.ts`, or `dashboard.spec.ts`
- shared testing helpers go in **`src/test/`**

Example:

- `src/app/[locale]/(landing)/_components/Waitlist/Waitlist.tsx`
- `src/app/[locale]/(landing)/_components/Waitlist/submitWaitlist.ts`
- `src/app/[locale]/(landing)/_components/Waitlist/_tests/Waitlist.test.tsx`
- `src/app/[locale]/(landing)/_components/Waitlist/_tests/submitWaitlist.test.ts`
- `src/app/[locale]/(landing)/_components/Waitlist/_tests/WaitlistShare.test.tsx`
- `e2e/landing.spec.ts`
- `e2e/auth.spec.ts`

Why this split:

- `_tests/` keeps the feature folder easy to scan
- co-location keeps test intent discoverable during implementation and refactors
- `src/test/` avoids duplicating setup code across unrelated areas
- domain-based E2E files avoid turning browser coverage into one large mixed spec that is harder to scan and maintain

Use `src/test/` for things like:

- custom `renderWithProviders()` helpers
- shared browser API mocks such as `matchMedia`, `ResizeObserver`, or clipboard helpers
- reusable fixtures/factories such as mock users, sessions, or common `FormData` builders
- common testing wrappers for `next-intl`, theme providers, or analytics mocks

Do not move a helper into `src/test/` just because it exists. Promote it only when it is clearly reused across multiple test files or feature areas.

Keep App Router limitations explicit:

- prefer RTL for Client Components and synchronous browser behavior
- do not treat async Server Components as good RTL targets by default
- use Playwright for end-to-end App Router flow validation when route transitions, redirects, or async server rendering are the real risk

## Decision framework for every implementation

Every feature, bugfix, or refactor should evaluate these three questions before completion:

1. Does this change add or modify business logic that should have unit tests?
2. Does this change depend on multiple modules or layers cooperating correctly and therefore need integration tests?
3. Does this change affect a critical user workflow that should be proven end-to-end?

If the answer is yes, add the relevant tests in the same change whenever practical.

Record the decision in the related `Work Order` and source product docs, and keep mirrored GitHub artifacts aligned. For each test type, mark it as:

- required, with the target behavior or flow to cover
- not required, with a short risk-based reason

This keeps planning, implementation, and review aligned on the same testing expectation.

## What deserves priority coverage

Start with the highest-risk product areas:

- pre-order payment tracking
- paid vs remaining amount calculations
- shipment and split shipment state changes
- order lifecycle status logic
- dashboard totals and derived summaries
- validation at server boundaries

## What does not need heavy test investment

Usually avoid spending early effort on:

- static presentational markup with no branching logic
- trivial wrappers around framework primitives
- low-risk visual changes better covered by manual review
- brittle assertions against marketing or UX copy that may evolve without changing the behavior

When a change falls into this category, do not leave testing unspecified. Explicitly document that unit, integration, and E2E tests are not required by risk.

## Relationship with automated checks

Tests complement, but do not replace, the validation checklist.

Choose the validation scope by risk:

1. docs/rules/process-only changes: no app validation commands
2. trivial low-risk code edits: run the narrowest relevant check, usually `npm run lint`
3. behavioral or higher-risk changes: run `npm run test`, `npm run type-check`, `npm run lint`, and `npm run validate-build`

When test scripts exist for the affected scope, run the relevant automated tests as part of the same validation pass.

For workflows that already have Playwright coverage, E2E validation is not optional at close-out. Run the matching spec for the touched area, or run the full `npm run test:e2e` suite when multiple covered workflows are affected.

Examples:

- auth flow changes: `npm run test:e2e -- e2e/auth.spec.ts`
- landing CTA/waitlist changes: `npm run test:e2e -- e2e/landing.spec.ts`
- broader routing or multiple covered flows: `npm run test:e2e`

## Practical rollout

Adopt testing incrementally:

1. Start with unit tests for the most critical business rules.
2. Add integration tests for server-side feature slices and data contracts.
3. Add a small number of E2E tests for the MVP workflows that cannot break.

This keeps delivery velocity high while steadily improving confidence.

## CI workflows

Two GitHub Actions workflows run automated checks beyond local development:

- `.github/workflows/validate.yml` — runs on every push/PR to any branch. The `validate` job
  runs type-check, lint, and unit tests. A separate `build` job runs `npm run validate-build`
  (Prisma client generation + `next build --webpack`, no real database access) to catch
  production-build regressions that `type-check`/`lint` alone would miss. The `build` job needs
  no GitHub secrets: `DATABASE_URL` and `BETTER_AUTH_SECRET` are set to non-secret placeholder
  values in the workflow, only to keep module-scope reads (the Prisma connection pool in
  `src/lib/prisma.ts`, Better Auth's `secret` in `src/lib/auth/auth.ts`) from seeing `undefined`.
- `.github/workflows/e2e-critical.yml` — runs Playwright's critical-flow specs (`e2e/auth.spec.ts`
  and `e2e/orders.spec.ts`) only on pull requests targeting `main`, plus manual
  `workflow_dispatch` runs. It intentionally does not run on every push: a real Postgres +
  browser round-trip is too costly for that. `playwright.config.ts`'s `webServer` starts
  `npm run dev` itself against the configured database (`reuseExistingServer` is disabled
  whenever `CI` is set).

### Required GitHub secrets

**Owner decision (2026-07-10): deferred — not needed while the workflow stays local-only.**
`e2e-critical.yml` only triggers on a `pull_request` targeting `main` or a manual
`workflow_dispatch` run from the Actions tab. The project's actual workflow does not open PRs or
merge through GitHub, so this workflow never fires on its own today, and the secrets below have
no effect until that changes. `validate.yml` (type-check, lint, unit tests, build) still runs on
every push and needs none of this.

Set these secrets only when the workflow starts actually running (e.g. if PRs or manual dispatch
runs are adopted later):

The `e2e-critical.yml` workflow needs the following repository secrets (Settings → Secrets and
variables → Actions). This is the one part of R9 (CI: build + critical e2e) that requires manual
setup — the workflows themselves need no other secrets:

| Secret                   | Used for                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `E2E_DATABASE_URL`       | Postgres connection string CI uses to run the e2e suite. Migrations are applied automatically (`prisma migrate deploy`). |
| `E2E_BETTER_AUTH_SECRET` | Better Auth session-signing secret for the E2E app instance.                                                             |
| `E2E_USER_EMAIL`         | Email of the test account used to sign in during e2e runs.                                                               |
| `E2E_USER_PASSWORD`      | Password for that same test account.                                                                                     |

**Owner decision (2026-07-10): these four secrets point at the development environment**, not a
dedicated E2E database. Concretely:

- `E2E_DATABASE_URL` = the same Neon **dev** `DATABASE_URL` already used for local development.
- `E2E_BETTER_AUTH_SECRET` = the same `BETTER_AUTH_SECRET` used in dev.
- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` = the existing dev test account (the one
  `scripts/seed-dev-data.ts` already seeds via `TARGET_USER_EMAIL`), which already has at least one
  store for `orders.spec.ts`'s order-creation flow.

Consequences of this choice:

1. **No separate E2E database to seed.** The dev database already has the test user and stores
   the specs need, so there is no additional data-setup step beyond creating the secrets below.
2. **CI e2e runs create/clean up test data in the dev database**, the same way local e2e runs
   already do — this is a shared side effect of running Playwright against dev, not something new.
   If that ever becomes a problem (data noise, contention with local dev work), the fix is to
   provision a dedicated E2E database and point these same 4 secrets at it — no workflow changes
   required.

Set the 4 secrets from the values already in the local `.env` (this reads local values and does
not print or store them anywhere except GitHub's encrypted secret store):

```bash
gh secret set E2E_DATABASE_URL --body "$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')"
gh secret set E2E_BETTER_AUTH_SECRET --body "$(grep '^BETTER_AUTH_SECRET=' .env | cut -d= -f2- | tr -d '"')"
gh secret set E2E_USER_EMAIL --body "$(grep '^E2E_USER_EMAIL=' .env | cut -d= -f2- | tr -d '"')"
gh secret set E2E_USER_PASSWORD --body "$(grep '^E2E_USER_PASSWORD=' .env | cut -d= -f2- | tr -d '"')"
```
