---
id: BP-01
type: BLUEPRINT
slug: auth-identity-and-recovery-platform
title: Auth Identity and Recovery Platform
status: ACTIVE
parent: FRD-01
children:
  - WO-01
  - WO-02
  - WO-03
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# BP-01 Auth Identity and Recovery Platform

## Purpose

Describe the system that authenticates users, protects private routes, enforces verification policy, and supports password recovery.

## Runtime Components

- Better Auth server in `src/lib/auth/auth.ts` (providers, account linking, username-generation create hook, verification + reset callbacks, Kit `after` hook)
- server session helpers in `src/lib/auth/auth-server.ts`; client in `auth-client.ts`
- redirect + callback-sanitization helpers in `src/lib/auth/authRedirect.ts`
- verification helpers in `src/lib/auth/authVerification.ts` (snapshot, send, day-6 reminder)
- password-recovery helpers in `src/lib/auth/authPasswordRecovery.ts`, `passwordRecoveryThrottle.ts`, `authPasswordRecoveryData.ts`, and the email builders `authPasswordResetEmail.ts` / `authVerificationEmail.ts`
- auth routes in `src/app/[locale]/(auth)/*` (including `verify-email/confirm` and `verify-email-required`) with shared `_components` and `_utils/authEntryContext`
- in-shell verification chrome `src/components/modules/auth/VerifyEmailBanner.tsx` + `VerificationResend.tsx`; resend action `(app)/_actions/resendVerificationEmail.ts`
- private route enforcement in `src/app/[locale]/(app)/layout.tsx`
- Kit sync in `src/lib/integrations/kit.ts`; grace-anchor queries in `src/queries/user.ts`; verification markers in `src/queries/verification.ts`

## Architecture Decisions

- auth uses Better Auth with Prisma-backed persistence and DB-backed sessions (cookie cache disabled so server-side user mutations are visible immediately)
- a unique username is auto-generated in the user-create hook; the form never collects it
- account linking is enabled for Google as a trusted provider, with profile hydration
- verification access is a derived, four-state snapshot (`not_applicable`/`verified`/`grace`/`blocked`) anchored on `unverifiedGraceStartsAt ?? createdAt`; enforced through private-route gating (grace banner, day-7 gate) rather than forced logout
- a one-time day-6 reminder is sent via an idempotent verification-marker sentinel
- callback `returnTo` is sanitized to same-origin, non-auth paths before use
- password recovery is tokenized (60-min, single-use, sessions revoked on reset) over transactional Resend email, behind an escalating 2/5/15/60-min throttle enforced both server- and client-side, and kept neutral to avoid account enumeration
- Kit sync is fire-and-forget in an `after` hook and never blocks or surfaces failures
- dev-only escape hatches (`useSecureCookies` off outside production, `BETTER_AUTH_EXTRA_ORIGINS`) support local/LAN testing and are inert in production

## Risks

- auth regressions block the whole private product
- verification logic and return-to handling must stay stable across route changes
- recovery flows must not leak account existence or token details

## Linked Work Orders

- `docs/product/prd-02-collector-app/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/work-orders/wo-01-auth-core-and-entry-flows.md`
- `docs/product/prd-02-collector-app/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/work-orders/wo-02-route-protection-and-verification-lifecycle.md`
- `docs/product/prd-02-collector-app/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/work-orders/wo-03-password-recovery-and-reset.md`
