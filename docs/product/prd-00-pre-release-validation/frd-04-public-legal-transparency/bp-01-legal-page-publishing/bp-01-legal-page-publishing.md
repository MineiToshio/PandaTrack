---
id: BP-01
type: BLUEPRINT
slug: legal-page-publishing
title: Legal Page Publishing
status: ACTIVE
parent: FRD-04
children:
  - WO-01
  - WO-02
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# BP-01 Legal Page Publishing

## Purpose

Describe how PandaTrack publishes static-but-localized legal pages using route-level rendering, a shared standalone document layout, shared metadata/OG helpers, and locale JSON sources.

## Runtime Components

- `src/app/[locale]/privacy/page.tsx` — privacy route; defines `PRIVACY_SECTION_KEYS` (12) and `generateMetadata`
- `src/app/[locale]/terms/page.tsx` — terms route; defines `TERMS_SECTION_KEYS` (9) and `generateMetadata`
- `src/app/[locale]/_components/LegalPageLayout.tsx` — shared standalone legal-document layout (Server Component): public minibar, top/bottom back-link, eyebrow + title + updated-date head, intro, table of contents, sections (plain headings; only the TOC `<ol>` auto-numbers); splits each body on blank lines into paragraphs
- `src/app/[locale]/_components/public/PublicMinibar.tsx` — public chrome (logo-home, locale switch, theme toggle)
- `src/app/[locale]/privacy/opengraph-image.tsx` and `src/app/[locale]/terms/opengraph-image.tsx` — per-segment dynamic OG images via `getOgImageData` + `OgImageTemplate`
- locale files under `src/i18n/locales/{es,en}/{privacy,terms}.json` (document body + `og*` keys) and `common.legal` (chrome strings: `eyebrow`, `backToHome`, `tableOfContents`)
- shared metadata helper `buildPageMetadata` in `src/lib/seo.ts`
- `src/app/sitemap.ts` — registers both routes (`monthly`, priority `0.5`)

## Architecture Notes

- Legal content is file-driven rather than CMS-driven; updating a clause is an i18n + `lastUpdated` edit, never a code or schema change.
- Privacy and terms share one parameterized layout and diverge only in eyebrow icon, title, and the ordered section-key list passed by each page.
- Legal routes depend on the public localization and SEO platform rather than reinventing metadata logic; canonical/OG follow the default-locale-unprefixed rule from `buildCanonicalPath`.
- The pages are static SSR documents: no data access, no server actions, no client boundary, no analytics.

## Build Plan

1. `WO-01` — privacy route, localized sections, metadata + OG.
2. `WO-02` — terms route reusing the same layout, metadata + OG.

Both shipped; the redesign S11 pass factored the per-page markup into the shared `LegalPageLayout` without changing the functional contract.

## Linked Work Orders

- `docs/product/prd-00-pre-release-validation/frd-04-public-legal-transparency/bp-01-legal-page-publishing/work-orders/wo-01-privacy-policy-page.md`
- `docs/product/prd-00-pre-release-validation/frd-04-public-legal-transparency/bp-01-legal-page-publishing/work-orders/wo-02-terms-of-service-page.md`
