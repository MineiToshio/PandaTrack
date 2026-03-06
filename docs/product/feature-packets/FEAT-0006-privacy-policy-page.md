# Feature Packet - FEAT-0006 Privacy Policy Page

## 0) Metadata

- Feature ID: `FEAT-0006`
- Feature name: Public privacy policy page
- Owner: Product + Legal + Engineering
- Status: `Done` (retroactive documentation)
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: legal locale files, legal page layout, SEO metadata
- Risk level: `Medium`

## 1) Product Requirements

### 1.1 Problem

Users must understand what personal data is collected and how it is used before joining the waitlist.

### 1.2 Goal

Provide a clear, accessible, localized privacy policy page linked from the landing.

### 1.3 Scope

- In scope:
  - Public route `/{locale}/privacy`
  - Structured legal sections from locale files
  - SEO metadata and OG image support
- Out of scope:
  - Legal advice workflow
  - Jurisdiction-specific versions per region

## 2) Functional Requirements

- `FR-1`: Privacy page renders title, intro, last-updated, and section blocks.
- `FR-2`: Content is localized through `privacy.json` in both locales.
- `FR-3`: Page includes navigation back to home.
- `FR-4`: Metadata generated from localized privacy keys.

## 3) Data Contract (Spec-First)

### 3.1 Inputs

- Namespace: `privacy`
- Section keys list in page component
- Locale route parameter

### 3.2 Outputs

- Rendered legal content sections
- Metadata payload via shared SEO helper

### 3.3 Persistence and data access

- Content source: `src/i18n/locales/{locale}/privacy.json`
- No database persistence

## 4) UX + i18n Checklist

- Readable legal typography and spacing
- Section anchor ids and semantic headings
- Locale parity for all required keys

## 5) Acceptance Criteria (Testable)

- `AC-1`: `/es/privacy` and `/en/privacy` render complete policy content.
- `AC-2`: Missing section body line breaks are displayed as paragraphs.
- `AC-3`: Back-to-home link preserves locale.

## 6) Test Plan

- Integration: privacy page render in both locales
- Regression: section key changes remain aligned with translation files

## 7) ADR Reference

- Requires ADR: `No`

## 8) Definition of Done

- Global DoD link: `docs/process/definition-of-done.md`

## 9) Open Questions

- Should legal text versioning/changelog be stored separately for compliance traceability?
