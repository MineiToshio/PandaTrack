---
id: FDD-04
type: FDD
slug: public-legal-transparency
title: Public Legal & Transparency — Feature Design Document
status: ACTIVE
parent: FRD-04
last_updated: 2026-06-16
prototype: ./prototype/public-legal-transparency.html
design_system: ../../../design/README.md
demo_anchors:
  - "#s11-legal-privacy"
  - "#s11-legal-terms"
  - "#s11-legal-privacy-mobile"
---

# FDD-04 · Public Legal & Transparency — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-04, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/public-legal-transparency.html`](./prototype/public-legal-transparency.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to the public legal documents, and **cites the prototype** for the exact pixel. When this
> FDD and the design system disagree on a system-wide rule, `docs/design/` wins. When this
> FDD and the prototype disagree on a legal-specific visual, the prototype wins until this
> FDD is corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The legal body is **not** reproduced
> here — it lives verbatim in i18n (`src/i18n/locales/{es,en}/privacy.json` and
> `terms.json`, FR-04-03) and is summarized structurally below.

---

## 1. Overview & screens covered

Public Legal & Transparency is the pair of **standalone public documents** — the privacy
policy and the terms of service — that back PandaTrack's pre-release trust and compliance
posture. Unlike every collector workspace, these pages live **outside the App Shell**: there
is no sidebar, no app topbar, no breadcrumb. They are long-form reading documents, reachable
from the landing footer and from the app's `ShellAccountMenu`, so a single design serves both
the logged-out and logged-in entry points.

The primary design constraint is **legibility, not interaction.** These are static,
SSR-delivered documents with one job — be readable and trustworthy — so the design leads with
a narrow reading column, clear heading hierarchy, and a table of contents, and deliberately
omits the dense chrome and stateful affordances of the product surfaces. The redesign was a
**presentation-only** pass: the content still comes verbatim from i18n and no functional
requirement changed (see [`frd-04-public-legal-transparency.md`](./frd-04-public-legal-transparency.md)).

### Screens in this FDD

| #   | Screen                     | Route               | Prototype anchor            |
| --- | -------------------------- | ------------------- | --------------------------- |
| 1   | Privacy policy (desktop)   | `/{locale}/privacy` | `#s11-legal-privacy`        |
| 2   | Terms of service (desktop) | `/{locale}/terms`   | `#s11-legal-terms`          |
| 3   | Privacy policy (mobile)    | `/{locale}/privacy` | `#s11-legal-privacy-mobile` |

The privacy document carries **12 sections** (anchor ids `#whoWeAre … #contact`); the
terms document carries **9** (`#acceptance … #contact`). The mobile variant renders
the privacy document and intentionally **drops the table of contents** (see §7).

Requirements traced throughout: `FR-04-01 … FR-04-05`, `AC-04-01 … AC-04-03` (see
[`frd-04-public-legal-transparency.md`](./frd-04-public-legal-transparency.md)). The pages
consume system tokens directly and introduce a long-form document layout that exists nowhere
else in the product.

---

## 2. Layout & structure per screen

These pages do **not** use the App Shell. They use the public chrome (`mk-minibar`) over a
single centered reading column. The chrome (`mk-*` minibar, logo, lang switch, theme toggle)
is system landing chrome and is not redefined here; only the `legal-doc` column is specific
to this FRD.

### 2.1 Document shell (`#s11-legal-privacy`, `#s11-legal-terms`)

Vertical rhythm, top to bottom:

```
mk-minibar (public)   mk-brand "P PandaTrack" (home) · spacer · ES/EN · theme toggle
legal-doc             centered reading column, max-width 760px
  legal-back (top)    "← Volver al inicio"  (back to localized home — FR-04-05)
  legal-head          mk-eyebrow chip "Legal" · <h1> · legal-updated date line
  legal-intro         opening paragraph
  legal-toc           "En esta página" — 2-column ordered index of internal anchors
  legal-section × N    plain <h2> + body paragraph(s)
  legal-back (bottom) "← Volver al inicio"  (repeated)
```

The whole document is a single `legal-doc` column, **`max-width: 760px`, centered**
(`margin: 0 auto`), with desktop padding `52px 20px 80px` (`36px 20px 64px` below `768px`) —
verified in the prototype's `.legal-doc` rule. This is the durable distinguishing geometry:
a tight measure tuned for reading, not the wide content grids of the product.

**`legal-back`** is an inline back-link (`arrow-left` icon + `"Volver al inicio"`) rendered
twice — once above the head and once after the last section (`margin-top: 32px`) — so the
return route is reachable from either end of a long scroll. It points to the localized home
(FR-04-05 / AC-04-03).

**`legal-head`** is the document masthead, separated from the body by a `1px solid var(--border)`
underline (`padding-bottom: 24px`):

1. `mk-eyebrow` chip `"Legal"` — `shield` icon for privacy, `scroll-text` icon for terms.
2. `<h1>` title — `clamp(28px, 4vw, 38px)`, weight 700, tight tracking (`-0.02em`).
   Privacy: `"Política de privacidad"`. Terms: `"Términos de servicio"`.
3. `legal-updated` — a `calendar` icon + `"Última actualización: febrero de 2026"` in
   `--text-muted` (the real date carried verbatim from i18n).

**`legal-intro`** is the opening paragraph at the largest body size (`16px`,
`--text-secondary`, `line-height 1.6`), setting the document's tone before the index.

**`legal-toc`** (`<nav aria-label="Secciones">`) is a bordered card on `var(--surface)`
(`border-radius: 14px`, `padding: 16px 18px`): a `JetBrains Mono` uppercase micro-label
`"En esta página"` over an `<ol>` laid out in **2 columns** (`columns: 2; column-gap: 28px`)
of internal anchor links. Each `<li>` links to a `legal-section` id.

**`legal-section`** repeats N times: a plain (unnumbered) `<h2>` (`19px`, weight 600) followed
by one or more body paragraphs (`15px`, `--text-secondary`, `line-height 1.65`). Headings are
plain title text from i18n with no number prefix and no CSS counter (for example `"Quiénes
somos"`, `"Tus derechos"`); the only numbering shown is the auto-numbering of the table-of-contents
`<ol>`. The anchor target is the `<section id={key}>`, which carries a `scroll-mt-20` offset so an
anchored jump lands with a gap above it; the minibar is not sticky.

### 2.2 Privacy vs terms — the only content divergence

The two documents share the identical `legal-doc` skeleton; they differ only in eyebrow icon,
title, and the section list:

| Document | Eyebrow icon  | Sections | Anchor range             |
| -------- | ------------- | -------- | ------------------------ |
| Privacy  | `shield`      | 12       | `#whoWeAre … #contact`   |
| Terms    | `scroll-text` | 9        | `#acceptance … #contact` |

Privacy sections (verbatim `es` headings, plain text — no number prefix): `Quiénes somos`,
`Datos que recogemos`, `Cómo usamos tus datos`, `Base legal (EEE/Reino Unido)`, `Compartir
datos y terceros`, `Conservación`, `Tus derechos`, `Cookies y tecnologías similares`,
`Seguridad`, `Menores`, `Cambios en esta política`, `Contacto`.

Terms sections: `Aceptación de los términos`, `Descripción del servicio`, `Requisitos y
cuenta`, `Uso aceptable`, `Propiedad intelectual`, `Privacidad`, `Exención de responsabilidad
y limitación`, `Cambios en los términos`, `Contacto`.

---

## 3. Visual treatment

The legal documents introduce **no new tokens, palettes, or surfaces.** They consume the
Velvet system as-is; the only thing specific to this FRD is a long-form document layout. The
definitions live in [visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD               | Token / class      | Where                                  |
| ------------------------------ | ------------------ | -------------------------------------- |
| Document body text             | `--text-secondary` | intro, section paragraphs, TOC links   |
| Headings (h1 / h2)             | `--text-primary`   | `legal-head h1`, `legal-section h2`    |
| Updated-date line              | `--text-muted`     | `legal-updated`                        |
| TOC card surface               | `--surface`        | `legal-toc` background                 |
| Dividers / TOC border          | `--border`         | `legal-head` underline, `legal-toc`    |
| Eyebrow + link/back-link hover | `--accent`         | `mk-eyebrow`, TOC `a:hover`, back-link |

There is no status color, no destructive register, no surface-accent (`s8-card-*`) system on
these pages — they are intentionally quieter than the product. The eyebrow chip is the only
accent-tinted element; everything else is the neutral reading palette.

### 3.2 Typography (long-form reading)

This is where the FRD is most specific. The legal layout uses a dedicated reading ramp tuned
for long prose rather than the dashboard/detail ramps:

- **Title (`h1`)**: `clamp(28px, 4vw, 38px)`, weight 700, tracking `-0.02em`.
- **Section heading (`h2`)**: `19px`, weight 600, tracking `-0.01em`.
- **Lead paragraph (`legal-intro`)**: `16px`, `line-height 1.6`.
- **Body paragraph**: `15px`, `line-height 1.65` — generous leading for sustained reading.
- **Reading measure**: the `760px` column keeps the line length comfortably under the
  ~70ch target for legibility (workshop §8, [interface-patterns.md](../../../design/interface-patterns.md)).
- **Micro-labels**: the TOC heading and updated-date use small sizes; the TOC `"En esta
página"` label is **JetBrains Mono** uppercase with wide tracking, the system's mono code
  treatment ([ADR 0007](../../../design/decisions/0007-text-muted-outdoor-code-mono-reassignment.md)).

### 3.3 Shape, radius & elevation

Standard system values, no overrides: the TOC card uses `border-radius: 14px` on `--surface`
with a `--border` outline (border-first elevation, the system is border-led not shadow-led).
The masthead and document are separated by hairline `--border` rules rather than shadows.

---

## 4. Components consumed

The legal pages are an **assembly of public chrome + a long-form document layout**; there are
no product primitives here. The catalog entries are in
[components.md](../../../design/components.md).

| Component / pattern          | Tier    | Role in FRD-04                                                  |
| ---------------------------- | ------- | --------------------------------------------------------------- |
| `mk-minibar` (public chrome) | module  | logo-home + lang switch + theme toggle (no app shell)           |
| `Logo` (brand mark)          | core    | `"P PandaTrack"` home link in the minibar                       |
| `mk-eyebrow`                 | core    | the `"Legal"` eyebrow chip (`shield` / `scroll-text`)           |
| Back-link (`legal-back`)     | pattern | `"← Volver al inicio"` to the localized home (FR-04-05)         |
| `legal-toc` nav              | pattern | in-page table of contents (this FRD's distinguishing component) |
| Theme toggle                 | module  | light / dark, inherited from public chrome                      |
| Locale switch (`mk-lang`)    | module  | ES / EN, inherited from public chrome                           |

In Phase B the layout is the existing `src/app/[locale]/_components/LegalPageLayout.tsx`,
consumed by `privacy/page.tsx` and `terms/page.tsx` (+ per-segment `opengraph-image.tsx`).
Content is injected from i18n; `buildPageMetadata` and OG support (FR-04-04) are preserved.
These are implementation contracts, not new design surfaces.

---

## 5. Interactions & states

### 5.1 Cross-cutting states

These pages are **static, SSR-rendered documents** sourced from i18n, so they have **no
loading, empty, or error states of their own** — there is nothing to fetch, paginate, or
mutate. Route-level error / 404 are system screens and live in `docs/design`, not here. This
absence is deliberate, not an omission.

### 5.2 In-page navigation (the table of contents)

The one meaningful interaction is **anchored navigation**: each `legal-toc` link targets a
`legal-section` id. Following a link scrolls to that section; the `<section>` (the anchor target)
carries a `scroll-mt-20` offset so the landed section sits with a gap above it rather than pinned
flush to the viewport top. The minibar is not sticky/fixed — it scrolls away with the page.
TOC links and the back-link tint to `--accent` on hover.

### 5.3 Back to home (FR-04-05 / AC-04-03)

Both `legal-back` links and the minibar `mk-brand` logo return to the **localized** home
(`/{locale}`), preserving the active locale. This is the only route exit from a legal page.

### 5.4 Motion

Inherited entirely from the system — see [motion.md](../../../design/motion.md). Anchored
scrolling, link hover transitions, and theme switching follow system motion and the
reduced-motion contract; there are no FRD-specific animations.

---

## 6. Copy & voice

The legal body copy is **formal and compliance-grade but written in the product's `es`
voice** — plain, reassuring, second-person ("tus datos", "tu cuenta"), never legalese for its
own sake. Voice principles live in [ux-copy.md](../../../design/ux-copy.md); the canonical
glossary (`pedido ↔ order`, `tienda ↔ store`, `envío ↔ shipment`) is enforced — see
[glossary.md](../../glossary.md). The full legal text is **not reproduced here**: it comes
verbatim from `src/i18n/locales/{es,en}/privacy.json` and `terms.json` (FR-04-03) and must not
be rewritten in the layout.

Chrome strings (es), by surface:

| Surface           | Tone       | String                                    |
| ----------------- | ---------- | ----------------------------------------- |
| Eyebrow chip      | label      | `"Legal"`                                 |
| Privacy title     | formal     | `"Política de privacidad"`                |
| Terms title       | formal     | `"Términos de servicio"`                  |
| Updated-date line | factual    | `"Última actualización: febrero de 2026"` |
| TOC heading       | wayfinding | `"En esta página"`                        |
| Back-link         | inviting   | `"Volver al inicio"`                      |

These chrome strings (eyebrow, "En esta página", "Volver al inicio") may live in `common`;
the section headings and body are the verbatim i18n content. EN equivalents already exist in
the locales — no new copy work for the redesign.

Tone rule for this FRD: the legal documents carry **no mascot** and no marketing flourish —
they read as a trustworthy reference, consistent with the quiet, formal-but-human register.

---

## 7. Responsive

Mobile-first; desktop is extra reading room. Breakpoint behavior is the system's — see
[interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-04 specifics:

- **Single-column always**: the `760px` `legal-doc` column already reads as a single stack, so
  there is no layout reflow between desktop and mobile beyond padding. The column padding
  tightens from `52px 20px 80px` (≥`768px`) to `36px 20px 64px` below.
- **Mobile minibar** (`#s11-legal-privacy-mobile`): the minibar compresses to a `56px` bar
  with `16px` side padding and a smaller brand; the locale switch is dropped to leave room,
  keeping only the theme toggle (per prototype). The back-link points to the mobile home.
- **TOC dropped on mobile** (`#s11-legal-privacy-mobile`): the two-column table of contents is
  **omitted** on the narrow viewport — the index would consume a full screen of vertical space
  before the reader reaches any content, so the document goes straight from `legal-intro` to
  the first `legal-section`. This is the one intentional structural difference between the
  desktop and mobile documents.
- **Title clamp**: the `h1 clamp(28px, 4vw, 38px)` scales the title down on narrow screens
  without a separate rule.

---

## 8. Accessibility (FRD-04 specifics)

Baseline is WCAG 2.2 AA in both themes. System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What matters
specifically for long-form legal documents:

- **Landmark + heading hierarchy**: the document is a `<main>` landmark with a single `<h1>`
  (document title) and sequential `<h2>` section headings — no skipped levels — so screen
  readers can navigate the document by heading.
- **Table of contents as navigation**: `legal-toc` is a `<nav aria-label="Secciones">`
  wrapping an `<ol>`; its anchor links are keyboard-operable with visible focus, giving a
  skip-to-content equivalent for a long page.
- **Anchored sections land with a gap**: the `scroll-mt-20` offset on each `<section>` (the
  anchor target) keeps a jumped-to section from being pinned flush to the viewport top, so
  keyboard/anchor users always land with breathing room above the heading.
- **Icon-only controls labelled**: the theme toggle buttons carry `aria-label` (`"Tema
claro"` / `"Tema oscuro"`); the back-link is text + icon (not icon-only).
- **Reading contrast & measure**: body text on `--text-secondary` is contrast-verified in
  light and dark; the `760px` column holds line length under ~70ch for comfortable reading.
- **No interactive traps**: the pages are static documents — there are no modals, focus
  traps, or live regions to manage.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/public-legal-transparency.html`](./prototype/public-legal-transparency.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). Anchors
  `#s11-legal-privacy`, `#s11-legal-terms`, `#s11-legal-privacy-mobile`.
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and ADR 0007.
- **Functional contract**: [`frd-04-public-legal-transparency.md`](./frd-04-public-legal-transparency.md)
  and its blueprint (`bp-01-legal-page-publishing`).
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the prototype are the durable record.
