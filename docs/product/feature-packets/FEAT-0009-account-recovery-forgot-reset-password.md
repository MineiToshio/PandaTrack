# Feature Packet - FEAT-0009 Account Recovery (Forgot/Reset Password)

## 0) Metadata

- Feature ID: `FEAT-0009`
- Feature name: Account recovery with forgot/reset password
- Owner: Product + Engineering
- Status: `Ready`
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: Better Auth email/password module, Resend (transactional email), i18n, PostHog
- Risk level: `Medium`

## 1) Product Requirements

### 1.1 Problem

Users who forget credentials cannot recover account access without a secure reset flow.

### 1.2 Goal

Provide a secure, low-friction forgot/reset password experience with clear feedback and abuse controls.

### 1.3 Scope

- In scope:
  - Forgot-password request form
  - Reset-password form (token-based)
  - Transactional email send through Resend
  - Reset token expiration and validation
  - Basic send throttling and user-friendly error handling
- Out of scope:
  - Account recovery through support team workflow
  - 2FA recovery codes

### 1.4 Primary flow

1. User clicks "Forgot password" and submits account email.
2. System issues reset token and sends reset link email.
3. User opens link, submits new password, and resets credentials.
4. User signs in with new password.

### 1.5 Edge cases

- Unknown email: respond with neutral success message (avoid account enumeration).
- Expired or invalid token: show clear error and allow requesting a new link.
- Resend provider limit/error: show retry-later message and log failed attempt.
- Multiple requests: enforce cooldown/throttling.

### 1.6 Success metrics

- Product metric: password recovery completion rate.
- UX metric: reset success within first attempt.
- Guardrail metric: reset-email send failure rate.

## 2) Functional Requirements

### 2.1 Functional requirements

- `FR-1`: Forgot-password endpoint accepts email and triggers reset email flow.
- `FR-2`: Reset link uses one-time token with expiration.
- `FR-3`: Token validity window is 60 minutes.
- `FR-4`: Reset form updates password only when token is valid.
- `FR-5`: UI shows generic response for forgot-password request regardless of email existence.
- `FR-6`: Flow is fully localized (`es`, `en`).

### 2.2 Non-functional requirements

- Security: no account enumeration leakage.
- Reliability: provider failures are handled gracefully.
- Accessibility: form labels, announcements, keyboard submit.
- Observability: reset request/send/success/failure events tracked.

### 2.3 Business rules

- `BR-1`: Reset tokens expire after 60 minutes.
- `BR-2`: Reset tokens are single-use.
- `BR-3`: Cooldown for repeated reset requests applies (MVP target: 15 minutes per email).
- `BR-4`: On successful password reset, existing sessions should be invalidated according to Better Auth capabilities/policy.

### 2.4 State model

- Recovery state:
  - `idle`
  - `request_submitted`
  - `email_send_failed`
  - `token_valid`
  - `token_invalid_or_expired`
  - `reset_success`
- Transitions:
  - `idle -> request_submitted` on forgot submit
  - `request_submitted -> token_valid` when user opens valid link
  - `request_submitted -> token_invalid_or_expired` when link invalid/expired
  - `token_valid -> reset_success` when new password accepted

## 3) Data Contract (Spec-First)

### 3.1 Inputs

- Forgot request input:
  - `email` (required, valid email)
- Reset input:
  - `token` (required)
  - `newPassword` (required, policy defined in auth core)

### 3.2 Outputs

- Forgot response:
  - Always neutral success message for UI
- Reset response:
  - `success`
  - `invalid_or_expired_token`
  - `validation_error`
  - `provider_or_internal_error`

### 3.3 Persistence and data access

- Reset tokens: managed by Better Auth (or companion storage if required)
- Optional operational log table (MVP-lite): `emailDeliveryAttempts` for failed sends due to provider limits/errors
- Atomic write required (`transaction`): `No` for MVP path unless implementation introduces multi-step writes

### 3.4 Analytics

- Required PostHog events (initial set):
  - `auth_forgot_password_submitted`
  - `auth_forgot_password_email_sent`
  - `auth_forgot_password_email_failed`
  - `auth_reset_password_viewed`
  - `auth_reset_password_submitted`
  - `auth_reset_password_success`
  - `auth_reset_password_failed`

## 4) UX + i18n Checklist

- Affected views:
  - Forgot-password page/modal
  - Reset-password page
- Locale keys in `es` and `en` for:
  - Intro copy
  - Success/error feedback
  - Expired-link fallback action

## 5) Acceptance Criteria (Testable)

### `AC-1`

- Given a user submits forgot-password with any email
- When request completes
- Then UI shows neutral success response without disclosing account existence.

### `AC-2`

- Given a valid reset token
- When user submits compliant new password within 60 minutes
- Then password is updated and reset succeeds.

### `AC-3`

- Given an expired or invalid token
- When reset page is accessed/submitted
- Then user sees invalid/expired state and can request a new link.

### `AC-4`

- Given provider send limit/error occurs
- When forgot-password email send is attempted
- Then user sees retry-later message and failure is logged/tracked.

## 6) Test Plan

- Unit:
  - Token age validation behavior
  - Error mapping to user-facing messages
- Integration:
  - Resend send path success/failure handling
  - Better Auth token issuance/validation path
- E2E:
  - Forgot -> email link -> reset success
  - Expired token flow
  - Unknown email neutral response flow

## 7) ADR Reference

- Requires ADR: `No`
- Reason: recovery flow builds on auth architecture defined in FEAT-0008/ADR-0001.

## 8) Definition of Done

- Global DoD link: `docs/process/definition-of-done.md`
- Feature-specific DoD additions:
  - 60-minute expiry enforced
  - No account-enumeration leakage in forgot-password UX

## 9) Open Questions

- Final retry/cooldown policy thresholds for forgot-password requests.
- Whether to force immediate sign-out of all active sessions after password reset.

## 10) Implementation Slices

### Slice 1 - Recovery request baseline

- Status: `Planned`
- Last updated: `2026-03-06`
- Goal: enable forgot-password request flow safely.
- Scope:
  - Forgot-password view/form
  - Neutral success response (no account enumeration)
  - Basic request validation and throttling hook points
- Exit criteria:
  - Users can submit recovery request with neutral feedback
  - No user existence leakage in UI/API responses
- Progress notes (stable, optional):
  -

### Slice 2 - Token issuance and reset email delivery

- Status: `Planned`
- Last updated: `2026-03-06`
- Goal: deliver valid reset links through transactional email.
- Scope:
  - Token generation and expiry configuration (60 minutes)
  - Resend provider integration for recovery emails
  - Failure handling with retry-later UX message
- Exit criteria:
  - Reset email sent for valid recovery requests
  - Provider failures are handled without app crash
- Progress notes (stable, optional):
  -

### Slice 3 - Reset password completion flow

- Status: `Planned`
- Last updated: `2026-03-06`
- Goal: allow secure credential reset from tokenized link.
- Scope:
  - Reset page/form with token validation
  - New-password submission and update
  - Invalid/expired token states and fallback action
- Exit criteria:
  - Valid token resets password successfully
  - Invalid/expired tokens show clear recovery path
- Progress notes (stable, optional):
  -

### Slice 4 - Security hardening and session policy

- Status: `Planned`
- Last updated: `2026-03-06`
- Goal: enforce abuse controls and post-reset account safety.
- Scope:
  - Single-use token enforcement
  - Cooldown/rate-limit policy implementation
  - Session invalidation behavior after successful reset
- Exit criteria:
  - Token reuse is prevented
  - Repeated abuse attempts are throttled
- Progress notes (stable, optional):
  -

### Slice 5 - Observability and regression validation

- Status: `Planned`
- Last updated: `2026-03-06`
- Goal: ensure flow is measurable and stable.
- Scope:
  - PostHog events for recovery journey
  - Sentry capture for unexpected failures
  - Unit/integration/E2E checks on critical paths
- Exit criteria:
  - Recovery funnel events are visible
  - Core recovery scenarios pass validation
- Progress notes (stable, optional):
  -
