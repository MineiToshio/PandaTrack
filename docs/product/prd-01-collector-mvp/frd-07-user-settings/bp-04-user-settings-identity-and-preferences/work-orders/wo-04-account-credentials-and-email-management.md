---
id: WO-04
type: WORK_ORDER
slug: account-credentials-and-email-management
title: Account Credentials and Email Management
status: DRAFT
parent: BP-04
source_features:
  - FEAT-0013
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-04 Account Credentials and Email Management

## Summary

Implement the provider-aware account-management controls for email, password change, and password setup while reusing the existing verification lifecycle where required.

## In Scope

- provider-aware account capability UI
- credential-account email change flow with confirmation modal
- verification lifecycle restart after email change
- Google-only password-setup flow
- credential-account password-change flow
- clear blocked state for unsupported email changes on Google-linked accounts

## Out of Scope

- unlinking Google
- multi-email support
- adding more OAuth providers
- profile image and username editing
- budget and collector preferences

## Requirements

- `FR-07-13` through `FR-07-18`
- `BR-07-06` through `BR-07-08`

## Blueprints

- `BP-04` account-management contract
- `BP-04` auth-method branching decisions

## E2E Acceptance Tests

- Credential-only user can change email and is returned to the verification-banner lifecycle.
- Google-only user can set a password but cannot change email.
- Google-linked credential user still cannot change email in MVP.
