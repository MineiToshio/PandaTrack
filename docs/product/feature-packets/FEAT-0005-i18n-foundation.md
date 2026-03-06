# Feature Packet - FEAT-0005 Internationalization Foundation

## 0) Metadata
- Feature ID: `FEAT-0005`
- Feature name: Locale routing and translation foundation
- Owner: Product + Engineering
- Status: `Done` (retroactive documentation)
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: `next-intl`, locale JSON files, middleware/proxy
- Risk level: `Low`

## 1) Product Requirements
### 1.1 Problem
Landing and legal pages need multilingual support for the target audience from day one.

### 1.2 Goal
Serve fully localized content and routing for Spanish (default) and English.

### 1.3 Scope
- In scope:
  - Locale routing (`es`, `en`) with default locale behavior
  - Per-namespace translation loading (`common`, `landing`, `terms`, `privacy`)
  - Locale-aware UI and links
- Out of scope:
  - CMS-driven translations
  - Runtime translation editing

## 2) Functional Requirements
- `FR-1`: Routes resolve under `/` (default locale) and `/{locale}`.
- `FR-2`: Invalid locales fall back to default locale behavior.
- `FR-3`: UI copy is sourced from locale JSON files, not hardcoded.
- `FR-4`: Metadata generation uses locale-specific translated keys.

## 3) Data Contract (Spec-First)
### 3.1 Inputs
- Request locale from route segment/middleware
- Translation key paths within namespaces

### 3.2 Outputs
- Localized string content delivered by `next-intl`

### 3.3 Persistence and data access
- Translation files under `src/i18n/locales/{es,en}`
- No database persistence

## 4) UX + i18n Checklist
- `es` and `en` namespaces aligned: `common`, `landing`, `terms`, `privacy`
- Locale switch and localized legal/home navigation present

## 5) Acceptance Criteria (Testable)
- `AC-1`: `/en` renders English copy; default route renders Spanish copy.
- `AC-2`: Legal pages render localized text and metadata in both locales.
- `AC-3`: Missing/invalid locale path falls back safely via configured routing behavior.

## 6) Test Plan
- Integration: locale route rendering for `es` and `en`
- Regression: new copy additions require mirrored keys in both locales

## 7) ADR Reference
- Requires ADR: `No`

## 8) Definition of Done
- Global DoD link: `docs/process/definition-of-done.md`
- Feature-specific DoD additions:
  - Any new user-facing copy ships in both `es` and `en`

## 9) Open Questions
- Do we need a third locale before app launch (e.g., Portuguese)?
