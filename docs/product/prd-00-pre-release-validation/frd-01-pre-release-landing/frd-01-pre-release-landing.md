---
id: FRD-01
type: FRD
slug: pre-release-landing
title: Pre-release Landing and Waitlist Capture
status: SUPERSEDED
parent: PRD-00
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0001
implementation_status: SUPERSEDED_BY_GO_LIVE
superseded_by: docs/product/prd-00-pre-release-validation/frd-01-pre-release-landing/fdd-01-pre-release-landing.md
---

# FRD-01 Pre-release Landing and Waitlist Capture

> **SUPERSEDED — go-live transition (redesign S11, 2026-06-15).** The pre-release
> waitlist landing this FRD describes has been replaced by the **go-live landing with
> sign-up** (collector MVP entry). The waitlist form, success/share state, and the
> Kit (ConvertKit) + Google Sheets + referral integrations were removed from the
> landing; every CTA now points to `/sign-up` (with a secondary `/sign-in`). The
> redesigned landing belongs to the collector MVP rather than this pre-release FRD —
> the transition was anticipated below under "Superseded or transitional". The durable
> design record for the shipped landing is
> [`fdd-01-pre-release-landing.md`](./fdd-01-pre-release-landing.md) and the
> self-contained prototype at [`prototype/pre-release-landing.html`](./prototype/pre-release-landing.html).
> The functional requirements below are retained for historical context; the
> waitlist-specific ones (FR-01-02..07) are **no longer in effect**.

## Overview

This FRD defines the public landing experience PandaTrack used during the pre-release phase to explain the product and collect waitlist interest.

It is reverse-engineered from:

- the FEAT-0001 GitHub tracking artifacts that mirrored the original work orders
- the implemented landing route and waitlist components
- landing tests and translation files

## Current State

> Updated 2026-06-16 (S16 doc-alignment pass). The lists below reflect the **shipped go-live landing**, not the original pre-release waitlist flow.

### Implemented (go-live)

- localized home route with hero (animated product window), problem framing, features, full-width banner, FAQ accordion, and footer
- auth-first CTA flow: every CTA points to `/sign-up`; the header also exposes `/sign-in`
- marketing header with smooth in-page scroll nav + mobile burger sheet; public theme/language toggles

### Removed in the go-live transition

- waitlist form (required email + optional name/comment) and the success/share state
- Kit (ConvertKit), Google Sheets, and referral-share integrations and their env vars
- waitlist PostHog events (replaced by the sign-up funnel events)

### Superseded or transitional

- this FRD represents the pre-auth (waitlist) entry model and is now **superseded**
- the auth-first go-live landing belongs to the collector MVP (PRD-01); the durable design
  record is
  [`fdd-01-pre-release-landing.md`](./fdd-01-pre-release-landing.md) and
  [`prototype/pre-release-landing.html`](./prototype/pre-release-landing.html)
  (the workshop artifacts in `docs/redesign/` are disposable and being archived)

## User Stories

### US-01 Understand the product quickly

As a public visitor, I want the landing to explain the collector problem clearly so I can decide whether PandaTrack is relevant.

### US-02 Join the waitlist with low friction

As an interested visitor, I want to submit my email quickly so I can register interest without a long signup flow.

### US-03 Share after successful signup

As a visitor who joined the waitlist, I want an immediate success/share state so I can spread PandaTrack without extra friction.

## Functional Requirements

- `FR-01-01`: The landing page must render the core sections in a stable narrative order.
- `FR-01-02`: The waitlist form must require a valid email.
- `FR-01-03`: The waitlist form must allow optional `name` and `comment`.
- `FR-01-04`: Valid submissions must call the server-side waitlist action.
- `FR-01-05`: Successful submissions must switch the UI into a success/share state.
- `FR-01-06`: Validation errors must render as user-facing field or form feedback.
- `FR-01-07`: Recoverable submission failures must show a generic non-breaking error state.
- `FR-01-08`: The landing must render locale-specific copy and behavior in `es` (default) and `en`. _(still in effect — "waitlist flow" phrasing was pre-go-live; the requirement applies to the full landing)_

## Business Rules

- `BR-01-01`: `email` is mandatory and must pass email-format validation.
- `BR-01-02`: `name` and `comment` are optional and may be omitted.
- `BR-01-03`: Secondary downstream failures must not crash the success path if the primary subscriber write succeeds.
- `BR-01-04`: The public landing must remain accessible without authentication.

## Acceptance Criteria

### `AC-01-01`

- Given a visitor opens the localized home route
- When the page loads
- Then hero, user-fit, features, banner, FAQ, and footer sections are visible.

> **Note (go-live):** the waitlist section was removed; the shipped section order is
> hero → user-fit → features → banner → faqs → footer. The CTAs navigate to `/sign-up`.

### `AC-01-02`

- Given a visitor submits the form with an invalid email
- When validation runs
- Then the UI shows an email validation error and does not complete submission.

### `AC-01-03`

- Given a visitor submits the form with a valid email
- When the primary subscriber write succeeds
- Then the UI shows the success/share state.

### `AC-01-04`

- Given the server action returns a recoverable failure
- When the user submits valid data
- Then the UI shows a generic error state without breaking the page.

## Implementation Notes

### Shipped go-live landing (authority)

The waitlist route group, `Waitlist.tsx`, `WaitlistForm.tsx`, `WaitlistShare.tsx`,
`submitWaitlist.ts`, and `waitlistSchema.ts` were fully removed at the go-live
transition. **No waitlist code remains in `src/`.**

Current implementation entry points:

- Route: `src/app/[locale]/(landing)/page.tsx`
- Layout (marketing wrapper): `src/app/[locale]/(landing)/layout.tsx`
- Sections: `Hero`, `UserFit`, `Features`, `Banner`, `Faqs`, `Footer`
  under `src/app/[locale]/(landing)/_components/`
- Header (includes `Header`, `BurgerMenu`, `HeaderNav`):
  `src/app/[locale]/(landing)/_components/Menu/` (`HeaderNav.tsx` is a client component).
  The header/sheet consume the public toggles `PublicLanguageToggle`/`PublicThemeToggle`
  from `_components/public/` — the `LanguageToggle`/`ThemeToggle` copies under `Menu/`
  are used by the app shell, not the landing.
- Public shared components (brand mark, minibar toggles):
  `src/app/[locale]/_components/public/`
- Structured data: `LandingJsonLd` (`(landing)/_components/LandingJsonLd.tsx`) emits
  `WebSite` + `SoftwareApplication` JSON-LD for the home route.
- OG image: `src/app/[locale]/opengraph-image.tsx` serves the landing Open Graph image.
- Locale copy (no `waitlist` keys): `src/i18n/locales/{es,en}/landing.json`
- E2E coverage: `e2e/landing.spec.ts` (verifies sign-up CTA, FAQ accordion,
  absence of waitlist form)

### In-page section IDs (production)

| Section  | HTML id     | Nav target  |
| -------- | ----------- | ----------- |
| User-fit | `#user-fit` | `#user-fit` |
| Features | `#features` | `#features` |
| FAQ      | `#faqs`     | `#faqs`     |

These differ from the prototype anchor names (`#s11-fit`, `#s11-feat`, `#s11-faq`),
which are demo-scoped. The FDD `demo_anchors` field lists the prototype anchors; the
table above is what ships.

### Analytics

PostHog events fired by the landing (from `POSTHOG_EVENTS.LANDING` in
`src/lib/constants.ts`):

| Event name                | Where fired                                   | Properties                          |
| ------------------------- | --------------------------------------------- | ----------------------------------- |
| `hero_cta_clicked`        | Hero primary CTA (`Button` → `/sign-up`)      | `location: "hero"`, `destination`   |
| `banner_cta_clicked`      | Banner CTA (`Button` → `/sign-up`)            | `location: "banner"`, `destination` |
| `header_cta_clicked`      | Header "Crear cuenta" (`Button` → `/sign-up`) | `location: "header"`, `destination` |
| `mobile_menu_opened`      | Burger button (`data-ph-event`)               | —                                   |
| `mobile_menu_nav_clicked` | Sheet nav links + sheet "Crear cuenta"        | `destination`, `cta_type` (on CTA)  |
| `faq_item_toggled`        | `FaqAccordion` every toggle                   | `faq_id`, `faq_question`, `action`  |
| `social_link_clicked`     | Footer social icons (`data-ph-event`)         | `platform`                          |

The header "Iniciar sesión" link does not fire a dedicated landing event (it is a plain
`<Button as="a">` without `posthogEvent`). The mobile sheet "Iniciar sesión" Button
also fires no event — it only carries `onClick={onClose}`. Only the mobile sheet nav
links and the sheet "Crear cuenta" Button emit `mobile_menu_nav_clicked`.

## Linked Blueprint

- `docs/product/prd-00-pre-release-validation/frd-01-pre-release-landing/bp-01-public-landing-conversion/bp-01-public-landing-conversion.md`
