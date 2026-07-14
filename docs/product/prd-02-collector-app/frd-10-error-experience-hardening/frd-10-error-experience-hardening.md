---
id: FRD-10
type: FRD
slug: error-experience-hardening
title: Error Experience Hardening
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-07-14
source_features: []
implementation_status: IMPLEMENTED
---

# FRD-10 Error Experience Hardening

## Overview

Define a complete, controlled failure experience across the whole collector app and its public surfaces: full 404 coverage, a proper generic error (500-class) surface for every route segment, a hardened catastrophic global-error fallback, and a single consistent error-capture discipline. The outcome is that no user ever reaches an unstyled crash and every failure is reported to monitoring exactly once.

This is a consolidation and hardening FRD. It builds on an existing mature cross-cutting state system and never redefines it. The visual and behavioral spec for every error/404/offline surface is owned by the design system: [ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md) (cross-cutting state system) and [`docs/design/states.md`](../../../design/states.md) §3. This FRD is the product-level owner of the route-level failure contract and the coverage guarantee; it defers all visual treatment to those documents.

## Domain Goal

Guarantee that every reachable URL and every render or runtime failure resolves to an on-brand, localized, recoverable surface, and that every unexpected failure is captured once with the right context. Close the remaining coverage gaps without adding boundaries or events that are not justified.

## Current State

The app already ships most of this system. The gaps are specific and small.

### Implemented

- `src/app/global-error.tsx`: catastrophic fallback for a root-layout render error. Self-contained (inline styles, inline SVG icons, no next-intl, no theme tokens), captures once via `Sentry.captureException`, offers retry via `reset()`. It is the one documented place where hardcoded colors are allowed (ADR 0013). Copy is currently Spanish-only.
- `src/app/[locale]/(app)/error.tsx`: authenticated-shell route error boundary. Captures once with `tags.area = "app_shell"` and `extra.digest`, renders `EmptyState appearance="page"` destructive tone, `role="alert"`, offers retry (`reset()`) + go-home. Owned by [`FRD-03`](../frd-03-collector-app-shell/frd-03-collector-app-shell.md).
- `src/app/[locale]/(app)/not-found.tsx`: authenticated-shell 404. Neutral tone, no Sentry capture, keeps the shell, offers home + orders CTAs. Owned by [`FRD-03`](../frd-03-collector-app-shell/frd-03-collector-app-shell.md).
- `src/app/[locale]/not-found.tsx`: public root 404 for any unmatched URL under `/{locale}`. Neutral tone, localized (`common.notFound`), no capture.
- `src/app/[locale]/[...rest]/page.tsx`: catch-all that converts an otherwise-unmatched path under `/{locale}` into a `notFound()` so it renders the on-brand `[locale]/not-found.tsx` instead of the framework default 404.
- Sentry runtime baseline: `onRequestError` (server/edge request errors), `onRouterTransitionStart` (client navigation), and the three-runtime init. Owned by [`FRD-02` (PRD-01)](../../prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md) · [BP-01 · WO-02 _runtime-monitoring-baseline_](../../prd-01-public-landing/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/work-orders/wo-02-runtime-monitoring-baseline.md).
- Server Actions across settings, orders, deliveries, and user-settings already return a consistent discriminated result (`{ ok: true; …payload } | { ok: false; error: <code>; …extra }`), never throw for expected failures, capture only unexpected errors, and surface expected errors to the client (toast/inline).
- Design primitives: `EmptyState` (`appearance="page"`, tone-extended), `SectionError`, `Toast`, and `ToastContext` all exist and are canonical.

### Planned

- A **locale-level route error boundary** `src/app/[locale]/error.tsx`. It does not exist today, so any render error inside `(auth)`, `(landing)`, `privacy`, `terms`, or the children of `[locale]/layout.tsx` bubbles past every styled boundary straight to the bare `global-error.tsx` catastrophic fallback. This is the primary coverage gap.
- **global-error hardening**: bilingual (es + en) inline copy instead of Spanish-only, verified theme-safe styling, and confirmed single capture.
- An **error-contract audit sweep** across every route segment and Server Action, folding in the applicable open hardening items from [`docs/development/sentry.md`](../../../development/sentry.md) and updating that doc to reflect the final state.

## User Stories

### US-10-01 Never hit a raw crash

As a collector, when something breaks on any screen, I want a clear, on-brand page that tells me what happened and lets me retry or get back to safe ground, so I never see a raw stack trace or an unstyled browser error.

### US-10-02 Consistent missing-page experience

As a collector, when I follow a broken or stale link anywhere in the product, I want the same calm, localized "this page doesn't exist" surface with a way back, whether the URL is public or inside my workspace.

### US-10-03 Recover from a public-surface failure

As a visitor on the landing, legal, or sign-in pages, when a render error occurs, I want a styled, localized error page with retry and home actions, not the catastrophic bare fallback meant only for total root failure.

### US-10-04 Reliable, quiet monitoring

As the team maintaining PandaTrack, I want every unexpected failure captured in Sentry exactly once with useful context, and expected user errors kept out of the noise, so alerting stays trustworthy.

## Functional Requirements

Coverage:

- `FR-10-01`: Every unmatched URL under `/{locale}` must resolve to the on-brand, localized, neutral 404 surface (`[locale]/not-found.tsx` via the `[...rest]` catch-all), never the framework default 404. In-shell `notFound()` calls under `(app)` continue to resolve to the shell-scoped 404.
- `FR-10-02`: Every render or runtime error thrown within a public or authenticated route segment must be caught by a styled, localized route-level error boundary and must never fall through to the bare `global-error.tsx` fallback except when the root layout itself fails.
- `FR-10-03`: A new locale-level error boundary `src/app/[locale]/error.tsx` must catch failures in the `(auth)`, `(landing)`, `privacy`, and `terms` segments (all children of `[locale]/layout.tsx`), and act as the backstop if `(app)/error.tsx` itself throws.
- `FR-10-04`: The authenticated `(app)` subtree must retain its dedicated boundary tagged `area: "app_shell"` (owned by FRD-03); this FRD must not collapse the two boundaries into one.

Route error surface behavior:

- `FR-10-05`: The locale-level error boundary must render the destructive full-page surface defined in [`states.md`](../../../design/states.md) §3.1 (`EmptyState appearance="page"`, `iconTone="destructive"`, `TriangleAlert`, mono eyebrow, `role="alert"`), offer a primary retry that calls `reset()` and a ghost go-home action, and localize all copy via next-intl.
- `FR-10-06`: The locale-level error boundary must capture the failure to Sentry exactly once, with `tags.area = "public_shell"` and `extra.digest`, distinguishing it from the `app_shell` boundary.
- `FR-10-07`: Localized route-error copy must live in a dedicated translation namespace (`common.error`, sibling to the existing `common.notFound`) in both `es` and `en`.

Global error surface behavior:

- `FR-10-08`: `global-error.tsx` must remain fully self-contained: inline styles, inline SVG, no next-intl imports, and no dependency on theme tokens or providers, because it replaces the root layout (ADR 0013).
- `FR-10-09`: `global-error.tsx` copy must be bilingual inline (es + en presented together, or rendered from a minimal inline locale guess) rather than Spanish-only, so a catastrophic failure is legible to both audiences without importing i18n.
- `FR-10-10`: `global-error.tsx` styling must be theme-safe (must not assume a specific `data-theme`, since the theme init script may not have run) and must capture the root failure exactly once via `Sentry.captureException`.

Capture discipline:

- `FR-10-11`: 404 (`not-found.tsx` at both levels) and offline surfaces must not capture to Sentry; route error and global error must capture exactly once each. No failure may be captured twice across framework hooks (`onRequestError`) and route boundaries.
- `FR-10-12`: Server Actions must follow the confirmed discriminated-result contract: return `{ ok: false; error: <code> }` for expected failures (never throw), capture only unexpected failures once with redacted context, and let the client surface expected errors as toasts or inline messages.

Root-scope and configuration:

- `FR-10-13`: The behavior for URLs entirely outside the `/{locale}` tree (paths the proxy matcher does not internationalize) must be documented and verified. Additional coverage must be added only if a real gap is found; a documented "no gap, handled by proxy + `[...rest]`" outcome is an acceptable result.
- `FR-10-14`: The applicable Sentry configuration hardening items from [`docs/development/sentry.md`](../../../development/sentry.md) must be resolved or explicitly confirmed as already satisfied, and that document must be updated to reflect the final architecture, including the new `public_shell` boundary.

## Business Rules

- `BR-10-01`: A 404 is neutral, never destructive. The content is absent or moved, not failed; it is not an exception and is never captured to Sentry.
- `BR-10-02`: Offline is a warning, transitory state, never destructive, and is not captured to Sentry.
- `BR-10-03`: Only a real server, render, or fetch failure is destructive tone and is captured.
- `BR-10-04`: Every error is reported to Sentry exactly once. `SectionError` never captures; the fallible fetch that produced it captures in its own `try/catch`. Route and global boundaries capture the render failure; framework hooks must not be re-captured manually unless adding meaningful product context.
- `BR-10-05`: `global-error.tsx` is the single sanctioned exception to the i18n and theme-token rules. Its bilingual copy is inline by necessity, not by preference, and this exception must not be copied to any other surface.
- `BR-10-06`: Route error and 404 surfaces keep the shell where a shell exists. The failure or absence is in the segment, not in the layout, so the layout chrome (sidebar/topbar for `(app)`) stays mounted.
- `BR-10-07`: The mascot is prohibited in every error, 404, and offline state (ADR 0013, D5). No error surface mounts it.
- `BR-10-08`: Server Action expected errors are typed discriminated results, not exceptions. The client always renders them (toast or inline); an expected error must never manifest as a thrown error that trips a route boundary.
- `BR-10-09`: Per-segment route error boundaries inside `orders`, `deliveries`, `stores`, and `settings` are not added. The `(app)/error.tsx` subtree boundary plus Server Action results plus `SectionError` for region failures already cover the authenticated domains. A new per-segment boundary is justified only when a segment needs a distinct recovery action or a distinct capture context, and none currently does.

## Acceptance Criteria

### `AC-10-01`

- Given a render error is thrown inside a `(landing)`, `(auth)`, `privacy`, or `terms` route
- When the boundary resolves
- Then the localized destructive full-page error surface renders inside the locale layout (theme + i18n present)
- And Sentry receives exactly one capture tagged `area: "public_shell"` with the digest
- And the user can retry (`reset()`) or go home

### `AC-10-02`

- Given any unmatched URL under `/{locale}` (public or private-looking)
- When it resolves
- Then the on-brand localized neutral 404 renders (never the framework default)
- And no Sentry capture is emitted

### `AC-10-03`

- Given the root layout itself fails to render
- When `global-error.tsx` takes over
- Then a self-contained bilingual fallback renders with a retry action
- And Sentry receives exactly one `captureException`
- And no next-intl, theme token, or provider is required for it to render

### `AC-10-04`

- Given a Server Action encounters an expected failure
- When it returns
- Then it returns `{ ok: false; error: <code> }` without throwing
- And the client surfaces the error (toast or inline) without tripping any route error boundary
- And Sentry is not notified of the expected failure

### `AC-10-05`

- Given the full error/404 surface set is exercised
- When each surface renders
- Then each unexpected failure is captured exactly once and no expected/absent/transitory state (404, offline, validation) is captured
- And `docs/development/sentry.md` accurately lists every capture point including `public_shell`

## Implementation Notes

- Next.js error-boundary bubbling defines the coverage tiers: a thrown error is caught by the nearest `error.tsx`; if that boundary or a layout above it throws, it bubbles to the next `error.tsx`, and finally to `global-error.tsx`. `[locale]/error.tsx` therefore sits between `(app)/error.tsx` and `global-error.tsx` and closes the gap for every non-`(app)` segment.
- `[locale]/error.tsx` renders inside `[locale]/layout.tsx`, which already emits the `NextIntlClientProvider` and `ThemeProvider`, so it can use `useTranslations` and theme tokens like `(app)/error.tsx` does. An error in `[locale]/layout.tsx` itself is not caught by `[locale]/error.tsx` (a boundary never catches its own layout) and correctly bubbles to `global-error.tsx`.
- Reuse the existing `(app)/error.tsx` component shape for `[locale]/error.tsx` (same `EmptyState appearance="page"` destructive surface, same capture pattern) with the `public_shell` area tag and `common.error` copy. Do not fork a new visual treatment.
- Translation-namespace decision: the new keys live in `common.error` (mirroring `common.notFound`, which already backs `[locale]/not-found.tsx`). The `appLayout.error` namespace stays reserved for the authenticated-shell boundary. This keeps the public-surface copy in the shared `common` namespace rather than the app-shell namespace.
- `global-error.tsx` cannot import next-intl. Bilingual copy is therefore hardcoded inline. A minimal, dependency-free locale hint (for example reading the first path segment) may pick which language to lead with, but both languages must remain legible.
- The catch-all `[locale]/[...rest]/page.tsx` and the proxy matcher (`["/", "/(es|en)/:path*"]`) together define which URLs reach the localized 404. Document this interaction rather than adding new routes unless a concrete unhandled path is found.

## Error Contract

This FRD is the product-level owner of the route-level failure contract. It also restates, as confirmed, the Server Action result contract that the workflow FRDs already implement.

### Route-level failure tiers

| Tier                 | Surface                    | Trigger                                                                      | Tone                                 | Shell               | Sentry                                |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------ | ------------------- | ------------------------------------- |
| Segment 404 (public) | `[locale]/not-found.tsx`   | unmatched URL via `[...rest]` catch-all, or `notFound()` in a public segment | neutral                              | n/a (public layout) | none                                  |
| Segment 404 (app)    | `(app)/not-found.tsx`      | `notFound()` inside the authenticated shell                                  | neutral                              | keeps shell         | none                                  |
| Route error (public) | `[locale]/error.tsx` (new) | thrown render/runtime error in `(auth)`/`(landing)`/`privacy`/`terms`        | destructive                          | n/a (public layout) | once, `area: "public_shell"` + digest |
| Route error (app)    | `(app)/error.tsx`          | thrown render/runtime error in the authenticated subtree                     | destructive                          | keeps shell         | once, `area: "app_shell"` + digest    |
| Section error        | `SectionError`             | a region fails while the page lives                                          | destructive (or `warning` = offline) | keeps page          | none (the failing fetch captures)     |
| Catastrophic         | `global-error.tsx`         | root-layout render failure                                                   | destructive (self-contained)         | replaces root       | once, bare `captureException`         |
| Offline              | `states.md` §3.5 surface   | connectivity loss                                                            | warning                              | keeps page/shell    | none                                  |

Every error is reported exactly once (`BR-10-04`). 404 and offline never capture.

### Server Action result contract (confirmed)

- Every mutating Server Action returns a discriminated union: `{ ok: true; …payload } | { ok: false; error: <ErrorCode>; …context }`. It never throws for an expected failure.
- Expected failures (validation, not-found, ineligibility, authorization, rate limits) are returned as typed `error` codes and rendered by the client as toasts or inline messages; they are not captured to Sentry.
- Only unexpected failures are captured, once, with redacted, PII-safe context. Free-text note content and raw user strings are never attached (mirrors [`FRD-02` (PRD-01) · `BR-02-04`](../../prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md#business-rules)).
- This contract is already implemented in the store, order, delivery, payment, and settings domains; the audit sweep (BP-01 · WO-03) confirms conformance and fixes deviations rather than introducing a new pattern.

## Analytics

Error, 404, and offline surfaces track **no PostHog events**. Per [`posthog-events.mdc`](../../../../.agents/rules/posthog-events.mdc), events are for meaningful user interactions and conversion milestones; an error page is neither a CTA surface nor a conversion point, and adding an "error viewed" event would be noise without a decision it informs. The retry and go-home actions on the error surfaces are recovery affordances, not tracked conversions.

This is an explicit decision, not an omission: no `POSTHOG_EVENTS` entries are added by this FRD. If a future need arises to measure error-recovery rates, it would be introduced as a deliberate follow-up with a named metric, not baked into this hardening pass.

## Screens and Data Contract

These surfaces are **system screens** owned by the design system, not new product screens. Their layout, tone, iconography, copy voice, responsive behavior, and accessibility are fully specified in [`docs/design/states.md`](../../../design/states.md) §3 and governed by [ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). **No FDD and no prototype are required for this FRD**, because it introduces no new visual design: `[locale]/error.tsx` reuses the exact destructive full-page surface already shipped by `(app)/error.tsx`, and every other surface already exists. This FRD fixes coverage, capture discipline, and copy, not visual design.

The surfaces in scope and their data/behavior contract:

- **Locale route error** (`[locale]/error.tsx`, new): receives `{ error, reset }`; loads `common.error` copy via next-intl; renders the destructive `EmptyState appearance="page"`; captures once (`public_shell`); actions: retry (`reset()`), go-home (locale root `/`).
- **App route error** (`(app)/error.tsx`, existing, FRD-03): unchanged behavior; documented here as part of the tier map.
- **App 404** (`(app)/not-found.tsx`, existing, FRD-03) and **public 404** (`[locale]/not-found.tsx`, existing): unchanged; documented as the neutral tier.
- **Global error** (`global-error.tsx`, existing, hardened): self-contained bilingual fallback; captures once.

No data is loaded from Prisma by any of these surfaces; they are presentation and capture only.

## State Model

Error surfaces are stateless render tiers selected by the framework, not lifecycle entities. The selection rules:

- `notFound()` (thrown by a segment or by the `[...rest]` catch-all) selects the nearest `not-found.tsx` (neutral, no capture).
- A thrown `Error` selects the nearest `error.tsx` (destructive, captures once); if that or an ancestor layout throws, it bubbles up one tier until `global-error.tsx`.
- `error.tsx` exposes `reset()`, which re-renders the boundary's subtree; a successful re-render clears the error state.
- `SectionError` retry defaults to `router.refresh()` (re-runs the Server Components) and is region-scoped, leaving the rest of the page mounted.

## Confirmed

- The locale-level error boundary is added at `src/app/[locale]/error.tsx` with `area: "public_shell"`, closing the public/auth/legal coverage gap.
- New localized route-error copy lives in the `common.error` namespace (es + en), sibling to `common.notFound`.
- `global-error.tsx` stays self-contained and gains bilingual inline copy; it remains the single sanctioned i18n/theme-token exception.
- No per-segment error boundaries are added inside `orders`, `deliveries`, `stores`, or `settings` (`BR-10-09`).
- No PostHog events are added for error/404/offline surfaces.
- The Server Action discriminated-result contract is confirmed as the standing pattern; the audit sweep enforces conformance, it does not redesign it.
- No FDD or prototype is produced; the surfaces are design-system-owned system screens.

## Open Questions

- Whether `global-error.tsx` should lead with a language guessed from the URL path or always present both languages stacked. Deferred to WO-02 implementation; both satisfy the bilingual requirement.
- Whether a future error-recovery metric is worth introducing. Deferred; out of scope for this hardening pass.
- Whether the `sendDefaultPii: true` and sampling-rate production policy (open hardening item) should tighten before a wider launch. This touches Sentry config owned by [`FRD-02` (PRD-01)](../../prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md) and is reviewed in WO-03; any config change must be coordinated with that owner.

## Out of Scope

- Offline / PWA connectivity behavior and detection. The offline tone vocabulary is defined in `states.md` §3.5, but the offline surface and its detection mechanism belong to the reminders-and-notifications PWA work (FRD-09, planned).
- Email alert routing, incident triage, and on-call workflows (operational, not product).
- Retry/backoff or circuit-breaker infrastructure for outbound calls.
- The Sentry runtime init and framework hooks themselves (owned by [`FRD-02` (PRD-01)](../../prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md)); this FRD only adds a boundary that uses them and reviews configuration policy.
- Any redesign of the error/404/offline visual system (owned by `docs/design/`).

## Cross-domain notes

- **Authenticated-shell boundaries** (`(app)/error.tsx`, `(app)/not-found.tsx`) are owned by [`FRD-03`](../frd-03-collector-app-shell/frd-03-collector-app-shell.md) · [BP-01 · WO-03 _shell-observability-and-polish_](../frd-03-collector-app-shell/bp-01-collector-workspace-shell/work-orders/wo-03-shell-observability-and-polish.md). This FRD does not modify them; it documents them as tiers and adds the parent `[locale]/error.tsx` that backstops them.
- **Sentry init, `onRequestError`, `onRouterTransitionStart`, and the three-runtime configuration** are owned by [`FRD-02` (PRD-01)](../../prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md) · [BP-01 · WO-02 _runtime-monitoring-baseline_](../../prd-01-public-landing/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/work-orders/wo-02-runtime-monitoring-baseline.md). The configuration hardening items reviewed in this FRD's WO-03 touch files that FRD owns; changes are coordinated with it and its docs are updated in the same change.
- **Design system**: [ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md), [`states.md`](../../../design/states.md) §3, and [`PLAYBOOK.md`](../../../design/PLAYBOOK.md) §10.4 own the visual and tone contract for every surface here. This FRD references them and never re-specifies them.

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-10-error-experience-hardening/bp-01-error-surface-coverage/bp-01-error-surface-coverage.md`
