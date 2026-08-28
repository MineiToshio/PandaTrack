---
id: FDD-12
type: FDD
slug: collector-progression
title: Collector Progression — Feature Design Document
status: ACTIVE
parent: FRD-12
last_updated: 2026-08-26
prototype: ./prototype/collector-progression.html
design_system: ../../../design/README.md
demo_anchors:
  - "#p0"
  - "#p1"
  - "#p2"
  - "#p3"
  - "#p4"
  - "#p5"
  - "#p6"
  - "#p7"
  - "#p8"
---

# FDD-12 · Collector Progression — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-12, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/collector-progression.html`](./prototype/collector-progression.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to Collector Progression, and **cites the prototype** for the exact pixel. When this FDD
> and the design system disagree on a system-wide rule, `docs/design/` wins. When this
> FDD and the prototype disagree on a Progression-specific visual, the prototype wins
> until this FDD is corrected in the same change. Where the prototype is silent or ahead
> of the (currently `DRAFT`) functional contract, this document says so explicitly rather
> than papering over the gap.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/progress.json`.

---

## 1. Overview & screens covered

Collector Progression is a private, non-monetary meta-layer over everything the collector
already does elsewhere in the app: it turns server-verified facts (an order placed, a
payment logged, a delivery received, a store discovered) into an append-only points ledger,
a permanent private **rank**, and a collectible **medal album**. It is structurally different
from every other FDD in this repo: it is not a sibling workspace next to Orders/Deliveries/
Stores with its own list-detail-wizard grammar. It is a thin, cross-cutting layer that reads
outcomes from the other domains and writes nothing back into them (`FRD-12` Out of Scope),
surfaced through **one navigation entry** (`Progreso`), **one dashboard widget**, and **two
global overlays** that can appear on top of any screen in the app.

Three constraints shape every visual decision here:

1. **Private, not social.** Rank and medals are visible only to their owner (`FR-12-18`,
   `BR-12-02`). The hero eyebrow says so out loud (`"Rango 4 de 10 · solo tú lo ves"`), and the
   comparison-between-collectors placeholder is a disabled, non-collecting dead end
   (`FR-12-39`) — never a soft "coming soon" invitation to opt in.
2. **Recognition, never a gate.** No privilege, discount, or app behavior changes because of
   rank or medals (`BR-12-09`). The whole layer can be switched off in one toggle (`FR-12-38`),
   and the switch removes the navigation entry, the widget, and every overlay together — there
   is no "half off" state.
3. **Calm where it recurs, loud where it's earned.** The dashboard widget and the sidebar's
   compact rank glance render with **no animation** — static rings, no sheen sweep (the
   prototype hard-codes this with an `#p1` override that turns off `.stage-sheen` and dims the
   emblem glow). The full animation vocabulary (holo sweep, shine, confetti, rays, sparks) is
   reserved for the album, the medal detail, and the two celebration surfaces — see §3.1 and
   §5.5.

### Screens in this FDD

| #   | Screen                                            | Route                                  | Prototype anchor |
| --- | ------------------------------------------------- | -------------------------------------- | ---------------- |
| 1   | Dashboard · `"Tu rango"` widget                   | `/{locale}/dashboard`                  | `#p1`            |
| 2   | Progreso · Resumen (default tab)                  | `/{locale}/progress`                   | `#p2`            |
| 3   | Progreso · Rangos                                 | `/{locale}/progress?tab=rangos`        | `#p3`            |
| 4   | Progreso · Medallas (album)                       | `/{locale}/progress?tab=medallas`      | `#p4`            |
| 5   | Progreso · Medallas · Detail (subview)            | `/{locale}/progress/medals/[medalKey]` | `#p5`            |
| 6   | Global · unlock toast                             | (overlay, any authenticated screen)    | `#p6`            |
| 7a  | Global · full-screen celebration, medal variant   | (overlay, any authenticated screen)    | `#p7`            |
| 7b  | Global · full-screen celebration, rank-up variant | (overlay, any authenticated screen)    | `#p7`            |
| 8   | Medal detail · event / numbered variant           | `/{locale}/progress/medals/[medalKey]` | `#p8`            |
| 9   | Progreso · Resumen · rules explainer (subview)    | `/{locale}/progress/how-it-works`      | none, see §2.9   |

The prototype's `#p0` is a **structural map, not a shipped screen** — a diagram of how the
`Progreso` entry fans out into its three tabs, where the medal detail subview hangs off
`Medallas`, and where the dashboard widget and the two global overlays sit relative to it. It
is cited here only as the reading order for this document, not as a ninth anchor to
implement.

Requirements traced throughout: `FR-12-01 … FR-12-48`, `BR-12-01 … BR-12-22`,
`AC-12-01 … AC-12-17` (see [`frd-12-collector-progression.md`](./frd-12-collector-progression.md),
`DRAFT` at the time of this FDD and `ACTIVE` since `WO-07` closed). Its Implementation Notes call
for six ADRs numbered from `0035`. All six now exist and are accepted:
[`0035`](../../../design/decisions/0035-collector-progression-point-ledger.md) (the point ledger),
[`0036`](../../../design/decisions/0036-medal-rarity-visual-system.md) (the medal rarity visual
system), [`0037`](../../../design/decisions/0037-progression-deferred-credit-no-pending-state.md)
(deferred credit with no pending state),
[`0038`](../../../design/decisions/0038-permanent-rank-and-merit-lock.md) (the permanent rank and
its merit lock), [`0039`](../../../design/decisions/0039-phased-social-surface.md) (the phased
social surface) and
[`0040`](../../../design/decisions/0040-medals-grant-no-points-and-are-never-revoked.md) (medals
grant no points and are never revoked, amended 2026-08-26). Earlier revisions of this document
cited only the first two, because the other four were unwritten when it was drafted.

---

## 2. Layout & structure per screen

All product screens live inside the collector **App Shell** (see
[interface-patterns.md → Layout & app shell](../../../design/interface-patterns.md)). The
shell is system chrome and is **not** redefined here.

### 2.1 Dashboard widget, `"Tu rango"` (`#p1`)

`FR-12-35` fixes the widget's content; it does **not** fix its slot inside the twelve-column
`dash-grid` documented in
[`fdd-06-dashboard.md § 2.1`](../frd-06-dashboard/fdd-06-dashboard.md#21-dashboard-dashboard).
The prototype's `#p1` frame is a simplified dashboard (three KPI tiles, no `Caja` / `Presupuesto`
/ `Tendencias` zones) built only to stage the widget in isolation, so its "widget sits directly
under the topbar, above everything else" placement is **not** evidence for where it belongs in
the real dashboard. Placing it there would rank a non-monetary, non-actionable widget above
`ZONA 1 · Caja y obligaciones`, the page's primary decision (decálogo #9, "data is the hero").
**The exact `dash-span-*` slot is an open amendment to `fdd-06-dashboard.md`**, to be resolved
in the same change that ships this widget; this FDD specifies only the widget's own anatomy.

```
rank-widget (card, accent family — "your things", see §3.1)
  rank-widget-top
    RankEmblem e-md (84px), glow, no sheen (dashboard = calm)
    w-body
      eyebrow "Tu rango"
      name + Chip neutral mono "Rango N de 10"
      ProgressBar tall
      bar-note: "{current} de {nextThreshold} pts" · "Te faltan {N} pts para {nextRankName}"
    trailing (align end)
      pts figure (mono, large) + "puntos" caption
      Chip success "+{N} este mes"
  rank-widget-foot
    eyebrow "Últimas medallas"
    medal-tick-row: up to 5 MedalStage s-tick (38px), calm — no sheen, dimmed glow
    ghost button "Ver el álbum {N} de {M} →"
```

Mobile (`m-widget`): the same content stacks vertically, centered header row (`RankEmblem e-sm`,
56px), the tick row drops to `s-tick-mob` (32px, 4 shown instead of 5 in the prototype), and the
footer collapses the ghost button + count into one text line, `"{N} de {M} · Ver el álbum"`.
`FR-12-35` also requires "no mutation" here — the widget is a pure link into `/{locale}/progress`,
consistent with the dashboard's read-only contract (`FRD-06 · FR-06-15`).

**Sidebar footer glance (prototype-only, not a named FRD-12 surface).** Every screen in the
prototype (`#p1`–`#p8`) carries a compact `"Tu progreso"` line in the sidebar footer — a 38px
`RankEmblem e-xs` plus `"{points} · Rango N de 10"` — sitting above the existing account
affordance. `FRD-12 § Surfaces` names exactly four surfaces (`Progreso` section, medal detail
subview, dashboard widget, global overlays) and does not include a persistent sidebar element.
Treat this as a **design proposal carried by the prototype, not a committed requirement**;
confirm with product before implementing it, since it also touches the sidebar's otherwise
inviolable structure (`interface-patterns.md § 1`, "Account affordance… with the collapse control
beneath it").

### 2.2 `Progreso` section shell (`#p2`, `#p3`, `#p4`)

```
app-topbar (sticky)     "Progreso" · Chip neutral mono "{points} pts" (desktop only)
subtabs                 Resumen · Medallas · Rangos  (Tabs module, underline-active)
```

`FR-12-30` fixes three tabs, the active one persisted in the URL and omitted at the default
(`Resumen`) — the same pattern the orders/stores/deliveries lists already use for filters and
sort. **As shipped, the selection is carried by the path** (`/progress`, `/progress/medals`,
`/progress/ranks`) rather than by a `?tab=` parameter, because the album had already shipped as its
own route with the medal detail hanging off it; a parameter would have given the same panel two
addresses. The observable contract is unchanged: the default tab writes no segment of its own, an
unknown segment falls back to it, and the detail subview keeps `Medallas` marked. See
`wo-04-progreso-section-and-dashboard-widget.md` § Technical Notes. This maps onto the existing `Tabs` module
([components.md](../../../design/components.md), "Tabbed navigation within a page") per
[interface-patterns.md § 4 Tabs](../../../design/interface-patterns.md#4-navigation-patterns):
a small, parallel, non-hierarchical group (three) where the user works one tab at a time — the
canonical case for tabs, not an edge case. The prototype's `.subtab` treatment (bottom border in
`--accent`, bold + `--accent` text when active, `--text-secondary` otherwise) is the visual
target; reconcile it against `Tabs`' actual current API and extend the component in place if it
doesn't yet support an underline-active recipe — do not fork a parallel tab bar.

**The panel owns the rhythm** (recorded 2026-08-25). The `role="tabpanel"` element the bar's
`aria-controls` names carries `flex flex-col gap-[var(--space-6)] lg:gap-[var(--space-8)]`. Each tab
renders a flat list of blocks and no wrapper of its own, so with no gap declared here all sixteen
block pairs across the three tabs sat at **0 px** and the section read as one undifferentiated slab —
the defect that opened this design pass. Fixing it in the layout fixes all four routes at once; do
not re-add per-page spacing wrappers.

Each tab page also renders its own `sr-only` `h1` (`"Progreso · Resumen"` and siblings). The section
name is already in the topbar and the tab name in the bar, so a visible one would say twice what the
chrome says, but the document still needs a top heading: without it the three pages start their
outline at `h2`.

The underline tab items use `--text-caption` and `px-[var(--space-2)]`, not the off-scale `12.5px`
and 4px they shipped with.

### 2.3 Resumen tab (`#p2`)

```
rank-hero (top-accent, "your things" family)
  RankEmblem e-xl (148px), glow
  h-body
    eyebrow "Rango N de 10 · solo tú lo ves"
    h2 rank name (font-display)
    p.lore
    ProgressBar tall + bar-note (current/next + "Te faltan N pts para {nextRank}")
  trailing: pts figure (mono, xl) + "puntos acumulados" + Chip success "+{N} este mes"
pg-grid (two cards, side by side desktop / stacked mobile)
  card "Puntos de este mes" — Chip success "+{N}" + list, one row per rule group ("Pedidos
    registrados +90 pts", "Datos completos +64 pts", …)
  card "Candado de mérito" — plain-copy line + ProgressBar (thin) + bar-note
section-title "Medallas" + Chip neutral mono "{N} de {M}" + ghost "Ver el álbum completo →"
medal-grid (showcase — the most recently unlocked, not all 28)
card "Rangos"
  mini-ladder: 3 rungs (previous · current · next), RankEmblem e-xs (38px) each
  ghost "Ver la escalera completa →"
card.sunken "soon" — "Comparación entre coleccionistas" · "Próximamente: compara con otros
  coleccionistas."
```

**Placement corrections recorded at the design pass (2026-08-25).** Three of the blocks above moved
from where the prototype drew them, and the moves are the shipped truth:

- The **honesty line** is the FOOTER of the `Puntos de este mes` card (a rule plus muted caption
  inside it), not a bare `<p>` standing between two cards. It qualifies the figures in that card;
  free-floating between blocks it read as a stray caption belonging to neither.
- The **comparison placeholder** is LAST on the page, under the `Rangos` card. What is switched off
  must not sit between two things that work. Its dashed border is declared as a whole `border`
  shorthand: the `subtle` card variant already sets a transparent 1px border, so a bare
  `border-dashed` class loses to it and the border never draws.
- The **mini-ladder** is three columns abreast from `sm` up (the prototype's `.mini-ladder` flex row)
  and stacks below it, where three columns would leave every rank name in a hundred-pixel well.
- Section titles under the screen title use `SectionTitleWithAccent`, per
  [interface-patterns.md § Section titles](../../../design/interface-patterns.md), rather than a
  bare display-face `h2`.

**The four elements `FRD-12` requires here and the prototype originally omitted are now
present**, in the block above, beneath the hero and above the `Medallas` showcase:

- The **monthly point breakdown by rule group** (`FR-12-31`) as a `card` with one row per rule
  group and a `+{N}` total chip, reusing the existing `card`/`section-title`/`chip` grammar —
  no new component.
- The **merit-lock counter** (`FR-12-31`, `FR-12-17`) as a second card with the mandated plain
  copy — `"Leyenda viva pide el 60 % del álbum. Llevas 9 de 28."` — never only a bare
  percentage, plus a thin `ProgressBar`. **The demo collector is rank 4, below the rank-6
  visibility floor `FR-12-17` sets.** The prototype renders the card anyway, unconditionally, so
  this static reference has one place that shows every Resumen element at once; that is a
  deliberate documentation choice, not a claim about when the real component mounts.
  Implementation gates this card on `FR-12-17` (rank 6+), exactly as specified — it is not
  always-on the way the honesty line is.
- The **permanent honesty line** (`FR-12-41`): `"Los puntos miden tu registro, no tu gasto."`
  It is not a tooltip and not dismissible — placed as a persistent `<p>` caption beneath the two
  cards, not folded into a banner that can be closed.
- The **disabled comparison placeholder** (`FR-12-39`, `"Próximamente: compara con otros
coleccionistas."`), reusing the same `.soon` sunken-card treatment the medal detail subview
  (§2.6) already uses for its own "not yet meaningful" figure — one visual pattern for "this
  exists but is off," not two. `FRD-12` scopes the requirement to "the `Progreso` section"
  without pinning a tab; Resumen is the section's overview tab and is where the prototype places
  it, but the exact tab remains an open decision to confirm during implementation, not a
  prototype omission to silently correct.

### 2.4 Rangos tab (`#p3`)

```
p.sec intro, "Diez rangos, de la puerta del club a la leyenda…"
ladder-legend: dot(success) "Conquistado" · dot(accent) "Estás aquí" ·
               dot(border-strong) "Bloqueado, todavía no lo alcanzas" ·
               "El rango alcanzado es permanente: retrocede la barra, nunca el nombre."
ol.ladder (vertical, summit first)
  li.is-summit.is-locked      rank 10 — "La cima" tag, RankEmblem e-lg em-summit glow-summit,
                               centered name+lore, threshold + "te faltan N pts" + Bloqueado
  li.is-locked                ranks 9→5 — RankEmblem e-sm em-high, name+lore,
                               threshold + gap + Bloqueado
  li.is-current                rank 4 — "Estás aquí" pill+icon, name+lore,
                               threshold, plus its own ProgressBar tall + bar-note
  li.is-done ×3                ranks 3→1 — RankEmblem e-sm em-steel, name+lore,
                               threshold + date reached + "Conquistado" + check icon
```

The legend's own copy encodes `BR-12-06`/`FR-12-16` (permanence) directly as user-facing text —
keep that line verbatim; it is doing real explanatory work, not decoration.

**Two deviations recorded at implementation (WO-04, 2026-08-23).** First, the ladder's vertical
spine is drawn as a 3px band strip on each rung's leading edge, painted with that rung's own
`--rank-band-*` token, instead of the prototype's absolutely-positioned spine and dots: the
prototype's offsets are hand-tuned pixels that break inside the mobile disclosure and at 320px, and
the strip carries the same information at every width. Second, **no per-rank reached date is
rendered** on the conquered rungs. The prototype's `"alcanzado el 21 jul 2026"` line has no data
behind it, since nothing in the schema records when a rank was reached; the rungs carry the
`Conquistado` label and a check instead of a fabricated date.

**Two further corrections recorded at the design pass (2026-08-25).**

**No `opacity` anywhere on the ladder.** The prototype's five dimming steps (0.94 → 0.62 toward the
summit) are withdrawn, in both this section and §3.3. Measured on the shipped screen they pushed a
locked rank's name to **2.90:1**, under AA, which contradicts `FR-12-33` outright: a ladder whose
thresholds have to stay readable at every width cannot fade the ranks a collector is planning
against. `visual-foundations.md` already forbids `opacity` as a low-contrast device
("Never `opacity`. Low contrast is achieved with semantic tokens"), and `--rank-band-locked-text`
carries the same instruction. Distance is now carried by the muted text token, the padlock and the
word `Bloqueado` (measured after the change: **6.74:1** light, **9.02:1** dark). The legend's copy
moved with it, since it described the dimming: `"Bloqueado, se atenúa hacia la cima"` →
`"Bloqueado, todavía no lo alcanzas"` (`en`: `"Locked, not reached yet"`).

**The summit is a halo, not a rail.** The 3px band strip every other rung carries is replaced on the
summit by a soft radial in `--rank-band-top`. The `La cima` word also moved off `--accent-warm`
(3.33:1) onto `--rank-band-top-text` (**15.01:1** light, **17.26:1** dark); only the trophy glyph
stays warm, which as a graphical object answers to 3:1 rather than to the 4.5:1 text threshold.

**The halo was rescoped to the plate, not the card (owner feedback, 2026-08-25).** The first shipped
version ran the radial full-height and near-full-width behind the whole rung (`110% 65%`, 14% mix):
at that size it read as a warm-red stain across the card rather than as light coming off the summit,
especially in light theme where the pale surface let the full-strength hue show through. The halo now
sits in a fixed `150px` circle centered behind the `RankEmblem` alone (`20%` mix, `closest-side`
feather, centered with a translate rather than auto margins, see §3.3), rendered before the emblem in
the DOM so the plate's own art paints on top of it. This
reads as an aura on the piece itself in both themes instead of a background tint, and it does not
touch `--accent-warm` or any other consumer of `--rank-band-top` (the emblem ring, the trophy glyph,
the card border): only the wash behind the summit rung changed.

Locked rungs also drop the repeated figure: where `missingPoints` equals the threshold — the common
case, not an edge one, for every rank above the collector's first — the rung prints the threshold
once instead of `"9350 pts · Te faltan 9350 pts"`, which read as a rendering fault.

**Mobile (`.compact`)** does not render all ten rungs unconditionally: the summit stays, the
rungs adjacent to the current one stay, and the distant locked band between them collapses into
one dashed `rung-jump` row (`"3 rangos más entre la cima y ti, con sus umbrales"`). `FR-12-33`
requires the full ladder with every threshold visible ("a ladder whose next step is unknown
cannot be planned against"), so this row must be interactive, not inert text. **The prototype
now implements the row as a native disclosure**: a `<details class="rung-jump-details">` /
`<summary class="rung-jump">` pair, with ranks 9, 8 and 7 (thresholds, gap-to-go and all)
nested inside as the disclosure's hidden content, expanded and collapsed with no JavaScript.
This satisfies `FR-12-33` without inventing a bespoke expand/collapse state machine — the
`<summary>`'s own visible text is its accessible name, and its native open/closed state is
exposed to assistive tech the same way any other disclosure widget's is. Implementation may
keep the native `<details>`/`<summary>` pair or use a `<button aria-expanded>` toggling a
revealed list instead (see §8) — either satisfies the requirement; a static summary row that
never reveals ranks 7–9 does not.

**Opening the tab scrolls to the current rung (owner feedback, 2026-08-25).** The ladder paints
summit first, so a collector below the top ranks used to land on a page showing someone else's
rank and had to scroll past it to find their own. `RankLadder` publishes `data-rank-current="true"`
on the one rung with `state === "current"`; a small client island, `RankLadderScrollToCurrent`
(mirroring `RankLadderViewedCapture`'s "tiny island beside a server-rendered ladder" shape), reads
that marker on mount and calls the platform's own `scrollIntoView({ block: "center" })`. It skips
the jump entirely when the rung is already fully inside the viewport (rank 1, or any viewport tall
enough to show the whole ladder), and drops the animation for `prefers-reduced-motion` collectors
(`behavior: "auto"` instead of `"smooth"`), the same `matchMedia` check `useAnimatedNumber` already
uses. The ladder itself stays entirely server-rendered; nothing about this adds a client boundary
to the surrounding page.

### 2.5 Medallas tab / album (`#p4`)

```
album-head (card)
  album-count (mono, large) "{N}" + "de {M} medallas"
  ProgressBar (thin) + bar-note ("6 páginas del álbum" / "{N} por descubrir")
  pager: 6 pills, one per series, active pill in --accent
card.sunken "La tirada" (rarity legend)
  eyebrow "La tirada" + 5 RarityChip (one per level, icon + label — see §3.1)
  caption "La rareza se lee como una tirada de impresión, no como un rango de videojuego."
per series (×6, repeated)
  section-title: h2 series name + one-line caption | its own thin ProgressBar + "{n} de {m}"
  medal-grid: MedalCard × n
```

**`MedalCard` anatomy**, three states:

| State                                        | Art treatment                                                                           | Body                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unlocked                                     | Full-color `MedalStage s-lg` (168px), drawn full bleed: no plate, no rarity ring (§3.3) | `h3` name, `p.cond` condition text, footer: `RarityChip` + unlock date                                                                                                                                                                                                            |
| Locked, hinted                               | Art drained through `--locked-art-filter` + a padlock chip in the corner (§3.3)         | `h3` "Medalla bloqueada"-style title **is not shown**; instead `h3` name **is** shown for hinted locks (the prototype keeps the real name, e.g. "La espera imposible"), `hint-label` "Cómo conseguirla" + `p.cond` states the real condition, footer: `RarityChip` only (no date) |
| Locked, secret (4 pieces, `Secretas` series) | Same drain + chip                                                                       | `h3` "Medalla bloqueada" (neutral, generic), `hint-label` "Cómo conseguirla" but the body reads `"Sin pista todavía"`, footer: `RarityChip` only                                                                                                                                  |

This is `FR-12-25`'s distinction rendered exactly: every locked medal outside `Secretas` shows
its real name and condition as a hint; the three `Secretas` pieces alone hide both behind a
neutral label. Do not generalize the "hidden name" treatment to any other series.

**Grid and card corrections (2026-08-25).**

- The card is `h-full` and its foot (rarity chip plus unlock date) is anchored with `mt-auto`.
  Cards in one row differ by a line or two of hint, and without the anchor every chip in the row
  sat at a different height.
- The album grid keeps `auto-fill`: the empty slot at the end of a short series is the album's own
  rhythm, and every page has to draw its pieces at the same size. The **showcase** grid and the
  "siguiente de la página" preview use `auto-fit` instead, because they carry a fixed handful of
  medals and `auto-fill` was laying out tracks for cards that are not there, leaving ~198px of dead
  grid beside the last one. Gap is `--space-4`.
- The series header aligns its figure and its bar on `items-end`; centred, the tall figure and the
  short bar floated at different heights.

**Catalogue v2: the album has no `"Próximamente"` state left (2026-08-26).** All 28 medals are
shipped and evaluable (`FR-12-20`), so no series header prints the `"Próximamente"` label in place
of its counter and bar, and no `MedalCard` renders the upcoming variant, whose body read
`"Próximamente"` instead of `"Cómo conseguirla"` because an instruction the collector cannot follow
is not a hint. Every locked card now carries a real hint, the four `Secretas` aside. **The mechanism
stays in place**, unused: the catalogue's phase field, the album's shipped-versus-catalogued split,
the series header's label branch and the card's status label are all still wired, so a future
time-limited event medal (`FR-12-28`) has a rendering path to switch on rather than one to invent.

**Series sizes after v2.** `Primeros pasos` is 8 pieces and the other five pages are 4 each, so
every page fills its rows at 2 columns (mobile) and at 4 (a typical desktop width). The `auto-fill`
note above still governs the widths in between, where a page can end on a partial row: that empty
slot is the album's own rhythm, not a layout fault to correct.

### 2.6 Medal detail subview (`#p5`)

Route `/{locale}/progress/medals/[medalKey]` (`FR-12-34`) — a **subview** of `Medallas`, not a
fourth tab. Back navigation returns to the album page the collector came from with scroll
position preserved.

```
BackNavLink "← Volver al álbum"     (canonical component — the prototype's raw `.btn.ghost`
                                      markup must be swapped for `BackNavLink`, per
                                      interface-patterns.md § 4)
detail-wrap  (grid: 320px art column + flexible fact column; 1 col below 900px)
  detail-art
    MedalStage s-2xl (262px), rarity ring + seal, sheen active
    RarityChip below the art
  fact column
    eyebrow (series name, or "Medalla secreta" for the Secretas series)
    h2 (font-display, 30px) medal name
    p.sec  flavor/context line
    detail-fact rows (148px label + value, divider between):
      "Cómo la conseguiste"   concrete provenance sentence, e.g. an ORD-… MonoCode reference
      "Fecha"                 unlock date, spelled out
      "Página del álbum"      series name (+ "sin pista previa" for Secretas)
      "Tirada"                rarity name + its treatment ("Primera edición · sello dorado")
      "Puntos"                "Las medallas no dan puntos y no se revocan." (encodes
                               FR-12-22/BR-12-08 as copy — keep verbatim)
    .soon block  (dashed, sunken, muted) — see below
    section-title "Siguiente de la página"
    medal-grid.tight → MedalCard s-md (116px), the next locked piece in the same series
```

**Art column corrections (2026-08-25).** The art card fills its own column (`w-full`, no
`justify-self-center`) and draws the piece at `s-2xl` (262px), the size §3.3 always specified;
shipped at `s-xl` inside a centred card it left ~133px of dead margin on either side of the medal.
`MedalStage` gained the `2xl` step for it. The card carries the prototype's soft radial behind the
piece, mixed from the medal's own rarity ring token. The `.soon` block's dashed border is declared
as a whole `border` shorthand for the same reason as the Resumen placeholder (§2.3), and the
"siguiente de la página" preview is capped at 240px so a single card is card-sized rather than
stretched across the fact column.

**The `"% de coleccionistas que la tienen"` block needs different handling than the
prototype's.** `FR-12-27` says this figure "must **not** render while the platform has too few
users for the figure to be meaningful." The prototype always renders the row, dimmed
(`opacity: 0.75`, dashed border), to communicate "this exists but is off" within a static demo.
**Amended by the owner during WO-05 (2026-08-23).** The shipped medal detail renders the `.soon`
block switched off, with the honesty copy `"Se enciende cuando haya más coleccionistas."`, rather
than omitting it. The concern behind the original instruction (a greyed stat implying real data
exists) is answered by the copy itself, which says in plain words that the figure is not being
computed yet; omitting the row entirely would instead hide a planned surface from the collector.
The row carries no figure, no placeholder number and no link, so nothing on screen can be read as
a value. The original instruction is preserved above as the design record; the amendment is what
ships.

Mobile: centered stack, `MedalStage s-xl` (208px), a trimmed fact card (only "Cómo la
conseguiste", "Fecha", "Página del álbum" — "Tirada" is covered by the `RarityChip` shown right
under the art, "Puntos" is dropped for space), then the same `.soon` block.

### 2.7 Global overlays: unlock toast (`#p6`) and full-screen celebration (`#p7`)

Both are **global** (`FR-12-36`): triggered by the host mutation's own success payload
(`FR-12-13`), rendered over whatever screen the collector was already on, not scoped to
`Progreso`.

**Unlock toast** (`#p6`, one per medal, queued — `FR-12-29`):

```
steam-toast  (fixed, bottom-right desktop / full-width bar above the tab bar on mobile)
  MedalStage s-sm (72px), rarity ring + seal, sheen ACTIVE (toasts are not calm — see §5.5)
  t-body
    t-kicker  (mono uppercase, rarity-tinted) "Medalla desbloqueada"
    t-name    (bold) medal name
    t-meta    (muted) "{rarity} · página {series} · {N} de {M}"
  t-line  bottom accent hairline in the rarity gradient, countdown
```

This toast is the first real implementation of the "achievement toast" the design system has
reserved since [ADR 0001 § 4.12](../../../design/decisions/0001-s2-closure-decisions.md) and
recorded in
[visual-foundations.md's elevation table](../../../design/visual-foundations.md) ("Achievement
toast: `--elevation-3` + achievement halo"). Two deliberate extensions beyond that earlier,
never-built description, to record here rather than rediscover as a regression:

- The halo/border is **rarity-tinted** (keyed off the unlocked medal's rarity token, §3.1), not
  fixed warm the way ADR 0001 originally imagined it.
- **No mascot.** ADR 0001's own text describes the achievement toast as carrying "mascota
  celebrating"; that description is superseded by the later, binding
  [ADR 0013 § D5](../../../design/decisions/0013-cross-cutting-state-system.md) (2026-08-13
  update): the mascot sprites were never produced, `MascotBubble` was deleted, and **no document
  may specify a mascot as an accepted requirement**. The medal art, the rarity ring, and the
  motion (sheen, halo, confetti) carry the celebratory register instead. This applies to every
  celebratory surface in this FDD, not only the toast.

**Burst collapse (amendment, 2026-08-23 review).** Past **three** medals in one credited action the
per-medal sequence is replaced by a single toast, and the batch's qualifying-rarity unlocks do
**not** escalate to the full-screen celebration either:

```
steam-toast  (same anatomy as above)
  MedalStage s-sm of the RAREST medal in the batch, its rarity ring and halo
  t-kicker  "Medallas desbloqueadas"
  t-name    "Desbloqueaste {N} medallas"
  t-meta    "Míralas todas en tu álbum"
```

Measured, not assumed: a collector whose history was migrated unlocks **ten** phase-1 medals on
their very first credited action (verified against the dev database on 2026-08-23), which the queue
would drain as roughly forty seconds of stacked toasts plus a full-screen dialog behind them, over
whatever the collector was actually doing. `FR-12-29` promises the unlocks arrive one at a time
rather than as a pile; past a readable batch size, one honest count is how that promise is kept, and
the album is the surface built to read ten medals. It is the same reasoning `FR-12-43` already
applies to the migrated history's single aggregated welcome. Three is the boundary because four
toasts already hold the screen for the better part of twenty seconds. A rank crossing arriving with
a burst is still celebrated: it is a different, rare event, and it is server-claimed.

`role="status"` (not `alert`) — an ambient, non-interrupting confirmation, matching the system's
`aria-live="polite"` toast convention. The medal art inside is decorative (`aria-hidden`); the
name, rarity and series are already fully stated in `t-name`/`t-meta`, so nothing is
image-dependent.

**Full-screen celebration** (`#p7`, two variants):

```
epic  (fixed, inset:0, scrim + backdrop-filter blur(7px))
  epic-rays, epic-halo, confetti (33 pieces, aria-hidden), spark ×12 (aria-hidden)
  epic-panel
    Variant A — medal:                    Variant B — rank-up (`.epic-panel.core`):
      epic-kicker  "Medalla {rarity}"        epic-kicker (accent) "Subiste de rango"
      MedalStage s-xl/s-md, medal-rise       rank-jump: old RankEmblem e-sm (dimmed .45)
        entrance (1.1s)                        → arrow-up (accent) → new RankEmblem e-lg, glow
      epic-title  medal name                epic-title  new rank name
      epic-sub    flavor line                epic-sub    rank lore + "Rango N de 10,
      epic-chips  series · "N de M"                        y este no se pierde nunca."
      CTA primary "Verla en el álbum"        ProgressBar tall + bar-note (toward the next rank)
                                              CTA primary "Seguir"
```

**`FR-12-37` still governs the real component; the prototype now stages the same contract in
static markup.** `FR-12-37` requires the rank celebration to be "a light, dismissible modal
following the repository's canonical modal pattern." Earlier drafts of the prototype's `.epic`
element were a hand-rolled full-viewport overlay with no `role`, no focus management, and no
close control beyond its primary CTA — exactly the shape
[interface-patterns.md § 5](../../../design/interface-patterns.md#5-modals-and-overlays)
forbids ("building a dialog/overlay from an ad-hoc `<Portal>` plus `<div>`"). The prototype has
since been corrected: each `.epic-panel` now carries `role="dialog"`, `aria-modal="true"`,
`aria-labelledby` pointing at its `epic-title`, and a focusable close button (`.epic-close`),
and the demo's own script dismisses the overlay on that button, on a backdrop click, and on
Escape, so the contract is exercised, not just annotated. **This is still a static-prototype
approximation, not the real component.** The pixel content (confetti, rays, sparks, the
oversized medal/rank art, the blurred scrim) is the real design target and should be preserved;
implementation must still make it the **body content of a canonical `<Modal>`**
(`tone="success"` or a new tone) rather than a parallel overlay system — a hand-rolled `role`
and a hand-rolled focus trap are not the same guarantee a shared `<Modal>` gives every other
dialog in the app, and this component must not be the one exception.

**The medal variant is now confirmed scope, not a proposal.** `FR-12-47` folds it into `FRD-12`:
the full-screen celebration fires for a rank-up (`FR-12-37`) and, separately, for a medal unlock
at the `Holográfica` or `Firmada` rarity tiers — the two highest of the print-run ramp — and for
no other rarity, which continues to use only the unlock toast (`FR-12-36`). The prototype's
worked example (`Firmada`, the rarest tier) is one instance of that rule, not the whole of it.

**Three implementation decisions taken while building the real surfaces (2026-08-23), recorded
here rather than left to be rediscovered as regressions:**

- **The decor is painted inside the panel, not over the scrim.** The prototype's rays, halo and
  confetti sit on the full-viewport `.epic` element. The shipped component is the body of a
  canonical `<Modal tone="success">`, and the modal owns its own backdrop; reaching around it to
  decorate the scrim would be forking it by another name. The halo, the confetti and the oversized
  art therefore render inside the panel (`.celebration-halo`, `.celebration-confetti`,
  `.celebration-rise` in `globals.css`, all removed outright under reduced motion). The
  celebratory register is preserved; the surface it is painted on is not.
- **The unlock toast's meta line drops the `{N} de {M}` counter.** The toast reads
  `"{rarity} · página {series}"`. The credited Server Action's payload carries the unlocked medal's
  key, rarity and series (`MedalUnlockSummary`) and no album count, so printing "N de M" would mean
  adding a second server read to every credited mutation for one line of a four-second surface. The
  aggregated welcome, which is server-resolved anyway, does state a medal count (`FR-12-43`).
- **A qualifying unlock is announced by the celebration INSTEAD of the toast.** `FR-12-47` reads
  "a medal unlock at the other three tiers is announced **only** by the unlock toast; it never
  escalates". The complement is that a `Holográfica`/`Firmada` unlock escalates rather than doubling
  up: the same medal arriving as both a toast and a full-screen surface reads as two unlocks. When a
  single response carries both tiers, the non-qualifying ones still queue as toasts.

---

### 2.8 Medal detail, event / numbered variant (`#p8`)

Same route and subview relationship as §2.6 (`/{locale}/progress/medals/[medalKey]`), rendered
differently for a medal carrying `availableFrom`/`availableTo`/`numbered` (`FR-12-28`):

```
app-topbar h1 = event name (not "Progreso")
event-banner
  icon + eyebrow "Evento de tiempo limitado" + event name
  sentence stating the window + "Fuera de la ventana no se desbloquea nunca más."
  countdown: 3 cd-cells (días · horas · min)
card (large)
  MedalStage s-2xl, stage-seal shows the ordinal ("Nº 042") instead of a rarity-level seal
  serial callout: "#042" (large mono) + "de 200" caption
  h2 event medal name, description
  medal-foot: RarityChip + "Desbloqueada el {date}"
section-title "Resto de la serie del evento" + Chip "{n} de {m}"
medal-grid: sibling event medals, locked/silhouette (same treatment as §2.5)
```

The permanence-of-unavailability sentence in the banner is the user-facing face of `BR-12-20`
("an event window is absolute") — keep it verbatim; do not soften it into something that implies
a future reopening.

### 2.9 Rules explainer subview (no prototype anchor)

Shipped after the prototype was drawn (2026-08-26, `FR-12-48`), so it has no `#p` anchor. Route
`/{locale}/progress/how-it-works`, one level under the section, which keeps the tab bar's own
`Resumen` marked while it is open exactly as the medal detail keeps `Medallas` marked.

```
BackNavLink "← Volver al resumen"
header
  Eyebrow "Progreso"
  h1 (font-display, --text-title) "Cómo funciona la progresión"
  p.lead (max-width 64ch) one sentence: what the layer rewards
guide grid (1 col; 2 cols from lg)
  6 × card.elevated, equal height
    header: tonal icon circle 36px (accent 14 % mix, the Modal's recipe at a smaller size)
            + h2 (--text-body, semibold) = the rule
    p = what the rule does
    p.muted (rule above it, pushed to the card foot) = why the rule exists
card.subtle dashed "soon" — Users icon + "Nadie te compara con nadie"
```

Three decisions worth keeping:

- **Not a fourth tab, and not a modal.** A tab would rank the rulebook with the album and the
  ladder, which are read every visit; a modal would make a page of prose unlinkable and would turn
  into a full-height scrolling sheet on mobile. The entry is the quiet inline accent link on the
  `Resumen` card footer, beside the honesty line (§2.3), matching the settings/dashboard inline-link
  recipe rather than a `Button`.
- **Every card carries its reason.** The muted foot line is not decoration and is not optional in the
  data shape: a rule with no reason reads as a decree, and the two rules that generated real
  confusion (deferred credit, the store gate) are exactly the ones whose reason does the work.
- **Two columns from `lg`, one below.** Six single-column cards push the last rule off a screen whose
  whole promise is that it reads in a minute.

---

## 3. Visual treatment

### 3.1 Color roles

Collector Progression consumes the existing Velvet system for every generic role (buttons,
chips, cards, states) and **introduces one new token family the system does not have yet**: a
five-level rarity ramp and a four-tier rank-emblem ramp. Both need a promotion decision before
implementation — see the callout below the table.

| Role in this FRD                                                       | Token / class                                    | Where                                                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Primary CTA (`Ver el álbum`, `Marcar…`, `Verla en el álbum`, `Seguir`) | `--accent` (Button primary)                      | hero, toast/celebration CTAs                                                                                                           |
| Rank hero / dashboard widget surface                                   | `s8-card-accent` ("your things" family, §7)      | rank hero, `Tu rango` widget                                                                                                           |
| `Estás aquí` (current rank), `arrow-up`, ladder legend dot             | `--accent`                                       | ladder, rank-up celebration                                                                                                            |
| `Conquistado` (past ranks), ladder legend dot                          | `--success`                                      | ladder `is-done` rows                                                                                                                  |
| `Bloqueado` (future ranks), ladder legend dot                          | `--border-strong` / `--text-muted`               | ladder locked rows — **neutral, not warning/destructive**, consistent with `BR-12-10` ("no league demotion", nothing here is punitive) |
| Merit-lock counter (rank 6+)                                           | `--info` (proposed — not fixed by the prototype) | Resumen tab, once visible                                                                                                              |
| `+{N} este mes` figure                                                 | `--success` (Chip)                               | rank hero, dashboard widget                                                                                                            |

**Rarity ramp (new).** Five levels, each a distinct hue family, none reused from an existing
status/accent token 1:1. The five-grade print-run vocabulary, the "never color alone" pairing
with a mono seal glyph, and the rule keeping strong motion off the dashboard are the accepted
design decision of [ADR 0036](../../../design/decisions/0036-medal-rarity-visual-system.md);
what follows is that decision's token-level detail:

| Level (es)       | Treatment                                                              | Seal glyph | Where the ring animates           |
| ---------------- | ---------------------------------------------------------------------- | ---------- | --------------------------------- |
| Tirada normal    | Matte, near-neutral grey, no seal                                      | —          | never                             |
| Primera edición  | Warm gold ring + corner seal                                           | `1ª ED`    | never                             |
| Edición limitada | Cool teal ring + numbered border                                       | `Nº LTD`   | never                             |
| Holográfica      | Violet→teal→green iridescent ring, animated sweep (`holo-sweep`, 3.8s) | `HOLO`     | album, detail, toast, celebration |
| Firmada          | Warm coral/gold ring + halo glow + a traced signature overlay          | `FIRMA`    | album, detail, toast, celebration |

**Rarity in the ARTWORK is a different channel from rarity in the RING (relanguaged 2026-08-26).**
The table above is what the app paints around the piece, and it is unchanged. What changed is the
art inside it. The album used to encode rarity by changing the medal's DRAWING STYLE, so a
`Primera edición` piece was literally drawn in a different technique from a `Tirada normal` one.
Catalogue v2 moves all 28 pieces into the single painted style the rank emblems already use, which
removes that channel, and rebuilds rarity inside the art on three bounded signals instead: the frame
METAL (blackened iron, brass and copper, satin silver steel, prismatic crystal, antique gold), a
bounded piece COUNT on the rim (one plain band, four rivets, two bands, eight facets, two bands plus
one cabochon) and the LIGHT level (none, none, one contained spark, a clear glow, a full aura). The
ladder is built as a VALUE ladder because it has to survive greyscale at 32 px: `MedalStage` renders
a locked medal of any grade as that same art desaturated, so a grade that only existed in colour
would vanish exactly where the collector has not earned the piece yet. Series is likewise carried by
the plate shape (unchanged) plus one enamel field colour per page. The specification, including the
measured greyscale ladder and where it is still weak, is
[`medal-catalogue-v2.md`](./medal-catalogue-v2.md) §2, §3 and §3a.

None of these five hues have an AA-contrast pass documented anywhere in
[visual-foundations.md](../../../design/visual-foundations.md) the way the status colors do
(`--{status}-chip-text` aliases) — **they are pending promotion to `tokens-css.md`, gated on an
AA-contrast pass, not promoted by this FDD.** Before implementation, either (a) promote them to
real semantic tokens (`--rarity-normal`, `--rarity-first`, `--rarity-limited`, `--rarity-holo`,
`--rarity-signed`, each with a `-soft` fill and a `-chip-text` alias) added to
`visual-foundations.md`/`tokens-css.md` in the same change ("Rule for new reusable variables"),
with the AA-contrast pass recorded at promotion time, or (b) express them as calibrated
`color-mix` recipes off existing tokens with that same explicit contrast measurement recorded.
Either way, `RarityChip` text needs the same chip-text-alias discipline the status system
already enforces (`visual-foundations.md § Status color as text`).

**Rank-band ramp (new).** Four tiers key the `RankEmblem` fill by how far along the ladder a
rank sits — steel (achieved, neutral grey), core (current, `--accent` violet), high
(near-summit, magenta), summit (rank 10, gold) — same promotion decision as the rarity ramp:
**pending promotion to `tokens-css.md`, gated on an AA-contrast pass**, not promoted by this FDD.

**Halo/glow.** The toast and celebration reuse the _idea_ already reserved in
`visual-foundations.md`'s elevation table ("Achievement toast: `--elevation-3` + achievement
halo… built from `--accent-warm`") but generalize the halo color to the rarity token in play
(medal variant) or to `--accent` (rank-up variant, `--halo-core` in the prototype) rather than a
single fixed warm halo. Record this generalization in the same visual-foundations.md update
that promotes the rarity/rank tokens.

**Confetti/sparks.** Colors are drawn from a deliberate mix of `--accent`, `--accent-warm`,
`--success` and the new rarity tokens — the same kind of "categorical mix off existing
semantics" the dashboard collection zone already does
([visual-foundations.md § Chart series colors](../../../design/visual-foundations.md)), not a
new arbitrary palette. Confirm it the same way: named, not improvised per-instance.

### 3.2 Typography

- Rank and medal names in hero/detail slots: `--font-display` at 28–34px, the same ramp
  reserved for "hero numbers, ceremonial headings" — no deviation.
- **Points figures use `--font-mono`, not the display ramp.** `.pts` sets
  `font-family: var(--font-mono); font-weight: 700`. This is a deliberate, FRD-12-specific
  choice — a "scoreboard" register distinct from the money `detail-hero-amount` slot FDD-08
  repurposes for the delivery arrival window. Keep it; it also means the points figure already
  has consistent digit widths for `useAnimatedNumber` (`motion.md § 6.4`) when a credited
  mutation returns `pointsDelta` optimistically (`FR-12-13`).
- Eyebrows (`Tu rango`, `Últimas medallas`, rarity/seal labels, countdown cell labels): uppercase
  mono, standard `Eyebrow` treatment.
- Medal condition/lore/hint text: body, `--text-secondary`.
- Event serial callout (`#042`): large mono, bold, tabular — same register as the points figure.
- **Every heading declares its own weight** (added 2026-08-25). Tailwind's Preflight resets
  `h1`–`h6` to `font-weight: inherit`, so a heading class that sets only a size renders at 400 and
  the whole section reads as body copy with no hierarchy. Titles in the 32px slot carry
  `[font-weight:var(--font-weight-title)]`, those in the 22px slot
  `[font-weight:var(--font-weight-semibold)]`. Never `font-bold` as a literal: the weight token is
  what light and dark are calibrated against.
- **No italics.** The system has no italic register; a `statusLabel` such as `"Próximamente"` is set
  apart with `--text-muted`, not with `italic`.

### 3.3 Shape, radius & elevation

Two new circular/faceted primitives this FRD introduces (flag both for a `components.md` entry
once implemented):

**`MedalStage`** — circular, sized by surface:

| Size token   | px  | Surface                                                                  | Exercised in the prototype |
| ------------ | --- | ------------------------------------------------------------------------ | -------------------------- |
| `s-tick-mob` | 32  | Mobile dashboard widget strip, mobile sidebar (if kept)                  | yes                        |
| `s-tick`     | 38  | Desktop dashboard widget strip, sidebar glance                           | yes                        |
| `s-xs`       | 44  | Reserved — not used by any current screen                                | no                         |
| `s-sm`       | 72  | Unlock toast                                                             | yes                        |
| `s-md`       | 116 | "Next in this series" preview (detail subview), mobile celebration panel | yes                        |
| `s-lg`       | 168 | Album grid cards, Resumen showcase                                       | yes                        |
| `s-xl`       | 208 | Mobile medal detail hero, desktop celebration panel                      | yes                        |
| `s-2xl`      | 262 | Desktop medal detail hero, event medal hero                              | yes                        |

**`RankEmblem`** — a faceted heater-shield silhouette, sized by surface:

| Size token | px  | Surface                                                                         |
| ---------- | --- | ------------------------------------------------------------------------------- |
| `e-xs`     | 38  | Sidebar glance, mini-ladder rungs (30px in `.compact`)                          |
| `e-sm`     | 56  | Mobile dashboard widget, ladder `is-done`/`is-high` rungs, rank-up "old" emblem |
| `e-md`     | 84  | Desktop dashboard widget                                                        |
| `e-lg`     | 108 | Ladder summit and rank-up "new" emblem                                          |
| `e-xl`     | 148 | Resumen tab rank hero                                                           |

Both primitives originally shipped with a placeholder art hole (§4) while final medal/emblem art
did not exist yet; the prototype's `data-medal` attribute and mono `"Imagen"` caption inside
`.stage-note` marked that hole explicitly rather than shipping a guessed illustration.
`MedalStage`'s hole was filled for all 24 medals of the then-current catalogue on 2026-08-24 (see
`medal-art-guide.md` §5), and `RankEmblem`'s for all ten ranks on 2026-08-25 (see
`rank-art-guide.md` §9). The medal art was then relanguaged and regrown to 28 pieces by the
catalogue v2 pass approved on 2026-08-26, which is the album's current art record
([`medal-catalogue-v2.md`](./medal-catalogue-v2.md) §2, §3, §3a). That art shipped the same day:
`public/medals/` now holds the 28 v2 pieces, every catalogue row carries its `imageKey`, and no
medal falls back to the placeholder medallion any more. `medal-art-guide.md` keeps its
series-to-shape mapping (§0), which v2 does not touch; its rarity-to-drawing-style mapping is
superseded by the frame/count/light system recorded in §3.1 above.

**`RankEmblem` with artwork (2026-08-25).** Filling the hole settled three things the placeholder
never had to answer, and all three are decisions, not defaults:

1. **The numeral is gone from the plate.** It was only ever there because the middle of the plate was
   empty; the artwork occupies exactly that spot, and a numeral on top of it would hide the one thing
   the emblem now carries. Nothing is lost, because every surface that draws an emblem already states
   the position in words beside it: the dashboard widget's `"Rango N de 10"` chip, the `Resumen`
   hero's eyebrow (`"Rango 1 de 10 · solo tú lo ves"`), the celebration's `"Rango N de 10, y este no
se pierde nunca."`, and the `Rangos` tab, which is an ordered list of ten. The numeral is kept as
   the fallback for a rank index off the ladder, which the ladder itself cannot produce.
2. ~~**The band ring stays, as the plate's own border.**~~ **Superseded on 2026-08-26** by the
   frameless pass below: the ring is gone entirely, and the ladder's state is carried by the rung
   rather than by the art. The reasoning recorded here (that the ring was the emblem's only carrier
   of state) was sound and is exactly what the frameless pass had to answer.
3. **A locked rank is the real artwork, drained** — visible but not earned, so what is waiting up
   the ladder stays legible (`FR-12-33`). It carries **no padlock**, unlike `MedalStage`: a rank is
   drawn as small as 38 px, where a padlock covers the motif entirely, and every surface that shows a
   locked rank already labels it `"Bloqueado"` in text on the same row. The recipe itself
   (`grayscale` plus 60% opacity) was **replaced on 2026-08-26**; see the frameless pass below.

**Frameless artwork, and the locked state that had to follow (2026-08-26).** The single largest
visual decision of this section, taken on the owner's report that the emblems looked "small and
boxed in" and the medals carried a "borde raro". Both readings were correct, and they had the same
cause: **the art already carries its own frame.** Every rank emblem is drawn with a metal rim or a
heater shield; every medal is drawn with a rim whose rivets, facets and light are how the catalogue's
own art system encodes the print run ([`medal-catalogue-v2.md`](./medal-catalogue-v2.md) §3a). The
plate the UI drew around them was therefore a frame around a frame, and it charged the art a fifth of
its own box for the privilege. On the medals it did worse than that: the plate's ring was a **circle**
clipping a set that is full of shields, pentagons and a star, so the corners of those pieces were
simply cut off.

Three consequences, all of them rules rather than settings:

1. **`RankEmblem` and `MedalStage` draw the artwork full bleed.** No ring, no disc, no plate colour,
   no glow, no inset. The image is a direct child of the sized box and fills it, with
   `object-contain` — never `object-cover`, which is half of what cropped the non-circular medals.
   The documented pixel sizes are unchanged; what changed is how much of each box the art is allowed
   to occupy, which rose from roughly 73% to the ~87% the illustrator drew.
2. **Ladder state left the emblem with the ring.** `conquered`, `current` and `top` now draw
   identically, because the artwork of a rank IS identical whether it has been passed or not, and
   every surface already states which it is without depending on colour (`ADR 0006`): the current
   rung's 1.5 px accent border, its `"Estás aquí"` pill and the progress bar no other rung has; the
   conquered rung's green strip, check and `"Conquistado"`; the summit's warm aura and `"La cima"`
   tag; the mini ladder's own labels. The `band` prop survives as published state (`data-band`) and
   as the one branch that still changes the drawing: `locked`. Re-adding a coloured ring would only
   repeat what the rung says, in the one register the art cannot afford to share.
3. **Locked art is a per-theme token, `--locked-art-filter`** (`globals.css` §5c), not a class and
   not a literal filter string: the recipe has to differ between light and dark, and a `filter` is a
   thing no colour variable can carry.

**Why the locked recipe is `grayscale(1) contrast(1.18) brightness(0.92)` (light) and
`grayscale(1) contrast(1.12) brightness(0.72)` (dark).** The owner's complaint about the old
`grayscale(1) opacity(.6)` was that it made the pieces look "bien muertas", and the diagnosis is
precise: the `opacity` and the flattened contrast together drained not just the colour but the
_material_, leaving a pale beige smear on a pale card. Six candidates were implemented and captured
in the real app at 32, 56 and 168 px in both themes before this one was chosen:

| Candidate                                  | Verdict                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Solid silhouette (`brightness(0)` + alpha) | Rejected. At every size the motif collapses to one flat blob: the sword, the hourglass and the coin all read the same. |
| Veil + partial desaturation                | Rejected. Lands on bronze/sepia, which reads as a **different rarity**, not as unearned.                               |
| Full colour at reduced opacity + padlock   | Rejected. A 55%-opacity gold coin is still a gold coin; ambiguous beside an earned one, and reads as a loading state.  |
| "Unlit": soft desaturation + slight blur   | Rejected. Muddy at large sizes and illegible at 32 px, where any blur is most of the motif.                            |
| **Pewter: full drain, contrast kept**      | **Chosen.** Reads as a real material — a struck but unfinished piece — crisp at 32 px, motif fully legible at 168 px.  |
| Pewter with a residual 15% of hue          | Rejected, narrowly. The surviving tint reads as tarnish; the clean version is livelier, not deader.                    |

The rule the winner encodes, and the one to keep if the values are ever retuned: **remove the colour,
keep the contrast.** Contrast is what makes a monochrome piece look like metal instead of like a
faded print, and it is exactly what the previous recipe threw away.

**The padlock became a corner chip.** `MedalStage`'s lock used to sit in the middle of the piece
behind a translucent veil. The veil was part of the frame that just left, and covering the motif to
say "you have not got this" defeats an album whose whole job is to show the collector what is
waiting. It is now a small chip on `--surface-elevated` with a `--border-strong` hairline, sized per
stage size, sitting at the art's lower-right corner. `RankEmblem` still carries no padlock at all,
for the reasons above.

**The summit is no longer exempt from its own state.** `LadderRung` used to hand the summit the warm
`top` band unconditionally, which was harmless while all ten plates were the same numeral. With real
art it printed rank 10 in full colour directly above a desaturated rank 9, which reads as rank 9
being the lesser piece rather than as the summit being unearned. The summit now takes `top` only once
it is reached and is a locked rung like any other until then; the rung around it keeps the halo and
the `"La cima"` tag either way.

**How the plate is sized, and why it is a rule rather than a detail (2026-08-26).** The emblem takes
a **definite width** (`var(--rank-emblem-size, <size>)`) with a **separate `max-width: 100%`**
ceiling, and it insets its artwork with an **absolutely positioned concentric square** (`inset: 8%`),
never with padding. Both halves are load-bearing, and both were learned from the same owner report:

- `width: min(<size>, 100%)` reads as a harmless ceiling and behaves as one inside a container of
  known width, but not inside a **shrink-to-fit** one. On the summit the plate sits in a centered
  `flex` box (added to hold the aura), whose width is derived from the plate while the plate's `100%`
  asks for the box's width. CSS breaks that cycle by handing `min()` a zero, and the 84 px plate
  rendered at **4.6 px**: the rank 10 artwork simply was not there. A percentage `max-width` has no
  cycle, because it is ignored while a container measures its contents. This is the same failure the
  responsive-notes bullet below already records ("collapsed the emblem to a couple of pixels"),
  returning by a different route, so the shape of the declaration is the rule, not the callsite.
- Padding on the plate could never draw the frame it claimed to: `next/image`'s `fill` positions the
  image against the plate's **padding box**, so the image was laid over that padding rather than kept
  out of it. Worse, a percentage padding resolves against the **containing block**, so `p-[8%]` on a
  950 px-wide rung asked for 76 px a side and, through `min-width: auto`, inflated the 56 px rung
  plate to **172 px** and the 148 px `Resumen` hero to 170 px. Sizes across the whole section were
  quietly wrong; the table above is what the section renders now.

**The summit aura is centered with a translate, never with `inset-0` + auto margins (2026-08-26).**
The aura is deliberately **wider** than the plate it sits behind, and auto margins are forbidden from
resolving negative on the **inline** axis (CSS 2.1 §10.3.7): asked to center a 150 px circle in an
84 px box, the browser pins it left and hangs the whole surplus off the right. It therefore sat
beside the rank name instead of behind the emblem, reading in the light theme as exactly the warm-red
smudge the rescoping above was meant to remove. The block axis has no such rule, which is why it
looked correct vertically and wrong horizontally. `top-1/2 left-1/2` plus `-translate-x-1/2
-translate-y-1/2` centers it on both axes at any size. Any future decor drawn larger than the element
it belongs to inherits this constraint.

**Surfaces (corrected 2026-08-25).** Every leaf card in this section sits directly on the app canvas
(`--background`), so it takes the `elevated` `Card` variant, not `outlined`. `outlined` paints
`--surface`, which in the dark theme lands **1.023:1** against the canvas — the cards were there and
could not be seen. This is L013 (`--surface` vs `--surface-elevated`, Δ 3% versus 6%) applied to this
section; the ladder rungs and the locked `MedalCard` follow the same rule, the locked card because a
dashed border with no fill of its own read as a hole punched in the grid rather than as a card.
Padding on those cards is `lg`, not `md`.

**Elevation.** Cards (album, hero, detail) use the standard system elevation (list card = 1,
section card = 2). The toast reuses the achievement-toast composition (`--elevation-3` +
rarity-tinted halo, §3.1). The full-screen celebration panel needs its own bespoke elevation
recipe beyond the documented `--elevation-4` ceiling (larger blur radius, rarity/accent-tinted
glow) — the same kind of one-off `--modal-shadow` treatment the canonical `<Modal>` already
carries for its own desktop panel; do not reuse `--elevation-4` unmodified.

**Locked-art treatment** is a domain-specific recipe of this section — distinct from the generic
interactive `disabled` state layer (`visual-foundations.md § Focus and state layers`), which governs
controls, not illustrative art. The two do not conflict. It is recorded as its own pattern in
`components.md` (`MedalStage`, `RankEmblem`) and as the `--locked-art-filter` token in
`visual-foundations.md`; the values and the reasoning are above.

---

## 4. Components consumed

| Component                       | Tier   | Role in FRD-12                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar`, `Header`             | module | App shell chrome                                                                                                                                                                                                                                                                 |
| `Tabs`                          | module | The three `Progreso` tabs — extend in place for the underline-active recipe if not already supported                                                                                                                                                                             |
| `BackNavLink`                   | core   | "← Volver al álbum" on the medal detail subview (replaces the prototype's raw `.btn.ghost`)                                                                                                                                                                                      |
| `ProgressBar`                   | core   | Every bar in this FRD: rank hero, dashboard widget, ladder current-rung, album header, per-series header. **No fifth hand-rolled meter** — `interface-patterns.md § 15` already caps the app at one canonical track+fill component                                               |
| `Chip` / `StatusChip`           | core   | `"Rango N de 10"` mono chip, `"+N este mes"` success chip. Rarity chips are **not** `StatusChip` (rarity is not in the `ADR 0002` enum) — build `RarityChip` on `Chip`'s visual grammar (icon + label, tone by rarity) rather than stretching `StatusChip`'s discriminated union |
| `Button`                        | core   | Primary/ghost hierarchy throughout                                                                                                                                                                                                                                               |
| `Modal`                         | module | **Required** wrapper for the full-screen celebration (`FR-12-37`) — see §2.7. Do not hand-roll the `.epic` overlay as a parallel dialog system                                                                                                                                   |
| `Toast` infrastructure          | core   | Recommended base for the unlock toast: extend `src/components/core/Toast/` with an `achievement` variant carrying medal art + rarity accent, rather than a fully separate `.steam-toast` implementation — one canonical toast surface, consistent extension                      |
| `EmptyState`                    | module | First-run empty (`FR-12-40`) and the "0 de 28" all-silhouette album state                                                                                                                                                                                                        |
| `Skeleton`                      | core   | `Progreso` section loading, matching the real tab layout                                                                                                                                                                                                                         |
| `MonoCode`                      | core   | `ORD-…` reference inside a medal's "Cómo la conseguiste" fact                                                                                                                                                                                                                    |
| **New, FRD-12-specific**        |        |                                                                                                                                                                                                                                                                                  |
| `RankEmblem`                    | —      | Faceted shield primitive, §3.3 sizes                                                                                                                                                                                                                                             |
| `MedalStage`                    | —      | Circular medal-art primitive, §3.3 sizes, locked/unlocked/secret states                                                                                                                                                                                                          |
| `RarityChip`                    | —      | Icon + label chip per rarity level, §3.1                                                                                                                                                                                                                                         |
| `MedalCard`                     | —      | Album grid item — unlocked / hinted-locked / secret-locked, §2.5                                                                                                                                                                                                                 |
| `RankLadder` / `RankLadderRung` | —      | Vertical ladder, §2.4                                                                                                                                                                                                                                                            |

Every new component above needs a `components.md` entry once implemented, per the reuse rule
("the FRD is an assembly of existing components; flag any genuinely new reusable component").

---

## 5. Interactions & states

### 5.1 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md). FRD-12 instances:

- **Loading**: `Progreso` section skeleton matching the real tab shell, `aria-busy="true"`.
- **First-run empty** (`FR-12-40`): `"Todavía no tienes puntos. Registra tu primer pedido y
empieza."` — encouraging tone, primary CTA into order creation. Gated on the collector never
  having reached a rank above the first rung and holding no medal, not merely on the live total
  being zero.
- **Voided-with-history zero** (`FR-12-40`): a collector whose live total was voided down to
  zero (`FR-12-44`) but who already reached a higher rank or holds a medal renders the normal
  rank hero at `0` points, with no separate status line: the hero card already prints the
  figure, so a standalone sentence restating it read as redundant next to it (owner feedback,
  2026-08-25). Never the first-run empty above, which would contradict the rank ladder and album
  already shown lower on the same screen.
- **Album, nothing unlocked**: every medal renders as a silhouette; the counter reads
  `"0 de 28"` (the whole shipped catalogue since catalogue v2, §2.5), not an empty container.
- **Recompute in progress** (`FR-12-11`, Error Contract `PROGRESS_RECOMPUTE_BUSY`): a
  non-blocking notice over the cached values ("may be a few minutes old"), never a full-page
  loading replacement of already-known data.

### 5.2 Lock states (medal album)

| State                          | Visual                                                  | Copy                                                               |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `locked` (hinted)              | Drained art + padlock chip                              | Real name + real condition text as the hint (`FR-12-25`)           |
| `locked-secret` (4 pieces)     | Drained art + padlock chip                              | Neutral title `"Medalla bloqueada"`, `"Sin pista todavía"`         |
| `unlocked`                     | Full color, drawn full bleed (no ring)                  | Real name, condition, unlock date                                  |
| `unlocked-not-current`         | Full color (same as `unlocked` — never dims)            | Adds `"ya no vigente"` without withdrawing the unlock (`BR-12-08`) |
| `expired` (event, past window) | Drained permanently — never re-offered as merely locked | States the window has closed, per `BR-12-20`                       |

### 5.3 Ladder states and the merit lock

Ranks 9 and 10 additionally gate on the medal-catalogue percentage lock (`FR-12-17`), visible
from rank 6 onward. The mobile compact ladder's collapsed `rung-jump` row is an interactive
disclosure (§2.4), not a static summary line, precisely because `FR-12-33` requires every
threshold to stay visible on demand.

### 5.4 Toast queueing

Unlike ordinary toasts, which may stack (`interface-patterns.md § 11`, "stack upward"), unlock
toasts must show **one at a time with a short separation** even when several medals unlock in
the same action (`FR-12-29`). This needs a small sequential queue in the achievement-toast
variant, not the default multi-toast stacking behavior.

### 5.5 Optimistic behavior & motion

- The credited mutation's own Server Action returns `pointsDelta`, `rankUp`, and the unlocked
  medal list in its success payload (`FR-12-13`); the client raises the toast/celebration
  optimistically off that payload — never waits for a follow-up fetch or a deferred hook.
- The points figure animates via `useAnimatedNumber` (`motion.md § 6.4`, 600ms, snap under
  reduced motion) whenever it changes from a credited action.
- **Calm surfaces** (dashboard widget, sidebar glance): no `.stage-sheen` sweep, dimmed emblem
  glow — the prototype enforces this with an explicit `#p1`-scoped override, not by omission.
- **Loud surfaces** (album, medal detail, toast, celebration): full sheen/holo sweep, confetti,
  sparks, rays.
- **Reduced motion**: confetti is hidden entirely (`display: none`); the toast and the
  celebration panel/stage-wrap render already in place with no enter animation
  (`animation: none; opacity: 1; transform: none`). This matches
  [motion.md § 4](../../../design/motion.md#4-reduced-motion-prefers-reduced-motion)'s own
  "Toast enter/exit" row ("appear/disappear without slide") — a full stop for pure decoration
  (confetti, sparks, holo sweep, medal-rise) is consistent with the system's reduced-motion
  policy, since none of it is the surface's core transition.

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md).
`BR-12-19` fixes the vocabulary: the unlockable object is **`"medalla"` / `"medal"`**, never
`"badge"` (reserved for the design system's `StatusChip`). Strings live in
`src/i18n/locales/{es,en}/progress.json`.

Key strings (es), by surface and tone:

| Surface                           | Tone                    | String                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rank hero eyebrow                 | matter-of-fact, private | `"Rango N de 10 · solo tú lo ves"`                                                                                                                                                                                                                                                                                                                                        |
| First order-created feedback      | confidence-building     | `"Sumaste {points} puntos. Se suman {deferred} más cuando registres el primer pago o la primera llegada."`, `{deferred}` from the server-resolved sublinear ladder position (`FR-12-05`, `FR-12-07`); collapses to `"Sumaste {points} puntos."` when an advance declared with the order already credited `order-registered` in the same request, leaving nothing to defer |
| Honesty line (permanent)          | plain, reassuring       | `"Los puntos miden tu registro, no tu gasto."` (`FR-12-41`)                                                                                                                                                                                                                                                                                                               |
| Merit-lock counter                | concrete, not alarming  | `"Leyenda viva pide el 60 % del álbum. Llevas 9 de 28."` (`FR-12-17`)                                                                                                                                                                                                                                                                                                     |
| Ladder legend, permanence         | reassuring              | `"El rango alcanzado es permanente: retrocede la barra, nunca el nombre."`                                                                                                                                                                                                                                                                                                |
| Comparison placeholder (disabled) | neutral, closed door    | `"Próximamente: compara con otros coleccionistas."` (`FR-12-39`)                                                                                                                                                                                                                                                                                                          |
| Medal "no points" fact            | plain                   | `"Las medallas no dan puntos y no se revocan."`                                                                                                                                                                                                                                                                                                                           |
| Rarity legend caption             | explanatory             | `"La rareza se lee como una tirada de impresión, no como un rango de videojuego."`                                                                                                                                                                                                                                                                                        |
| Secret medal, locked              | neutral                 | `"Medalla bloqueada"` / `"Sin pista todavía"`                                                                                                                                                                                                                                                                                                                             |
| `% de coleccionistas` note        | quiet, self-aware       | `"Se enciende cuando haya más coleccionistas."` (must not render below the threshold, see §2.6)                                                                                                                                                                                                                                                                           |
| Event permanence                  | firm                    | `"Fuera de la ventana no se desbloquea nunca más."` (`BR-12-20`)                                                                                                                                                                                                                                                                                                          |
| Unlock toast kicker               | celebratory-restrained  | `"Medalla desbloqueada"`                                                                                                                                                                                                                                                                                                                                                  |
| Rank-up celebration sub           | celebratory, reassuring | `"{lore} Rango N de 10, y este no se pierde nunca."`                                                                                                                                                                                                                                                                                                                      |
| First-run empty                   | encouraging             | `"Todavía no tienes puntos. Registra tu primer pedido y empieza."`                                                                                                                                                                                                                                                                                                        |
| Rules explainer, entry link       | quiet, unpushy          | `"Cómo funciona"` (§2.9, `FR-12-48`)                                                                                                                                                                                                                                                                                                                                      |
| Rules explainer, deferred credit  | plain, de-dramatising   | `"No es un error ni un retraso: un pedido sin ningún pago anotado todavía es una intención. El primer pago es lo que lo vuelve real."` (`BR-12-13`)                                                                                                                                                                                                                       |
| Rules explainer, reserved figures | candid                  | `"Los números exactos no se publican, justamente para que no se puedan optimizar."` (`BR-12-22`)                                                                                                                                                                                                                                                                          |

Per [ux-copy.md § 2.1](../../../design/ux-copy.md), success/achievement moments are the one
register allowed **one** celebratory emoji and `--ease-bounce`. The prototype's own copy uses
none — that is compliant (emoji is permitted, never mandatory); implementation may add a single
`✨`/`🎉` to the toast or celebration copy if it reads better, but must not add a mascot (§2.7).
No string above uses an em dash; keep that discipline in every locale.

---

## 7. Responsive

Mobile-first; desktop is extra room. Breakpoint behavior is the system's — see
[interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-12 specifics:

**The prototype's mobile frame is not the real mobile shell.** Every `.phone` frame in
`collector-progression.html` renders a persistent five-icon bottom `.tabbar` (Hoy · Pedidos ·
Tiendas · Progreso · Ajustes) purely so a static, single-page demo has _some_ way to jump
between simulated screens without a router. **The app has no such bar.** Mobile primary
navigation is the header's burger button opening `AppNavDrawer`
(`src/app/[locale]/(app)/_components/AppLayout/AppNavDrawer.tsx`), an off-canvas overlay drawer,
not persistent bottom chrome (desktop uses the PUSH `Sidebar`
instead, per `interface-patterns.md § 1`). Implementation must add the `Progreso` entry to the
existing `Sidebar`/`AppNavDrawer` item list, not build a bottom tab bar to match the prototype's
staging device. Relatedly, the prototype's own sidebar and tab-bar mockups **already dropped
`Entregas`** to make room for `Progreso` (both list only Hoy · Pedidos · Tiendas · Progreso ·
Ajustes), while the real nav carries five primary items today — Dashboard, Tiendas, Pedidos,
Entregas, Ajustes (`navigationConfig.ts`) — so adding `Progreso` makes six. **Where the sixth
entry goes, and whether anything is regrouped to fit it, is an open decision for
implementation**, not something this FDD or its prototype resolves; do not drop `Entregas` from
the real nav on the strength of the prototype alone.

- **Dashboard widget**: `RankEmblem e-md` (84px) → `e-sm` (56px); tick row `s-tick` (38px, 5
  shown) → `s-tick-mob` (32px, 4 shown); footer ghost-button-plus-row collapses to one text
  link, `"{N} de {M} · Ver el álbum"`. **One plate, resized by the `--rank-emblem-size` class**
  (see `components.md`), never two plates behind `hidden` / `sm:block` wrappers — that pairing
  collapsed the emblem to a couple of pixels on every width.
- **`Progreso` tab bar**: three tabs never need horizontal scroll at any supported width; the item
  uses `--text-caption` at both sizes rather than the prototype's 13px / 12.5px pair, which is off
  the type scale. (This is the in-page `Resumen`/`Medallas`/`Rangos` `Tabs` module, unrelated to
  the prototype-only bottom `.tabbar` above.) The bar's rule is an **inset box-shadow** and its
  items carry **no negative margin** (`Tabs`, `underline` recipe, corrected 2026-08-26). The bar
  keeps `overflow-x-auto` for bars of many tabs, and that makes it a scroll container in **both**
  axes, because CSS gives an element whose other axis is `visible` an implied `auto`. The usual
  `-mb-px` on the items — the trick for pulling the active underline over the bar's own `border-b`
  — hung one pixel past the scrollport, and Chrome answered with a full vertical scrollbar down the
  side of a 44px tab bar, stealing its width and clipping the last pixel of that same underline. An
  inset shadow paints the rule inside the box with nothing to overhang, and the active item's own
  `border-b-2` covers it (a parent's inset shadow paints beneath its descendants).
- **Resumen hero**: `RankEmblem e-xl` (148px) desktop; centered, stacked, `e-lg` (120px) on
  mobile, where the points figure also reorders to sit directly under the emblem instead of at
  the foot of the card.
- **Resumen two-card row**: the `lg:grid-cols-2` applies only when the merit lock is actually
  rendered (rank 6+, `FR-12-17`). Unconditionally, the single-child grid reserved 480px of empty
  row on every account below that floor.
- **Rangos rung (mobile)**: the fact block takes `basis-full` so it wraps to its own line and the
  rank name gets the rest of the first row; sharing that row with a plate and a right-hand column
  left the name in a hundred-pixel well. The plate itself drops to 44px below `md`.
- **Rangos ladder**: full ten-row list desktop; mobile `.compact` collapses the distant locked
  band (ranks 9–7) into one disclosure row (§2.4, §5.3); the current rung's side content
  (threshold/progress) reflows from a right-aligned column to a full-width row beneath the name.
- **Album grid**: `repeat(auto-fill, minmax(216px, 1fr))` — the column count comes from a
  minimum card width, not a breakpoint, the same philosophy the dashboard's trend-chart grid
  already uses (`fdd-06-dashboard.md § 2.2`); no bespoke mobile-only grid class is needed. The
  showcase / preview grid uses `auto-fit` at `minmax(168px, 1fr)` instead (§2.5).
- **Mini-ladder (Resumen)**: three columns abreast from `sm` up, stacked rows below it. The rank
  name wraps to two lines in the column and truncates to one in the stacked row.
- **Medal detail**: 320px art column + flexible fact column desktop; single column, centered,
  below 900px (`MedalStage s-xl`, 208px, replacing `s-2xl`), with the fact list trimmed to three
  rows (§2.6).
- **Toast**: fixed bottom-right desktop; a full-width bar pinned near the bottom edge on mobile
  (`right/left: 12px; bottom: 78px` in the prototype). That offset was written to clear the
  prototype's invented bottom tab bar; the real app has no such bar to clear. What the toast
  must actually clear on mobile is the safe-area inset and, on the routes where it renders
  (`CreateOrderFab`'s dashboard + orders-list routes, `isFabEligibleRoute`), the floating
  create-order button — the same `--fab-offset`/`--fab-h` reservation the FAB-eligible routes
  already use for their own bottom padding. The exact offset is an implementation detail to
  verify against those variables, not the prototype's `78px`.
- **Celebration**: same full-viewport treatment at both sizes; medal/rank art drops one size
  step (`s-xl` → `s-md` for the medal variant); the panel narrows to the viewport with safe
  margins rather than a fixed max-width.
- **Event banner**: horizontal row desktop (banner text + countdown side by side); stacks
  vertically on mobile (`flex-direction: column`).

---

## 8. Accessibility (FRD-12 specifics)

Baseline is WCAG 2.2 AA in both themes. System-wide rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What matters
specifically here:

- **Rarity is never color-only, and this FRD does it twice over** — every rarity ring pairs
  with a mono seal glyph on the piece itself (`1ª ED` / `Nº LTD` / `HOLO` / `FIRMA`, none for
  the base tier) **and** a full-text `RarityChip` wherever a medal is listed
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)). Preserve
  both redundancies; do not simplify to "just the chip" or "just the ring."
- **The smallest medal sizes drop both signals, and the prototype now compensates.**
  `s-tick`/`s-tick-mob` (38px/32px — dashboard widget, sidebar glance, and by extension the
  toast's rarity ring at `s-sm`) hide `.stage-seal` and `.stage-note` outright at that size,
  leaving **ring color as the only rarity signal** at exactly the sizes where ADR 0006's "must
  be a shape, not just hue" requirement is hardest to satisfy in the art itself. Every
  tick-sized `MedalStage` `<figure>` in the prototype now carries `aria-label="{medal name},
{rarity level}"` (e.g. `"Medalla Mapa propio, holográfica"`), so the distinction survives for
  screen-reader and color-blind users even though the seal is visually dropped for space.
  Implementation must keep this accessible name on every `s-tick`/`s-tick-mob` instance.
- **Locked medals** communicate "locked" via icon (padlock) + text (the hint or `"Sin pista
todavía"`), never desaturation alone — already compliant in the prototype.
- **Full-screen celebration**: must carry `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby` pointing at `epic-title`, a focus trap, and Escape/backdrop dismissal. The
  prototype's `.epic-panel` now carries `role="dialog"`, `aria-modal="true"` and
  `aria-labelledby`, plus a focusable `.epic-close` button that dismisses on click, on a
  backdrop click, and on Escape (a small demo script, since a static page has no framework to
  hook into) — but it has **no real focus trap**, which a static page cannot fake credibly. That
  gap, and the trap itself, are supplied by wrapping the panel in the canonical `<Modal>` per
  `FR-12-37` (§2.7). The decorative rays/confetti/spark layers are already correctly
  `aria-hidden` in the prototype; preserve that.
- **Unlock toast**: `role="status"`, medal art `aria-hidden` (the text content already states
  name, rarity, series and count, so nothing depends on the image), countdown hairline purely
  decorative.
- **Ladder "current" marker**: the `"Estás aquí"` pill is accessible as text already; add
  `aria-current="step"` (or `"true"`) on the current rung's `<li>` so assistive tech can jump to
  it directly, beyond relying on reading order.
- **Mobile ladder expand control** (§5.3 fix): the prototype now uses a native
  `<details class="rung-jump-details">`/`<summary class="rung-jump">` disclosure, whose visible
  text (`"3 rangos más entre la cima y ti, con sus umbrales"`) is its own accessible name and
  whose open/closed state is exposed natively, satisfying the requirement without
  `aria-expanded`. Implementation may keep that native pattern or use a `<button aria-expanded>`
  with an accessible name such as `"Mostrar N rangos más"` toggling a revealed list — either
  satisfies `FR-12-33`; a static, non-interactive summary line does not.
- **Event countdown**: should not be a live region — a constantly re-announcing timer is
  disruptive. The banner's full date-range sentence is the accessible source of truth; the
  numeric countdown is a decorative reinforcement on top of it.
- **Ladder attenuation** (`.dim-1…5`): the opacity step communicates distance from the current
  rank, but the meaning is carried by position and the explicit `"te faltan N pts"` text on every
  row, not by opacity alone — compliant as designed.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/collector-progression.html`](./prototype/collector-progression.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). It introduces a
  local CSS token layer — the rarity ramp, the rank-band ramp, `--halo-warm`/`--halo-core`,
  `--scrim`, `--stage-core`/`--stage-edge` — that does not yet exist in
  `docs/design/tokens-css.md`; treat these as **pending promotion to `tokens-css.md`, gated on
  an AA-contrast pass** (§3.1), in the same change that ships `FRD-12`. Its route bar also shows
  Spanish, section-scoped paths for staging (`/progreso`, `/progreso/album`,
  `/progreso/album/{medalKey}`, `/progreso/rangos`); the FRD's route contract —
  `/{locale}/progress`, `/{locale}/progress?tab=…`, `/{locale}/progress/medals/[medalKey]`
  (`FR-12-30`, `FR-12-34`) — governs implementation, not the prototype's address bar.
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns (§4 Tabs, §5 Modals, §7 Chip-Eyebrow + Top-Accent, §8 Status/
  Badges/Chips, §11 Toast, §15 Progress Meters), motion.md (§4 reduced motion, §6.4 count/number
  change, §6.5 success micro-moment), states.md (§2 EmptyState, §4 Mascot policy), and ADRs
  0001 (achievement toast, historical description, partially superseded — see §2.7), 0002
  (status chip mapping, **not** used for rarity), 0006 (color-blindness icon+label contract),
  0008 (canonical Modal, Semantic Depth), 0013 (cross-cutting states; **binding** mascot
  exclusion, D5), 0014 (motion / view transitions), 0035 (accepted — the point ledger this
  domain is built on), and 0036 (accepted — the medal rarity visual system §3.1 details).
- **Functional contract**: [`frd-12-collector-progression.md`](./frd-12-collector-progression.md)
  (`FR-12-01…47`, `BR-12-01…21`, `AC-12-01…16`), status `ACTIVE` since `WO-07` closed. Its
  Implementation Notes call for six new ADRs (numbered from `0035`); all six are now accepted
  (`0035`–`0040`, cited in §1), one per work order that owed one, and `0040` carries a dated
  amendment from the medal catalogue v2 pass.
- **Gaps between the prototype and the functional contract**, tracked so they aren't
  rediscovered as regressions: the `"% de coleccionistas"` row that must be **omitted** entirely
  below the user-count threshold rather than rendered dimmed (§2.6); the celebration overlay's
  `role="dialog"`/close-button/Escape treatment being a static-page approximation that still
  needs the real focus trap only a canonical `<Modal>` wrapper supplies (§2.7, §8); the merit-lock
  card rendering unconditionally in the prototype's Resumen tab even though the demo collector
  is rank 4, below the rank-6 floor `FR-12-17` sets, so implementation must gate it and the
  prototype does not model that gate (§2.3); the prototype's mobile frame staging a persistent
  bottom tab bar and dropping `Entregas` from its nav, neither of which reflects the real
  `AppNavDrawer`-based mobile shell or its five-item nav (§7); and the prototype's Spanish,
  section-scoped URLs versus the FRD's locale-prefixed route contract (above). The monthly point
  breakdown, merit-lock counter, honesty line, comparison placeholder, the mobile ladder's
  disclosure row, and the tick-sized medals' accessible names were also absent from earlier
  drafts of the prototype; all six are now present (§2.3, §2.4, §8) and are no longer tracked
  here as gaps.
