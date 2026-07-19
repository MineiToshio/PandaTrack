---
id: WO-02
type: WORK_ORDER
slug: terms-of-service-page
title: Terms of Service Page
status: ACTIVE
parent: BP-01
last_updated: 2026-07-19
source_features:
  - FEAT-0007
implementation_status: IMPLEMENTED
---

# WO-02 Terms of Service Page

## Summary

Publish PandaTrack's localized terms of service page with the same public-web guarantees as the privacy page, reusing the shared `LegalPageLayout` parameterized for the terms namespace.

## In Scope

- terms route (`/{locale}/terms`) outside the App Shell
- localized section rendering via `TERMS_SECTION_KEYS` (10 sections, including a Peru governing-law clause) + `LegalPageLayout`
- localized metadata (`buildPageMetadata`) and per-segment OG image (`opengraph-image.tsx`)
- top + bottom back-to-home link, table of contents, sitemap entry

## Out of Scope

- explicit contract acceptance workflows
- regional terms branching

## Requirements

- `FR-04-02`
- `FR-04-03`
- `FR-04-04`
- `FR-04-05`
- `FR-04-06`
- `FR-04-07`
- `FR-04-08`
- `FR-04-09`
- `FR-04-10`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- `/es/terms` and `/en/terms` render complete localized content
- back-to-home navigation preserves locale
