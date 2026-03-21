---
id: WO-02
type: WORK_ORDER
slug: seo-and-social-metadata-foundation
title: SEO and Social Metadata Foundation
status: ACTIVE
parent: BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0004
implementation_status: IMPLEMENTED
---

# WO-02 SEO and Social Metadata Foundation

## Summary

Ship reusable SEO, canonical, OG, sitemap, and robots behavior for the public web.

## In Scope

- metadata builder
- canonical URL generation
- sitemap and robots routes
- OG image routing

## Out of Scope

- blog SEO strategy
- advanced rich-snippet expansion

## Requirements

- `FR-03-03`
- `FR-03-04`
- `FR-03-05`
- `FR-03-06`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Public pages expose localized metadata and canonical URLs
- `robots.txt` and `sitemap.xml` resolve correctly
