# Feature Packet - FEAT-0008 Auth Core, Authorization, and Email Verification

## 0) Metadata

- Feature ID: `FEAT-0008`
- Feature name: Auth core, route protection, and verify email lifecycle
- Owner: Product + Engineering
- Status: `Ready`
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: `better-auth` (self-hosted), Prisma, Neon Postgres, Google OAuth, Resend, Kit API
- Risk level: `High`

## 1) Product Requirements

### 1.1 Problem

PandaTrack needs user identity and access boundaries so private user data (purchases, payments, shipments, budgets) is protected while public areas remain open.

### 1.2 Goal

Ship authentication and authorization for the app with:

- Email/password + Google login
- Public vs private route protection
- Non-blocking verify-email lifecycle with timed enforcement
- Dedicated sign-up and sign-in entry points from landing CTAs

### 1.3 Target user

Collectors using PandaTrack to manage personal purchase and tracking data.

### 1.4 Scope

- In scope:
  - Better Auth self-hosted integration in current Next.js app
  - Sign up, sign in, sign out views and flows
  - Separate pages for auth entry: `/sign-up` and `/sign-in`
  - Cross-navigation between sign-up and sign-in pages
  - Email/password + Google OAuth
  - Minimal email signup form (email + password only)
  - Provider-aware account model (`email`, `google`)
  - Automatic account linking when Google email matches existing email account
  - Session handling and private route protection
  - Verify-email flow with grace period and reminders
  - Account enforcement at day 7 if email remains unverified
  - Kit sync/tag for authenticated users (`app_user` tag)
  - Landing CTA update from waitlist-oriented actions to auth-oriented actions
- Out of scope:
  - Password recovery UI and reset flow (covered in FEAT-0009)
  - 2FA
  - Advanced RBAC policy matrix
  - Mandatory profile completion at signup (name can be completed later in settings)

### 1.5 Public vs private access model

- Public routes:
  - Landing pages
  - Stores discovery/reviews section
- Private routes:
  - Purchases
  - Pre-order payments
  - Shipments/deliveries
  - Budget/spending
  - User dashboard and account-specific data

### 1.5.1 Auth entry and CTA model

- Auth entry routes:
  - `/sign-up` (primary conversion route)
  - `/sign-in` (returning users)
- Redirect rule:
  - Authenticated users who access `/sign-up` or `/sign-in` are redirected to `/dashboard`
- Landing CTA strategy:
  - Primary CTAs (hero/header/banner/current waitlist section replacement) point to `/sign-up`
  - Secondary access link points to `/sign-in`
- Auth page links:
  - Sign-up page includes "Already have an account? Sign in"
  - Sign-in page includes "Don't have an account? Sign up"

### 1.6 Primary flow

1. User signs up with email/password or signs in with Google.
2. Session is created and user can access private sections.
3. If email/password account is unverified, user sees verify banner and reminder flow.
4. On day 7 unverified, private access is blocked until verification is completed.

### 1.7 Edge cases

- Google provider unavailable: show recoverable auth error and fallback to email/password.
- Verify email send fails (rate limit/provider error): show retry message, do not crash auth flow.
- User tries private route on day 7+ without verification: redirect to verification gate view.
- Existing waitlist user signs up: sync user tag in Kit without duplicating logic by email.

### 1.8 Success metrics

- Product metric: successful auth completion rate (signup/signin -> valid session).
- UX metric: private-route unauthorized redirect rate decreases after rollout.
- Guardrail metric: auth error rate and provider-send failure rate remain below threshold.

## 2) Functional Requirements

### 2.1 Functional requirements

- `FR-1`: System supports email/password sign up and sign in.
- `FR-2`: System supports Google OAuth sign in from day one.
- `FR-3`: System supports sign out and session invalidation.
- `FR-4`: Public routes stay accessible without authentication.
- `FR-5`: Private routes require valid session.
- `FR-6`: Email/password accounts include verify-email lifecycle.
- `FR-7`: Unverified users are reminded and then blocked from private access at day 7.
- `FR-8`: Authenticated users are synced to Kit with a dedicated app-user tag.
- `FR-9`: App exposes dedicated `/sign-up` and `/sign-in` pages, accessible directly by URL.
- `FR-10`: Sign-up and sign-in pages cross-link each other.
- `FR-11`: Landing primary CTAs navigate to `/sign-up`; secondary auth link navigates to `/sign-in`.
- `FR-12`: If a user already has an active session, `/sign-up` and `/sign-in` redirect to `/dashboard`.
- `FR-13`: Email/password sign-up form requires only `email` and `password` (no required name field).
- `FR-14`: Google signup/signin stores provider profile data when available (`name`, `avatar`, provider metadata).
- `FR-15`: If Google OAuth email matches an existing email/password account, the provider is linked to the same user account instead of creating a new one.

### 2.2 Non-functional requirements

- Security: auth secrets remain server-side; no sensitive leakage in logs.
- Reliability: auth pages and protected routes behave consistently in server/client navigation.
- Accessibility: login/signup/verification UX supports keyboard and screen-reader behavior.
- Observability: key auth events and failures are tracked via PostHog + Sentry.

### 2.3 Business rules

- `BR-1`: `landing` and `stores` are public.
- `BR-2`: All account-bound product data is private and user-scoped.
- `BR-3`: Verify-email applies to email/password accounts.
- `BR-4`: Google accounts are considered verified by provider trust model.
- `BR-5`: Unverified email/password accounts keep private access during grace period only.
- `BR-6`: Grace period is 7 days from account creation.
- `BR-7`: A single reminder email is sent on day 6.
- `BR-8`: After day 7, private access is blocked until email is verified.
- `BR-9`: At day 7+, user session is kept, but private routes are gated by a blocking verification screen (no forced logout).
- `BR-10`: Email/password signup collects only `email` and `password` at entry.
- `BR-11`: Accounts created with email/password are registered with provider type `email`.
- `BR-12`: Google-authenticated accounts are registered with provider type `google` and may include `name`/`avatar` from provider payload.
- `BR-13`: When provider email matches an existing account email, auth methods are linked to the same user identity (single account, multiple login methods).
- `BR-14`: Profile fields such as display name are editable post-signup in settings and are not required to complete registration.

### 2.4 State model

- Auth state:
  - `anonymous`
  - `authenticated_verified`
  - `authenticated_unverified_grace`
  - `authenticated_unverified_blocked`
- Transitions:
  - `anonymous -> authenticated_unverified_grace` (email/password signup)
  - `anonymous -> authenticated_verified` (Google signin or verified email/password)
  - `authenticated_unverified_grace -> authenticated_verified` (email verified)
  - `authenticated_unverified_grace -> authenticated_unverified_blocked` (day 7 threshold)
  - `authenticated_* -> anonymous` (signout/session invalid)

## 3) Data Contract (Spec-First)

### 3.1 Inputs

- Signup input:
  - `email` (required, valid email)
  - `password` (required, policy to be defined)
- Signin input:
  - `email`, `password` or Google OAuth callback payload
- Verification lifecycle fields (user/account metadata):
  - `emailVerifiedAt` (`Date | null`)
  - `verificationDeadlineAt` (`Date`)
  - `verificationBlockedAt` (`Date | null`)
  - `lastVerificationReminderAt` (`Date | null`)
  - `verificationReminderCount` (`number`)
- Provider/account-link fields:
  - `provider` (`email | google`)
  - `providerAccountId` (`string`, when OAuth-based)
  - `profileName` (`string | null`, optional from OAuth provider)
  - `profileImageUrl` (`string | null`, optional from OAuth provider)

### 3.2 Outputs

- Auth/session output: normalized current-user session object
- Authorization output: allow/deny for private route access
- Verification output: banner state + action state (send/resend/check)

### 3.3 Persistence and data access

- Auth persistence: Better Auth tables in Neon via Prisma
- Product data model: private entities link to authenticated user id
- Additional persistence (if needed for lifecycle): verification lifecycle metadata attached to user/account profile
- Atomic write required (`transaction`): `Yes` for multi-step onboarding writes

### 3.4 Analytics

- Required PostHog events (initial set):
  - `auth_signup_submitted`
  - `auth_signup_success`
  - `auth_signup_failed`
  - `auth_signin_submitted`
  - `auth_signin_success`
  - `auth_signin_failed`
  - `auth_google_signin_clicked`
  - `auth_signout`
  - `auth_verify_banner_shown`
  - `auth_verify_email_sent`
  - `auth_verify_email_failed`
  - `auth_private_access_blocked_unverified`
  - `auth_verify_email_resent_clicked`

## 4) UX + i18n Checklist

- Affected views:
  - Sign up
  - Sign in
  - Verify-email notice/banner
  - Unverified-blocked gate view for private routes
- Locale coverage:
  - `es` and `en` keys for all auth/verification screens and feedback messages
- Accessibility:
  - Labeled controls, keyboard submit, focus handling, error announcement

## 5) Acceptance Criteria (Testable)

### `AC-1`

- Given a user without session
- When they visit public routes (landing/stores)
- Then content is accessible without login.

### `AC-2`

- Given a user without session
- When they visit private routes
- Then they are redirected to sign-in.

### `AC-3`

- Given a user signs up with email/password
- When signup succeeds
- Then session is created, verify banner is shown, and grace period starts.

### `AC-4`

- Given a user signs in with Google
- When provider auth succeeds
- Then session is created and private routes are accessible.

### `AC-5`

- Given an email/password account remains unverified for 7 days
- When user attempts private-route access
- Then access is blocked and a verification gate screen is shown with a `Resend verification` action.

### `AC-6`

- Given a blocked unverified user on day 7+
- When the user clicks `Resend verification`
- Then the app attempts to send a new verification email and shows success/failure feedback without logging the user out.

### `AC-7`

- Given a new authenticated user
- When signup/signin succeeds
- Then user email is synced/tagged in Kit as app user.

### `AC-8`

- Given a user on landing
- When they click any primary CTA (hero/header/banner/waitlist replacement section)
- Then they are routed to `/sign-up`.

### `AC-9`

- Given a user in `/sign-up` or `/sign-in`
- When they use the alternate auth link
- Then they are routed to the opposite auth page.

### `AC-10`

- Given an already authenticated user
- When they access `/sign-up` or `/sign-in` directly by URL
- Then they are redirected to `/dashboard`.

### `AC-11`

- Given a user chooses email/password sign-up
- When they open `/sign-up`
- Then the required fields are only email and password.

### `AC-12`

- Given a user signs up/signs in with Google
- When provider payload includes profile data
- Then account profile fields (name/avatar) are stored when available.

### `AC-13`

- Given an existing email/password account for `user@example.com`
- When the same person signs in with Google using `user@example.com`
- Then login methods are linked to the same account and no duplicate user account is created.

### `AC-14`

- Given an email/password account that is still unverified on day 6
- When the reminder job/window is processed
- Then exactly one verification reminder email is sent.

## 6) Test Plan

- Unit:
  - Auth guard utilities (public/private routing decisions)
  - Verification deadline calculation
- Integration:
  - Better Auth + Prisma + Neon session flow
  - Google OAuth callback flow
  - Verification enforcement logic on protected routes
  - Day-6 verification reminder dispatch behavior
- E2E:
  - Email/password signup/signin happy path
  - Google signin happy path
  - Google signin links to existing email account with same email
  - Private-route redirect when anonymous
  - Block behavior after verification deadline
  - Landing CTA to `/sign-up` navigation
  - Sign-up <-> sign-in cross-navigation
  - Authenticated user redirect from `/sign-up` and `/sign-in` to `/dashboard`
- Regression:
  - Public stores pages remain public
  - Landing sections remain stable after CTA replacement from waitlist to auth entry

## 7) ADR Reference

- Requires ADR: `Yes`
- Reason: introduces foundational architecture for identity, route protection, and user ownership model across the app.
- Planned ADR: `ADR-0001-auth-strategy-better-auth-self-hosted.md`

## 8) Definition of Done

- Global DoD link: `docs/process/definition-of-done.md`
- Feature-specific DoD additions:
  - Public/private boundaries validated end-to-end
  - Verification grace and block behavior validated
  - Kit sync works for authenticated users without breaking auth flow

## 9) Open Questions

- Final password policy (minimum length/entropy rules).
- Final session lifetime policy (assumption for MVP: long-lived rolling sessions; precise TTL to be fixed during implementation).
- Whether account deletion after extended unverified state should be automated in a later phase.
- Final copy for the verification gate message and CTA labels in `es` and `en`.
- Conflict resolution policy for rare edge cases where provider email normalization differs across identity providers.
