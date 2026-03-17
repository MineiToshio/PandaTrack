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
last_updated: 2026-03-16
implementation_status: IMPLEMENTED
---

# BP-01 Legal Page Publishing

## Purpose

Describe how PandaTrack publishes static-but-localized legal pages using route-level rendering, shared metadata helpers, and locale JSON sources.

## Runtime Components

- `src/app/[locale]/privacy/page.tsx`
- `src/app/[locale]/terms/page.tsx`
- locale files under `src/i18n/locales/{es,en}/{privacy,terms}.json`
- shared metadata helper in `src/lib/seo.ts`

## Architecture Notes

- Legal content is file-driven rather than CMS-driven.
- Legal routes depend on the public localization and SEO platform rather than reinventing metadata logic.

## Linked Work Orders

- `docs/product/prd-00-pre-release-validation/frd-04-public-legal-transparency/bp-01-legal-page-publishing/work-orders/wo-01-privacy-policy-page.md`
- `docs/product/prd-00-pre-release-validation/frd-04-public-legal-transparency/bp-01-legal-page-publishing/work-orders/wo-02-terms-of-service-page.md`
