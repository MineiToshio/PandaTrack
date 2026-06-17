---
id: FRD-01
type: FRD
slug: account-access-and-recovery
title: Account Access and Recovery
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0008
  - FEAT-0009
implementation_status: IMPLEMENTED
---

# FRD-01 Account Access and Recovery

## Overview

This FRD defines the identity and access layer for PandaTrack's collector workspace.

> **Visual design.** The six auth screens (sign-up, sign-in + its error state,
> forgot-password, reset-password, verify-email-sent and the day-7 verification gate)
> were restyled in redesign S11 to the public focused-card layout. That change was
> **presentation-only** — flow and acceptance criteria are unchanged — and its durable
> record is the [FDD](fdd-01-account-access-and-recovery.md) plus the self-contained
> [prototype](prototype/account-access-and-recovery.html). The only behavioral addition
> from that work is the reset screen's repeat-password match guard (`FR-01` reset flow;
> no AC change). This FRD does not re-describe the visuals — reference the FDD for them.

It consolidates:

- auth core and route protection
- sign-up and sign-in entry points
- email verification lifecycle with grace and blocking behavior
- Google linking and Kit sync
- forgot/reset password recovery

## Current State

### Implemented

- Better Auth + Prisma + Neon auth foundation (`src/lib/auth/auth.ts`), with email/password and Google providers, account linking on matching email, DB-backed sessions (no cookie cache), and `nextCookies()` wiring
- a unique `username` is auto-generated for every new user inside the Better Auth `user.create.before` hook (no username field is exposed at sign-up); the email is required and trimmed before the hook proceeds
- sign-up and sign-in routes (`/{locale}/sign-up`, `/{locale}/sign-in`), each redirecting an already-authenticated session to its resolved callback URL
- Google sign-in from a multicolor brand button on both entry cards; profile name/image hydrated from the Google profile, account linked (not duplicated) when the email already exists
- private route protection in the app layout (`src/app/[locale]/(app)/layout.tsx`): no session redirects to sign-in; a `blocked` verification state redirects to the day-7 gate; a `grace` state renders the workspace with a verification banner pinned above the shell
- email-verification lifecycle: verification email on sign-up, a four-state snapshot (`not_applicable` / `verified` / `grace` / `blocked`), an automatic day-6 reminder email (sent at most once per grace window), and the day-7 blocking gate
- a token-confirmation route `/{locale}/verify-email/confirm` that calls Better Auth `verifyEmail` and routes to the status screen (success → return-to; expired/invalid → status card with resend)
- resend-verification available from the in-shell banner (grace), the status screen, and the day-7 gate; backed by the `resendVerificationEmail` Server Action
- forgot-password and reset-password flows with a neutral anti-enumeration response, 60-minute single-use tokens, sessions revoked on password reset, and an escalating recovery throttle (2 → 5 → 15 → 60 min) enforced both server-side (fingerprinted by email + IP + device, persisted in the verification table) and client-side (per-email `localStorage` cooldown)
- the reset screen confirms the new password against a "repeat password" field before submitting (UX guard; no AC change), with `invalid` / `ready` / `success` states
- localized, transactional emails via Resend for verification, day-6 reminder, and password reset, with locale resolved from the reset URL → cookie → `Accept-Language` → `es`
- non-blocking Kit sync (`syncAuthenticatedUserToKit`) fired in a Better Auth `after` hook on every new session, tagging the subscriber as an app user (no-op when Kit is not configured)
- auth-focused Playwright coverage (`e2e/auth.spec.ts`) plus unit coverage for redirect, verification, recovery throttle, and the recovery/reset forms

### Visual / design

- the six auth screens were restyled in redesign S11 to the public focused-card layout (slim minibar + centered card + accent glow); the durable design record is the [FDD](fdd-01-account-access-and-recovery.md) + its [prototype](prototype/account-access-and-recovery.html). This is presentation-only — no flow or AC changed.

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
- `FR-01-13`: Every new user must receive a unique, auto-generated `username` at account creation; the username is never collected on the sign-up form (sign-up captures only email + password per `BR-01-03`). If username generation fails, the account creation is rejected.
- `FR-01-14`: Authenticated users who land on `/sign-up`, `/sign-in`, or `/forgot-password` must be redirected to their resolved callback URL (`returnTo` when safe, otherwise the dashboard).
- `FR-01-15`: A `returnTo` callback target must be sanitized before use: only same-origin absolute paths are honored, protocol-relative (`//`) and cross-origin targets are rejected, a mismatched locale prefix collapses to the dashboard, and the auth entry routes themselves (`/sign-in`, `/sign-up`, `/forgot-password`) are never used as a post-auth destination.
- `FR-01-16`: While an email/password account is in the grace window, the private workspace must remain usable but must display a persistent verification banner with an inline resend action above the app shell.
- `FR-01-17`: A one-time day-6 reminder verification email must be sent automatically during the grace window (between day 6 and day 7) the first time the user loads the private workspace inside that window; it must never be sent more than once per grace window.
- `FR-01-18`: An emailed verification link must resolve through a dedicated confirm route that completes verification and then routes the user to a status screen: success continues to the callback target; an expired token shows the expired state; any other failure shows the invalid state. Both failure states offer resend (when signed in) and a path back to sign-in.
- `FR-01-19`: The 7-day verification window must be anchored on `unverifiedGraceStartsAt` when present and otherwise on the account `createdAt`. Successful verification must clear `unverifiedGraceStartsAt`. (An email change re-stamps this anchor, restarting the window — owned by [`FRD-07`](../frd-07-user-settings/frd-07-user-settings.md).)
- `FR-01-20`: Password-recovery requests must be rate-limited with an escalating backoff of 2 → 5 → 15 → 60 minutes. The limit is enforced server-side (keyed by a hash of email + client IP + device signature, persisted as a throttle marker) and mirrored client-side (per-email cooldown in `localStorage`) so the user sees a cooldown notice before a redundant request is made. A throttled request must delete the freshly issued reset token and stay neutral.
- `FR-01-21`: Reset-password tokens must be single-use and must revoke all of the user's existing sessions when the password is changed.
- `FR-01-22`: Authenticated users must sync to Kit on session creation without blocking the auth flow; the sync must no-op when Kit is not configured and must never surface its failures to the user (captured to Sentry only).
- `FR-01-23`: All recovery and verification emails must be localized, with the locale resolved in order from the reset/verification URL, then the request cookie, then `Accept-Language`, defaulting to `es`.

## Business Rules

- `BR-01-01`: Landing and public stores remain public.
- `BR-01-02`: Dashboard and other collector routes remain private.
- `BR-01-03`: Email/password sign-up requires only email and password.
- `BR-01-04`: Google accounts are treated as verified through the provider trust model.
- `BR-01-05`: The verification grace period lasts seven days from account creation.
- `BR-01-06`: Password reset tokens expire after 60 minutes.
- `BR-01-07`: Password reset should avoid account enumeration. The forgot-password response is always the same neutral note regardless of whether the email exists, and the sign-in failure message is intentionally generic ("email or password incorrect") rather than disclosing which field was wrong.
- `BR-01-08`: A user is subject to the verification gate only when they have a credential (email/password) account. Google-only accounts are `not_applicable` and never see the grace banner or the day-7 gate (they are verified through the provider trust model per `BR-01-04`).
- `BR-01-09`: The grace window is rendered as a non-blocking banner from day 0 to day 7; only after the deadline does access become blocked by the gate. The day-6 reminder email is the single proactive nudge inside that window.
- `BR-01-10`: Dev-only cookie and origin escape hatches exist for local/LAN testing (`useSecureCookies` is off when `NODE_ENV !== "production"`; `BETTER_AUTH_EXTRA_ORIGINS` adds trusted origins). These must be inert in production.

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

### `AC-01-06`

- Given an email/password account inside the grace window
- When the user opens the private workspace
- Then the workspace renders normally with a verification banner pinned above it
- And the banner exposes an inline resend action.

### `AC-01-07`

- Given an email/password account on day 6 of the grace window that has not yet been reminded
- When the user loads the private workspace
- Then a reminder verification email is sent once
- And it is not sent again for the remainder of the same grace window.

### `AC-01-08`

- Given a recovery request that exceeds the allowed rate
- When the user submits forgot-password again
- Then they see a cooldown notice with the remaining minutes
- And no new reset email is sent (and any freshly issued token is discarded).

### `AC-01-09`

- Given the new password and the repeat-password fields do not match
- When the user submits the reset form
- Then submission is blocked with a mismatch message and no reset call is made.

### `AC-01-10`

- Given an expired or invalid verification link
- When the confirm route processes it
- Then the user is sent to the verification status screen in the matching (expired vs invalid) state
- And, when signed in, can resend the verification email from there.

### `AC-01-11`

- Given a `returnTo` value that is cross-origin, protocol-relative, or points at an auth entry route
- When an auth page resolves its callback URL
- Then the unsafe target is discarded and the dashboard is used instead.

## Implementation Notes

- Better Auth server: `src/lib/auth/auth.ts` (providers, account linking, username-generation hook, verification + reset-password callbacks, Kit `after` hook, dev cookie/origin escape hatches)
- Server session helper: `src/lib/auth/auth-server.ts`; client: `src/lib/auth/auth-client.ts`
- Redirect / callback sanitization helpers: `src/lib/auth/authRedirect.ts` (`resolveAuthCallbackURL`, `buildAuthAlternativeHref`, `buildVerificationStatusHref`, `buildVerificationConfirmHref`)
- Verification logic: `src/lib/auth/authVerification.ts` (`getVerificationSnapshot`, `sendVerificationEmail`, `maybeSendDaySixVerificationReminder`)
- Password recovery: `src/lib/auth/authPasswordRecovery.ts`, throttle math in `src/lib/auth/passwordRecoveryThrottle.ts`, throttle persistence in `src/lib/auth/authPasswordRecoveryData.ts`, emails in `authPasswordResetEmail.ts` / `authVerificationEmail.ts`
- Private gate enforcement: `src/app/[locale]/(app)/layout.tsx`
- Auth routes + page-scoped components: `src/app/[locale]/(auth)/*` (`sign-in`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`, `verify-email/confirm`, `verify-email-required`) with shared `_components/AuthFormLayout`, `AuthStatusCard`, `EmailPasswordForm`, `SignInForm`, `SignUpForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `GoogleSignInButton`, and `_utils/authEntryContext`
- In-shell verification chrome: `src/components/modules/auth/VerifyEmailBanner.tsx`, `VerificationResend.tsx`; resend action `src/app/[locale]/(app)/_actions/resendVerificationEmail.ts`
- Kit sync: `syncAuthenticatedUserToKit` in `src/lib/integrations/kit.ts`
- Grace-anchor query helpers: `src/queries/user.ts` (`findUserVerificationSnapshot`, `clearUnverifiedGraceStartsAt`); verification-marker helpers `src/queries/verification.ts`
- E2E: `e2e/auth.spec.ts`; unit: `src/lib/auth/_tests/*`, `src/app/[locale]/(auth)/_components/_tests/*`
- Visuals are owned by the [FDD](fdd-01-account-access-and-recovery.md) + [prototype](prototype/account-access-and-recovery.html); do not re-describe screen look-and-feel here.
- Redesign notes (cross-concern with FRD-07, no change to auth behavior): the sign-out action in `ShellAccountMenu.tsx` uses the destructive (red, borderless) styling formalized in [ADR 0012](../../../design/decisions/0012-account-destructive-action-styling.md); avatar upload/replace in account identity reuses the shared `ImageCropper` inside the adaptive `Modal` (centered dialog on desktop, bottom sheet on mobile).

## Screens and Data Contract

All auth pages live under the public route group `src/app/[locale]/(auth)/*` and render inside the focused-card public shell (`(auth)/layout.tsx` → `PublicMinibar` + `auth-wrap` glow). They are **anonymous-first**: an existing session on an entry page redirects away. The day-7 gate is the one auth surface reached from inside the private group. Visual layout is owned by the [FDD](fdd-01-account-access-and-recovery.md); this section fixes purpose, data, server calls, and states.

### Sign-in — `/{locale}/sign-in` (optional `?returnTo=`)

- **Purpose:** email/password + Google entry into the workspace.
- **Data loaded:** `getSession()` (server) — present session redirects to the resolved `callbackURL`; `resolveAuthEntryContext` computes `callbackURL` + the sign-up `alternativeHref`; `buildAuthAlternativeHref` computes the forgot-password href (all preserving a safe `returnTo`).
- **Auth calls:** `authClient.signIn.email({ email, password, callbackURL })`; `authClient.signIn.social({ provider: "google", callbackURL })`.
- **States:** default; submit-pending (button spinner, fields disabled); error — top `auth-form-error` banner (`role="alert"`) with both fields tinted; the banner uses Better Auth's `signInError.message` as the primary text (raw, possibly English), falling back to the localized credentials message only when no message is present; empty-field client guard before any network call.

### Sign-up — `/{locale}/sign-up` (optional `?returnTo=`)

- **Purpose:** create an email/password account (Google also offered).
- **Data loaded:** same entry-context resolution as sign-in (alternative = sign-in); terms/privacy hrefs from `ROUTES`.
- **Auth calls:** `authClient.signUp.email({ email, password, name: "", callbackURL })` — Better Auth's `user.create.before` hook injects the generated `username`; `sendOnSignUp` dispatches the verification email; the `after` hook fires Kit sync.
- **States:** default; pending; error — `USER_ALREADY_EXISTS` maps to a specific message, all other codes to the generic message. A terms/privacy acknowledgement checkbox is shown in the card; it is uncontrolled and presentational only (no `required` attribute, no validation, does not block submit). The password field shows the `passwordHelp` hint ("Mínimo 8 caracteres."). On success, routes to `callbackURL`.

### Forgot password — `/{locale}/forgot-password` (optional `?returnTo=`)

- **Purpose:** request a reset link without leaking account existence.
- **Data loaded:** entry-context (`getSession` redirect if already authenticated); reads the per-email client throttle from `localStorage`.
- **Auth calls:** `authClient.requestPasswordReset({ email, redirectTo })`; `redirectTo` is hardcoded to `/{locale}/reset-password` — `returnTo` is **not** forwarded through the reset email link. Server side `sendResetPassword` → `handlePasswordRecoveryRequest` (throttle → Resend email → throttle marker).
- **States:** default shows the neutral note; when feedback tone is `status` (cooldown or success) the status message (`role="status"`) **replaces** the neutral note rather than appearing alongside it. Client-side cooldown notice when an active throttle exists; field-level validation (required / missing `@`); neutral success note; retry-later alert on request error. The success and cooldown states are deliberately indistinguishable from the "no such account" case.

### Reset password — `/{locale}/reset-password?token=…` (optional `error=INVALID_TOKEN`, `returnTo`)

- **Purpose:** set a new password from a tokenized link.
- **Data loaded:** server pre-computes `initialState` = `invalid` when `error=INVALID_TOKEN` or no token, else `ready`; builds sign-in + forgot-password hrefs.
- **Auth calls:** `authClient.resetPassword({ token, newPassword })`.
- **States:** `ready` (two password fields + repeat-match guard; first field shows the `passwordHelp` hint "Mínimo 8 caracteres."); `invalid` (no/expired token → "request another link" + back to sign-in); `success` (CTA to sign-in). On reset, all sessions are revoked (`revokeSessionsOnPasswordReset`). Submit guards: empty password, mismatch, missing token; server `INVALID_TOKEN` flips to `invalid`.

### Verify-email status — `/{locale}/verify-email` (optional `error`, `returnTo`)

- **Purpose:** the post-link landing / verification-sent status card.
- **Data loaded:** without `error`, requires a session (else → sign-in), reads `getVerificationSnapshot`, and redirects by state (`verified`/`not_applicable` → return-to; `blocked` → gate; `grace` → return-to). With `error`, renders a status card (`TOKEN_EXPIRED` → expired copy; anything else → invalid copy).
- **Actions:** `VerificationResend` (signed-in) or a sign-in CTA (anonymous).
- **States:** accent-tone status icon; expired vs invalid copy; the `linkExpiryNote` is always rendered as the card note regardless of error type; resend pending/success/error feedback.

### Verify-email confirm — `/{locale}/verify-email/confirm?token=…` (optional `returnTo`)

- **Purpose:** server-only token consumer; no UI of its own.
- **Behavior:** missing token → status page with `error=INVALID_TOKEN`; otherwise calls `auth.api.verifyEmail` and follows the returned redirect (success → return-to via the status callback; failure → status page with the error). `afterEmailVerification` clears `unverifiedGraceStartsAt`.

### Day-7 gate — `/{locale}/verify-email-required` (optional `returnTo`)

- **Purpose:** block the workspace for an unverified credential account past the grace deadline.
- **Data loaded:** requires a session (else → sign-in); re-reads `getVerificationSnapshot` and redirects to the dashboard unless `state === "blocked"` (defends against direct navigation).
- **Actions:** `VerificationResend` (primary), with `shownEvent` firing `auth_private_access_blocked_unverified`. The gate renders only the status card + resend; it has no sign-out affordance (the `verifyGate.signOut` i18n key is unused/dead).
- **States:** warning-tone status card; resend pending/success/error.

### Private layout gate — `src/app/[locale]/(app)/layout.tsx` (every private route)

- **Purpose:** the always-on access + verification gate for the whole collector workspace.
- **Data loaded:** `getSession()`; `getVerificationSnapshot(userId)`; in `grace`, `maybeSendDaySixVerificationReminder`.
- **States:** no session → redirect to sign-in; `blocked` → redirect to the day-7 gate (carrying `returnTo=dashboard`); `grace` → render the shell **plus** the pinned `VerifyEmailBanner`; otherwise → render the shell normally.

## State Model

### Verification access state (`VerificationAccessState`)

Derived per request from the user record (`getVerificationSnapshot`); never stored as a column. Inputs: whether the user has a `credential` account, `emailVerified`, and the grace anchor (`unverifiedGraceStartsAt ?? createdAt`). Deadline = anchor + 7 days.

| Condition                                      | State            | Workspace effect                             |
| ---------------------------------------------- | ---------------- | -------------------------------------------- |
| No credential account (Google-only)            | `not_applicable` | full access, no banner, no gate (`BR-01-08`) |
| Credential account, `emailVerified = true`     | `verified`       | full access                                  |
| Credential account, unverified, now < deadline | `grace`          | full access + pinned verification banner     |
| Credential account, unverified, now ≥ deadline | `blocked`        | workspace replaced by the day-7 gate         |

Transitions: verifying the email (via the confirm route) flips `grace`/`blocked` → `verified` and clears `unverifiedGraceStartsAt`. An email change ([FRD-07](../frd-07-user-settings/frd-07-user-settings.md)) re-stamps `unverifiedGraceStartsAt = now`, resetting `emailVerified` and returning the account to a fresh `grace` window.

### Day-6 reminder marker (idempotency)

A sentinel verification record keyed `verification-day6-reminder:{userId}` (far-future `expiresAt`) records that the one-time reminder fired. `maybeSendDaySixVerificationReminder` no-ops unless: state is `grace`, now is within [anchor+6d, deadline), and no marker exists. On a successful send it writes the marker (so a re-stamped anchor from an email change yields a new marker opportunity only after the prior marker is gone).

### Reset state machine (client, `ResetPasswordForm`)

`ready → success` on a valid reset; `ready → invalid` on a missing/`INVALID_TOKEN` token; `invalid` is terminal in-page (routes out to forgot-password); `success` is terminal (routes to sign-in).

### Recovery throttle escalation

Per scope (server: hash of email+IP+device; client: per-email), the stage walks `0→1→2→3` over the backoff `[2, 5, 15, 60]` minutes and saturates at stage 3. The active window is `expiresAt > now`; a request during an active window escalates the stage and is rejected; a request after expiry resets to stage 0.

## Error Contract

Auth surfaces lean on Better Auth's typed error codes plus a few flow-local ones. Expected (recoverable, no noisy monitoring) vs unexpected (captured once to Sentry):

- **Sign-in:** Better Auth `error.code` (e.g. invalid credentials) → generic banner message; the raw code is sent only as the `error_code` analytics property, never shown verbatim in a way that discloses which field failed (`BR-01-07`). Empty fields are a pre-network client guard.
- **Sign-up:** `USER_ALREADY_EXISTS` → specific message; any other code → generic message. Username-generation failure inside the create hook rejects account creation (`FR-01-13`) and is captured to Sentry.
- **Forgot password:** never reveals existence. Internal outcomes: throttled (`rate_limited`, freshly issued token deleted, neutral), email delivery failure (`PASSWORD_RESET_EMAIL_DELIVERY_FAILED` thrown after token cleanup + Sentry capture), success. The client surfaces only the neutral note, the cooldown notice, or a generic retry-later alert.
- **Reset password:** `INVALID_TOKEN` → flips the form to `invalid`; client-only guards: empty password, repeat-mismatch, missing token; network exception → generic error + Sentry capture.
- **Verify-email confirm / status:** `TOKEN_EXPIRED` → expired status copy; any other failure → invalid status copy; missing token → invalid.
- **Resend verification (`resendVerificationEmail` action):** typed result reasons `unauthenticated`, `not_required`, `send_failed`; `send_failed` (and provider errors) are captured to Sentry and surfaced as a neutral resend-error.
- **Kit sync:** all failures swallowed (`.catch(() => {})` at the hook + internal Sentry capture); never blocks or surfaces to auth.

## Analytics

Auth events are namespaced under `POSTHOG_EVENTS.AUTH` in `src/lib/constants.ts`. Every event carries `locale`; failures additionally carry an `error_code` / `reason`. No email or password value is ever sent as a property (the email is used only as the server-side `distinctId` for backend captures).

- **Sign-up:** `auth_signup_submitted`, `auth_signup_success`, `auth_signup_failed`
- **Sign-in:** `auth_signin_submitted`, `auth_signin_success`, `auth_signin_failed`
- **Google:** `auth_google_signin_clicked`
- **Sign-out:** `auth_signout`
- **Forgot password:** `auth_forgot_password_submitted`, `auth_forgot_password_email_sent`, `auth_forgot_password_email_failed`, `auth_forgot_password_failed` (carries `reason: "rate_limited"` + `cooldown_minutes` on throttle)
- **Reset password:** `auth_reset_password_viewed` (carries `state`), `auth_reset_password_submitted`, `auth_reset_password_success`, `auth_reset_password_failed`
- **Verification:** `auth_verify_banner_shown`, `auth_verify_email_sent` (carries `source`: `manual_resend` / `day6_reminder`), `auth_verify_email_failed` (carries `reason`), `auth_verify_email_resent_clicked`, `auth_private_access_blocked_unverified`

Backend-fired events (server `distinctId = email`): `auth_forgot_password_email_sent`/`_failed`, `auth_forgot_password_failed` (rate-limited), and the day-6 `auth_verify_email_sent`/`auth_verify_email_failed`.

## Linked Blueprint

- `docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/bp-01-auth-identity-and-recovery-platform.md`
