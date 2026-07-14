---
id: WO-01
type: WORK_ORDER
slug: locale-error-boundary
title: Locale Error Boundary
status: ACTIVE
parent: BP-01
source_issue: 118
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-14
---

# WO-01 Locale Error Boundary

## Summary

Add the missing locale-level route error boundary `src/app/[locale]/error.tsx` so render and runtime errors in the `(auth)`, `(landing)`, `privacy`, and `terms` segments (and any child of `[locale]/layout.tsx`) resolve to a styled, localized, recoverable surface instead of bubbling to the bare catastrophic fallback. The boundary also backstops `(app)/error.tsx` if that boundary itself throws.

This closes the primary coverage gap identified in [`FRD-10`](../../frd-10-error-experience-hardening.md).

## In Scope

- new Client Component `src/app/[locale]/error.tsx` that:
  - receives `{ error, reset }`
  - renders the destructive full-page surface per [`states.md`](../../../../../design/states.md) §3.1: `EmptyState appearance="page"`, `iconTone="destructive"`, `TriangleAlert`, mono eyebrow, `role="alert"`, `headingAs="h1"`
  - offers a primary retry action (`RotateCw`, calls `reset()`) and a ghost go-home action (locale root `/{locale}`)
  - captures the failure once: `Sentry.captureException(error, { tags: { area: "public_shell" }, extra: { digest: error.digest } })` in a `useEffect`
- new `common.error` translation keys in `src/i18n/locales/es/common.json` and `src/i18n/locales/en/common.json` (`eyebrow`, `title`, `description`, `retry`, `goHome`), voiced per [`ux-copy.md`](../../../../../design/ux-copy.md) neutral pole for errors
- unit test asserting the boundary renders the localized surface, wires `reset()` to the retry action, and calls `Sentry.captureException` once with `area: "public_shell"`
- an E2E acceptance path that forces a render error in a public/auth route and asserts the styled localized surface renders with a working retry

## Out of Scope

- `(app)/error.tsx` and `(app)/not-found.tsx` (owned by FRD-03; unchanged)
- `global-error.tsx` (WO-02)
- any per-segment error boundary inside `orders`/`deliveries`/`stores`/`settings` (`BR-10-09`)
- any change to Sentry init or framework hooks (owned by PRD-01 FRD-02)
- PostHog events (none for error surfaces per FRD-10 Analytics)

## Requirements

- `FR-10-02`, `FR-10-03`, `FR-10-05`, `FR-10-06`, `FR-10-07`
- `FR-10-11` (single capture; 404/offline never capture)
- `BR-10-03`, `BR-10-04`, `BR-10-06`, `BR-10-07`
- Acceptance: `AC-10-01`

## Blueprints

- [`BP-01`](../bp-01-error-surface-coverage.md): locale route-error contract, tier separation (`public_shell` vs `app_shell`), primitive reuse

## Design and Copy

- Reuse the exact component shape of the existing `(app)/error.tsx`; only the `tags.area` value (`public_shell`) and the copy namespace (`common.error`) differ. Do not introduce a new visual treatment.
- The boundary renders inside `[locale]/layout.tsx`, so next-intl and theme tokens are available. Keep the component dependency-light so a missing dependency does not itself trip the boundary.
- Visual, tone, and a11y are owned by [`states.md`](../../../../../design/states.md) §3.1 and [ADR 0013](../../../../../design/decisions/0013-cross-cutting-state-system.md); do not re-specify them. No FDD/prototype (system screen).
- Mascot is prohibited (`BR-10-07`).

## E2E Acceptance Tests

- Given a forced render error in a `(landing)` or `(auth)` route, when the boundary resolves, then the localized destructive error surface renders inside the locale layout, the retry action re-runs the segment via `reset()`, and the go-home action navigates to `/{locale}`.
- Given the same error, then exactly one Sentry capture is emitted tagged `area: "public_shell"` with the digest (asserted via a spy/mock in the unit test; the E2E asserts the user-visible surface and recovery).

## Assumptions

- The go-home action targets the bare locale root `/{locale}`, mirroring the existing pattern in [`not-found.tsx`](../../../../../../src/app/[locale]/not-found.tsx) rather than `ROUTES.dashboard` (which the `(app)` shell uses instead), since the public shell's "home" is the marketing landing page, not the dashboard.
- `common.error` copy reuses the same voice and wording already validated for `appLayout.error` (destructive tone, neutral voice, assume-the-fault phrasing), per [`ux-copy.md`](../../../../../design/ux-copy.md) section 3.2 and the frozen tone vocabulary in [`states.md`](../../../../../design/states.md) section 3.1. The failure message itself does not need to differ between the app shell and the public shell.
- The component is a Client Component receiving `{ error, reset }` and mirrors the exact shape of [`(app)/error.tsx`](<../../../../../../src/app/[locale]/(app)/error.tsx>) per the Design and Copy note above; only `useTranslations` namespace, `tags.area`, and the go-home `href` differ.
- Test file placement follows the existing `_tests/` sibling-folder convention (`.agents/rules/project-structure.mdc`) applied at the route-segment level, matching how `_actions/_tests/` is used elsewhere in the app router tree.

## Technical Notes

- The E2E acceptance test needs a deterministic way to force a render error in a public route. A new dev-only route, `src/app/[locale]/dev-error-boundary/page.tsx`, throws unconditionally outside `NODE_ENV === "production"` and resolves to the standard `notFound()` in production, so it is never a reachable endpoint once deployed. This mirrors the existing `[...rest]/page.tsx` precedent of using a dedicated route to deterministically exercise a boundary (in that case `not-found.tsx`, in this one `error.tsx`).
- Sentry capture uses the exact same `tags`/`extra` shape as `(app)/error.tsx` (`tags: { area: "public_shell" }`, `extra: { digest: error.digest }`) so both tiers stay consistent per [`states.md`](../../../../../design/states.md) section 3.6 (one capture per error).
