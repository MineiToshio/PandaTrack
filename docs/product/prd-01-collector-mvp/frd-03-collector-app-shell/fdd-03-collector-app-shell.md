---
id: FDD-03
type: FDD
slug: collector-app-shell
title: Collector App Shell — Feature Design Document
status: ACTIVE
parent: FRD-03
last_updated: 2026-06-16
prototype: ./prototype/collector-app-shell.html
design_system: ../../../design/README.md
demo_anchors:
  - "#dashboard"
---

# FDD-03 · Collector App Shell — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-03, so the feature's design is
> reconstructible without depending on the disposable `docs/redesign/` workshop. It
> pairs with the self-contained prototype at [`./prototype/collector-app-shell.html`](./prototype/collector-app-shell.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to the Collector App Shell, and **cites the prototype** for the exact pixel. When this
> FDD and the design system disagree on a system-wide rule, `docs/design/` wins. When this
> FDD and the prototype disagree on a shell-specific visual, the prototype wins until this
> FDD is corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in the shell
> and dashboard namespaces under `src/i18n/locales/en/*.json`.

---

## 1. Overview & screens covered

The Collector App Shell is **not a screen — it is the chrome every other collector
workspace inherits.** It is the stable app frame that wraps every authenticated `(app)`
route: a left navigation **sidebar**, a **top bar**, and a single **content column**. When
FRD-05 (Orders), FRD-08 (Deliveries), FRD-09 (Stores), and Settings render their list /
detail / wizard grammar, they render _inside this shell_. The shell's job is to disappear:
clarity over novelty, one predictable frame so a returning user always knows where
navigation, breadcrumbs, language, theme, and their account live.

Because the shell has no content of its own, the prototype renders it around a **single
representative screen** — the **dashboard placeholder** (`#dashboard`). The dashboard is
**out of scope for the MVP as a feature**: it is a placeholder that exists only to give the
shell something to frame. The bento of KPIs, the "Anotar pago" inline flow, the activity
feed, and the mascot that the workshop spec
([`docs/redesign/screens/dashboard.md`](../../../redesign/screens/dashboard.md)) describes
are **not** FRD-03 deliverables and are documented here only as the placeholder content the
prototype happens to show. **The real subject of this FDD is the shell itself.**

### Screens in this FDD

| #   | Screen                            | Route             | Prototype anchor |
| --- | --------------------------------- | ----------------- | ---------------- |
| 1   | App shell + dashboard placeholder | `/{locale}` (`/`) | `#dashboard`     |

The single anchor frames the four shell regions described in §2: the sidebar, the top bar,
the content frame, and (functionally, not in the desktop-only prototype markup) the mobile
burger drawer.

Requirements traced throughout: `FR-03-01 … FR-03-08`, `BR-03-01 … BR-03-05`,
`AC-03-01 … AC-03-04` (see [`frd-03-collector-app-shell.md`](./frd-03-collector-app-shell.md)).
The shell's layout, sidebar push behavior, and breadcrumb top bar are governed by
[ADR 0003](../../../design/decisions/0003-demo-decisions.md); the constrained content header
by [ADR 0011](../../../design/decisions/0011-mobile-detail-secondary-actions.md); the
account-area styling by [ADR 0012](../../../design/decisions/0012-account-destructive-action-styling.md).

---

## 2. Layout & structure per screen

The shell is the system's normative app frame — see
[interface-patterns.md → The collector app shell](../../../design/interface-patterns.md).
This FDD does not redefine it; it records the anatomy as the prototype assembles it. In the
prototype the whole frame is a single rounded card (`.app-shell`, `border-radius: 24px`,
`box-shadow: var(--shadow-2)`) that becomes a CSS grid at `≥1024px`
(`grid-template-columns: 240px 1fr`).

### 2.1 The sidebar (`.app-sidebar`)

A vertical column on `bg-surface-elevated` with a `border-right`, top to bottom in the
**inviolable order** the system mandates:

```
app-sidebar-brand        Logo mark (demo-brand-mark "P") + "PandaTrack"
app-nav-link (×5)        Hoy · Pedidos · Entregas · Tiendas · Ajustes
app-sidebar-footer       account affordance (avatar + username) + collapse control beneath
```

- **Brand (top):** the `Logo` wordmark — the one place Zilla Slab appears
  ([components.md](../../../design/components.md)).
- **Navigation:** five `app-nav-link`s, each an icon + label. The active route carries
  `is-active` (raised to `--text-primary`, accent-tinted state layer). The icons are
  `layout-dashboard` (`"Hoy"`), `package` (`"Pedidos"`), `truck` (`"Entregas"`),
  `store` (`"Tiendas"`), `settings` (`"Ajustes"`). **`Settings` lives in the lower account
  area conceptually but is surfaced as a primary nav row in the prototype's placeholder;**
  the functional contract (FR-03-06) keeps account actions in the lower shell, not the
  header.
- **User footer (`.app-sidebar-footer` / `ShellAccountMenu`):** the account trigger
  (avatar + username) with the **collapse control (`.app-sidebar-collapse-btn`) directly
  beneath it.** The avatar never moves to the top bar (BR-03-04). The prototype's placeholder
  footer also shows the legacy mascot status chip (`🐼 Pan · ON`); that mascot affordance is
  **not** an FRD-03 deliverable and is retained only as placeholder dressing.

**Three sidebar states (FR-03-03, the PUSH model — ADR 0003):**

| State             | Width   | Behavior                                                                                                                  |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Expanded          | `240px` | Full nav with labels; default.                                                                                            |
| Collapsed (rail)  | `64px`  | Icons only; labels hidden (`font-size: 0`), brand mark compacts, footer compacts, collapse chevron rotates `180deg`.      |
| Collapsed + hover | `240px` | The rail **pushes**: `:has(.app-sidebar:hover)` grows the grid column and the content moves right — it never floats over. |

The grid column animates (`grid-template-columns 220ms cubic-bezier(0.2,0,0,1)`) so the
content frame slides predictably. Hover-expand is **PUSH, never overlay** — preserving
predictability is the whole point (interface-patterns.md). The collapse state **persists per
user**; FR-03-07 reflects it through the shared `--sidebar-current-w` CSS variable on the
content grid.

### 2.2 The top bar (`.app-topbar`)

A horizontal bar at the top of the content column. Its contract is deliberately **narrow**
(ADR 0011): `[☰] + breadcrumb + title` on the left, language and theme toggles on the right,
and **nothing else** — no back navigation, no overflow (`⋯`) menu, no account avatar.
Contextual actions (secondary actions, back links, CTAs) belong to `<main>`, not the shell
header.

```
app-topbar     [☰ burger (mobile)] · breadcrumb chain · presentational title │ spacer │ lang · theme
```

- **Breadcrumbs:** ancestors are links (`--text-muted`, hover to `--text-primary`), the
  current segment is plain `--text-primary` `font-weight 500`, separators are chevrons at
  `opacity 0.5`. The breadcrumb is navigation; a screen's back-link is a separate shortcut
  inside `<main>` (interface-patterns.md → Breadcrumbs). At the root, the prototype shows the
  presentational title (`"Dashboard"`) rather than a breadcrumb chain.
- **The title is presentational, not a document heading** — exactly one primary `h1` lives in
  `<main>`, so the outline keeps one title per view.
- **Language toggle (`.lang-toggle`)** and **compact theme toggle (`.theme-toggle-compact`)**
  sit on the right after the spacer. In the prototype's placeholder the right slot is a
  `⌘K`-search affordance (`.app-topbar-action`); the functional contract puts lang + theme
  there (FR-03-06).

### 2.3 The content frame (`.app-content`)

The single main content column to the right of the sidebar. It owns the page: a constrained
width (`max-width: 1280px` on `main`, generous `padding`), and it is where every workspace's
hero, list, detail, and wizard render. The shell guarantees the frame, not its contents. In
the prototype it holds the dashboard placeholder bento — out of scope per §1.

### 2.4 Mobile navigation (burger drawer)

Below `1024px` the `.app-sidebar` is `display: none` and the **burger-triggered drawer
(`AppNavDrawer`) is the single primary navigation surface** (FR-03-04). The `[☰]` control in
the top bar opens it; the **same account affordance that lives in the expanded sidebar footer
appears in the drawer** (do not split core account actions between header and drawer —
BR-03-05). The drawer is an anchored inline expansion, not a floating panel.

> **Removed during the redesign (do not reintroduce):** the 4-tab `MobileTabBar` (its token
> `--mobile-tab-bar-h` and `mobileTabBar.*` i18n keys were dropped — S5.2), and the floating
> action button (`FAB`) + idle `MascotBubble` (the component files survive but the shell no
> longer mounts them). The burger drawer is the sole primary mobile navigation.

---

## 3. Visual treatment

The shell introduces **no new tokens, palettes, surfaces, or type ramps.** It consumes the
Velvet system as-is; the definitions live in
[visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md). This section records only how the shell
_applies_ the system.

### 3.1 Color roles

| Role in this FRD                         | Token / class                                | Where                                    |
| ---------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| Shell canvas                             | `--background`                               | behind the `.app-shell` card             |
| Sidebar surface                          | `--surface-elevated` (`bg-surface-elevated`) | `.app-sidebar`                           |
| Shell card / content surface             | `--surface`                                  | `.app-shell` body, `.app-content`        |
| Sidebar / top-bar dividers               | `--border`                                   | sidebar `border-right`, top-bar edge     |
| Active nav row + focus                   | `--accent`                                   | `app-nav-link.is-active`, `--focus-ring` |
| Nav / control hover state layer          | `color-mix(--text-primary, --state-hover)`   | nav link, collapse btn, lang/theme hover |
| Active-route / current-crumb text        | `--text-primary`                             | active nav label, breadcrumb `.current`  |
| Ancestor crumb, inactive nav, muted meta | `--text-muted` / `--text-secondary`          | breadcrumb links, idle nav labels        |

The sidebar surface is **`--surface-elevated`** (FR-03-06), one step above the content card,
so the navigation reads as chrome distinct from the page.

### 3.2 Typography

- The brand wordmark uses **Zilla Slab via `Logo`** — the only Zilla Slab in the app.
- Nav labels and the breadcrumb current segment are body weight; the current crumb is
  `font-weight 500`.
- The top-bar title is a presentational line, not an `h1` ramp — it must not compete with the
  page's single primary heading.
- The shell itself carries no large display numerals; the dashboard placeholder's hero uses
  the system display ramp, but that is placeholder content, not shell typography.

### 3.3 Shape, radius & elevation

Standard system values, no overrides. The notable shell-specific choice is the **outer
frame**: the prototype wraps the whole shell in a single rounded card
(`border-radius: 24px`, `box-shadow: var(--shadow-2)`, `overflow: hidden`) so the app reads
as one contained surface. Elevation is border-led (the sidebar is separated by a
`border-right`, not a drop shadow). The collapse chevron is the only rotating affordance
(`rotate(180deg)` in the collapsed state).

---

## 4. Components consumed

Everything below already exists in the catalog — see
[components.md](../../../design/components.md). The shell is an **assembly of existing module
components**; it must not fork or reinvent any of them.

| Component          | Tier   | Role in FRD-03                                                                                                                             |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Sidebar`          | module | The PUSH sidebar — collapsed rail expands on hover; burger drawer on mobile ([ADR 0003](../../../design/decisions/0003-demo-decisions.md)) |
| `Header`           | module | The top bar — breadcrumbs + lang + theme                                                                                                   |
| `Logo`             | core   | Brand wordmark at the sidebar top (the only Zilla Slab surface)                                                                            |
| `ShellAccountMenu` | module | Lower-shell account trigger (avatar + username), shared between desktop sidebar footer and mobile drawer                                   |
| `AppNavDrawer`     | module | Mobile burger drawer — the single primary mobile navigation                                                                                |
| `ThemeToggle`      | core   | Compact light/dark control in the top bar                                                                                                  |
| `LangToggle`       | core   | `es` / `en` switch in the top bar                                                                                                          |
| `AppPageHero`      | module | Private-app page intro header, rendered by the workspaces _inside_ the content frame (not by the shell)                                    |

> **Not consumed by the shell (intentionally):** `FAB` and `MobileTabBar` — see the removed
> list in §2.4. They remain in the catalog but the app layout no longer mounts them.

The cross-app redesign patterns the shell **hosts but does not own** — the adaptive `Modal`,
the single-primary sticky action bar, and the Chip-Eyebrow + Top-Accent section card — belong
to the design system and to the individual workspace FDDs, not to FRD-03.

---

## 5. Interactions & states

### 5.1 Sidebar collapse, hover-expand & persistence (FR-03-03 / FR-03-07)

- **Collapse toggle:** the `.app-sidebar-collapse-btn` beneath the account trigger toggles
  the `data-sidebar` state between `expanded` and `collapsed`; the chevron rotates `180deg`.
- **Hover-expand (PUSH):** while collapsed, `:has(.app-sidebar:hover)` grows the grid column
  to `240px` and the content **moves right** — the sidebar never overlays content. Leaving the
  hover returns it to the `64px` rail.
- **Persistence:** the collapse choice persists per user and is reflected on the content grid
  through `--sidebar-current-w` (the implementation's shared hook). Reopening the app restores
  the last state.
- **Label reveal:** when the rail expands (by toggle or hover), labels fade in with a slight
  delay (`opacity 180ms … 60ms`) so they don't pop before the width has grown.

### 5.2 Navigation & active state

- The current route's `app-nav-link` carries `is-active`; only one nav row is active at a
  time. Hover applies the shared state-layer mix; focus shows `--focus-ring`.
- The breadcrumb chain updates per route (ancestors as links, current as plain text); at the
  root only the presentational title is shown.

### 5.3 Top-bar controls

- **Theme toggle:** light/dark; the workshop's decision keeps `localStorage["theme"]` with
  `default system`, synced with settings (placeholder behavior — implementation detail, not a
  shell-specific design rule).
- **Language toggle:** switches `es` ⇄ `en`; the routed locale segment drives copy.
- **Mobile burger:** `[☰]` opens the `AppNavDrawer`; the drawer carries the same account
  affordance as the desktop footer.

### 5.4 Cross-cutting states

The shell is persistent chrome and has **no list/empty/error states of its own** — those
belong to the workspaces it frames. System-wide state rules live in
[states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). The dashboard
placeholder's empty / loading / per-bento-error behaviors documented in the workshop spec are
**out of scope** for FRD-03.

### 5.5 Motion

Shell motion is restrained and system-level — see [motion.md](../../../design/motion.md):

- Grid column animates on collapse / hover-expand (`220ms cubic-bezier(0.2,0,0,1)`).
- Sidebar width + padding animate (`200ms`); labels fade with a `60ms` delay; the collapse
  chevron rotates (`200ms`).
- **Reduced motion:** the prototype gates non-essential animation behind
  `@media (prefers-reduced-motion: reduce)`; the collapse/expand collapses to an instant or
  fade with no spring. Hover/press, focus, and the transform/opacity rule are inherited
  unchanged from the system.

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md). The
shell's copy is almost entirely **navigation labels**, which use the canonical glossary
(`pedido ↔ order`, `entrega ↔ delivery`, `tienda ↔ store`) — see
[glossary.md](../../glossary.md). Strings live in the shell namespace under
`src/i18n/locales/{es,en}/*.json`.

Key strings (es), by surface:

| Surface                | Tone              | String       |
| ---------------------- | ----------------- | ------------ |
| Nav · dashboard        | direct, present   | `"Hoy"`      |
| Nav · orders           | glossary noun     | `"Pedidos"`  |
| Nav · deliveries       | glossary noun     | `"Entregas"` |
| Nav · stores           | glossary noun     | `"Tiendas"`  |
| Nav · settings         | glossary noun     | `"Ajustes"`  |
| Collapse control label | quiet, functional | `"Colapsar"` |

The dashboard label is `"Hoy"` (not "Inicio"/"Dashboard") — a present-tense, collector-facing
voice for "what do I have to deal with today". The top-bar title shown by the placeholder
(`"Dashboard"`) is presentational chrome and not a user-voice string the shell owns.

---

## 7. Responsive

Mobile-first; desktop is extra room. Breakpoint behavior is the system's — see
[interface-patterns.md → Responsive](../../../design/interface-patterns.md). The shell's
responsive story **is the desktop ⇄ mobile navigation transformation**:

- **Desktop (`≥1024px`):** the `.app-shell` becomes a two-column grid
  (`240px 1fr`); the `.app-sidebar` is `display: flex` and persistent; the top bar shows the
  breadcrumb chain, lang, and theme. Collapse / hover-expand (§5.1) is a desktop-only
  affordance.
- **Mobile / tablet (`<1024px`):** the `.app-sidebar` is `display: none`; navigation moves
  entirely into the **burger-triggered `AppNavDrawer`** reached from the top-bar `[☰]`. The
  drawer carries the same account affordance as the desktop footer (BR-03-05). There is **no
  bottom tab bar and no FAB** — both were removed (§2.4).
- The content frame is full-width on mobile and constrained (`max-width`) on desktop; each
  workspace owns its own internal responsive collapse (e.g. tables → cards), not the shell.

---

## 8. Accessibility (FRD-03 specifics)

Baseline is WCAG 2.2 AA in both themes. System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What matters
specifically for the shell:

- **Sidebar is a landmark:** `.app-sidebar` is an `<aside>` with `aria-label`
  (`"Navegación principal"`), so assistive tech can jump to navigation.
- **Active route is announced, not color-only:** the active nav row carries an active
  semantic (`aria-current`) in addition to the accent state layer — status is never carried by
  color alone ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).
- **Collapse control is keyboard-operable and labelled:** the collapse button has a textual
  `"Colapsar"` label (visible when expanded, retained as an accessible name when collapsed)
  and a discernible state.
- **Hover-expand has a keyboard-equivalent:** expansion is not hover-only — focusing into the
  collapsed rail or toggling the collapse control reveals the labels (FR-03-04's intent that
  the experience never depends on hover).
- **Breadcrumb is real navigation:** ancestor crumbs are focusable links; the current segment
  is plain text, not a link.
- **Burger drawer:** the `[☰]` trigger exposes its expanded state; the drawer manages focus and
  is dismissible by keyboard; it does not trap focus permanently.
- **One primary heading per view:** the top-bar title is presentational, leaving the single
  `h1` to `<main>` so the heading outline stays correct for screen-reader navigation.

---

## 9. Sources & provenance

- **Pixel truth:** [`./prototype/collector-app-shell.html`](./prototype/collector-app-shell.html)
  (self-contained; opens standalone in light + dark; default palette Velvet; renders the full
  shell — `.app-shell`, `.app-sidebar`, `.app-nav-link`, `.app-sidebar-collapse-btn`,
  `.app-topbar`, breadcrumbs — around the `#dashboard` placeholder).
- **System rules:** [`docs/design/`](../../../design/README.md) — interface-patterns (the
  normative collector app shell), visual-foundations, tokens-css, components, motion, states,
  ux-copy, and ADRs
  [0003](../../../design/decisions/0003-demo-decisions.md),
  [0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md),
  [0011](../../../design/decisions/0011-mobile-detail-secondary-actions.md),
  [0012](../../../design/decisions/0012-account-destructive-action-styling.md), and
  [0013](../../../design/decisions/0013-cross-cutting-state-system.md).
- **Functional contract:** [`frd-03-collector-app-shell.md`](./frd-03-collector-app-shell.md)
  and its linked blueprint.
- **Workshop raw material (disposable):**
  [`docs/redesign/screens/dashboard.md`](../../../redesign/screens/dashboard.md) — the
  dashboard placeholder wireframe (out of scope for the MVP; documents the mascot, walking
  strip, FAB, and bento that the shell merely frames). This is being archived; this FDD + the
  prototype are the durable record of the shell.
