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
last_updated: 2026-03-21
implementation_status: IMPLEMENTED
---

# BP-01 Localization and SEO Platform

## Purpose

Describe the shared technical platform that serves localized public routes and reusable SEO metadata.

## Runtime Components

- `src/i18n/routing.ts`
- `src/i18n/request.ts`
- `src/app/[locale]/layout.tsx`
- `src/lib/seo.ts`
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- public `opengraph-image.tsx` files

## Architecture Notes

- Localization is route-based and compatible with Next.js App Router.
- Metadata generation is centralized to avoid duplicated page-level logic.
- SEO outputs are built from runtime config and locale-aware path helpers.

## Linked Work Orders

- `docs/product/prd-00-pre-release-validation/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/work-orders/wo-01-locale-routing-and-translation-baseline.md`
- `docs/product/prd-00-pre-release-validation/frd-03-public-web-platform-foundation/bp-01-localization-and-seo-platform/work-orders/wo-02-seo-and-social-metadata-foundation.md`
