---
id: WO-02
type: WORK_ORDER
slug: app-shell-user-menu-and-identity-surface
title: App Shell User Menu and Identity Surface
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-13
implementation_status: IMPLEMENTED
---

# WO-02 App Shell User Menu and Identity Surface

## Summary

Replace the shell sign-out-only account affordance with a reusable lower-shell identity surface that shows avatar plus username and opens an upward user menu for account actions and legal links.

## In Scope

- desktop sidebar lower identity surface
- collapsed-sidebar persistent avatar/fallback plus hover/expand identity behavior
- mobile drawer lower identity surface
- avatar fallback rendering
- upward-opening menu interaction with `Settings`, `Sign out`, `Privacy Policy`, and `Terms and Conditions`
- route wiring from menu to settings
- replacement of the current drawer sign-out-only control
- removal of `Settings` from primary shell navigation
- reuse of one account-menu component across shell surfaces

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
- `BR-07-03`
- `BR-07-04`
- `BR-07-05`
- `BR-07-06`

## Blueprints

- `BP-01` shell identity contract and one-page settings discoverability decisions

## Assumptions

- `WO-01` lands first so the shell can resolve a persisted username for every authenticated user.
- The desktop sidebar remains the canonical home of shell-level navigation and account access.
- The content header no longer owns account actions in MVP once this slice is delivered.

## UX Notes

- In desktop expanded sidebar state, show a rounded avatar plus username row directly above the sidebar expand/collapse control.
- The entire identity row is interactive, uses pointer cursor and hover feedback, and opens its menu upward.
- The desktop trigger should feel like a clean row rather than a filled card; the avatar itself does not need a background chip until hover adds surface emphasis to the row.
- In desktop collapsed sidebar state, keep the avatar or fallback visible in the lower rail even before expansion.
- In desktop collapsed sidebar state, hover or focus expansion reveals the username and the full trigger layout without changing menu ordering.
- In mobile and tablet drawer state, replace the current sign-out button in the lower drawer area with the same avatar-plus-username trigger and inline anchored menu.
- The opened menu should visually follow the modern productivity-app account-menu pattern: identity block at the top, core actions in the middle, legal links visibly anchored at the bottom.

## Interaction Notes

- Menu ordering should be:
  1. `Settings`
  2. `Sign out`
  3. `Privacy Policy`
  4. `Terms and Conditions`
- `Settings` must be removed from the primary shell navigation once this slice ships.
- On desktop, the menu is a floating panel anchored above the trigger.
- The desktop floating panel may be a bit wider than the trigger row so the legal footer fits on one compact line.
- On mobile/tablet drawer, the same menu content opens inline within the drawer instead of as a floating overlay.
- Legal links remain visible in the opened menu rather than hidden behind a second-level submenu.
- Legal links should appear side by side in a small footer row with a subtle separator, matching the shell trust-footer pattern.
- Legal links open in a new browser tab.
- The menu closes on outside click, route navigation, and any menu-action selection.
- The account-menu component should be shared between desktop and mobile placements so states, ordering, and accessibility behavior stay aligned.

## Accessibility Notes

- The lower identity trigger must remain keyboard reachable in expanded sidebar, collapsed-sidebar-expanded state, and drawer.
- The trigger needs an explicit accessible name that includes the username and indicates account actions.
- The opened menu must preserve visible focus order and allow dismissal without trapping users in the lower shell area.

## E2E Acceptance Tests

- Desktop shell shows avatar and username above the sidebar expand/collapse control instead of using a header sign-out button.
- Desktop collapsed sidebar still shows the avatar or fallback in the lower rail and reveals the full account trigger on hover/focus expansion.
- Hovering or focusing the collapsed desktop rail still allows access to the same lower account trigger and upward floating menu.
- Mobile drawer replaces the sign-out-only footer control with the same identity surface and inline menu actions.
- User menu links to settings, still allows sign-out, and shows visible links to Privacy Policy and Terms and Conditions.
- Primary shell navigation no longer shows `Settings` after the lower account menu is available.
