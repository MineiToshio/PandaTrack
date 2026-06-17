---
id: WO-01
type: WORK_ORDER
slug: locale-routing-and-translation-baseline
title: Locale Routing and Translation Baseline
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0005
implementation_status: IMPLEMENTED
---

# WO-01 Locale Routing and Translation Baseline

## Summary

Establish route-level localization and translation loading for the public web.

## In Scope

- `es` default locale (no URL prefix)
- `en` alternate locale (prefix `/en`)
- Per-request locale validation and message namespace loading
- Locale-preserving navigation for public routes
- Middleware locale detection from `Accept-Language`
- Middleware auth guard for private routes
- Legacy `/purchases` → `/orders` permanent redirect (308)

## Out of Scope

- CMS-driven translations
- Runtime translation editing
- More than two locales

## Requirements

- `FR-03-01`
- `FR-03-02`
- `FR-03-07`
- `FR-03-08`

## Blueprints

- `BP-01`

## Implemented Artifacts

| File                          | What it delivers                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `src/i18n/routing.ts`         | `defineRouting({ locales: ["en", "es"], defaultLocale: "es" })`                  |
| `src/i18n/request.ts`         | Per-request locale guard + dynamic import of 16 message namespaces               |
| `src/proxy.ts`                | Middleware: legacy redirect, auth guard, i18n hand-off                           |
| `src/app/[locale]/layout.tsx` | Locale param validation, `html[lang]`, theme-init script, `generateStaticParams` |
| `src/types/locale.ts`         | `Locale` type + `isLocale` guard derived from `routing.locales`                  |

## Test Coverage

- Unit: `src/proxy.test.ts` — three Vitest cases covering unauthenticated redirect, authenticated pass-through, and public-route pass-through.
- E2E: `e2e/landing.spec.ts` — hero CTA navigates to `/en/sign-up`; header sign-in link navigates to `/en/sign-in` (implicitly validates both locale route and navigation).

## Acceptance Criteria

- `/` renders Spanish content by default, without a locale prefix in the URL.
- `/en` renders English content with correct navigation links.
- An unauthenticated visitor landing on `/{locale}/dashboard` is redirected to `/{locale}/sign-in?returnTo=/{locale}/dashboard`.
- `/{locale}/purchases/123` redirects 308 to `/{locale}/orders/123`.
