---
id: FRD-04
type: FRD
slug: public-legal-transparency
title: Public Legal Transparency
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0006
  - FEAT-0007
implementation_status: IMPLEMENTED
---

# FRD-04 Public Legal Transparency

## Overview

This FRD defines the public privacy and terms pages that support PandaTrack's pre-release trust and compliance posture. They are **standalone public documents** rendered outside the App Shell (no sidebar, no app topbar, no breadcrumb), reachable from the landing footer, the sign-up form, and the in-app account menu, so one design serves both logged-out and logged-in entry points.

These are **static, SSR-delivered, content-only** pages. They fetch nothing, mutate nothing, and persist no state — the entire body comes verbatim from i18n (`privacy.json` / `terms.json`, FR-04-03). The design constraint is legibility, not interaction; the visual and interaction design is owned by the [FDD](fdd-04-public-legal-transparency.md) and its [prototype](./prototype/public-legal-transparency.html). This functional doc fixes routing, content sourcing, metadata, and navigation behavior only.

> **Implementation note (redesign S11, 2026-06-15).** The privacy and terms pages were
> restyled to the standalone legal-document layout (`LegalPageLayout`: public minibar,
> back-link, eyebrow + updated-date head, intro, table of contents, sections).
> This was a **presentation-only** change — no functional requirement changed; content still
> comes verbatim from i18n (FR-04-03). The look-and-feel is documented in the FDD; the
> this was explored in the redesign subproject (historical).

## Current State

### Implemented

- Both legal pages ship under `/{locale}/privacy` and `/{locale}/terms` as public top-level routes (no auth, no `(app)` group, outside the App Shell). Locales: `es` (default, unprefixed canonical) and `en`.
- Both pages render through the shared `src/app/[locale]/_components/LegalPageLayout.tsx` (public minibar, top + bottom back-links, eyebrow + title + updated-date head, intro, table of contents, sections). The layout is a Server Component using next-intl hooks; there is no client boundary.
- Section structure is driven by an explicit ordered key list in each page (`PRIVACY_SECTION_KEYS` — 12 keys; `TERMS_SECTION_KEYS` — 9 keys). Each key resolves to a `{key}Title` and `{key}Body` pair in the namespace; the body string is split on blank lines into paragraphs.
- Localized metadata and per-segment OG images: `generateMetadata` calls `buildPageMetadata` (`src/lib/seo.ts`); each route has `opengraph-image.tsx` driven by `og*` i18n keys.
- Both routes are registered in `src/app/sitemap.ts` (`monthly`, priority `0.5`).
- Chrome strings live in the `common.legal` namespace (`eyebrow`, `backToHome`, `tableOfContents`); document content lives in the per-document namespaces.

### Known issues

- The FDD ([fdd-04](fdd-04-public-legal-transparency.md) §1, §2.2) describes the in-page anchor ids with placeholder names (`#priv-who … #priv-contact`, `#terms-accept … #terms-contact`). The shipped anchor ids are the camelCase section keys themselves (`#whoWeAre … #contact` for privacy; `#acceptance … #contact` for terms). See `contradictionsForHuman`.

## User Stories

### US-04-01 Read the privacy policy

As a visitor or user, I want to read PandaTrack's privacy policy in my language so I can understand what data is collected and why before trusting the product.

### US-04-02 Read the terms of service

As a visitor or user, I want to read the terms of service in my language so I understand the conditions of using PandaTrack.

### US-04-03 Return to the product

As a reader, I want a clear, always-reachable way back to the localized home page from either end of a long document.

## Functional Requirements

- `FR-04-01`: PandaTrack must publish a localized privacy policy page at `/{locale}/privacy`.
- `FR-04-02`: PandaTrack must publish a localized terms of service page at `/{locale}/terms`.
- `FR-04-03`: Both pages must render their entire body (title, last-updated line, intro, and every section) from locale files (`src/i18n/locales/{es,en}/{privacy,terms}.json`); no legal copy may be hardcoded in the layout. Section order is fixed by the page-level key list, not by JSON key order.
- `FR-04-04`: Both pages must produce locale-aware metadata — title, description, canonical URL, and Open Graph (including a per-segment dynamic OG image) — via the shared `buildPageMetadata` helper and the per-route `opengraph-image.tsx`.
- `FR-04-05`: Both pages must provide a clear route back to the localized home page (`/{locale}`), rendered both above the document head and after the last section.
- `FR-04-06`: Both pages must render through one shared standalone legal-document layout (`LegalPageLayout`), parameterized by namespace and ordered section keys, so privacy and terms stay structurally identical and diverge only in icon, title, and section list.
- `FR-04-07`: Each section body must be split on blank-line boundaries into separate paragraphs so multi-paragraph legal text renders as distinct `<p>` elements rather than one run-on block.
- `FR-04-08`: Both pages must render an in-page table of contents linking to every section anchor on the page, and each section must offset its scroll target so an anchored jump leaves a comfortable gap above the landed section rather than pinning it to the viewport top.
- `FR-04-09`: Both pages must be publicly reachable without authentication (no session, no App Shell) and must be listed in the sitemap.
- `FR-04-10`: Both pages must be discoverable from the standard entry points — the landing footer, the sign-up form consent line, and the in-app account menu — using the localized routes.

## Business Rules

- `BR-04-01`: Legal content is file-driven (i18n JSON), not CMS-driven or database-driven; updating a clause is a content edit in the locale files plus a `lastUpdated` change, never a code or schema change.
- `BR-04-02`: The privacy and terms documents share one layout and differ only by data: eyebrow icon (`shield` for privacy, `scroll-text` for terms), title, and the ordered section-key list.
- `BR-04-03`: Section headings are plain title text in i18n (e.g. `"Quiénes somos"`, `"Tus derechos"`) with no number prefix and no CSS counter. The only numbering shown is the auto-numbering of the table-of-contents `<ol>`; the `<h2>` section headings render unnumbered.
- `BR-04-04`: These pages carry no interactive product state — no loading, empty, error, or guard states of their own. Their only interaction is anchored in-page navigation plus the locale switch / theme toggle inherited from the public chrome.
- `BR-04-05`: The default locale (`es`) is served at the unprefixed canonical path; `en` is served prefixed. Both the metadata canonical and the sitemap entries follow this rule.

## Acceptance Criteria

### `AC-04-01`

- Given a user opens `/es/privacy` or `/en/privacy`
- When the page renders
- Then the complete localized privacy content is visible (title, last-updated line, intro, table of contents, and all 12 sections)

### `AC-04-02`

- Given a user opens `/es/terms` or `/en/terms`
- When the page renders
- Then the complete localized terms content is visible (title, last-updated line, intro, table of contents, and all 9 sections)

### `AC-04-03`

- Given the user follows either back-to-home link (top or bottom)
- When navigation occurs
- Then the route is the localized home (`/{locale}`) and preserves the active locale

### `AC-04-04`

- Given a section body in i18n contains a blank-line separator
- When the section renders
- Then each block becomes its own paragraph element

### `AC-04-05`

- Given the user activates a table-of-contents link
- When the page scrolls to that section
- Then the landed section's scroll target offset leaves a gap above it so the heading is not pinned flush to the viewport top

### `AC-04-06`

- Given a social or search crawler requests either page
- When it reads the document head
- Then it receives a localized title, description, canonical URL, and an absolute Open Graph image URL pointing to the per-segment `opengraph-image`

## Screens and Data Contract

Both routes live directly under `/{locale}` (public, outside the App Shell). There is no authentication, no session scoping, and no per-user data — so there are no guard, 403, or ownership states. Visual layout is owned by the [FDD](fdd-04-public-legal-transparency.md); this section fixes purpose, content source, and the (intentionally minimal) state surface.

### Privacy — `/{locale}/privacy`

- **Purpose:** the public privacy policy; trust/compliance reference reachable logged-out and logged-in.
- **Component:** `LegalPageLayout` with `namespace="privacy"` and `sectionKeys=PRIVACY_SECTION_KEYS` (`whoWeAre`, `dataWeCollect`, `howWeUse`, `legalBasis`, `sharing`, `retention`, `yourRights`, `cookies`, `security`, `children`, `changes`, `contact` — 12 sections).
- **Content source:** `privacy` namespace (`title`, `lastUpdated`, `intro`, and `{key}Title` / `{key}Body` per section) plus `common.legal` chrome strings. No queries, no server actions.
- **Metadata / OG:** `generateMetadata` → `buildPageMetadata({ locale, namespace: "privacy", pathSegment: "privacy", titleKey: "title", descriptionKey: "intro" })` (the shipped call also passes the resolved `locale`); `opengraph-image.tsx` → `getOgImageData(locale, "privacy")` rendering `OgImageTemplate` from `ogEyebrow` / `ogHeadline` / `ogSubline`.
- **States:** none beyond the rendered document. No loading/empty/error/guard/404 specific to this route (a missing-locale request is handled by the locale routing layer, not this page).

### Terms — `/{locale}/terms`

- **Purpose:** the public terms of service; same public-web guarantees as privacy.
- **Component:** `LegalPageLayout` with `namespace="terms"` and `sectionKeys=TERMS_SECTION_KEYS` (`acceptance`, `service`, `eligibility`, `conduct`, `ip`, `privacyRef`, `disclaimers`, `changes`, `contact` — 9 sections).
- **Content source:** `terms` namespace + `common.legal` chrome strings. No queries, no server actions.
- **Metadata / OG:** `generateMetadata` → `buildPageMetadata({ locale, namespace: "terms", pathSegment: "terms", titleKey: "title", descriptionKey: "intro" })` (the shipped call also passes the resolved `locale`); `opengraph-image.tsx` → `getOgImageData(locale, "terms")`.
- **States:** none beyond the rendered document (same as privacy).

### Shared layout contract (`LegalPageLayout`)

- **Props:** `namespace: "privacy" | "terms"`, `sectionKeys: readonly string[]`, `locale: string`.
- **Renders:** public minibar (`PublicMinibar`) → `<main class="legal-doc">` containing top back-link → head (`mk-eyebrow` with `shield`/`scroll-text` + `<h1>{title}` + `legal-updated` with `calendar` + `lastUpdated`) → `legal-intro` → `<nav aria-label>` table of contents (a visible `<h4>{tableOfContents}` heading over an `<ol>` of `#${key}` anchors) → one `<section id={key} aria-labelledby>` per key with a plain (unnumbered) `<h2>` and the blank-line-split body paragraphs → bottom back-link.
- **Back-link target:** `/${locale}${ROUTES.home}` (FR-04-05).
- **Anchor ids:** the section key string itself, set on each `<section id={key}>` (e.g. `#whoWeAre`, `#acceptance`); the `<section>` (the anchor target) carries `scroll-mt-20` so an anchored jump lands with a gap above it. The `<h2>` heading is not the jump target, so the separate `.legal-section h2 { scroll-margin-top }` CSS rule does not affect anchored jumps.

## State Model

Not applicable. These pages render static, file-sourced content and own no stateful entity, no lifecycle transitions, and no derived state. Theme and locale are global app concerns inherited from the public chrome, not state of this feature.

## Error Contract

No mutations exist in this feature, so there are no typed expected error codes. The only failure modes are infrastructural and handled outside this FRD:

- A request for an unsupported locale is resolved by the next-intl routing layer (`src/i18n/routing.ts` / `src/proxy.ts`), not by these pages.
- A missing i18n key would surface as a next-intl message-resolution error at build/runtime; the content contract (FR-04-03) requires every `{key}Title` / `{key}Body` pair to exist for each key in the page's section list.
- Route-level `not-found` / `error` boundaries are system screens (owned by `docs/design`), not redefined here.

## Analytics

This feature emits **no PostHog events**. The legal pages are static reading documents with no CTA, form, toggle, or mutation, so there is no meaningful clickable interaction to track, and `POSTHOG_EVENTS` (`src/lib/constants.ts`) defines no legal/privacy/terms namespace. Locale switch and theme toggle are public-chrome controls; their tracking, if any, belongs to the landing/chrome surface, not to FRD-04. This absence is intentional, not a gap.

## Confirmed

- privacy and terms are public pages outside the App Shell, served for both `es` and `en`
- all legal copy is file-driven from i18n; the layout never hardcodes legal text
- the two documents share one parameterized layout and differ only in icon, title, and section list
- both pages expose a localized back-to-home link at the top and bottom of the document
- the table of contents links to every section and anchored jumps leave a scroll-margin gap above the landed section
- the pages are reachable from the landing footer, the sign-up form, and the in-app account menu

## Out of Scope

- jurisdiction-specific or regional legal branching
- explicit legal-acceptance capture or contract-signing workflows
- CMS-driven or database-driven legal content
- cookie-consent banner / preference management (separate concern if introduced)
- versioned legal-document history beyond the single `lastUpdated` line

## Linked Blueprint

- `docs/product/prd-01-public-landing/frd-04-public-legal-transparency/bp-01-legal-page-publishing/bp-01-legal-page-publishing.md`
