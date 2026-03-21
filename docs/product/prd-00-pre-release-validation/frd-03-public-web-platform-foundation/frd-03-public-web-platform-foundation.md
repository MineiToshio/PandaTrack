---
id: FRD-03
type: FRD
slug: public-web-platform-foundation
title: Public Web Platform Foundation
status: ACTIVE
parent: PRD-00
children:
  - BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0004
  - FEAT-0005
implementation_status: IMPLEMENTED
---

# FRD-03 Public Web Platform Foundation

## Overview

This FRD captures the platform capabilities that made PandaTrack's public web experience production-ready:

- locale routing and translation loading
- canonical metadata and OG generation
- sitemap and robots routes
- localized public metadata for landing and legal pages

## Functional Requirements

- `FR-03-01`: Public routes must support Spanish as default and English as an alternate locale.
- `FR-03-02`: Public copy must come from locale files instead of hardcoded strings.
- `FR-03-03`: Metadata generation must be localized and reusable.
- `FR-03-04`: Sitemap and robots routes must expose crawler-friendly outputs.
- `FR-03-05`: OG images must resolve through absolute URLs and locale-aware routes.
- `FR-03-06`: Canonical paths must avoid duplicate locale ambiguity for the default locale.

## Implementation Signals

- locale routing exists in `src/i18n/routing.ts`
- metadata helper exists in `src/lib/seo.ts`
- routes exist for `src/app/robots.ts`, `src/app/sitemap.ts`, and segment-level `opengraph-image.tsx`

## Acceptance Criteria

### `AC-03-01`

- Given a visitor opens `/` and `/en`
- When the pages render
- Then the content resolves in the expected locale.

### `AC-03-02`

- Given a public route generates metadata
- When metadata is built
- Then canonical, title, description, and OG values are locale-aware.

### `AC-03-03`

- Given crawlers request `robots.txt` and `sitemap.xml`
- When the routes resolve
- Then they expose the expected public outputs.

## Linked Blueprint

- `docs/product/prd-00-pre-release-validation/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/bp-01-localization-and-seo-platform.md`
