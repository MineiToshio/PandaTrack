---
id: WO-02
type: WORK_ORDER
slug: global-error-hardening
title: Global-Error Hardening
status: ACTIVE
parent: BP-01
source_issue: 119
source_features: []
implementation_status: IN_PROGRESS
last_updated: 2026-07-14
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

## Assumptions

- Bilingual presentation leads with a language guessed from the URL path (`/es` vs `/en` first segment, default `es`) and keeps the other language fully legible below it, rather than stacking both languages with equal weight, in [`global-error.tsx`](../../../../../../src/app/global-error.tsx).
- Theme-safety is achieved with a small inline `<style>` block defining CSS custom properties, overridden by an `@media (prefers-color-scheme: dark)` query, since the theme-init script never runs before `global-error.tsx` and `data-theme` cannot be assumed, in [`global-error.tsx`](../../../../../../src/app/global-error.tsx).
- The retry action label is bilingual (`Reintentar · Retry`) rather than a single language, so the one recovery action stays legible to both audiences without adding next-intl, in [`global-error.tsx`](../../../../../../src/app/global-error.tsx).
- The root-scope 404 gap found during verification (a non-locale URL rendering Next's framework-default 404) is closed with a redirect in the invalid-locale branch of [`[locale]/layout.tsx`](../../../../../../src/app/%5Blocale%5D/layout.tsx) rather than a root-layout restructure.
- A dev-only harness route renders `GlobalError` directly outside the `/{locale}` tree so the E2E spec can exercise the fallback, since `global-error.tsx` only replaces the root layout on a genuine failure in a production build, not under the `next dev` server Playwright's `webServer` runs, in [`dev-global-error/page.tsx`](../../../../../../src/app/dev-global-error/page.tsx).

## Technical Notes

- **Bilingual-presentation decision**: chose a dependency-free path-based lead (guess the language from `window.location.pathname`'s first segment, default to the app default locale `es` when no window is available) over stacking both languages with identical visual weight. The lead block reads first and largest; the other language follows immediately below at a slightly smaller, still fully legible size, separated by a divider. This satisfies `FR-10-09` ("bilingual inline") while giving the more likely-relevant audience the primary read, and degrades safely to `es` during any render pass where `window` is unavailable.
- **Root-404 verification finding**: ran the app locally and confirmed a non-locale URL (for example `/foo`) matches the `[locale]` dynamic segment with an invalid locale value; `[locale]/layout.tsx` calls `notFound()`; because a layout cannot render its own segment's `not-found.tsx`, that call had no root boundary to land on and fell through to Next's framework-default 404 page (confirmed via a real request: HTTP 404 status, "This page could not be found." body, not the on-brand `[locale]/not-found.tsx` copy). This is a real, concrete gap under `FR-10-13`, not a documented no-gap outcome.
- **Root-404 fix chosen**: replaced the `notFound()` call in the invalid-locale branch of `src/app/[locale]/layout.tsx` with `redirect("/" + routing.defaultLocale)`. A first attempt used a root `src/app/not-found.tsx` that issued the redirect, but under the E2E gate the framework still returned its default 404 for `/foo`-style URLs (a `redirect()` thrown while rendering a root not-found boundary without a root layout is not honored reliably), so the redirect was moved into the layout itself, where `redirect()` is a documented, reliable primitive. Verified by the `e2e/global-error.spec.ts` root-404 test: `/foo`-style URLs now land on `/es`, and `/en/nonexistent-thing` (inside the `/{locale}` tree) still renders the on-brand localized 404 via the existing `[...rest]` catch-all, confirming no regression to `AC-10-02`.
- **Alternatives considered and rejected for the 404 fix**: (a) broadening the proxy matcher so every path is internationalized, letting next-intl's own locale-prefix redirect catch `/foo`, rejected because it touches the private-route auth-redirect logic in `src/proxy.ts`, which is outside this slice's scope and risk budget for a hardening pass; (b) redirecting to `/${defaultLocale}${pathname}` to preserve the attempted path and land on the literal not-found copy, rejected because Next.js does not expose the unmatched pathname to a root `not-found.tsx` without relying on undocumented internals.
- **E2E simulation for `global-error.tsx`**: `global-error.tsx` only takes over a genuine root-layout failure in a production build; Playwright's `webServer` in `playwright.config.ts` runs `npm run dev`, where Next.js shows its dev error overlay instead. The dev-only harness route renders the real `GlobalError` component directly with a manufactured error, placed outside `/{locale}` (like `global-error.tsx` itself) so it needs no parent layout and produces its own `<html>`/`<body>` without nesting conflicts. Outside development the harness redirects to the default locale (same policy as the invalid-locale branch), so it is never reachable once deployed.
