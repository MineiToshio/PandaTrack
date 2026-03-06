# SEO Implementation Notes

## Purpose
Technical reference for SEO behavior across landing and legal pages.

## Current architecture
- Shared helper: `src/lib/seo.ts`
- Route outputs: `src/app/sitemap.ts`, `src/app/robots.ts`
- Locale metadata defaults: `src/app/[locale]/layout.tsx`
- OG image conventions: `docs/development/og-images.md`

## Implemented behavior
- Canonical URL generation by locale and path segment
- Localized metadata generation for landing, terms, privacy
- Absolute `og:image` URLs for social crawler compatibility
- Dynamic sitemap generation for localized public routes
- Robots declaration including sitemap URL

## Environment
- `NEXT_PUBLIC_SITE_URL` should be set in production for stable canonical and OG URLs.

## Validation checklist
- `/sitemap.xml` returns expected URLs.
- `/robots.txt` includes correct sitemap entry.
- Metadata in rendered HTML includes canonical and OG tags.
- Social link debuggers resolve the expected OG image URL.
