---
id: WO-03
type: WORK_ORDER
slug: error-contract-audit
title: Error-Contract Audit and Sentry Doc Alignment
status: ACTIVE
parent: BP-01
source_issue: 120
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-14
---

# WO-03 Error-Contract Audit and Sentry Doc Alignment

## Summary

Run a hardening sweep across every route segment and Server Action to confirm they follow the confirmed error contract: discriminated results (`{ ok: false; error: <code> }`, never throw for expected failures), exactly one Sentry capture per unexpected error, no duplicate reporting, and client-side toasts/inline messages for expected errors. Fix the deviations found. Fold in the applicable open hardening items from [`docs/development/sentry.md`](../../../../../development/sentry.md), and update that document so it reflects the final architecture, including the new `public_shell` boundary from WO-01.

This slice runs last because it verifies the full surface set, including the two boundaries created/hardened in WO-01 and WO-02.

## Assumptions

- The route-level boundaries, 404 surfaces, catch-all, and invalid-locale redirect from WO-01/WO-02 are already merged and are audit targets, not build targets.
- The Server Action discriminated-result contract is confirmed and not redesigned; the sweep enforces conformance and fixes deviations only.
- The Sentry runtime init files are owned by PRD-01 FRD-02. Configuration policy is reviewed here and any change is applied in coordination with that owner and mirrored in its doc.
- `sendDefaultPii: false` was already applied in commit `1b40070` (2026-07-10); this slice confirms and records the decision rather than re-applying it.
- Files owned by the parallel FRD-09 work (`src/app/manifest.ts`, `public/` service worker/icons, `vercel.json`, `src/lib/push/**`, `src/lib/data/notifications/**`, settings UI, `POSTHOG_EVENTS`) are out of bounds for edits; any deviation found there is reported as a handoff.

## Audit Plan

Modules swept for the confirmed error contract:

- Route boundaries and 404/redirect tiers: `src/app/[locale]/error.tsx`, `src/app/[locale]/(app)/error.tsx`, `src/app/global-error.tsx`, `src/app/[locale]/not-found.tsx`, `src/app/[locale]/(app)/not-found.tsx`, `src/app/[locale]/[...rest]/page.tsx`, `src/app/[locale]/layout.tsx` (invalid-locale redirect).
- Mutating Server Actions under `src/app/**/_actions/*.ts`: settings (`profileActions`, `accountCredentialsActions`, `preferencesActions`), auth (`resendVerificationEmail`), stores (`createStore`, `saveStoreEdit`, `saveStoreReview`, `deleteStoreReview`, `saveStoreNote`, `saveStoreReport`, `saveStoreProductTypeRequest`, `getDuplicateCandidates`), orders (`orderActions`, `orderFxActions`, `orderLifecycleActions`, `orderNoteActions`, `orderPaymentActions`, `orderItemActions`), deliveries (`createDeliveryAction`, `editDeliveryAction`, `deliveryLifecycleActions`, `deliveryNoteActions`).
- Data-layer modules under `src/lib/data/**` mutations (stores, orders, deliveries, user-settings, auth) for in-transaction throw-to-result conversion and single-capture discipline.
- Framework hooks and config: `src/instrumentation.ts` (`onRequestError`), `src/instrumentation-client.ts` (`onRouterTransitionStart`), the three init files, `next.config.ts`.

## In Scope

- audit every route segment for correct boundary coverage after WO-01/WO-02: `[locale]/error.tsx` (`public_shell`), `(app)/error.tsx` (`app_shell`), `global-error.tsx`, both `not-found.tsx` surfaces, and the `[...rest]` catch-all
- audit every mutating Server Action (`src/lib/data/*` mutation modules and route `_actions`) for conformance to the discriminated-result contract: no throw on expected failure, single capture of unexpected failures with redacted PII-safe context, expected errors rendered client-side
- verify no error is captured twice across framework hooks (`onRequestError`, `onRouterTransitionStart`) and route/global boundaries; remove any manual re-capture that does not add product context
- fold in the applicable open hardening items from `docs/development/sentry.md`:
  - **DSN / sensitive options externalization**: confirm the Sentry DSN and sensitive options are driven by environment variables; document the outcome (already-satisfied is an acceptable result). Any `.env` addition follows [`env-example.mdc`](../../../../../../.agents/rules/env-example.mdc).
  - **`sendDefaultPii` and sampling-rate production policy**: review `sendDefaultPii: true` and `tracesSampleRate` against a production policy and record the decision. Because these live in Sentry init files owned by [`FRD-02` (PRD-01)](../../../../prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md), any change is coordinated with that owner and its docs are updated in the same change.
- update `docs/development/sentry.md`: list every capture point (add `public_shell`), and replace the "Open hardening items" section with the resolution/decision for each item
- tests for whatever the sweep fixes (unit tests for corrected Server Action result shapes or capture behavior; no new E2E unless a fix changes a user-visible flow)

If the audit finds no Server Action deviations and no applicable hardening items, this slice reduces to the `docs/development/sentry.md` alignment update (adding `public_shell` and recording the reviewed items), and that outcome is stated explicitly in the sweep result rather than leaving the slice empty.

## Out of Scope

- redesigning the Server Action result pattern (it is confirmed, not reinvented)
- adding new per-segment boundaries (`BR-10-09`)
- offline/PWA behavior (FRD-09)
- adding PostHog events for error surfaces
- changing Sentry runtime init structure (only configuration policy is reviewed here, with the PRD-01 owner)

## Requirements

- `FR-10-11`, `FR-10-12`, `FR-10-14`
- `BR-10-04`, `BR-10-08`
- Acceptance: `AC-10-04`, `AC-10-05`

## Blueprints

- [`BP-01`](../bp-01-error-surface-coverage.md): Server Action result contract (audit target), one-capture-per-error discipline, monitoring doc contract

## Cross-domain coordination

- Sentry init and configuration files are owned by [`FRD-02` (PRD-01)](../../../../prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md) · [BP-01 · WO-02 _runtime-monitoring-baseline_](../../../../prd-01-public-landing/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/work-orders/wo-02-runtime-monitoring-baseline.md). Any configuration change here is coordinated with that FRD, and its `BR-02-03` (no duplicate capture) / `BR-02-04` (no PII in captures) are treated as binding.

## E2E Acceptance Tests

- Given each error/404/offline surface is exercised across the app, when each renders, then each unexpected failure is captured exactly once and no expected/absent/transitory state (404, offline, validation) is captured.
- Given a Server Action hits an expected failure, when it returns, then it returns `{ ok: false; error: <code> }` without throwing, the client surfaces the error without tripping any route boundary, and Sentry is not notified. (Verified primarily via unit tests over the audited actions; existing domain E2E suites cover the user-visible recovery.)
