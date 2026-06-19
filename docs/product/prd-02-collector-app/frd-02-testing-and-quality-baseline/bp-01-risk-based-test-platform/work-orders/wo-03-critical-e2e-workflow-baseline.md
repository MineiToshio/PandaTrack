---
id: WO-03
type: WORK_ORDER
slug: critical-e2e-workflow-baseline
title: Critical E2E Workflow Baseline
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0010
implementation_status: IMPLEMENTED
---

# WO-03 Critical E2E Workflow Baseline

## Summary

Protect critical App Router flows through Playwright for landing, auth, app-layout, settings, store, and delivery workflows.

## In Scope

- landing CTAs and waitlist path coverage
- auth redirect, sign-up error mapping, and recovery coverage
- app layout navigation baseline (mobile drawer, sidebar persistence, breadcrumbs)
- settings tab navigation and currency change modal
- store create flow and logo control behavior
- store-listing and store-detail unauthenticated redirect
- delivery create-from-order, mark delivered, reopen, delete, and order-status re-derivation

## Out of Scope

- every future collector workflow not yet implemented

## Requirements

- `FR-02-04`
- `FR-02-05`
- `FR-02-06`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

The full spec catalog as of 2026-06-16:

| Spec                        | Auth-gated | What is covered                                                                                                                                                                                                                  |
| --------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/landing.spec.ts`       | No         | Hero CTA, header sign-in link, FAQ accordion, no-waitlist assertion                                                                                                                                                              |
| `e2e/auth.spec.ts`          | No         | Dashboard redirect + returnTo preservation, inline validation + forgot-password link, throttled forgot-password, invalid-token reset-password state, valid-token reset-password success, sign-up duplicate-account error mapping |
| `e2e/app-layout.spec.ts`    | Yes        | Mobile unauthenticated redirect, authenticated mobile drawer + nav links, sidebar collapse persistence on reload, account-menu legal links, first-level heading only, nested breadcrumbs                                         |
| `e2e/settings.spec.ts`      | Yes        | Three section tabs, pane switching (account / preferences), currency change modal two-path footer, save-without-updating-rates                                                                                                   |
| `e2e/stores.spec.ts`        | Yes        | Create store page access, logo control visibility by store type, logo crop preview reopen, required-field validation without persisting                                                                                          |
| `e2e/store-listing.spec.ts` | No         | Stores listing redirect, store-detail redirect                                                                                                                                                                                   |
| `e2e/deliveries.spec.ts`    | Mixed      | Standalone delivery create redirect (unauthenticated, always runs), create-from-order wizard, mark delivered, order status re-derivation, reopen, delete, order cleanup                                                          |
