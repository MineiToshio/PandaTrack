---
id: FRD-04
type: FRD
slug: public-legal-transparency
title: Public Legal Transparency
status: ACTIVE
parent: PRD-00
children:
  - BP-01
last_updated: 2026-06-15
source_features:
  - FEAT-0006
  - FEAT-0007
implementation_status: IMPLEMENTED
---

# FRD-04 Public Legal Transparency

## Overview

This FRD defines the public privacy and terms pages that support PandaTrack's pre-release trust and compliance posture.

> **Implementation note (redesign S11, 2026-06-15).** The privacy and terms pages were
> restyled to the standalone legal-document layout (`LegalPageLayout`: public minibar,
> back-link, eyebrow + updated-date head, table of contents, numbered sections). This is
> a **presentation-only** change — no functional requirement changed; content still comes
> verbatim from i18n (`privacy.json` / `terms.json`, FR-04-03). See
> `docs/redesign/screens/legal.md`.

## Functional Requirements

- `FR-04-01`: PandaTrack must publish a localized privacy policy page.
- `FR-04-02`: PandaTrack must publish a localized terms of service page.
- `FR-04-03`: Both pages must render structured content from locale files.
- `FR-04-04`: Both pages must preserve locale-aware metadata and OG support.
- `FR-04-05`: Both pages must provide a clear route back to the localized home page.

## Acceptance Criteria

### `AC-04-01`

- Given a user opens `/es/privacy` or `/en/privacy`
- When the page renders
- Then the complete localized privacy content is visible.

### `AC-04-02`

- Given a user opens `/es/terms` or `/en/terms`
- When the page renders
- Then the complete localized terms content is visible.

### `AC-04-03`

- Given the user follows the back-to-home link
- When navigation occurs
- Then the route preserves the active locale.

## Linked Blueprint

- `docs/product/prd-00-pre-release-validation/frd-04-public-legal-transparency/bp-01-legal-page-publishing/bp-01-legal-page-publishing.md`
