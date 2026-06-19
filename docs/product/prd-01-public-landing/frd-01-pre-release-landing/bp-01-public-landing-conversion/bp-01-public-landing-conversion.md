---
id: BP-01
type: BLUEPRINT
slug: public-landing-conversion
title: Public Landing Conversion
status: SUPERSEDED
parent: FRD-01
children:
  - WO-01
  - WO-02
last_updated: 2026-06-16
implementation_status: SUPERSEDED_BY_GO_LIVE
---

# BP-01 Public Landing Conversion

> **SUPERSEDED — go-live transition (redesign S11, 2026-06-15).** This blueprint
> describes the pre-release architecture (waitlist-first). The waitlist form, server
> action, validation schema, and external integrations were removed. The shipped
> go-live landing is a static SSR marketing page with auth-first CTAs only.
> See [`frd-01-pre-release-landing.md`](../frd-01-pre-release-landing.md) and
> [`fdd-01-pre-release-landing.md`](../fdd-01-pre-release-landing.md) for the current
> authoritative state.

## Purpose (historical)

Described how PandaTrack's pre-release public landing would convert visitors into
waitlist submissions through a localized narrative page, a server-backed waitlist form,
and a success/share state.

## Runtime Components (go-live — shipped)

- Landing route: `src/app/[locale]/(landing)/page.tsx`
- Layout (marketing wrapper): `src/app/[locale]/(landing)/layout.tsx`
- Marketing sections (`Hero`, `UserFit`, `Features`, `Banner`, `Faqs`, `Footer`,
  `Section`): `src/app/[locale]/(landing)/_components/`
- Header + mobile burger sheet (`Header`, `BurgerMenu`, `HeaderNav`):
  `src/app/[locale]/(landing)/_components/Menu/`
- Public shared components (brand mark + the toggles the landing actually consumes,
  `PublicLanguageToggle`/`PublicThemeToggle`): `src/app/[locale]/_components/public/`
  (the `LanguageToggle`/`ThemeToggle` copies under `Menu/` are consumed by the app shell,
  not the landing)
- Locale copy (landing namespace, no waitlist keys):
  `src/i18n/locales/{es,en}/landing.json`

> **Removed at go-live:** `Waitlist.tsx`, `WaitlistForm.tsx`, `WaitlistShare.tsx`,
> `submitWaitlist.ts`, `waitlistSchema.ts`, and all ConvertKit / Google Sheets env vars.
> No waitlist code remains in `src/`.

## Contracts (go-live — shipped)

This is a fully static, SSR-delivered page. There are no form submissions or server
mutations. Every CTA is a plain navigation link:

- Primary CTA → `/{locale}/sign-up`
- Secondary auth link → `/{locale}/sign-in`

## Architecture Notes (go-live)

- Page is server-rendered; all sections are Server Components (no `"use client"`
  boundary on page or sections).
- `Header` and `BurgerMenu` are client components (state for burger open/close + focus
  trap).
- `FaqAccordion` is a client component (accordion toggle state + PostHog capture).
- No server actions, no form state, no external integrations.

## Risks (historical — resolved)

- Waitlist integrations leaking secrets: resolved by removal.
- Locale/UX alignment: still applies — locale copy lives in `src/i18n/locales/`.

## Linked Work Orders

- `docs/product/prd-01-public-landing/frd-01-pre-release-landing/bp-01-public-landing-conversion/work-orders/wo-01-public-landing-narrative.md`
- `docs/product/prd-01-public-landing/frd-01-pre-release-landing/bp-01-public-landing-conversion/work-orders/wo-02-waitlist-capture-and-share-state.md`
