---
id: FDD-01
type: FDD
slug: pre-release-landing
title: Pre-release Landing — Feature Design Document
status: ACTIVE
parent: FRD-01
last_updated: 2026-06-16
prototype: ./prototype/pre-release-landing.html
design_system: ../../../design/README.md
demo_anchors:
  - "#s11-landing"
  - "#s11-fit"
  - "#s11-feat"
  - "#s11-faq"
  - "#s11-landing-mobile"
---

# FDD-01 · Pre-release Landing — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-01, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/pre-release-landing.html`](./prototype/pre-release-landing.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to the Landing, and **cites the prototype** for the exact pixel. When this FDD and the
> design system disagree on a system-wide rule, `docs/design/` wins. When this FDD and
> the prototype disagree on a Landing-specific visual, the prototype wins until this FDD
> is corrected in the same change.
>
> **Scope note (go-live).** FRD-01's functional contract is marked `SUPERSEDED`: the
> pre-release waitlist was replaced by the **go-live landing with sign-up**. This FDD
> designs the **current go-live landing** as shipped in the prototype (every CTA points
> to `/sign-up`; the secondary action is `/sign-in`; there is **no waitlist form**). The
> superseded waitlist requirements (`FR-01-02 … FR-01-07`) are not designed here.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/landing.json`.

---

## 1. Overview & screens covered

The Landing is PandaTrack's **public front door**: the anonymous marketing surface that
explains the collector problem and converts visitors to sign-up. Unlike every other
documented feature, it lives **outside the App Shell** — there is no `Sidebar`, no
collector `Header`, no breadcrumb chrome. It is a **full-bleed marketing layout** that
consumes the Velvet design tokens but applies its own composition grammar (the `mk-*`
marketing classes, see [`./prototype/pre-release-landing.html`](./prototype/pre-release-landing.html)).
That paradigm difference — system tokens, marketing layout — is the primary design
constraint of this FRD.

The one deliberate signature element: **the hero "ventana-producto"** — a single
self-contained product window where one hero object (the collectible) travels the
lifecycle ribbon `Tienda → Pedido → Pago → Entrega` and converges on a "Tu colección"
dashboard panel. It carries the whole product story in one motion, and it is the feature's
defining visual (§5, §6 of the redesign spec; backed by the spec's referenced hero
deep-research, cited from the redesign subproject's landing copy deck (historical) — not the
research artifact itself).

### Screens in this FDD

| #   | Screen / section                  | Route            | Prototype anchor      |
| --- | --------------------------------- | ---------------- | --------------------- |
| 1   | Landing · desktop (full surface)  | `/{locale}`      | `#s11-landing`        |
| 2   | User-fit section (scroll target)  | `/{locale}#fit`  | `#s11-fit`            |
| 3   | Features section (scroll target)  | `/{locale}#feat` | `#s11-feat`           |
| 4   | FAQ section (scroll target)       | `/{locale}#faq`  | `#s11-faq`            |
| 5   | Landing · mobile (390px + burger) | `/{locale}`      | `#s11-landing-mobile` |

`#s11-landing` and `#s11-landing-mobile` are the two top-level demo surfaces; `#s11-fit`,
`#s11-feat`, and `#s11-faq` are in-page **smooth-scroll** targets reached from the nav and
footer (`data-s11-scroll`), enumerated here for the screens table and `demo_anchors`.

Requirements traced: `FR-01-01` (stable narrative section order) and `FR-01-08`/`BR-01-04`
(localized, anonymous-accessible) remain in effect; the waitlist requirements are
superseded (see [`frd-01-pre-release-landing.md`](./frd-01-pre-release-landing.md)).

---

## 2. Layout & structure per screen

This surface is **not** inside the App Shell. The page is a `mk-public` document made of a
sticky marketing header, a stack of full-bleed `mk-section` bands, and a `mk-footer`. Each
section is centered by a shared `mk-container`; full-bleed bands use the `mk-bleed` helper
(`width: 100vw` + negative side margins) **on desktop only** — the mobile phone frame never
uses it (anti-pattern §9 of the spec).

### 2.1 Narrative order (`#s11-landing`, FR-01-01)

Top to bottom, the stable narrative order (waitlist section removed at go-live):

```
mk-header (sticky top-0)   logo · nav · ES/EN · theme · "Iniciar sesión" · "Crear cuenta"
mk-hero                    eyebrow · H1 · sub · CTAs · trust line · ventana-producto
mk-section #s11-fit        user-fit: 3 collector-pain cards (mk-fit-grid)
mk-section.tinted #s11-feat features: 6 capability cards (mk-feature-grid)
mk-banner-section          full-width gradient CTA band → /sign-up
mk-section.tinted #s11-faq FAQ accordion (first item open)
mk-footer                  brand + tagline · columns (Producto/Cuenta/Legal) · copyright · social
```

> Production note: the `mk-header` is **sticky `top-0` in production** but is rendered
> non-sticky inside the demo so it does not collide with the demo's own `.demo-header`
> (spec §3/§9). Treat sticky as the shipped behavior.

### 2.2 Header & public minibar (`mk-header`)

A single `mk-header-inner` row: a `mk-brand` lockup (`mk-brand-mark` "P" tile + "PandaTrack")
on the left; a centered `mk-nav` (`aria-label="Navegación"`) with three in-page links —
`"Para quién"` → `#s11-fit`, `"Funciones"` → `#s11-feat`, `"Preguntas"` → `#s11-faq`; and a
right `mk-header-actions` cluster. The cluster is the **public minibar**: the language
toggle (`mk-lang`, ES/EN), the theme toggle (`mk-theme`, light/dark), then the two auth
controls — `"Iniciar sesión"` (`.btn ghost sm` → `/sign-in`) and `"Crear cuenta"`
(`.btn primary sm` → `/sign-up`). Below 900px the nav + actions collapse behind a
`mk-burger` that opens a side sheet (§5.4). The toggles are the public counterpart of the
app's in-shell theme/lang controls — same tokens, marketing chrome.

### 2.3 Hero (`mk-hero`)

A two-column `mk-hero-grid`: copy left, the ventana-producto right, over a radial
`mk-hero-glow` (accent wash, `aria-hidden`). The copy column (`mk-hero-copy`) stacks:

1. `mk-eyebrow` chip `"Para coleccionistas"` (`sparkles` icon) — decorative marketing
   eyebrow, **not** the §9.17 detail-eyebrow (anti-pattern §9 of the spec).
2. `<h1>` `"Toda tu colección, bajo control."` where `"bajo control"` is wrapped in
   `mk-grad-text` (the accent gradient). The headline names "colección" in large type by
   product decision (spec §3).
3. `mk-hero-sub` subtitle.
4. `mk-hero-cta`: `"Crear cuenta gratis"` (`.btn primary` → `/sign-up`) + `"Ver cómo
funciona"` (`.btn ghost`, smooth-scrolls to `#s11-feat`).
5. `mk-hero-trust` line with a `--success` `dot`: `"Gratis para empezar · Sin tarjeta"`.

The **ventana-producto** (`mk-hero-visual`) is the hero object — described in §5/§6.

### 2.4 User-fit (`#s11-fit`, `mk-fit-grid`)

`mk-eyebrow` `"El día a día de coleccionar"` + `<h2>` `"Tu colección crece. El desorden,
también."`, then **3 larger `mk-fit-card`s**, each with a `mk-fit-index` number, a
`mk-icon-tile`, a title, body copy, and a `mk-fit-bar` bottom bar tinted with the card's
`--tile` color that grows to full width on hover (`transform: translateY(-4px)` + the bar
animating to `width: 100%`). The three cards are the collector's pains: `"Pedidos por
todas partes"` (`--accent`), `"«¿Esto ya lo pagué?»"` (`--accent-warm`), `"Entregas que no
sabes dónde están"` (`--accent-cool`).

### 2.5 Features (`#s11-feat`, `mk-feature-grid`, `tinted`)

`mk-eyebrow` `"Todo en un solo lugar"` + `<h2>` `"Lo que necesitas para llevar tu
colección al día"`, then **6 `mk-feature-card`s** with per-card accent-tinted
`mk-icon-tile`s: `"Tiendas de confianza"`, `"Tus pedidos, ordenados"`, `"Pre-reservas sin
sorpresas"`, `"Entregas, incluso divididas"`, `"Avisos a tiempo"`, `"Todo de un vistazo"`.
The section sits on the system's `tinted` band surface.

### 2.6 Banner (`mk-banner-section`)

A **full-width gradient band**, edge-to-edge (decision A.2: a band, not a contained card,
for impact — spec §3). A centered `mk-banner-inner` carries `mk-eyebrow` `"Empieza hoy"`,
`<h2>` `"Tu colección merece estar en orden"`, body copy, and one `.btn primary`
`"Crear cuenta gratis"` (`arrow-right`) → `/sign-up`.

### 2.7 FAQ (`#s11-faq`, `mk-faq`, `tinted`)

`mk-eyebrow` `"Preguntas frecuentes"` + `<h2>` `"Lo que sueles preguntarte"`, then a
column of `mk-faq-item`s, each a `mk-faq-q` button (`data-s11-faq`, with a `chevron-down`
`chev`) over a `mk-faq-a` answer. **First item open by default** (§5.3).

### 2.8 Footer (`mk-footer`)

`mk-footer-top`: brand lockup + `mk-footer-tagline`, then `mk-footer-cols` with three
`mk-footer-col`s — **Producto** (Funciones/Preguntas, scroll), **Cuenta**
(Crear cuenta/Iniciar sesión), **Legal** (Privacidad/Términos). `mk-footer-bottom` carries
the `mk-footer-copy` copyright and `mk-footer-social` icons.

---

## 3. Visual treatment

The Landing introduces **no new tokens, palettes, or type ramps.** It consumes the Velvet
system as-is; the definitions live in
[visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md). What is Landing-specific is the **marketing
application** of those tokens (gradients, glows, full-bleed bands) and the `mk-*` class
layer that the App Shell never uses.

### 3.1 Color roles

| Role on the Landing                       | Token / treatment                                                                               | Where                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------- |
| Primary CTA (Crear cuenta / gratis)       | `--accent` (`.btn primary`)                                                                     | header, hero, banner, footer      |
| Secondary CTA (Iniciar sesión / Ver cómo) | ghost (`.btn ghost`)                                                                            | header, hero                      |
| Headline highlight gradient               | `--accent` / `--accent-warm` / `--accent-cool`                                                  | `mk-grad-text` on "bajo control"  |
| Hero ambient wash                         | radial accent glow                                                                              | `mk-hero-glow`                    |
| Section identity tints                    | `--accent` / `-warm` / `-cool` via `--tile`                                                     | `mk-icon-tile`, `mk-fit-bar`      |
| Banner band                               | accent gradient, edge-to-edge                                                                   | `mk-banner-section`               |
| Trust signal / "Entrega" station / chip   | `--success`                                                                                     | hero trust dot, journey station 4 |
| "Pendiente" stat / "Pre-reserva" chip     | `--warning`                                                                                     | dashboard panel                   |
| "En camino" chip                          | `--info`                                                                                        | dashboard panel                   |
| Tinted section bands                      | system `tinted` surface                                                                         | features, FAQ                     |
| Text / surface / border                   | `--text-primary/secondary/muted`, `--surface`, `--surface-elevated`, `--background`, `--border` | throughout                        |

Status chips reused in the dashboard panel keep the **icon + label** contract — color is
never the only carrier ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).

### 3.2 Typography

- Headlines (`<h1>`/`<h2>`): the system heading ramp; the H1 leads at marketing scale with
  the `mk-grad-text` span on `"bajo control"`. Mobile H1 is reduced (`32px` in the phone
  frame, per the prototype).
- Marketing eyebrows (`mk-eyebrow`) use uppercase-ish chip styling with a leading lucide icon.
- The hero ribbon caption (`mk-journey-cap`) and the dashboard badge (`mk-dash-badge`)
  render in **JetBrains Mono** at small sizes with wide tracking — the system's mono code
  treatment used here as a marketing micro-label.
- Stat/numeric values in the dashboard panel use the `.num` tabular treatment.

### 3.3 Shape, radius, elevation & gradients

Standard system values: cards at the standard radius, chips fully rounded, **border-first**
elevation with hover lift (`mk-fit-card:hover` → `translateY(-4px)` + `--shadow-2`).
Landing-specific expressive use of the system gradient/glow language: the `mk-grad-text`
headline gradient, the radial `mk-hero-glow`, and the full-bleed `mk-banner-section`
gradient band. These are restrained-gradient applications of Velvet's expressive accents,
not new surfaces.

---

## 4. Components consumed

This surface predates the React component catalog and is a **marketing layout**, so most of
its chrome is the bespoke `mk-*` layer rather than App Shell modules. Phase B maps the
recurring primitives onto the catalog ([components.md](../../../design/components.md));
the canonical mapping:

| Marketing element                      | Catalog target (Phase B)                                                               | Role on the Landing                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `.btn primary` / `.btn ghost`          | `Button` (core)                                                                        | all CTAs and auth actions                            |
| `mk-icon-tile` glyphs                  | lucide via `Icon` (core)                                                               | section/feature/journey icons                        |
| `mk-eyebrow` chip                      | marketing eyebrow (Landing-only)                                                       | decorative section label — **not** the §9.17 eyebrow |
| dashboard `chip warning` / `chip info` | `StatusChip` (core)                                                                    | "Pre-reserva" / "En camino" in the panel             |
| `mk-sheet` (burger)                    | `ModalSheet` pattern ([ADR 0008](../../../design/decisions/0008-modal-enhancement.md)) | mobile nav drawer (dialog semantics)                 |
| `mk-faq-item`                          | disclosure / accordion                                                                 | FAQ accordion                                        |
| `mk-lang` / `mk-theme`                 | public theme/language toggles                                                          | minibar controls                                     |
| `mk-brand` / `mk-brand-mark`           | `Logo` (core)                                                                          | brand lockup in header + footer                      |

The ventana-producto, journey ribbon, fit/feature/banner/footer bands have **no catalog
equivalent** — they are Landing-only marketing composition and are described by class name
against the prototype rather than mapped to a shared component.

---

## 5. Interactions & states

### 5.1 Section-level states

This is a static, SSR-delivered marketing page — there is **no loading state, no form, and
no success/share state** (the waitlist flow was removed at go-live; do not reintroduce it —
anti-pattern §9 of the spec). The only stateful surfaces are the FAQ accordion, the hero
motion, the hover treatments, and the mobile burger sheet. The CTAs simply navigate to
`/sign-up` and `/sign-in`.

### 5.2 Hover & in-page navigation

- **Card hover** (`mk-fit-card`): lift (`translateY(-4px)`), border-color shifts toward the
  card's `--tile`, and the `mk-fit-bar` grows to full width.
- **Smooth scroll**: nav links and the hero's `"Ver cómo funciona"` carry `data-s11-scroll`
  and scroll smoothly (with offset) to `#s11-fit` / `#s11-feat` / `#s11-faq`.

### 5.3 FAQ accordion (`mk-faq`)

Accessible disclosure: each `mk-faq-q` toggles its `mk-faq-a` with the `chev` rotating;
**the first item is open by default**; one or several may be open at a time (a minor Phase B
decision). Keyboard-operable with `aria-expanded` on each trigger (§8).

### 5.4 Mobile burger sheet (`mk-sheet`)

Below 900px the `mk-burger` opens a side `mk-sheet-panel` over a `mk-sheet-backdrop`, with a
`mk-sheet-head` (close `mk-sheet-close`) and `mk-sheet-link`s mirroring the nav + auth
actions. It is a **dialog** (`role="dialog"` / `aria-modal`), traps focus while open, closes
on tap-outside / Esc / link-selection, and **returns focus to the burger** (§8).

### 5.5 Hero motion — the ventana-producto

The signature interaction. Inside a single clean window (`mk-window`, `mk-window-bar` with
three `mk-window-dot`s), two parts compose the product story:

- **Journey ribbon** (`mk-journey`): the `mk-journey-cap` label `"El viaje de tu
coleccionable"` over a `mk-journey-rail` (`mk-journey-line` with a travelling fill) and
  4 `mk-journey-step`s — `Tienda` (`store`, `--accent-cool`), `Pedido` (`package`,
  `--accent`), `Pago` (`wallet`, `--accent-warm`), `Entrega` (`truck`, `--success`). A
  single `mk-journey-token` (the collectible) travels left→right; each station lights up
  (`mk-journey-tile` / `mk-journey-pop`) **one at a time**, staggered by `--s` (delay
  `--s * 1.6s`), looping ≈6.4s.
- **Dashboard panel** ("Tu colección", `mk-window-body` + `mk-dash-head`): a `mk-dash-badge`
  `"Panel"` and 3 stats — `"Gastado"`, `"Pendiente"` (`--warning`), `"En camino"` — over 2
  sample items (a figure with a `"Pre-reserva"` chip, a manga with an `"En camino"` chip).
  This is the **convergence point**: everything the journey shows ends up visible and
  manageable here.

The rationale (one hero object advancing a sequenced path → dashboard destination; only one
thing moves at a time) comes from the deep-research **referenced by the spec** (cited from the
redesign subproject's landing copy deck (historical), not the research file).

### 5.6 Motion mechanics & reduced-motion

Per [motion.md](../../../design/motion.md): the window animates in once
(`mk-window-anim` = a rise) then floats ambiently, and the token/stations loop. **Only
`transform` / `opacity` are animated** (the transform/opacity rule). The same design runs
on desktop and mobile (all 4 stations fit at 390px). **`prefers-reduced-motion` is
respected**: loops collapse to a single iteration so the window resolves to a legible static
state.

---

## 6. Copy & voice

Voice is the system's — informal, complicit, brief (decálogo #7); see
[ux-copy.md](../../../design/ux-copy.md). Marketing copy was rewritten for go-live with a
clarity-over-cleverness bias (unknown brand) and uses the canonical glossary terms —
**pedido**, **entrega**, **pre-reserva**, **pago**, **tienda** (never "orden", never "envío"
as a feature name) — see [glossary.md](../../glossary.md). Strings live in the `landing`
namespace of `src/i18n/locales/{es,en}/landing.json` (the `waitlist` keys were removed).

Key strings (es), by surface:

| Surface             | Tone               | String                                                                                                                                |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Hero eyebrow        | inviting           | `"Para coleccionistas"`                                                                                                               |
| Hero H1             | confident          | `"Toda tu colección, bajo control."`                                                                                                  |
| Hero subtitle       | clear, concrete    | `"Reúne tus pedidos de cualquier tienda, controla pre-reservas, pagos y entregas, y recibe un aviso antes de cada fecha clave."`      |
| Hero primary CTA    | low-friction       | `"Crear cuenta gratis"`                                                                                                               |
| Hero secondary CTA  | exploratory        | `"Ver cómo funciona"`                                                                                                                 |
| Hero trust line     | reassuring         | `"Gratis para empezar · Sin tarjeta"`                                                                                                 |
| Ribbon caption      | quiet, mono        | `"El viaje de tu coleccionable"`                                                                                                      |
| Dashboard badge     | quiet, mono        | `"Panel"`                                                                                                                             |
| User-fit heading    | empathetic         | `"Tu colección crece. El desorden, también."`                                                                                         |
| Features heading    | benefit-led        | `"Lo que necesitas para llevar tu colección al día"`                                                                                  |
| Banner heading      | aspirational       | `"Tu colección merece estar en orden"`                                                                                                |
| Banner body         | low-friction       | `"Crea tu cuenta gratis y reúne tus pedidos, pagos y entregas en un solo lugar. Toma menos de un minuto."`                            |
| FAQ heading         | plain              | `"Lo que sueles preguntarte"`                                                                                                         |
| FAQ Q1              | direct             | `"¿PandaTrack es gratis?"`                                                                                                            |
| FAQ Q (data safety) | reassuring         | `"¿Mis datos están seguros?"`                                                                                                         |
| Footer tagline      | summarizing        | `"Toda tu colección en un solo lugar: pedidos, pre-reservas y entregas."`                                                             |
| Hero window aria    | descriptive (a11y) | `"Demo de PandaTrack: un coleccionable recorre el ciclo —tienda, pedido, pago y entrega— y todo se ve y se maneja en un solo panel."` |

Tone rule: the mascot does not appear in this marketing surface; personality lives in the
copy voice and the hero motion (decálogo #6).

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's —
see [interface-patterns.md → Responsive](../../../design/interface-patterns.md). Landing
specifics (`#s11-landing-mobile`, 390px frame):

- **Header → burger**: below 900px the centered nav and the actions cluster collapse behind
  the `mk-burger`; the language/theme toggles and auth actions move into the `mk-sheet`
  (§5.4). The phone frame **never** uses `mk-bleed` (anti-pattern §9).
- **Hero**: the two-column `mk-hero-grid` stacks (copy over window); the H1 reduces to
  `32px`; the ventana-producto keeps all 4 journey stations (they fit at 390px) and the same
  motion.
- **Sections → single column**: `mk-fit-grid`, `mk-feature-grid`, and the footer columns
  collapse to one column; the banner band and FAQ accordion reflow full width.
- **Tap targets ≥ 44px** on mobile (spec §8).

---

## 8. Accessibility (Landing specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What matters
specifically here:

- **Landmarks**: `<header>` (banner) · `<main>` · `<footer>`; every section has its own
  heading. The nav carries an `aria-label` (`"Navegación"`) and tab order follows the
  visual order.
- **Burger sheet = dialog**: `role="dialog"` / `aria-modal`, focus trap while open, Esc
  closes, focus returns to the burger button.
- **FAQ accordion**: `aria-expanded` on each `mk-faq-q` trigger; fully keyboard-operable.
- **Hero motion**: the `mk-window` carries `role="img"` + a descriptive `aria-label` (§6);
  the journey ribbon and token are `aria-hidden` (decorative — the message lives in copy);
  `prefers-reduced-motion` is honored.
- **Status chips** in the dashboard panel keep the icon + label contract
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).
- **Gradient text contrast** (`mk-grad-text`) verified in light + dark; tap targets ≥ 44px
  on mobile.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/pre-release-landing.html`](./prototype/pre-release-landing.html)
  (self-contained; opens standalone in light + dark; default palette Velvet).
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and the relevant ADRs
  (0006 color/icon contract, 0008 modal/sheet).
- **Functional contract (superseded)**: [`frd-01-pre-release-landing.md`](./frd-01-pre-release-landing.md)
  — retained for historical context; the go-live behavior designed here supersedes the
  waitlist requirements.
- **Glossary**: [glossary.md](../../glossary.md) — canonical es↔en product terms.
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the prototype are
  the durable record.
