---
id: WO-02
type: WORK_ORDER
slug: terms-of-service-page
title: Terms of Service Page
status: DONE
parent: BP-01
last_updated: 2026-03-16
source_features:
  - FEAT-0007
---

# WO-02 Terms of Service Page

## Summary

Publish PandaTrack's localized terms of service page with the same public-web guarantees as the privacy page.

## In Scope

- terms route
- localized section rendering
- localized metadata

## Out of Scope

- explicit contract acceptance workflows
- regional terms branching

## Requirements

- `FR-04-02`
- `FR-04-03`
- `FR-04-04`
- `FR-04-05`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- `/es/terms` and `/en/terms` render complete localized content
- back-to-home navigation preserves locale
