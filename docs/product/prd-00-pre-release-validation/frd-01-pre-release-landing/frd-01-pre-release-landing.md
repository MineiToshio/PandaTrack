---
id: FRD-01
type: FRD
slug: pre-release-landing
title: Pre-release Landing and Waitlist Capture
status: ACTIVE
parent: PRD-00
children:
  - BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0001
implementation_status: IMPLEMENTED
---

# FRD-01 Pre-release Landing and Waitlist Capture

## Overview

This FRD defines the public landing experience PandaTrack used during the pre-release phase to explain the product and collect waitlist interest.

It is reverse-engineered from:

- the FEAT-0001 GitHub tracking artifacts that mirrored the original work orders
- the implemented landing route and waitlist components
- landing tests and translation files

## Current State

### Implemented

- localized home route with hero, problem framing, features, banner, FAQs, waitlist, and footer
- CTA flow anchored to the waitlist section
- waitlist form with required email and optional name/comment
- success/share state after submission
- server action that validates, submits, and maps errors into UI states

### Superseded or transitional

- this flow represents the pre-auth entry model
- later auth-first CTA behavior belongs to the collector MVP rather than this FRD

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
