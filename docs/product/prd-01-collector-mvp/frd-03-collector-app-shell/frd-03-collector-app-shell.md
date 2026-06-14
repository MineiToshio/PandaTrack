---
id: FRD-03
type: FRD
slug: collector-app-shell
title: Collector App Shell and Dashboard-first Navigation
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-13
source_features:
  - FEAT-0011
implementation_status: IMPLEMENTED
---

# FRD-03 Collector App Shell and Dashboard-first Navigation

## Overview

This FRD defines the private collector workspace shell that gives PandaTrack a stable app frame before the deeper collector workflows are filled in.

## Current State

### Implemented

- shared private app layout
- dashboard-first private entry
- desktop sidebar expand/collapse behavior with two modes: **PUSH** (manual toggle that shifts the content grid via `--sidebar-current-w`) and **FLOAT** (hover-expand overlay that does not shift content)
- touch-friendly drawer navigation; on mobile/tablet the burger `AppNavDrawer` is the **single** primary navigation surface (the earlier `MobileTabBar` was built and then removed in the redesign — see `FR-03-04` note)
- route-aware content header, constrained to `[☰]` + breadcrumb + title; it does not host back navigation, an overflow menu, or the account avatar (see `FR-03-05` note)
- locale/theme controls in the header; the sidebar surface uses `bg-surface-elevated`
- lower-shell account trigger (`ShellAccountMenu`) in the desktop sidebar and mobile drawer, with account actions moved out of the content header and `Settings` living in the lower account menu instead of the main nav list
- tests for layout behavior and E2E app-shell navigation

### Removed during the redesign

- `MobileTabBar` (4-tab bottom bar) — built in an earlier pass and then removed; its token `--mobile-tab-bar-h` and `mobileTabBar.*` i18n keys were dropped. The burger drawer is the sole primary mobile navigation.
- The floating action button (`FAB`) and the idle `MascotBubble` are no longer mounted by the app layout. The component files remain in the repo but are not consumed by the shell.

### Adopted cross-app redesign patterns

These are owned by the redesign design system (documented in `docs/redesign/PLAYBOOK.md` and the ADRs there), not introduced as shell-specific functional requirements: the **adaptive `Modal`** (renders a centered dialog on desktop and a bottom sheet on mobile), the **single-primary sticky action bar** for detail/create/edit screens, and the **Chip Eyebrow + Top-Accent** section-card treatment.

## Functional Requirements

- `FR-03-01`: Signed-in routes must render inside a reusable collector app shell.
- `FR-03-02`: The dashboard must be the default private entry destination.
- `FR-03-03`: The desktop sidebar must support expanded and collapsed states. **Redesign note:** implemented as two modes — PUSH (manual toggle that shifts the content grid) and FLOAT (hover-expand overlay that leaves content in place).
- `FR-03-04`: The mobile and tablet experience must replace hover-dependent behavior with a drawer pattern. **Redesign note:** the burger `AppNavDrawer` is the single primary mobile navigation; the `MobileTabBar` that briefly implemented a 4-tab bottom bar was removed (token and i18n keys dropped).
- `FR-03-05`: The content header must support route-aware title and contextual chrome. **Redesign note (ADR 0011):** "contextual chrome" is intentionally limited to `[☰]` + breadcrumb + title. The header does not host back navigation, an overflow (`⋯`) menu, or the account avatar; contextual actions (secondary actions, back links, CTAs) live in the page content (`<main>`), not in the shell header.
- `FR-03-06`: Locale, theme, and account actions must be available from the shell. **Redesign note:** locale and theme toggles live in the header; the account trigger (`ShellAccountMenu`) lives in the lower shell area, not the header. The sidebar surface color is `bg-surface-elevated`. The earlier `FAB` is no longer mounted by the shell.
- `FR-03-07`: Sidebar preference may be persisted locally in the browser. **Redesign note:** the PUSH/FLOAT sidebar state is shared via a hook and reflected on the content grid through the `--sidebar-current-w` CSS variable.
- `FR-03-08`: Shell interactions should be instrumentable and shell failures should be observable without noisy duplication. **Redesign note:** the idle `MascotBubble` was removed from the shell (it competed with sticky action bars and added no flow value).

## Business Rules

- `BR-03-01`: Dashboard is the private starting point.
- `BR-03-02`: `Pre-orders` stay conceptually grouped under orders in MVP navigation.
- `BR-03-03`: Shell clarity matters more than novelty.
- `BR-03-04`: The content header owns page context, not primary account actions.
- `BR-03-05`: Lower-shell account affordances should stay aligned between desktop sidebar and mobile drawer.

## Acceptance Criteria

### `AC-03-01`

- Given a signed-in user opens the collector workspace
- When the private layout renders
- Then the dashboard appears inside the shared app shell.

### `AC-03-02`

- Given the user is on mobile or tablet
- When they navigate the private workspace
- Then the shell uses an explicit drawer pattern instead of hover-only behavior.

### `AC-03-03`

- Given the user navigates between first-level and nested routes
- When the header renders
- Then it adapts page context appropriately.

### `AC-03-04`

- Given the shell exposes account actions
- When the user is on desktop or mobile/tablet
- Then the account trigger appears in the lower shell navigation area rather than in the content header.

## Linked Blueprint

- `docs/product/prd-01-collector-mvp/frd-03-collector-app-shell/bp-01-collector-workspace-shell/bp-01-collector-workspace-shell.md`
