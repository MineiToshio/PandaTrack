---
id: FRD-01
type: FRD
slug: account-access-and-recovery
title: Account Access and Recovery
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-15
source_features:
  - FEAT-0008
  - FEAT-0009
implementation_status: IMPLEMENTED
---

# FRD-01 Account Access and Recovery

## Overview

This FRD defines the identity and access layer for PandaTrack's collector workspace.

> **Implementation note (redesign S11, 2026-06-15).** The six auth screens (sign-up,
> sign-in, sign-in error, forgot-password, reset-password, verify-email and the day-7
> verification gate) were restyled to the public auth-card layout (slim minibar +
> centered card + accent glow, multicolor Google button, top error banner, tonal status
> icons). This is a **presentation-only** change — flow and acceptance criteria are
> unchanged. The reset screen now confirms the password against a "repeat password" field
> before submitting (UX guard; no AC change). See `docs/redesign/screens/auth.md`.

It consolidates:

- auth core and route protection
- sign-up and sign-in entry points
- email verification lifecycle with grace and blocking behavior
- Google linking and Kit sync
- forgot/reset password recovery

## Current State

### Implemented

- Better Auth + Prisma + Neon auth foundation
- sign-up and sign-in routes
- Google sign-in
- account linking by email
- private route protection in the app layout
- verification banner and day-seven gate
- forgot-password and reset-password flows
- auth-focused Playwright coverage

## User Stories

### US-01 Enter the collector app safely

As a collector, I want a normal sign-up and sign-in experience so my private data stays protected.

### US-02 Recover access without support

As a collector who forgot my password, I want a reset flow so I can get back into the app on my own.

### US-03 Keep one identity across methods

As a returning collector, I want Google and email/password to map to the same account when they share the same email.

## Functional Requirements

- `FR-01-01`: The system must support email/password sign-up and sign-in.
- `FR-01-02`: The system must support Google sign-in from day one.
- `FR-01-03`: Public routes must remain accessible without authentication.
- `FR-01-04`: Private routes must require a valid session.
- `FR-01-05`: `/sign-up` and `/sign-in` must be dedicated entry pages and must redirect authenticated users to the dashboard.
- `FR-01-06`: Email/password accounts must follow a verification lifecycle with a grace period and a blocking gate after seven days.
- `FR-01-07`: A resend-verification action must exist for blocked or grace-state users.
- `FR-01-08`: Authenticated users must sync non-blockingly to Kit as app users.
- `FR-01-09`: Forgot-password requests must return a neutral success response regardless of account existence.
- `FR-01-10`: Reset links must be token-based, time-limited, and single-use.
- `FR-01-11`: Password-reset success must allow the user to return to sign-in with updated credentials.
- `FR-01-12`: Existing accounts must link to Google on matching email rather than creating duplicates.

## Business Rules

- `BR-01-01`: Landing and public stores remain public.
- `BR-01-02`: Dashboard and other collector routes remain private.
- `BR-01-03`: Email/password sign-up requires only email and password.
- `BR-01-04`: Google accounts are treated as verified through the provider trust model.
- `BR-01-05`: The verification grace period lasts seven days from account creation.
- `BR-01-06`: Password reset tokens expire after 60 minutes.
- `BR-01-07`: Password reset should avoid account enumeration.

## Acceptance Criteria

### `AC-01-01`

- Given an anonymous user opens a private route
- When the private app layout evaluates access
- Then the user is redirected to sign-in.

### `AC-01-02`

- Given an authenticated user opens `/sign-up` or `/sign-in`
- When the page resolves
- Then the user is redirected to the dashboard.

### `AC-01-03`

- Given an email/password account is unverified after seven days
- When the user tries to access the private workspace
- Then the app shows the verification-required gate instead of the normal app shell.

### `AC-01-04`

- Given a user requests password recovery for any email
- When the request completes
- Then the UI shows a neutral success response.

### `AC-01-05`

- Given a valid password-reset token
- When the user submits a new password
- Then the password is updated and the user sees the success state.

## Implementation Notes

- Better Auth server: `src/lib/auth/auth.ts`
- Redirect helpers: `src/lib/auth/authRedirect.ts`
- Verification logic: `src/lib/auth/authVerification.ts`
- Private gate enforcement: `src/app/[locale]/(app)/layout.tsx`
- Recovery pages: `src/app/[locale]/(auth)/forgot-password/page.tsx` and `reset-password/page.tsx`
- E2E: `e2e/auth.spec.ts`
- Redesign notes (visual / cross-concern with FRD-07, no change to auth behavior): the sign-in and sign-up pages were restyled with the redesign tokens and components; the sign-out action in `ShellAccountMenu.tsx` uses the destructive (red, borderless) styling formalized in redesign ADR 0012 (account destructive-action styling); avatar upload/replace in account identity reuses the shared `ImageCropper` inside the adaptive `Modal` (centered dialog on desktop, bottom sheet on mobile).

## Linked Blueprint

- `docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/bp-01-auth-identity-and-recovery-platform.md`
