---
id: FRD-03
type: FRD
slug: public-web-platform-foundation
title: Public Web Platform Foundation
status: ACTIVE
parent: PRD-00
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0004
  - FEAT-0005
implementation_status: IMPLEMENTED
---

# FRD-03 Public Web Platform Foundation

## Overview

This FRD captures the platform capabilities that make PandaTrack's public web experience production-ready:

- locale routing and translation loading (next-intl, `es` default / `en` alternate)
- canonical metadata and OG generation (`buildPageMetadata`, `buildStoreDetailMetadata`)
- OG image rendering via per-segment `opengraph-image.tsx` routes backed by `OgImageTemplate` and `getOgImageData`
- structured data (JSON-LD) injection on the landing page
- sitemap and robots routes
- middleware-level auth guard that redirects unauthenticated visitors from private localized paths to sign-in

This FRD is infra-only — it has no user-facing screens of its own. Visual treatment of the landing and legal pages is owned by their respective FRDs. No FDD or prototype exists for this FRD.

## Linked Blueprint

`docs/product/prd-00-pre-release-validation/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/bp-01-localization-and-seo-platform.md`

---

## Functional Requirements

- `FR-03-01`: Public routes must support Spanish as default and English as an alternate locale. The default locale (`es`) renders without a locale prefix (`/`, `/terms`, `/privacy`); the English locale renders under `/en`.
- `FR-03-02`: User-facing copy must come from locale files instead of hardcoded strings. Locale message files are loaded per-segment in `src/i18n/request.ts`; the supported namespaces are `common`, `landing`, `terms`, `privacy`, `auth`, `dashboard`, `appLayout`, `stores`, `storeListing`, `countries`, `storeProductTypes`, `settings`, `orders`, `orderListing`, `deliveries`, and `components`.
- `FR-03-03`: Metadata generation must be localized and reusable. `buildPageMetadata` in `src/lib/seo.ts` accepts a locale, a namespace, a path segment, and translation keys, and produces `title`, `description`, `alternates.canonical`, and `openGraph` fields in one call. `buildStoreDetailMetadata` covers the public store detail page including the `noindex` rule for `PENDING` stores.
- `FR-03-04`: Sitemap and robots routes must expose crawler-friendly outputs. `src/app/sitemap.ts` lists all public locale variants of `/`, `/terms`, and `/privacy` with correct `changeFrequency` and `priority` values. `src/app/robots.ts` allows all user agents and points to the absolute sitemap URL.
- `FR-03-05`: OG images must resolve through absolute URLs and locale-aware routes. A private (non-exported) `getOgImageUrl` helper in `src/lib/seo.ts` constructs the full URL (using `getSiteUrl()`) for each page's OG image; it is consumed internally by `buildPageMetadata` and is not part of the module's public API. `ImageResponse` routes are placed at segment level: `src/app/[locale]/opengraph-image.tsx` (landing), `src/app/[locale]/terms/opengraph-image.tsx`, and `src/app/[locale]/privacy/opengraph-image.tsx`. All three use the Node.js runtime so fonts can be read from disk before render.
- `FR-03-06`: Canonical paths must avoid duplicate locale ambiguity for the default locale. `buildCanonicalPath` in `src/lib/seo.ts` omits the locale prefix for `es` and adds `/{locale}` only for alternates. The root locale layout sets `metadataBase` via `getSiteUrl()` and the per-page `generateMetadata` calls set explicit `alternates.canonical` URLs.
- `FR-03-07`: The middleware must protect private routes for unauthenticated visitors. `src/proxy.ts` inspects the session cookie for requests to any of `/dashboard`, `/orders`, `/deliveries`, `/payments`, `/budget` (under any locale); if no session token is present the visitor is redirected to the locale-scoped sign-in page with a `returnTo` query parameter encoding the original URL.
- `FR-03-08`: A legacy `/purchases` route must redirect permanently to `/orders`. The middleware redirects `/{locale}/purchases/*` to `/{locale}/orders/*` with HTTP 308.
- `FR-03-09`: The landing page must inject structured data (JSON-LD) for `WebSite` and `SoftwareApplication` schema types. `LandingJsonLd` in `src/app/[locale]/(landing)/_components/LandingJsonLd.tsx` renders both objects with the canonical home URL; only the `WebSite` object carries a locale-aware `inLanguage` value (the `SoftwareApplication` object has no `inLanguage`).
- `FR-03-10`: OG image rendering must degrade gracefully when network fonts are unavailable. `getOgFonts` in `src/lib/og.ts` attempts fonts from `@fontsource` packages in `node_modules`, then falls back to `public/fonts/`, then falls back to Google Fonts. The cascade is all-or-nothing per tier — it advances to the next tier only when the current tier returns zero fonts, not per individual font. Each `OgImageTemplate` invocation receives a `fontsLoaded` flag and substitutes system-safe fallbacks when any font family is absent.
- `FR-03-11`: The base URL used for canonical URLs, OG tags, the sitemap, and the JSON-LD `url` field must derive from `NEXT_PUBLIC_SITE_URL` (preferred in production), then from `VERCEL_URL`, then fall back to `http://localhost:3000`. The production value is `https://pandatrack.app`.

## Business Rules

- `BR-03-01`: `es` is the default locale; it never appears as a URL prefix. `/` and `/es` both resolve to Spanish, but canonical is always the prefix-free form.
- `BR-03-02`: Locale detection is enabled in the middleware (`localeDetection: true`), so a visitor arriving at `/` without a cookie or `Accept-Language` header is served the default locale.
- `BR-03-03`: The locale layout (`src/app/[locale]/layout.tsx`) validates the `locale` param against `routing.locales`; an unknown locale segment resolves to 404 via `notFound()`.
- `BR-03-04`: The title template at the root layout level is `%s | PandaTrack`. The landing page overrides with `absoluteTitle: true` to prevent "PandaTrack | PandaTrack" duplication.
- `BR-03-05`: `PENDING` stores must carry a `robots: { index: false, follow: false }` directive. This is implemented in `buildStoreDetailMetadata` via the `noindex` flag.
- `BR-03-06`: The sitemap includes only public locale variants of `/`, `/terms`, and `/privacy`. App shell and authenticated routes are excluded.
- `BR-03-07`: The auth redirect preserves the full original URL (pathname + query string) in the `returnTo` parameter; it never exposes session tokens or private data in that parameter.

## Acceptance Criteria

### `AC-03-01`

- Given a visitor opens `/`
- When the page renders
- Then content resolves in Spanish (default locale) without a locale prefix in the URL.

### `AC-03-02`

- Given a visitor opens `/en`
- When the page renders
- Then content resolves in English with locale-aware navigation.

### `AC-03-03`

- Given a public route generates metadata
- When metadata is built
- Then `title`, `description`, `alternates.canonical`, and `openGraph` fields are all locale-aware and point to the correct absolute URL.

### `AC-03-04`

- Given crawlers request `/robots.txt`
- When the route resolves
- Then it allows all user agents and references the absolute sitemap URL.

### `AC-03-05`

- Given crawlers request `/sitemap.xml`
- When the route resolves
- Then it lists `/`, `/terms`, and `/privacy` for both `es` (prefix-free) and `en` locales.

### `AC-03-06`

- Given a social crawler requests an OG image for the landing, terms, or privacy page
- When the `opengraph-image` route renders
- Then it returns a 1200×630 PNG using the correct locale copy and fonts.

### `AC-03-07`

- Given an unauthenticated visitor navigates to any private localized route
- When the middleware runs
- Then the visitor is redirected to `/{locale}/sign-in?returnTo=<original-path>`.

### `AC-03-08`

- Given a visitor navigates to `/{locale}/purchases` or `/{locale}/purchases/*`
- When the middleware runs
- Then the visitor is redirected 308 to `/{locale}/orders` or `/{locale}/orders/*`.

---

## Platform Components

This section enumerates each implemented module with its file location, responsibility, and key behavior. It is the source of truth for "what lives where."

### Locale routing — `src/i18n/routing.ts`

Defines `locales: ["en", "es"]` and `defaultLocale: "es"` via `defineRouting`. This is the single shared config imported by the middleware, layouts, `sitemap.ts`, and `buildCanonicalPath`.

### Request config — `src/i18n/request.ts`

Runs per request via `getRequestConfig`. Loads all locale message namespaces dynamically (`await import(...)` per file), validates the `requestLocale` against `isLocale`, and defaults to `es`. Loads: `common`, `landing`, `terms`, `privacy`, `auth`, `dashboard`, `appLayout`, `stores`, `storeListing`, `countries`, `storeProductTypes`, `settings`, `orders`, `orderListing`, `deliveries`, `components`.

### Locale types — `src/types/locale.ts`

Exports the `Locale` type (derived from `routing.locales`) and the `isLocale(value)` type guard used by `request.ts` and other callers to validate locale strings.

### Middleware — `src/proxy.ts`

Handles three concerns in order: (1) legacy `/purchases` 308 redirect; (2) session-cookie auth guard for private routes (guards `ROUTES.dashboard`, `ROUTES.orders`, `ROUTES.deliveries`, `ROUTES.payments`, `ROUTES.budget` under any locale prefix; note `ROUTES.settings` is intentionally excluded from `PRIVATE_ROUTE_PREFIXES` and relies on an app-level session check rather than the middleware guard); (3) hands off to `next-intl` middleware (`createMiddleware`) for all other requests. Matcher: `["/", "/(es|en)/:path*"]`.

Unit-tested in `src/proxy.test.ts` (redirects unauthenticated private requests; lets authenticated ones through; skips auth check for public routes).

### Root locale layout — `src/app/[locale]/layout.tsx`

Sets `metadataBase`, the `%s | PandaTrack` title template, and the default description from `common.meta.description`. Validates the locale param and calls `notFound()` for unknown values. Sets `html[lang]` and includes the theme-init inline script to prevent flash-of-wrong-theme. Generates static params via `routing.locales`.

### SEO helpers — `src/lib/seo.ts`

- `getSiteUrl()`: resolves `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → `localhost:3000`.
- `buildCanonicalPath(locale, segment)`: returns `/{locale}/{segment}` for non-default locales; omits the prefix for `es`.
- `buildPageMetadata(opts)`: full `Metadata` object (title, description, `alternates.canonical`, `openGraph` with explicit `images` array). Accepts `absoluteTitle` to bypass the template.
- `buildStoreDetailMetadata(opts)`: variant for store detail pages; supports `noindex` for `PENDING` stores.
- `PageCanonicalSegment` union type: `""`, `"terms"`, `"privacy"`, `"dashboard"`, `"stores"`, `"orders"`, `"deliveries"`, `"orders/pre-orders"`, `"settings"`.

### OG image helpers — `src/lib/og.ts`

- `getOgFonts()`: loads all five font files (Zilla Slab Highlight 700, Roboto Condensed 400/700, Open Sans 400/600) from `@fontsource` → `public/fonts/` → Google Fonts. The fallback is all-or-nothing per tier: it advances to the next tier only when the current tier returns zero fonts. Returns `{ fonts, loaded }` where `loaded` has per-family booleans.
- `getOgImageData(locale, namespace)`: loads OG copy keys `ogEyebrow`, `ogHeadline`, `ogSubline` from the given locale namespace (`"landing"`, `"terms"`, or `"privacy"`), plus fonts.
- `OG_FONT_NAMES`: `{ logo: "Zilla Slab Highlight", title: "Roboto Condensed", body: "Open Sans" }`.
- `getOgLogoFont()`: deprecated; kept for backward compatibility.
- `LOGO_FONT_NAME`: exported alias for `OG_FONT_NAMES.logo`.
- Exported types: `OgFontDescriptor`, `OgFontsResult`, `OgImageData`, `OgImageNamespace`.

### OG image template — `src/components/modules/OgImageTemplate.tsx`

Hero-style Satori layout: 1200×630 px, dark background (`#0b0f14`), radial-gradient orbs, eyebrow pill (Roboto Condensed), headline with purple-to-cyan gradient (Roboto Condensed 700), subline (Open Sans). Falls back to system fonts when `fontsLoaded` flags are false. Brand colors are hardcoded inline hex (Satori does not support CSS variables).

### Per-segment OG image routes

All use `export const runtime = "nodejs"`.

| Route file                                     | Namespace | `alt` text                                                       |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `src/app/[locale]/opengraph-image.tsx`         | `landing` | `PandaTrack - Your command center for shopping and collectibles` |
| `src/app/[locale]/terms/opengraph-image.tsx`   | `terms`   | `Terms of Service - PandaTrack`                                  |
| `src/app/[locale]/privacy/opengraph-image.tsx` | `privacy` | `Privacy Policy - PandaTrack`                                    |

### Robots — `src/app/robots.ts`

Returns `{ rules: { userAgent: "*", allow: "/" }, sitemap: "<baseUrl>/sitemap.xml" }`.

### Sitemap — `src/app/sitemap.ts`

Iterates `routing.locales`. For the default locale (`es`) the URL prefix is empty; for `en` the prefix is `/en`. Publishes: `/` (priority 1, weekly), `/terms` (0.5, monthly), `/privacy` (0.5, monthly) — two locale variants each, six entries total.

### JSON-LD — `src/app/[locale]/(landing)/_components/LandingJsonLd.tsx`

Server component. Injects `WebSite` and `SoftwareApplication` schema objects. URL is the locale-aware home URL (prefix-free for `es`). Only `WebSite` carries `inLanguage` (`"es"` or `"en"`); `SoftwareApplication` carries `applicationCategory: "UtilitiesApplication"` and `operatingSystem: "Web"` instead.

---

## Analytics

No PostHog events are instrumented in this platform layer itself. Landing-page interaction events (CTA clicks, nav, FAQ, social links) are owned by the landing-page components under `src/app/[locale]/(landing)` and are namespaced `POSTHOG_EVENTS.LANDING` in `src/lib/constants.ts`:

| Constant key              | Event name                |
| ------------------------- | ------------------------- |
| `HERO_CTA_CLICKED`        | `hero_cta_clicked`        |
| `BANNER_CTA_CLICKED`      | `banner_cta_clicked`      |
| `HEADER_CTA_CLICKED`      | `header_cta_clicked`      |
| `MOBILE_MENU_OPENED`      | `mobile_menu_opened`      |
| `MOBILE_MENU_NAV_CLICKED` | `mobile_menu_nav_clicked` |
| `FAQ_ITEM_TOGGLED`        | `faq_item_toggled`        |
| `SOCIAL_LINK_CLICKED`     | `social_link_clicked`     |

These events are listed here for cross-FRD completeness. They are not owned by this infra FRD.

---

## Test Coverage

### Unit — `src/proxy.test.ts` (Vitest)

Three cases:

1. Unauthenticated request to a private localized route → 307 redirect to `/{locale}/sign-in?returnTo=...`
2. Authenticated request to a private localized route → forwarded to i18n middleware
3. Public route → forwarded to i18n middleware, no auth check

### E2E — `e2e/landing.spec.ts` (Playwright)

- Hero CTA navigates to `/en/sign-up`
- Header sign-in link navigates to `/en/sign-in`
- FAQ accordion: first item open by default; second item toggles correctly
- No waitlist form remains on the landing (regression guard)

No dedicated E2E spec covers robots/sitemap; those are verified manually or via integration build smoke tests.

---

## Environment Variables

| Variable               | Scope                    | Purpose                                                                                 |
| ---------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | public (client + server) | Canonical base URL; required in production. Production value: `https://pandatrack.app`. |
| `VERCEL_URL`           | server only              | Automatic Vercel deployment URL; used as fallback when `NEXT_PUBLIC_SITE_URL` is unset. |

Both variables are documented in `.env.example`.

---

## Out of Scope

- CMS-driven or runtime-editable translations
- Blog or article SEO (rich snippets, breadcrumbs, article schema)
- Hreflang alternate link tags beyond the `alternates.canonical` field
- Server-side per-user locale preferences (locale is route-based only)
- More than two locales
