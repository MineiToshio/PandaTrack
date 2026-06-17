---
id: BP-01
type: BLUEPRINT
slug: localization-and-seo-platform
title: Localization and SEO Platform
status: ACTIVE
parent: FRD-03
children:
  - WO-01
  - WO-02
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# BP-01 Localization and SEO Platform

## Purpose

Describe the shared technical platform that serves localized public routes and reusable SEO metadata for PandaTrack's public web.

## Implemented Runtime Components

| File                                                       | Role                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/i18n/routing.ts`                                      | `defineRouting` config: `locales: ["en", "es"]`, `defaultLocale: "es"`              |
| `src/i18n/request.ts`                                      | Per-request locale validation and message namespace loading (16 namespaces)         |
| `src/proxy.ts`                                             | Next.js middleware: legacy redirect, auth guard for private routes, i18n hand-off   |
| `src/app/[locale]/layout.tsx`                              | Root locale layout: `metadataBase`, title template, locale guard, theme-init script |
| `src/lib/seo.ts`                                           | `buildPageMetadata`, `buildStoreDetailMetadata`, `buildCanonicalPath`, `getSiteUrl` |
| `src/lib/og.ts`                                            | `getOgFonts`, `getOgImageData`, `OG_FONT_NAMES`                                     |
| `src/components/modules/OgImageTemplate.tsx`               | Shared Satori layout for all OG images (1200×630, dark hero)                        |
| `src/app/[locale]/opengraph-image.tsx`                     | OG image for landing page (namespace: `landing`)                                    |
| `src/app/[locale]/terms/opengraph-image.tsx`               | OG image for Terms of Service (namespace: `terms`)                                  |
| `src/app/[locale]/privacy/opengraph-image.tsx`             | OG image for Privacy Policy (namespace: `privacy`)                                  |
| `src/app/robots.ts`                                        | `robots.txt` route — allows all, references absolute sitemap URL                    |
| `src/app/sitemap.ts`                                       | `sitemap.xml` route — 6 entries: `/`, `/terms`, `/privacy` × 2 locales              |
| `src/app/[locale]/(landing)/_components/LandingJsonLd.tsx` | JSON-LD `WebSite` + `SoftwareApplication` schema injection                          |

## Architecture Notes

- Localization is route-based (`[locale]` segment); the default locale `es` has no URL prefix.
- `localeDetection: true` in the middleware; `Accept-Language` triggers automatic locale inference on first visit.
- The locale layout validates the `locale` param against `routing.locales` and calls `notFound()` for invalid values.
- Metadata generation is centralized in `src/lib/seo.ts` to avoid per-page duplication. All pages call `buildPageMetadata` or `buildStoreDetailMetadata`; the root locale layout sets the shared title template and `metadataBase`.
- OG image routes are placed at the `[locale]` segment level (not inside route groups) to avoid Next.js App Router 404 edge cases with `opengraph-image` inside route groups.
- All OG image routes use `export const runtime = "nodejs"` so fonts can be read from disk before Satori renders.
- Font loading in `getOgFonts` has a three-tier fallback: `@fontsource` packages → `public/fonts/` → Google Fonts. This ensures OG images render even in offline or restricted environments.
- The middleware (`src/proxy.ts`) doubles as auth guard: it checks the `better-auth` session cookie before forwarding private routes, redirecting to `/{locale}/sign-in?returnTo=<original>` when no session is found.
- `NEXT_PUBLIC_SITE_URL` must be set in production. Its resolved value flows into canonical URLs, OG image URLs, the sitemap, and the JSON-LD `url` field via `getSiteUrl()`.

## Linked Work Orders

- `docs/product/prd-00-pre-release-validation/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/work-orders/wo-01-locale-routing-and-translation-baseline.md`
- `docs/product/prd-00-pre-release-validation/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/work-orders/wo-02-seo-and-social-metadata-foundation.md`
