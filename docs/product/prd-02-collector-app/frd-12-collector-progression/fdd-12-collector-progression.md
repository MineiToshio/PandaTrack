---
id: FDD-12
type: FDD
slug: collector-progression
title: Collector Progression — Feature Design Document
status: DRAFT
parent: FRD-12
last_updated: 2026-08-23
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

The prototype's `#p0` is a **structural map, not a shipped screen** — a diagram of how the
`Progreso` entry fans out into its three tabs, where the medal detail subview hangs off
`Medallas`, and where the dashboard widget and the two global overlays sit relative to it. It
is cited here only as the reading order for this document, not as a ninth anchor to
implement.

Requirements traced throughout: `FR-12-01 … FR-12-47`, `BR-12-01 … BR-12-21`,
`AC-12-01 … AC-12-16` (see [`frd-12-collector-progression.md`](./frd-12-collector-progression.md),
status `DRAFT` at the time of this FDD). Its Implementation Notes call for six ADRs numbered
from `0035`; two are accepted, [`0035`](../../../design/decisions/0035-collector-progression-point-ledger.md)
(the point ledger) and [`0036`](../../../design/decisions/0036-medal-rarity-visual-system.md) (the
medal rarity visual system), so this document cites those two for anything they cover — the
remaining four (`0037`–`0040`) are still unwritten and this document does not cite numbers for
them.

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
p.muted "Los puntos miden tu registro, no tu gasto." (permanent, not dismissible)
card.sunken "soon" — "Comparación entre coleccionistas" · "Próximamente: compara con otros
  coleccionistas."
section-title "Medallas" + Chip neutral mono "{N} de {M}" + ghost "Ver el álbum completo →"
medal-grid (showcase — the most recently unlocked, not all 24)
card "Rangos"
  mini-ladder: 3 rungs (previous · current · next), RankEmblem e-xs (38px) each
  ghost "Ver la escalera completa →"
```

**The four elements `FRD-12` requires here and the prototype originally omitted are now
present**, in the block above, beneath the hero and above the `Medallas` showcase:

- The **monthly point breakdown by rule group** (`FR-12-31`) as a `card` with one row per rule
  group and a `+{N}` total chip, reusing the existing `card`/`section-title`/`chip` grammar —
  no new component.
- The **merit-lock counter** (`FR-12-31`, `FR-12-17`) as a second card with the mandated plain
  copy — `"Leyenda del gremio pide el 60 % del álbum. Llevas 9 de 24."` — never only a bare
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
               dot(border-strong) "Bloqueado, se atenúa hacia la cima" ·
               "El rango alcanzado es permanente: retrocede la barra, nunca el nombre."
ol.ladder (vertical, summit first)
  li.is-summit.is-locked      rank 10 — "La cima" tag, RankEmblem e-lg em-summit glow-summit,
                               centered name+lore, threshold + "te faltan N pts" + Bloqueado
  li.is-locked.dim-{5..1}     ranks 9→5 — RankEmblem e-sm em-high, name+lore,
                               threshold + gap + Bloqueado (opacity steps toward the summit:
                               0.94 → 0.86 → 0.78 → 0.70 → 0.62, see §3.3)
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

| State                                        | Art treatment                                                                                    | Body                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unlocked                                     | Full-color `MedalStage s-lg` (168px), rarity ring + seal, sheen active                           | `h3` name, `p.cond` condition text, footer: `RarityChip` + unlock date                                                                                                                                                                                                            |
| Locked, hinted                               | Grayscale silhouette (`filter: grayscale(1) brightness(.42) contrast(1.15)`) + lock icon overlay | `h3` "Medalla bloqueada"-style title **is not shown**; instead `h3` name **is** shown for hinted locks (the prototype keeps the real name, e.g. "La espera imposible"), `hint-label` "Cómo conseguirla" + `p.cond` states the real condition, footer: `RarityChip` only (no date) |
| Locked, secret (3 pieces, `Secretas` series) | Same silhouette + lock                                                                           | `h3` "Medalla bloqueada" (neutral, generic), `hint-label` "Cómo conseguirla" but the body reads `"Sin pista todavía"`, footer: `RarityChip` only                                                                                                                                  |

This is `FR-12-25`'s distinction rendered exactly: every locked medal outside `Secretas` shows
its real name and condition as a hint; the three `Secretas` pieces alone hide both behind a
neutral label. Do not generalize the "hidden name" treatment to any other series.

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

Both primitives get a placeholder art hole (§4) while final medal/emblem art doesn't exist yet;
the prototype's `data-medal` attribute and mono `"Imagen"` caption inside `.stage-note` mark
that hole explicitly rather than shipping a guessed illustration.

**Elevation.** Cards (album, hero, detail) use the standard system elevation (list card = 1,
section card = 2). The toast reuses the achievement-toast composition (`--elevation-3` +
rarity-tinted halo, §3.1). The full-screen celebration panel needs its own bespoke elevation
recipe beyond the documented `--elevation-4` ceiling (larger blur radius, rarity/accent-tinted
glow) — the same kind of one-off `--modal-shadow` treatment the canonical `<Modal>` already
carries for its own desktop panel; do not reuse `--elevation-4` unmodified.

**Locked-medal treatment** (`grayscale(1) brightness(.42) contrast(1.15)` + a centered lock
icon) is a new, domain-specific "locked art" recipe — distinct from the generic interactive
`disabled` state layer (`visual-foundations.md § Focus and state layers`), which governs
controls, not illustrative art. The two do not conflict; record the locked-art recipe as its
own pattern when `MedalCard`/`MedalStage` land in `components.md`.

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
| `EmptyState`                    | module | First-run empty (`FR-12-40`) and the "0 de 12" all-silhouette album state                                                                                                                                                                                                        |
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
empieza."` — encouraging tone, primary CTA into order creation.
- **Album, nothing unlocked**: every medal renders as a silhouette; the counter reads
  `"0 de 12"` (phase 1's shipped total), not an empty container.
- **Recompute in progress** (`FR-12-11`, Error Contract `PROGRESS_RECOMPUTE_BUSY`): a
  non-blocking notice over the cached values ("may be a few minutes old"), never a full-page
  loading replacement of already-known data.

### 5.2 Lock states (medal album)

| State                          | Visual                                                      | Copy                                                               |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `locked` (hinted)              | Silhouette + lock icon                                      | Real name + real condition text as the hint (`FR-12-25`)           |
| `locked-secret` (3 pieces)     | Silhouette + lock                                           | Neutral title `"Medalla bloqueada"`, `"Sin pista todavía"`         |
| `unlocked`                     | Full color, rarity ring + seal                              | Real name, condition, unlock date                                  |
| `unlocked-not-current`         | Full color (same as `unlocked` — never dims)                | Adds `"ya no vigente"` without withdrawing the unlock (`BR-12-08`) |
| `expired` (event, past window) | Silhouette, permanently — never re-offered as merely locked | States the window has closed, per `BR-12-20`                       |

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

| Surface                           | Tone                    | String                                                                                                   |
| --------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Rank hero eyebrow                 | matter-of-fact, private | `"Rango N de 10 · solo tú lo ves"`                                                                       |
| First order-created feedback      | confidence-building     | `"Sumaste 5 puntos. Se suman 20 más cuando registres el primer pago o la primera llegada."` (`FR-12-05`) |
| Honesty line (permanent)          | plain, reassuring       | `"Los puntos miden tu registro, no tu gasto."` (`FR-12-41`)                                              |
| Merit-lock counter                | concrete, not alarming  | `"Leyenda del gremio pide el 60 % del álbum. Llevas 9 de 24."` (`FR-12-17`)                              |
| Ladder legend, permanence         | reassuring              | `"El rango alcanzado es permanente: retrocede la barra, nunca el nombre."`                               |
| Comparison placeholder (disabled) | neutral, closed door    | `"Próximamente: compara con otros coleccionistas."` (`FR-12-39`)                                         |
| Medal "no points" fact            | plain                   | `"Las medallas no dan puntos y no se revocan."`                                                          |
| Rarity legend caption             | explanatory             | `"La rareza se lee como una tirada de impresión, no como un rango de videojuego."`                       |
| Secret medal, locked              | neutral                 | `"Medalla bloqueada"` / `"Sin pista todavía"`                                                            |
| `% de coleccionistas` note        | quiet, self-aware       | `"Se enciende cuando haya más coleccionistas."` (must not render below the threshold, see §2.6)          |
| Event permanence                  | firm                    | `"Fuera de la ventana no se desbloquea nunca más."` (`BR-12-20`)                                         |
| Unlock toast kicker               | celebratory-restrained  | `"Medalla desbloqueada"`                                                                                 |
| Rank-up celebration sub           | celebratory, reassuring | `"{lore} Rango N de 10, y este no se pierde nunca."`                                                     |
| First-run empty                   | encouraging             | `"Todavía no tienes puntos. Registra tu primer pedido y empieza."`                                       |

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
  link, `"{N} de {M} · Ver el álbum"`.
- **`Progreso` tab bar**: three tabs never need horizontal scroll at any supported width; font
  drops 13px → 12.5px on mobile, matching the m-head-scoped `.subtabs` override. (This is the
  in-page `Resumen`/`Medallas`/`Rangos` `Tabs` module, unrelated to the prototype-only bottom
  `.tabbar` above.)
- **Resumen hero**: `RankEmblem e-xl` (148px) desktop; centered, stacked, `e-md` (84px) on
  mobile.
- **Rangos ladder**: full ten-row list desktop; mobile `.compact` collapses the distant locked
  band (ranks 9–7) into one disclosure row (§2.4, §5.3); the current rung's side content
  (threshold/progress) reflows from a right-aligned column to a full-width row beneath the name.
- **Album grid**: `repeat(auto-fill, minmax(216px, 1fr))` — the column count comes from a
  minimum card width, not a breakpoint, the same philosophy the dashboard's trend-chart grid
  already uses (`fdd-06-dashboard.md § 2.2`); no bespoke mobile-only grid class is needed.
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
  (`FR-12-01…47`, `BR-12-01…21`, `AC-12-01…16`), status `DRAFT`. Its Implementation Notes call
  for six new ADRs (numbered from `0035`); two are accepted (`0035`, `0036`, cited above) and
  four remain unwritten (`0037`–`0040`), one per remaining work order — this document cites only
  the two that exist.
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
