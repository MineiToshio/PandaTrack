---
id: WO-04
type: WORK_ORDER
slug: account-credentials-and-email-management
title: Account Credentials and Email Management
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-04
implementation_status: IMPLEMENTED
---

# WO-04 Account Credentials and Email Management

## Summary

Implement the provider-aware account-management controls for email, password change, and password setup while reusing the existing verification lifecycle where required.

This slice introduces the `Account` section of the settings page. Provider posture is derived at runtime from the user's linked auth accounts and determines which controls are visible and interactive.

## In Scope

- provider-aware account capability UI (`Account` section in `/settings`)
- credential-account email change flow with confirmation modal and current-password validation
- informational security notification to the old email address after a successful email change
- verification lifecycle restart after email change
- Google-only password-setup flow using `auth.api.setPassword`
- credential-account password-change flow
- UI transition from "Set password" to "Change password" after a Google-only user successfully sets a password
- clear blocked state for unsupported email changes on Google-only and Google-linked accounts
- rate limiting for email change (1 successful change per user per 7 days)

## Out of Scope

- unlinking Google
- multi-email support
- adding more OAuth providers
- profile image and username editing (WO-03)
- budget and collector preferences (WO-05)
- two-step email-change approval via the old email address (informational-only notification is in scope; a click-to-approve link in the old email is not)

## Requirements

- `FR-07-14` through `FR-07-19`
- `FR-07-30` — Account as a distinct third section in the settings page
- `FR-07-31` — Informational security email to old address after email change
- `BR-07-13` — Email change must never be bundled with a generic profile-form save
- `BR-07-17` — Rate limit of 1 email change per user per 7 days

## Blueprints

- `BP-01` account-management contract
- `BP-01` account-capability contract
- `BP-01` auth-method branching decisions

## Assumptions

- `WO-01` lands first and provides the shared provider-posture detection utility that this slice consumes to derive account capabilities at runtime.
- `WO-02` provides the shell account menu and settings entry point before this slice is implemented.
- Provider posture is derived from the authenticated user's `Account` records at runtime, not from persisted boolean flags on `User`.
- A Google-only user who successfully sets a password now has both a credential and a Google account linked. The UI must reflect this by showing "Change password" on the next component load.
- On successful credential email change, `User.email` updates immediately to the new normalized address, `emailVerified` becomes `false`, and the credential `Account.accountId` is aligned with the new email for sign-in. The old address stops working as the login identifier immediately.
- The app shell shows the standard verification banner right away because the user is a credential account with `emailVerified: false`. Completing the link sets `emailVerified` back to `true` via the normal `verify-email` flow.
- The email change rate limit follows the same storage and check pattern as `passwordRecoveryThrottle.ts`.
- The server action must validate the current password manually before persisting the new email; Better Auth session alone is not sufficient authorization for this operation.
- Better Auth session cookie cache is disabled so the `sendVerificationEmail` call in the same server action sees the updated user row from the database.

## UX Notes

### Settings page structure

The settings page exposes three distinct sections on the same route (`/settings`):

1. `Profile` — username, display name, avatar (WO-03)
2. `Account` — email and password management (this slice)
3. `Preferences` — country, currency, product types, budget (WO-05)

### Account section layout

The `Account` section exposes two independent subsections:

- **Email** — always visible; content and interactivity branch by provider posture
- **Password** — always visible; label and form branch by provider posture

Each subsection has its own save flow and must never be bundled together or with the `Profile` section saves.

### Email change flow (credential-only users)

1. The current email is displayed as a read-only value with a "Change email" action button.
2. Clicking "Change email" opens a confirmation modal.
3. The modal contains: a new email input, a current password field, and confirm/cancel actions. The current password uses the same shared password input as other Account flows, including a show/hide visibility toggle.
4. On confirm, required modal fields are validated on the client first (empty values show destructive field styling and a short message without calling the server). When valid, the server action validates the current password, checks the rate limit, updates `User.email` and `emailVerified`, aligns the credential account, sends the informational email to the old address, and triggers `sendVerificationEmail` to the new address.
5. After a successful server response, the new email appears immediately in the settings field and the shell verification banner is active without requiring a new sign-in.
6. In-account copy can repeat that a verification link was sent to the visible email address; the banner and resend control use the same lifecycle as other unverified credential accounts.
7. The user may continue using the app under the active session without interruption.

### Email blocked state (Google-only and Google-linked credential users)

- The email field is rendered as read-only with no action button.
- A helper text below reads: _"Your account uses Google. To change your email, update it directly in your Google account."_

### Password change flow (credential-only and Google-linked credential users)

- A form with two fields: `Current password` and `New password`. Both use the shared password input component (same pattern as sign-in and password reset), including a show/hide visibility toggle.
- On save, required fields are validated on the client first: empty values show destructive border styling and a short validation message without invoking the server action.
- Password strength and auth validation rules match those used in existing auth flows (server-side and Better Auth).
- A dedicated save button triggers only the password change action.
- After a successful password change, a transient toast notification confirms the update. Validation errors and auth errors remain inline above the form.

### Password setup flow (Google-only users)

- The subsection label reads "Set password" instead of "Change password".
- The form shows a single `New password` field (shared password input with show/hide; no current password field, since none exists).
- On save, the client validates that the field is non-empty with the same destructive styling pattern as the change-password form before invoking the server action.
- After a successful save, the section transitions to the "Change password" form on the next component load without a full page refresh.
- A transient toast notification confirms that the password was set. Validation errors remain inline above the form.

### Success and error feedback pattern (Account section)

Success confirmations (password changed, password set) use toast notifications. Validation errors, auth errors, and rate-limit errors remain inline inside the relevant form so the user can read them while the form is still visible. See `docs/design/interface-patterns.md` — _Toast Notifications_.

## Technical Notes

### Better Auth configuration

Disable session cookie cache (or equivalent) so server actions that update `User.email` are visible to the next Better Auth API call in the same request. Email change does not use `auth.api.changeEmail`; verification uses the existing `emailVerification.sendVerificationEmail` handler.

### Email change server action

The server action must execute the following steps in order:

1. Read the authenticated session via `auth-server.ts`.
2. Derive provider posture to confirm the user has a credential account (email change is only allowed for credential-bearing users).
3. Enforce the rate limit: reject if the user has already changed their email within the past 7 days.
4. Validate the current password via `auth.api.verifyPassword`.
5. In a transaction, update `User` (`email` to the normalized new address, `emailVerified: false`, `unverifiedGraceStartsAt` to now so the 7-day verification grace window restarts) and update the credential `Account` row so `accountId` matches the new email.
6. Record the successful change for rate limiting.
7. Send the informational security email to the **previous** address via `sendEmailWithResend`.
8. Call `auth.api.sendVerificationEmail({ body: { email: newEmail, callbackURL }, headers })` so the new inbox receives the standard verification link.

### Informational email to old address

A new email template is required for this notification:

- **Recipient:** old email address (before the change)
- **Subject:** localized — e.g., _"Your PandaTrack email is being changed"_
- **Body:** "Someone requested to change the email address for your PandaTrack account to [new email]. If this was you, no further action is needed. If you did not request this change, please contact us at hello@pandatrack.app."
- Build using the existing `buildTransactionalEmailTemplate()` helper.
- Must be localized (Spanish/English) following the same pattern as `buildAuthVerificationEmail` and `buildAuthPasswordResetEmail`.
- If this Resend call fails after the user row is updated, do not roll back the email change — log the failure to Sentry and treat the missed notification as operational follow-up.

### Verification email to new address

Better Auth sends the verification link to the new email using the existing `sendVerificationEmail` handler in `auth.ts`. No new template is needed for this step — the existing localized verification email is reused.

### Better Auth behavior on verification link click

When the user clicks the link sent to the new email, the standard verification handler runs against the current `User.email` (already the new address). It sets `emailVerified` to `true`, clears `unverifiedGraceStartsAt`, and clears the verification banner state for credential users.

### Password change server action

Call `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })` from the client, or the equivalent `auth.api.changePassword` from a server action. This revokes every other session tied to the account, closing off a session an attacker may be holding after the password changes. Better Auth issues a fresh session and sets its cookie for the caller as part of the same call, so the collector who just changed the password is never signed out.

### Password setup server action (Google-only)

Call `auth.api.setPassword({ body: { newPassword }, headers })` from a server action (this endpoint is server-only). This creates a new `Account` row with `providerId: "credential"` linked to the user. After success, the user can sign in with either Google or email/password.

`changePassword` cannot be used here — it requires `currentPassword` as a mandatory field and fails when no credential account exists.

### Rate limiting

Adapt `passwordRecoveryThrottle.ts` into a reusable email-change throttle with a 7-day window. Enforce the check server-side at the start of the server action, before any Better Auth calls, and return a user-facing error when the limit is exceeded.

### Session behavior

The active session is not revoked after an email change. The new email is the login identifier immediately; the old email is no longer valid for email/password sign-in. The user must verify the new address to clear `emailVerified`.

## Security Notes

- The email change server action must validate the current password manually before persisting a new email. The session alone is not sufficient authorization for this high-impact operation.
- Provider posture must be checked server-side — only users with a credential account may initiate an email change.
- The rate limit must be enforced server-side to prevent abuse and email spam to arbitrary new addresses.
- The informational email to the old address gives the original account owner notice of any unauthorized change attempt. The support contact (`hello@pandatrack.app`) must appear in the email body.
- `auth.api.setPassword` is server-only and must never be exposed as a direct client-callable action.
- Password forms must enforce the same minimum-strength rules used in signup and password reset flows.
- A second "confirm new password" field is not required in MVP; reducing typing errors is handled by the visibility toggle and server-side validation.

## Observability Notes

- Capture unexpected failures during email change execution (Better Auth call, Resend calls, rate limit storage) with Sentry.
- Capture unexpected failures during password change and password setup with Sentry.
- If the informational email to the old address fails after the user row is updated, log to Sentry and do not roll back the email change.
- Rate limit rejections may be logged at info level; they do not require Sentry capture unless abnormally frequent.

## Dependencies

- Provider-posture detection utility from `WO-01`
- Better Auth session access: `src/lib/auth/auth-server.ts`
- Better Auth `emailVerification.sendVerificationEmail` handler in `src/lib/auth/auth.ts` (reuse for the post-change verification email)
- Resend integration: `src/lib/integrations/resend.ts`
- Rate limiting pattern: adapt `passwordRecoveryThrottle.ts` for email change
- `buildTransactionalEmailTemplate()` for the informational email template
- Existing `buildAuthVerificationEmail` as reference for the new template's structure and i18n pattern
- Existing verification banner lifecycle from [`FRD-01`](../../../frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md)

## Testing Notes

Key flows to cover:

- Credential-only user can open the email change modal, is required to enter their current password, and the change is submitted successfully.
- Email change is rejected if the current password is wrong.
- Email change is rejected if the rate limit has been reached (1 successful change in the past 7 days).
- After a successful email change, `sendEmailWithResend` is called for the informational notification to the old address.
- After a successful email change, `sendVerificationEmail` is invoked for the new address.
- A Sentry event is captured if the informational email to the old address fails without rolling back the change.
- Clicking the verification link in the new email sets `emailVerified = true` for the current `User.email`.
- Google-only user sees the email field as read-only with the explanatory helper text and no action button.
- Google-linked credential user sees the email field as read-only with the explanatory helper text and no action button.
- Credential-only user can change their password using the current password plus new password form (two fields, no confirm field).
- Submitting password change or setup with empty required fields shows client-side destructive field styling without calling the server.
- Google-only user sees "Set password" form with a single new-password field and no current-password field.
- Google-only user successfully sets a password and the section transitions to "Change password" on the next load.

## E2E Acceptance Tests

- Credential-only user can change email: modal opens, current password is validated, new email appears in the field, and the verification banner restarts.
- Google-only user cannot change email: email field is read-only with explanatory helper text.
- Google-linked credential user cannot change email: email field is read-only with explanatory helper text.
- Google-only user can set a password and the section transitions to the "Change password" form afterward.
- Credential-only user can change their password successfully using the current password form.
- Password fields in Account (including the email-change modal) support show/hide via the shared password input.
