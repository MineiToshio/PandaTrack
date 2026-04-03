---
id: WO-02
type: WORK_ORDER
slug: app-shell-user-menu-and-identity-surface
title: App Shell User Menu and Identity Surface
status: DRAFT
parent: BP-04
source_features:
  - FEAT-0013
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-02 App Shell User Menu and Identity Surface

## Summary

Replace the shell sign-out-only account affordance with a clear avatar-plus-username identity surface and the minimum user menu for settings access and sign-out.

## In Scope

- desktop header identity surface
- mobile drawer identity surface
- avatar fallback rendering
- menu interaction with `Settings` and `Sign out`
- route wiring from menu to settings

## Out of Scope

- settings page internals
- username editing
- avatar upload flow
- email/password flows

## Requirements

- `FR-07-01`
- `FR-07-02`
- `FR-07-12`
- `BR-07-02`

## Blueprints

- `BP-04` shell identity contract and one-page settings discoverability decisions

## E2E Acceptance Tests

- Desktop shell shows avatar and username instead of a plain sign-out button.
- Mobile drawer shows the same identity surface and menu actions.
- User menu links to settings and still allows sign-out.
