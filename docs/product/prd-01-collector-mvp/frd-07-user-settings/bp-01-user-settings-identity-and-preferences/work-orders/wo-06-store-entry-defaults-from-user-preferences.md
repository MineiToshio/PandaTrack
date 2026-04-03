---
id: WO-06
type: WORK_ORDER
slug: store-entry-defaults-from-user-preferences
title: Store Entry Defaults from User Preferences
status: DRAFT
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-06 Store Entry Defaults from User Preferences

## Summary

Use saved user preferences to build the default `Stores` listing entry URL from the private navigation while preserving the current URL-driven listing behavior for direct navigation.

## In Scope

- app-navigation link generation for `Stores`
- reuse of current listing query-string parameters
- mapping preferred country and preferred product types into default filters
- preserving direct URL entry and manual query-string overrides
- doc alignment with store-domain discovery behavior

## Out of Scope

- changes to store moderation
- store create/edit behavior
- recommendation ranking
- onboarding flow

## Requirements

- `FR-07-27`
- `FR-07-28`

## Blueprints

- `BP-01` URL-canonical preference-consumption decision

## E2E Acceptance Tests

- Entering `Stores` from the app navigation uses the user's saved country and preferred product types in the generated URL.
- Entering `Stores` directly by URL without query params still loads the unfiltered listing.
- Entering `Stores` with manual query params preserves those query params instead of replacing them with saved defaults.
