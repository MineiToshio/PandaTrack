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
last_updated: 2026-11-05
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
| `src/app/robots.ts`                                        | `robots.txt`: public Allow, private/access Disallow, absolute sitemap URL                    |
| `src/app/sitemap.ts`                                       | `sitemap.xml` route — 6 entries: `/`, `/terms`, `/privacy` × 2 locales              |
| `src/app/[locale]/(landing)/_components/LandingJsonLd.tsx` | JSON-LD `WebSite` + `SoftwareApplication` schema injection                          |

## Architecture Notes

- Localization is route-based (`[locale]` segment); both `es` and `en` use a URL prefix, including the default locale.
- `localeDetection: true` in the middleware; `Accept-Language` triggers automatic locale inference on first visit.
- The locale layout validates the `locale` param against `routing.locales` and redirects to `/es` for invalid values before translation initialization.
- Metadata generation is centralized in `src/lib/seo.ts` to avoid per-page duplication. All pages call `buildPageMetadata` or `buildStoreDetailMetadata`; the root locale layout sets the shared title template and `metadataBase`.
- OG image routes are placed at the `[locale]` segment level (not inside route groups) to avoid Next.js App Router 404 edge cases with `opengraph-image` inside route groups.
- All OG image routes use `export const runtime = "nodejs"` so fonts can be read from disk before Satori renders.
- Font loading in `getOgFonts` has a three-tier fallback: `@fontsource` packages → `public/fonts/` → Google Fonts. This ensures OG images render even in offline or restricted environments.
- The middleware (`src/proxy.ts`) doubles as auth guard: it checks the `better-auth` session cookie before forwarding private routes, redirecting to `/{locale}/sign-in?returnTo=<original>` when no session is found.
- `NEXT_PUBLIC_SITE_URL` must be set in production. Its resolved value flows into canonical URLs, OG image URLs, the sitemap, and the JSON-LD `url` field via `getSiteUrl()`.

## Public Prerendering Contract

- Each of the three `opengraph-image.tsx` entries independently exports `generateStaticParams` mapping `routing.locales` to `{ locale }`. Verify all six localized OG routes in the prerender manifest and SSG build table; their Node runtime and font fallback remain unchanged.

- Keep the existing locale `generateStaticParams` in `src/app/[locale]/layout.tsx`; do not duplicate enumeration in pages.
- After validating the locale, call the stable `setRequestLocale(locale)` export from `next-intl/server` before loading messages or rendering translated descendants. Load layout messages with `getMessages({ locale })`.
- The landing layout and the home, privacy, and terms page entry points also validate and initialize supported locales before rendering, because Next.js can render layouts and pages independently. These entry points return no content for invalid locales, leaving the redirect to the proxy or root locale layout. This prevents static-to-dynamic errors from translated descendants. The proxy handles invalid-prefix home, privacy, and terms paths before rendering; the root layout remains the guard for unmatched paths. This avoids Next.js duplicating Location on the first static fallback cache miss. Verify the initial production-mode HTTP response has exactly one Location, alongside proxy function and matcher tests. The locale cache is request-scoped through React, never shared session state.
- Verify six public HTML routes in the prerender manifest and SSG build table: `/es`, `/en`, `/es/privacy`, `/en/privacy`, `/es/terms`, and `/en/terms`. Dashboard, orders, settings, and stores must remain dynamic through their session reads. Do not use `force-static`.
- Preserve the existing invalid-prefix redirect to `/es` before layout translation initialization. The owner confirmed prefixed Spanish URLs; sitemap, canonical metadata and JSON-LD share `buildCanonicalPath` and include both locale prefixes. Routing is unchanged.

## Crawler Metadata Contract

`robots.ts` emits public Allow plus private/access Disallow prefixes in all locale forms, following FR-03-04. `sitemap.ts` enumerates only home, privacy and terms in both locales using `buildCanonicalPath`, also shared by canonical metadata and landing JSON-LD. The metadata contract test scans app/auth pages so newly added protected families require a matching crawler exclusion.

## Linked Work Orders

- `docs/product/prd-01-public-landing/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/work-orders/wo-01-locale-routing-and-translation-baseline.md`
- `docs/product/prd-01-public-landing/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/work-orders/wo-02-seo-and-social-metadata-foundation.md`
