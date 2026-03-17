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
last_updated: 2026-03-16
implementation_status: IMPLEMENTED
---

# BP-01 Auth Identity and Recovery Platform

## Purpose

Describe the system that authenticates users, protects private routes, enforces verification policy, and supports password recovery.

## Runtime Components

- Better Auth server in `src/lib/auth/auth.ts`
- server session helpers in `src/lib/auth/auth-server.ts`
- redirect helpers in `src/lib/auth/authRedirect.ts`
- verification helpers in `src/lib/auth/authVerification.ts`
- auth routes in `src/app/[locale]/(auth)/*`
- private route enforcement in `src/app/[locale]/(app)/layout.tsx`

## Architecture Decisions

- auth uses Better Auth with Prisma-backed persistence
- account linking is enabled for Google
- verification is enforced through private-route gating rather than forced logout
- password recovery is handled through tokenized Better Auth flows and transactional email

## Risks

- auth regressions block the whole private product
- verification logic and return-to handling must stay stable across route changes
- recovery flows must not leak account existence or token details

## Linked Work Orders

- `docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/work-orders/wo-01-auth-core-and-entry-flows.md`
- `docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/work-orders/wo-02-route-protection-and-verification-lifecycle.md`
- `docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/bp-01-auth-identity-and-recovery-platform/work-orders/wo-03-password-recovery-and-reset.md`
