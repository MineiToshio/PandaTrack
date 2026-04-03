---
id: FRD-03
type: FRD
slug: collector-app-shell
title: Collector App Shell and Dashboard-first Navigation
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-04-03
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
- desktop sidebar expand/collapse behavior
- touch-friendly drawer navigation
- route-aware content header
- locale/theme controls
- tests for layout behavior and E2E app-shell navigation

### Planned Alignment

- lower-shell account trigger in the desktop sidebar and mobile drawer
- account actions moved out of the content header
- primary navigation updated so `Settings` lives in the lower account menu instead of the main nav list

## Functional Requirements

- `FR-03-01`: Signed-in routes must render inside a reusable collector app shell.
- `FR-03-02`: The dashboard must be the default private entry destination.
- `FR-03-03`: The desktop sidebar must support expanded and collapsed states.
- `FR-03-04`: The mobile and tablet experience must replace hover-dependent behavior with a drawer pattern.
- `FR-03-05`: The content header must support route-aware title and contextual chrome.
- `FR-03-06`: Locale, theme, and account actions must be available from the shell.
- `FR-03-07`: Sidebar preference may be persisted locally in the browser.
- `FR-03-08`: Shell interactions should be instrumentable and shell failures should be observable without noisy duplication.

## Business Rules

- `BR-03-01`: Dashboard is the private starting point.
- `BR-03-02`: `Pre-orders` stay conceptually grouped under purchases in MVP navigation.
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
