---
id: WO-02
type: WORK_ORDER
slug: seo-and-social-metadata-foundation
title: SEO and Social Metadata Foundation
status: ACTIVE
parent: BP-01
last_updated: 2026-11-05
source_features:
  - FEAT-0004
implementation_status: IMPLEMENTED
---

# WO-02 SEO and Social Metadata Foundation

## Summary

Ship reusable SEO, canonical, OG image, sitemap, robots, and structured-data behavior for the public web.

## In Scope

- Centralized metadata builder (`buildPageMetadata`, `buildStoreDetailMetadata`)
- Canonical URL generation with `/es` and `/en` prefixes, shared by sitemap and JSON-LD
- Base URL resolution via `getSiteUrl()` (`NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → localhost)
- Per-segment `opengraph-image.tsx` routes (landing, terms, privacy)
- Shared `OgImageTemplate` Satori layout (1200×630, dark hero, three-tier font fallback)
- OG font loading helpers (`getOgFonts`, `getOgImageData`) in `src/lib/og.ts`
- Robots route with public Allow and private/access Disallow prefixes in both locales and without a locale
- Sitemap route (six entries: `/`, `/terms`, `/privacy` × 2 locales)
- JSON-LD structured data on the landing page (`WebSite` + `SoftwareApplication`)
- `noindex` support for `PENDING` stores via `buildStoreDetailMetadata`

## Out of Scope

- Blog SEO strategy
- Advanced rich-snippet expansion (breadcrumbs, article schema)
- Hreflang `<link rel="alternate">` tags beyond `alternates.canonical`

## Requirements

- `FR-03-03`
- `FR-03-04`
- `FR-03-05`
- `FR-03-06`
- `FR-03-09`
- `FR-03-10`
- `FR-03-11`

## Blueprints

- `BP-01`

## Implemented Artifacts

| File                                                       | What it delivers                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/lib/seo.ts`                                           | `buildPageMetadata`, `buildStoreDetailMetadata`, `buildCanonicalPath`, `getSiteUrl`, `PageCanonicalSegment` |
| `src/lib/og.ts`                                            | `getOgFonts`, `getOgImageData`, `OG_FONT_NAMES`, `OgFontDescriptor`                                         |
| `src/components/modules/OgImageTemplate.tsx`               | Shared Satori component: `OgImageTemplate`, `OG_IMAGE_WIDTH` (1200), `OG_IMAGE_HEIGHT` (630)                |
| `src/app/[locale]/opengraph-image.tsx`                     | Landing OG image route — namespace `landing`, Node.js runtime                                               |
| `src/app/[locale]/terms/opengraph-image.tsx`               | Terms OG image route — namespace `terms`, Node.js runtime                                                   |
| `src/app/[locale]/privacy/opengraph-image.tsx`             | Privacy OG image route — namespace `privacy`, Node.js runtime                                               |
| `src/app/robots.ts`                                        | `robots.txt`: public Allow and private/access Disallow, absolute sitemap URL                                      |
| `src/app/sitemap.ts`                                       | `sitemap.xml` — 6 entries across two locales                                                                |
| `src/app/[locale]/(landing)/_components/LandingJsonLd.tsx` | JSON-LD injection (`WebSite` + `SoftwareApplication`)                                                       |

## OG Font Loading Strategy

`getOgFonts()` loads five font files (Zilla Slab Highlight 700, Roboto Condensed 400/700, Open Sans 400/600) using a three-tier cascade:

1. `@fontsource` packages in `node_modules` (preferred — woff files on disk, no network dependency)
2. `public/fonts/` directory (populated by the `download-og-fonts` script)
3. Google Fonts API fetch with a legacy User-Agent to retrieve woff/ttf (not woff2, which Satori does not support)

`OgImageTemplate` receives a `fontsLoaded: { logo, title, body }` object and substitutes system-safe CSS font stacks (`system-ui, sans-serif` / `Georgia, serif`) when any family is absent, ensuring the image always renders.

## Acceptance Criteria

- All three OG entries export `generateStaticParams` for `routing.locales`; the six localized PNG routes appear as SSG in the production build and prerender manifest. `src/test/public-prerender-guard.test.ts` guards the exports.

- Public pages expose localized `title`, `description`, `alternates.canonical`, and `openGraph` metadata with correct absolute URLs.
- The landing page canonical for `es` is `https://pandatrack.app/es`; for `en` it is `https://pandatrack.app/en`. JSON-LD and sitemap use those same URLs.
- `/robots.txt` keeps the public site indexable, excludes every app/auth route family (including nested pages), and references the absolute sitemap URL. Exclusions exist under `/es`, `/en`, and without a prefix. Home, privacy, terms and their public OG images are not disallowed.
- `/sitemap.xml` lists exactly `/es`, `/es/terms`, `/es/privacy`, `/en`, `/en/terms`, and `/en/privacy`, with canonical URLs shared with metadata. `src/app/_tests/seoMetadata.test.ts` verifies these URLs, structured data, and crawler exclusions against the actual page inventory.
- OG image routes return 1200×630 PNG with locale-correct copy.
- The landing page HTML contains a `<script type="application/ld+json">` block with both `WebSite` and `SoftwareApplication` entries.
- A `PENDING` store detail page carries `robots: { index: false, follow: false }` in its metadata.
