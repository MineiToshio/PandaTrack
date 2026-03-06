# Feature Packet - FEAT-0007 Terms of Service Page

## 0) Metadata
- Feature ID: `FEAT-0007`
- Feature name: Public terms of service page
- Owner: Product + Legal + Engineering
- Status: `Done` (retroactive documentation)
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: legal locale files, legal page layout, SEO metadata
- Risk level: `Medium`

## 1) Product Requirements
### 1.1 Problem
Users need transparent service terms before joining the waitlist or interacting with the product.

### 1.2 Goal
Provide a clear, localized, publicly accessible Terms of Service page.

### 1.3 Scope
- In scope:
  - Public route `/{locale}/terms`
  - Structured legal sections from locale files
  - SEO metadata and OG image support
- Out of scope:
  - Contract acceptance capture flow
  - Version-by-jurisdiction terms branching

## 2) Functional Requirements
- `FR-1`: Terms page renders title, intro, last-updated, and section blocks.
- `FR-2`: Content is localized through `terms.json` in both locales.
- `FR-3`: Page includes locale-preserving back-to-home links.
- `FR-4`: Metadata generated from localized terms keys.

## 3) Data Contract (Spec-First)
### 3.1 Inputs
- Namespace: `terms`
- Section keys list in page component
- Locale route parameter

### 3.2 Outputs
- Rendered legal content sections
- Metadata payload via shared SEO helper

### 3.3 Persistence and data access
- Content source: `src/i18n/locales/{locale}/terms.json`
- No database persistence

## 4) UX + i18n Checklist
- Semantic legal page structure via shared legal layout
- Locale parity for all legal keys

## 5) Acceptance Criteria (Testable)
- `AC-1`: `/es/terms` and `/en/terms` render complete terms content.
- `AC-2`: Paragraph splitting preserves readability for multi-paragraph sections.
- `AC-3`: Back links route to locale-specific home.

## 6) Test Plan
- Integration: terms page render in both locales
- Regression: section keys remain consistent with locale JSON

## 7) ADR Reference
- Requires ADR: `No`

## 8) Definition of Done
- Global DoD link: `docs/process/definition-of-done.md`

## 9) Open Questions
- Do we need explicit terms acceptance in future authenticated flows?
