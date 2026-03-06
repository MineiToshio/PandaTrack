# Feature Packet - FEAT-0004 SEO Foundation (robots, sitemap, metadata, OG)

## 0) Metadata

- Feature ID: `FEAT-0004`
- Feature name: SEO foundation for localized landing and legal pages
- Owner: Product + Engineering
- Status: `Done` (retroactive documentation)
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: Next.js metadata APIs, `next-intl`, OG image routes
- Risk level: `Medium`

## 1) Product Requirements

### 1.1 Problem

Without structured SEO metadata and crawler-friendly outputs, discoverability and social sharing quality are reduced.

### 1.2 Goal

Provide robust SEO fundamentals: canonical URLs, localized metadata, sitemap, robots, and dynamic OG images.

### 1.3 Scope

- In scope:
  - `robots.ts`
  - `sitemap.ts`
  - Shared metadata builder (`buildPageMetadata`)
  - Absolute OG image URLs and route-level `opengraph-image.tsx`
- Out of scope:
  - Blog/content SEO strategy
  - Rich snippet strategy beyond current JSON-LD usage

## 2) Functional Requirements

- `FR-1`: Home, terms, and privacy pages generate localized metadata.
- `FR-2`: Canonical URL generation supports default and alternate locales.
- `FR-3`: Sitemap includes localized entries for main public routes.
- `FR-4`: Robots exposes `sitemap.xml` and allows indexing.
- `FR-5`: OG image URLs are absolute and locale-aware.

## 3) Data Contract (Spec-First)

### 3.1 Inputs

- Locale (`es`, `en`)
- Metadata namespace (`landing`, `terms`, `privacy`)
- Canonical path segment (`", "terms", "privacy")

### 3.2 Outputs

- `Metadata` object for Next.js pages
- `sitemap.xml` route output
- `robots.txt` route output
- Dynamic OG image endpoints

### 3.3 Persistence and data access

- No database persistence
- Reads translation keys for metadata and OG copy

## 4) UX + i18n Checklist

- SEO copy keys exist per locale namespace
- Shared links display localized OG previews

## 5) Acceptance Criteria (Testable)

- `AC-1`: `/sitemap.xml` returns entries for localized home/terms/privacy pages.
- `AC-2`: `/robots.txt` contains sitemap URL and allow rules.
- `AC-3`: Page metadata includes canonical + OG image URL per locale.
- `AC-4`: `/{locale}/opengraph-image` and legal-page OG image routes render correctly.

## 6) Test Plan

- Integration: snapshot metadata generation for both locales
- Manual validation: social debugger checks for OG image resolution
- Regression: default locale canonical path remains root (no duplicate `/es` canonical)

## 7) ADR Reference

- Requires ADR: `No`

## 8) Definition of Done

- Global DoD link: `docs/process/definition-of-done.md`
- Feature-specific DoD additions:
  - Absolute OG URLs verified in production environment

## 9) Open Questions

- Should we add `hreflang` alternates explicitly for every page variant?
