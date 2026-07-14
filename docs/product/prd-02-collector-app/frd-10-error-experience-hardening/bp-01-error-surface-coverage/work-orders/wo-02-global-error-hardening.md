---
id: WO-02
type: WORK_ORDER
slug: global-error-hardening
title: Global-Error Hardening
status: DRAFT
parent: BP-01
source_features: []
implementation_status: PLANNED
last_updated: 2026-07-13
---

# WO-02 Global-Error Hardening

## Summary

Harden `src/app/global-error.tsx`, the catastrophic fallback for a root-layout render failure. Replace the Spanish-only hardcoded copy with bilingual (es + en) inline copy, make the styling theme-safe (it may render before the theme init script runs), and verify the single Sentry capture. Separately, document and verify the root-scope (non-locale) 404 behavior, adding coverage only if a real gap exists.

Because `global-error.tsx` replaces the root layout, it cannot import next-intl, use theme tokens, or rely on providers. Its self-containment is a hard constraint (ADR 0013), not a style choice.

## In Scope

- update `src/app/global-error.tsx` to:
  - present bilingual copy inline (es + en legible together, or a dependency-free path-based language hint that still keeps both legible) instead of Spanish-only
  - use theme-safe inline styling that does not assume a specific `data-theme` and remains legible in both light and dark contexts
  - keep it fully self-contained: inline styles, inline SVG, no next-intl, no design tokens, no providers
  - retain exactly one `Sentry.captureException(error)` in a `useEffect`, plus a retry that calls `reset()`
- document the root-scope 404 path: the proxy matcher (`["/", "/(es|en)/:path*"]`) and the `[locale]/[...rest]/page.tsx` catch-all together determine which URLs reach the localized 404. Verify a mistyped/non-locale URL does not fall to Next's default 404; add coverage only if a concrete unhandled path is found.
- unit test asserting `global-error.tsx` renders the bilingual fallback, wires `reset()`, and calls `Sentry.captureException` once
- an E2E acceptance path that forces a root-layout-level failure (or simulates the global-error render) and asserts the self-contained fallback renders with a working retry

## Out of Scope

- `[locale]/error.tsx` (WO-01)
- `(app)` boundaries (owned by FRD-03)
- Sentry init/config policy review (WO-03)
- restyling the localized 404 surfaces (verify-only here)
- PostHog events (none for error surfaces)

## Requirements

- `FR-10-08`, `FR-10-09`, `FR-10-10`, `FR-10-11`, `FR-10-13`
- `BR-10-04`, `BR-10-05`, `BR-10-07`
- Acceptance: `AC-10-03`, and the verification half of `AC-10-02`

## Blueprints

- [`BP-01`](../bp-01-error-surface-coverage.md): global-error contract (self-contained, bilingual, theme-safe, single capture) and the 404 verify-only contract

## Design and Copy

- `global-error.tsx` is the single sanctioned exception to the i18n and theme-token rules (`BR-10-05`); keep the exception contained to this file.
- Match the destructive icon-well + retry vibe of the shipped surface, standalone, per [`states.md`](../../../../../design/states.md) §3.2. No FDD/prototype (system screen).
- Copy voice: neutral pole for errors ([`ux-copy.md`](../../../../../design/ux-copy.md)); no mascot (`BR-10-07`).

## E2E Acceptance Tests

- Given a root-layout render failure, when `global-error.tsx` takes over, then a self-contained bilingual fallback renders with a working retry, no next-intl/theme/provider is required, and exactly one `Sentry.captureException` is emitted.
- Given a mistyped non-locale or unmatched URL, when it resolves, then the on-brand localized neutral 404 renders (never the framework default) and no Sentry capture is emitted.
