# Testing Strategy

This document defines how PandaTrack should use automated tests in a risk-based way.

The goal is not full coverage. The goal is to protect the product areas where regressions would be expensive: business rules, money-related calculations, state transitions, and the main user workflows.

## Principles

- Prefer high-value tests over high test counts.
- Match the test type to the risk.
- Keep tests deterministic and focused on stable behavior.
- Avoid tests that mostly duplicate implementation details.
- Use automated checks as a baseline on every meaningful change.

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

- create a purchase
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

## Decision framework for every implementation

Every feature, bugfix, or refactor should evaluate these three questions before completion:

1. Does this change add or modify business logic that should have unit tests?
2. Does this change depend on multiple modules or layers cooperating correctly and therefore need integration tests?
3. Does this change affect a critical user workflow that should be proven end-to-end?

If the answer is yes, add the relevant tests in the same change whenever practical.

## What deserves priority coverage

Start with the highest-risk product areas:

- pre-order payment tracking
- paid vs remaining amount calculations
- shipment and split shipment state changes
- purchase lifecycle status logic
- dashboard totals and derived summaries
- validation at server boundaries

## What does not need heavy test investment

Usually avoid spending early effort on:

- static presentational markup with no branching logic
- trivial wrappers around framework primitives
- low-risk visual changes better covered by manual review

## Relationship with automated checks

Tests complement, but do not replace, the standard validation checklist:

1. `npm run type-check`
2. `npm run lint`
3. `npm run validate-build`

When test scripts exist for the affected scope, run the relevant automated tests as part of the same validation pass.

## Practical rollout

Adopt testing incrementally:

1. Start with unit tests for the most critical business rules.
2. Add integration tests for server-side feature slices and data contracts.
3. Add a small number of E2E tests for the MVP workflows that cannot break.

This keeps delivery velocity high while steadily improving confidence.
