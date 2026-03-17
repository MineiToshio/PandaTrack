---
id: WO-01
type: WORK_ORDER
slug: privacy-policy-page
title: Privacy Policy Page
status: DONE
parent: BP-01
last_updated: 2026-03-16
source_features:
  - FEAT-0006
---

# WO-01 Privacy Policy Page

## Summary

Publish PandaTrack's localized privacy policy with public routing and SEO support.

## In Scope

- privacy route
- localized section rendering
- localized metadata

## Out of Scope

- jurisdiction-specific legal branching
- legal acceptance capture

## Requirements

- `FR-04-01`
- `FR-04-03`
- `FR-04-04`
- `FR-04-05`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- `/es/privacy` and `/en/privacy` render complete localized content
- back-to-home navigation preserves locale
