---
id: FRD-01
type: FRD
slug: pre-release-landing
title: Pre-release Landing and Waitlist Capture
status: SUPERSEDED
parent: PRD-00
children:
  - BP-01
last_updated: 2026-06-15
source_features:
  - FEAT-0001
implementation_status: SUPERSEDED_BY_GO_LIVE
superseded_by: docs/redesign/modules/landing-onboarding.md
---

# FRD-01 Pre-release Landing and Waitlist Capture

> **SUPERSEDED — go-live transition (redesign S11, 2026-06-15).** The pre-release
> waitlist landing this FRD describes has been replaced by the **go-live landing with
> sign-up** (collector MVP entry). The waitlist form, success/share state, and the
> Kit (ConvertKit) + Google Sheets + referral integrations were removed from the
> landing; every CTA now points to `/sign-up` (with a secondary `/sign-in`). The
> redesigned landing belongs to the collector MVP rather than this pre-release FRD —
> the transition was anticipated below under "Superseded or transitional". The shipped
> behavior and copy live in `docs/redesign/modules/landing-onboarding.md` and
> `docs/redesign/screens/landing.md`. The functional requirements below are retained
> for historical context; the waitlist-specific ones (FR-01-02..07) are **no longer in
> effect**.

## Overview

This FRD defines the public landing experience PandaTrack used during the pre-release phase to explain the product and collect waitlist interest.

It is reverse-engineered from:

- the FEAT-0001 GitHub tracking artifacts that mirrored the original work orders
- the implemented landing route and waitlist components
- landing tests and translation files

## Current State

> Updated 2026-06-15 (redesign S11 go-live). The lists below reflect the **shipped go-live landing**, not the original pre-release waitlist flow.

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
- the auth-first go-live landing belongs to the collector MVP (PRD-01); implementation is tracked in `docs/redesign/modules/landing-onboarding.md`

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
- `FR-01-08`: The waitlist flow must preserve locale-specific copy and behavior in `es` and `en`.

## Business Rules

- `BR-01-01`: `email` is mandatory and must pass email-format validation.
- `BR-01-02`: `name` and `comment` are optional and may be omitted.
- `BR-01-03`: Secondary downstream failures must not crash the success path if the primary subscriber write succeeds.
- `BR-01-04`: The public landing must remain accessible without authentication.

## Acceptance Criteria

### `AC-01-01`

- Given a visitor opens the localized home route
- When the page loads
- Then hero, user-fit, feature, banner, FAQ, waitlist, and footer sections are visible.

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

- Route: `src/app/[locale]/(landing)/page.tsx`
- Waitlist UI: `src/app/[locale]/(landing)/_components/Waitlist/*`
- Tests:
  - `src/app/[locale]/(landing)/_components/Waitlist/_tests/*`
  - `e2e/landing.spec.ts`

## Linked Blueprint

- `docs/product/prd-00-pre-release-validation/frd-01-pre-release-landing/bp-01-public-landing-conversion/bp-01-public-landing-conversion.md`
