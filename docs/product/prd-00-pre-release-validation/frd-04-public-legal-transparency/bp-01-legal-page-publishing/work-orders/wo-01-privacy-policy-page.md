---
id: WO-01
type: WORK_ORDER
slug: privacy-policy-page
title: Privacy Policy Page
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0006
implementation_status: IMPLEMENTED
---

# WO-01 Privacy Policy Page

## Summary

Publish PandaTrack's localized privacy policy with public routing and SEO support, rendered through the shared standalone legal-document layout (`LegalPageLayout`).

## In Scope

- privacy route (`/{locale}/privacy`) outside the App Shell
- localized section rendering via `PRIVACY_SECTION_KEYS` (12 sections) + `LegalPageLayout`
- localized metadata (`buildPageMetadata`) and per-segment OG image (`opengraph-image.tsx`)
- top + bottom back-to-home link, table of contents, sitemap entry

## Out of Scope

- jurisdiction-specific legal branching
- legal acceptance capture

## Requirements

- `FR-04-01`
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

- `/es/privacy` and `/en/privacy` render complete localized content
- back-to-home navigation preserves locale
