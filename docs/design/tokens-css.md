---
title: CSS-variable contract — Tailwind v4 @theme + token system
last_updated: 2026-06-16
status: canonical — applied in src/app/globals.css
owner: Sergio Minei
---

# CSS-variable contract (Velvet design system)

> **This file is the canonical CSS-variable contract, applied in `src/app/globals.css`.**
> It is the human-readable mirror/reference for the design tokens that ship in the live app.
> If `src/app/globals.css` and this document ever diverge, treat the rules in
> [`visual-foundations.md`](./visual-foundations.md) plus this contract as the target and bring
> the CSS toward it.
>
> For the semantic explanation of each token group (what each role means, contrast ratios,
> usage rules, and the justification behind the values), see
> [`visual-foundations.md`](./visual-foundations.md). This file documents the literal variable
> contract; `visual-foundations.md` documents the meaning.
>
> Conventions:
>
> - `@theme` declares static, non-color, non-font tokens **once** (type scale, spacing, radius,
>   breakpoints, z-index, motion, elevation indirection).
> - `@theme inline` exposes color and font roles as Tailwind utilities (`bg-*`, `text-*`,
>   `font-*`), pointing at the runtime variables so the utilities stay theme-aware.
> - The light/dark switch lives in `:root[data-theme="light"]` / `:root[data-theme="dark"]`
>   so the Tailwind-generated API is never duplicated.
> - Brand palettes redefine only what changes per brand. Velvet is the default and currently
>   ships its canvas/brand values directly inside the theme override blocks.
> - State layers are published as reusable `color-mix(...)` recipe classes, not as fixed tokens.
> - **Neutral-color mixes use `oklab`, not `oklch`.** Mixing a low-chroma neutral (e.g.
>   `--text-primary`) in `oklch` drifts the hue toward pink. This is a documented guard in the
>   repo: any `color-mix` whose first color is a neutral token must use `in oklab`. Brand-color
>   mixes (accent, status) stay in `oklch`.

---

## 1. `@theme` — static tokens (non-color, non-font)

```css
@import "tailwindcss";
@source not "../../docs/**";
@source not "../../.cursor/**";
@source not "../../*.md";

@theme {
  /* ─── Type scale ─── */
  --text-display: clamp(2.5rem, 4vw + 1rem, 3.5rem);
  --text-display--line-height: 4rem;
  --text-display--letter-spacing: -0.03em;

  --text-title: 2rem;
  --text-title--line-height: 2.5rem;
  --text-title--letter-spacing: -0.02em;

  --text-subtitle: 1.375rem;
  --text-subtitle--line-height: 1.75rem;
  --text-subtitle--letter-spacing: -0.01em;

  --text-body-lg: 1.0625rem;
  --text-body-lg--line-height: 1.625rem;
  --text-body-lg--letter-spacing: 0;

  --text-body: 0.9375rem;
  --text-body--line-height: 1.375rem;
  --text-body--letter-spacing: 0;

  --text-caption: 0.8125rem;
  --text-caption--line-height: 1.125rem;
  --text-caption--letter-spacing: 0.005em;

  --text-mono-lg: 0.9375rem;
  --text-mono-lg--line-height: 1.375rem;
  --text-mono-lg--letter-spacing: 0;

  --text-mono: 0.8125rem;
  --text-mono--line-height: 1.125rem;
  --text-mono--letter-spacing: 0.02em;

  --text-eyebrow: 0.6875rem;
  --text-eyebrow--line-height: 0.875rem;
  --text-eyebrow--letter-spacing: 0.08em;

  /* ─── Spacing scale ─── */
  --spacing: 0.25rem; /* base step Tailwind v4 */

  --space-0: 0;
  --space-px: 1px;
  --space-0_5: 0.125rem;
  --space-1: 0.25rem;
  --space-1_5: 0.375rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;
  --space-32: 8rem;
  --space-48: 12rem;

  /* ─── Layout magic numbers — app shell contracts ─── */
  --sidebar-w-expanded: 15rem;
  --sidebar-w-collapsed: 4rem;
  --header-h: 3.5rem;
  --header-h-desktop: 4rem;
  --drawer-w: 27.5rem;
  --sheet-max-h: 92svh;
  --modal-max-w: 32rem;
  --modal-max-w-lg: 48rem;
  --toast-max-w: 22rem;
  --container-max-w: 80rem;
  --container-max-w-prose: 42rem;
  --fab-size: 3.5rem;
  --fab-offset: 1rem;

  /* ─── Radius ─── */
  --radius-xs: 0.25rem;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.25rem;
  --radius-pill: 9999px;
  --radius-full: 9999px;

  /* ─── Breakpoints ─── */
  --breakpoint-xs: 24rem;
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
  --breakpoint-2xl: 96rem;

  /* ─── Z-index scale ─── */
  --z-base: 0;
  --z-sticky: 10;
  --z-sidebar: 20;
  --z-header: 30;
  --z-mascot: 35;
  --z-fab: 38;
  --z-popover: 40;
  --z-drawer: 50;
  --z-sheet: 60;
  --z-modal-backdrop: 70;
  --z-modal: 80;
  --z-toast: 90;
  --z-command: 100;
  --z-tooltip: 110;

  /* ─── Motion — durations ─── */
  --motion-instant: 100ms; /* discrete feedback: toggle flip, checkmark, count tick — snappier than --motion-fast */
  --motion-fast: 150ms;
  --motion-base: 280ms;
  --motion-slow: 480ms;

  /* ─── Motion — easings ─── */
  --ease-emphasis: cubic-bezier(0.2, 0, 0, 1);
  --ease-out-expressive: linear(0, 0.5, 0.85, 0.97, 1);
  --ease-bounce: linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1);
  --ease-vt-signature: linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1);

  /* ─── Elevation / shadow — indirection (real values live in :root[data-theme=…]) ─── */
  --shadow-elevation-1: var(--elevation-1);
  --shadow-elevation-2: var(--elevation-2);
  --shadow-elevation-3: var(--elevation-3);
  --shadow-elevation-4: var(--elevation-4);
}
```

---

## 2. `@theme inline` — Tailwind color + font utilities (theme-aware)

Colors and fonts are exposed as `--color-*` / `--font-*` so Tailwind v4 generates `bg-*`,
`text-*`, `font-*` utilities. Each one points at the runtime variable set per theme/palette, so
when `data-theme` changes the utility follows automatically. A block of backward-compatibility
aliases maps legacy tokens (`--primary`, `--card`, etc.) onto the new system.

```css
@theme inline {
  /* New fonts (reference CSS vars set by next/font on body) */
  --font-sans: var(--font-inter);
  --font-display: var(--font-inter);
  --font-mono: var(--font-jetbrains-mono);

  /* Legacy fonts (kept for backward compatibility) */
  --font-regular: var(--font-regular);
  --font-secondary: var(--font-secondary);
  --font-logo: var(--font-logo);

  /* ── New system colors ── */
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-overlay: var(--surface-overlay);

  --color-border: var(--border);
  --color-border-strong: var(--border-strong);

  /* Canonical names match Tailwind v4's text-text-* lookup
     (text-text-secondary → --color-text-secondary). Legacy *-color
     suffixed aliases are kept for any consumer still referencing them. */
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-primary-color: var(--text-primary);
  --color-text-secondary-color: var(--text-secondary);
  --color-text-on-accent: var(--text-on-accent);

  --color-accent: var(--accent);
  --color-accent-warm: var(--accent-warm);
  --color-accent-cool: var(--accent-cool);

  --color-focus-ring: var(--focus-ring);

  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-destructive: var(--destructive);
  --color-info: var(--info);

  --color-success-chip-text: var(--success-chip-text);
  --color-warning-chip-text: var(--warning-chip-text);
  --color-destructive-chip-text: var(--destructive-chip-text);
  --color-info-chip-text: var(--info-chip-text);

  /* ── Backward-compatibility aliases (legacy Tailwind utilities) ── */
  --color-foreground: var(--foreground);
  --color-surface-2: var(--surface-2);
  --color-card: var(--card);
  --color-popover: var(--popover);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-highlight: var(--highlight);
  --color-highlight-foreground: var(--highlight-foreground);
  --color-link: var(--link);
  --color-link-hover: var(--link-hover);
  --color-eyebrow-bg: var(--eyebrow-bg);
  --color-eyebrow-fg: var(--eyebrow-fg);
  --color-eyebrow-ring: var(--eyebrow-ring);
  --color-logo: var(--logo);

  /* Legacy text-color classes — mapped to new tokens without going through
     --text-title / --text-body (now font-sizes) */
  --color-text-title: var(--text-primary);
  --color-text-body: var(--text-primary);
  --color-text-muted: var(--text-muted);
}
```

---

## 3. `:root` — font weights, state layers, cross-palette status defaults

```css
:root {
  /* Font weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-display: 700;
  --font-weight-title: 600;
  --font-weight-medium-body: 500;
  --font-weight-mono: 500;

  /* State layer percentages */
  --state-hover-mix: 6%;
  --state-pressed-mix: 12%;
  --state-selected-bg-mix: 14%;
  --state-selected-border-mix: 28%;

  /* Shared semantic status tokens (cross-palette) — base values (light by default) */
  --color-success: oklch(58% 0.15 152);
  --color-warning: oklch(70% 0.16 75);
  --color-destructive: oklch(54% 0.21 25);
  --color-info: oklch(58% 0.14 245);

  /* Status chip text aliases — light */
  --color-success-chip-text: oklch(42% 0.13 152);
  --color-warning-chip-text: oklch(40% 0.1 75);
  --color-destructive-chip-text: oklch(45% 0.2 25);
  --color-info-chip-text: oklch(40% 0.13 245);
}
```

---

## 4. Theme overrides (palette-agnostic skeleton + Velvet canvas)

Light/dark each carry the cross-palette status colors, the elevation composition for the mode,
and — for the default Velvet brand — the canvas, surfaces, borders, text roles, accents, and
focus ring. A new brand palette redefines only the brand-dependent values; the status colors and
elevation model stay shared.

### 4.1 `:root[data-theme="light"]`

```css
:root[data-theme="light"] {
  color-scheme: light;

  /* Optical weight tuning per mode */
  --font-weight-display: 700;
  --font-weight-title: 600;
  --font-weight-medium-body: 500;

  /* Status — light (cross-palette; not redeclared per palette) */
  --success: var(--color-success);
  --warning: var(--color-warning);
  --destructive: var(--color-destructive);
  --info: var(--color-info);
  --success-chip-text: var(--color-success-chip-text);
  --warning-chip-text: var(--color-warning-chip-text);
  --destructive-chip-text: var(--color-destructive-chip-text);
  --info-chip-text: var(--color-info-chip-text);

  /* Elevation — soft real shadows (cool slate) */
  --elevation-1: 0 1px 2px rgba(20, 22, 30, 0.04);
  --elevation-2: 0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20, 22, 30, 0.04);
  --elevation-3: 0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20, 22, 30, 0.06);
  --elevation-4: 0 24px 48px rgba(20, 22, 30, 0.12);

  /* Canvas + brand colors — Velvet */
  --background: oklch(93% 0.02 285);
  --surface: oklch(96.5% 0.014 285);
  --surface-elevated: oklch(95% 0.016 285);
  --surface-overlay: oklch(8% 0.02 285 / 0.55);

  --border: oklch(85% 0.024 285);
  --border-strong: oklch(74% 0.03 285);

  --text-primary: oklch(22% 0.03 285);
  --text-secondary: oklch(44% 0.024 285);
  --text-muted: oklch(46% 0.022 285);
  --text-on-accent: oklch(99% 0.005 285);

  --accent: oklch(46% 0.2 290);
  --accent-warm: oklch(64% 0.2 22);
  --accent-cool: oklch(58% 0.1 215);

  --focus-ring: oklch(46% 0.2 290 / 0.55);
}
```

### 4.2 `:root[data-theme="dark"]`

```css
:root[data-theme="dark"] {
  color-scheme: dark;

  /* Optical weight tuning per mode */
  --font-weight-display: 670;
  --font-weight-title: 580;
  --font-weight-medium-body: 480;

  /* State mixes are stronger in dark */
  --state-hover-mix: 8%;
  --state-pressed-mix: 14%;

  /* Status — dark (higher lightness for readability; cross-palette) */
  --success: oklch(74% 0.16 152);
  --warning: oklch(82% 0.15 75);
  --destructive: oklch(70% 0.18 25);
  --info: oklch(78% 0.13 245);
  /* Chip text in dark = the status base (passes AA over the @14% chip fill) */
  --success-chip-text: var(--success);
  --warning-chip-text: var(--warning);
  --destructive-chip-text: var(--destructive);
  --info-chip-text: var(--info);

  /* Elevation — tone + border + inset highlight + glow (no real shadow) */
  --elevation-1: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 0 1px var(--border);
  --elevation-2: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 1px var(--border-strong);
  --elevation-3:
    inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px var(--border-strong),
    0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent);
  --elevation-4:
    inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px var(--border-strong),
    0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent),
    0 16px 64px -16px color-mix(in oklch, var(--accent-cool) 12%, transparent);

  /* Canvas + brand colors — Velvet */
  --background: oklch(10% 0.028 265);
  --surface: oklch(13% 0.028 265);
  --surface-elevated: oklch(16% 0.03 265);
  --surface-overlay: oklch(4% 0.02 265 / 0.65);

  --border: rgba(200, 200, 255, 0.07);
  --border-strong: rgba(200, 200, 255, 0.14);

  --text-primary: oklch(96% 0.012 280);
  --text-secondary: oklch(76% 0.02 280);
  --text-muted: oklch(64% 0.02 280);
  --text-on-accent: oklch(99% 0 0);

  --accent: oklch(74% 0.19 290);
  --accent-warm: oklch(80% 0.15 25);
  --accent-cool: oklch(74% 0.11 215);

  --focus-ring: oklch(74% 0.19 290 / 0.65);
}
```

---

## 5. Brand palettes

PandaTrack ships **5 brand palettes**: `velvet` (default), `lilac`, `plum`, `lagoon`, `forest`.
A palette is selected via `data-palette="<id>"` and only redefines the brand-dependent roles
(canvas, surfaces, borders, text, accents, focus ring) per theme; status colors and the
elevation model remain shared from §4.

> **Live-app note.** As applied in `src/app/globals.css`, the **Velvet** palette ships its values
> directly inside the `:root[data-theme="light"|"dark"]` blocks (§4) rather than inside
> `:root[data-palette="velvet"][data-theme="…"]` selectors — Velvet is the only active palette in
> the live app. The remaining four palettes below are the contract for the brand-switch feature:
> each is a `:root[data-palette="<id>"][data-theme="<mode>"]` override that redefines the same role
> set. When a palette switch is wired into the app, these blocks are the source values; until then
> they live here as the reference contract.

### 5.1 Velvet (default)

The applied values are in §4.1 (light) and §4.2 (dark). The equivalent palette-scoped form is:

```css
:root[data-palette="velvet"][data-theme="light"] {
  --background: oklch(93% 0.02 285);
  --surface: oklch(96.5% 0.014 285);
  --surface-elevated: oklch(95% 0.016 285);
  --surface-overlay: oklch(8% 0.02 285 / 0.55);

  --border: oklch(85% 0.024 285);
  --border-strong: oklch(74% 0.03 285);

  --text-primary: oklch(22% 0.03 285);
  --text-secondary: oklch(44% 0.024 285);
  --text-muted: oklch(46% 0.022 285);
  --text-on-accent: oklch(99% 0.005 285);

  --accent: oklch(46% 0.2 290);
  --accent-warm: oklch(64% 0.2 22);
  --accent-cool: oklch(58% 0.1 215);

  --focus-ring: oklch(46% 0.2 290 / 0.55);
}

:root[data-palette="velvet"][data-theme="dark"] {
  --background: oklch(10% 0.028 265);
  --surface: oklch(13% 0.028 265);
  --surface-elevated: oklch(16% 0.03 265);
  --surface-overlay: oklch(4% 0.02 265 / 0.65);

  --border: rgba(200, 200, 255, 0.07);
  --border-strong: rgba(200, 200, 255, 0.14);

  --text-primary: oklch(96% 0.012 280);
  --text-secondary: oklch(76% 0.02 280);
  --text-muted: oklch(64% 0.02 280);
  --text-on-accent: oklch(99% 0 0);

  --accent: oklch(74% 0.19 290);
  --accent-warm: oklch(80% 0.15 25);
  --accent-cool: oklch(74% 0.11 215);

  --focus-ring: oklch(74% 0.19 290 / 0.65);
}
```

### 5.2 Lilac

```css
:root[data-palette="lilac"][data-theme="light"] {
  --background: oklch(97.5% 0.012 320);
  --surface: oklch(99% 0.008 320);
  --surface-elevated: oklch(98% 0.01 320);
  --surface-overlay: oklch(8% 0.02 320 / 0.55);

  --border: oklch(80% 0.02 320);
  --border-strong: oklch(58% 0.026 320);

  --text-primary: oklch(22% 0.03 320);
  --text-secondary: oklch(44% 0.024 320);
  --text-muted: oklch(46% 0.022 320);
  --text-on-accent: oklch(99% 0.005 310);

  --accent: oklch(58% 0.18 310);
  --accent-warm: oklch(72% 0.16 25);
  --accent-cool: oklch(64% 0.08 165);

  --focus-ring: oklch(58% 0.18 310 / 0.55);
}

:root[data-palette="lilac"][data-theme="dark"] {
  --background: oklch(11% 0.024 280);
  --surface: oklch(14% 0.024 280);
  --surface-elevated: oklch(17% 0.026 280);
  --surface-overlay: oklch(4% 0.02 280 / 0.65);

  --border: oklch(96% 0.01 290 / 0.18);
  --border-strong: oklch(96% 0.01 290 / 0.45);

  --text-primary: oklch(96% 0.01 290);
  --text-secondary: oklch(76% 0.018 290);
  --text-muted: oklch(64% 0.018 290);
  --text-on-accent: oklch(15% 0.02 290);

  --accent: oklch(76% 0.17 305);
  --accent-warm: oklch(80% 0.14 25);
  --accent-cool: oklch(74% 0.1 200);

  --focus-ring: oklch(76% 0.17 305 / 0.65);
}
```

### 5.3 Plum

```css
:root[data-palette="plum"][data-theme="light"] {
  --background: oklch(97.5% 0.012 340);
  --surface: oklch(99% 0.008 340);
  --surface-elevated: oklch(98% 0.01 340);
  --surface-overlay: oklch(8% 0.02 340 / 0.55);

  --border: oklch(80% 0.02 340);
  --border-strong: oklch(58% 0.026 340);

  --text-primary: oklch(22% 0.03 340);
  --text-secondary: oklch(44% 0.024 340);
  --text-muted: oklch(46% 0.022 340);
  --text-on-accent: oklch(99% 0.005 350);

  --accent: oklch(50% 0.18 350);
  --accent-warm: oklch(70% 0.16 30);
  --accent-cool: oklch(64% 0.08 220);

  --focus-ring: oklch(50% 0.18 350 / 0.55);
}

:root[data-palette="plum"][data-theme="dark"] {
  --background: oklch(14% 0.02 340);
  --surface: oklch(17% 0.02 340);
  --surface-elevated: oklch(20% 0.022 340);
  --surface-overlay: oklch(4% 0.018 340 / 0.65);

  --border: oklch(96% 0.01 340 / 0.18);
  --border-strong: oklch(96% 0.01 340 / 0.45);

  --text-primary: oklch(96% 0.01 340);
  --text-secondary: oklch(76% 0.018 340);
  --text-muted: oklch(64% 0.018 340);
  --text-on-accent: oklch(15% 0.02 340);

  --accent: oklch(76% 0.16 350);
  --accent-warm: oklch(80% 0.14 30);
  --accent-cool: oklch(76% 0.08 220);

  --focus-ring: oklch(76% 0.16 350 / 0.65);
}
```

### 5.4 Lagoon

```css
:root[data-palette="lagoon"][data-theme="light"] {
  --background: oklch(97.5% 0.012 195);
  --surface: oklch(99% 0.008 195);
  --surface-elevated: oklch(98% 0.01 195);
  --surface-overlay: oklch(8% 0.02 195 / 0.55);

  --border: oklch(80% 0.018 195);
  --border-strong: oklch(58% 0.024 195);

  --text-primary: oklch(22% 0.024 195);
  --text-secondary: oklch(44% 0.02 195);
  --text-muted: oklch(46% 0.018 195);
  --text-on-accent: oklch(99% 0.005 195);

  --accent: oklch(50% 0.14 195);
  --accent-warm: oklch(70% 0.16 28);
  --accent-cool: oklch(64% 0.1 250);

  --focus-ring: oklch(50% 0.14 195 / 0.55);
}

:root[data-palette="lagoon"][data-theme="dark"] {
  --background: oklch(14% 0.018 200);
  --surface: oklch(17% 0.018 200);
  --surface-elevated: oklch(20% 0.02 200);
  --surface-overlay: oklch(4% 0.016 200 / 0.65);

  --border: oklch(96% 0.01 200 / 0.18);
  --border-strong: oklch(96% 0.01 200 / 0.45);

  --text-primary: oklch(96% 0.01 200);
  --text-secondary: oklch(76% 0.018 200);
  --text-muted: oklch(64% 0.018 200);
  --text-on-accent: oklch(15% 0.02 200);

  --accent: oklch(76% 0.13 195);
  --accent-warm: oklch(80% 0.14 28);
  --accent-cool: oklch(76% 0.1 250);

  --focus-ring: oklch(76% 0.13 195 / 0.65);
}
```

### 5.5 Forest

```css
:root[data-palette="forest"][data-theme="light"] {
  --background: oklch(97.5% 0.014 100);
  --surface: oklch(99% 0.01 100);
  --surface-elevated: oklch(98% 0.012 100);
  --surface-overlay: oklch(8% 0.018 100 / 0.55);

  --border: oklch(80% 0.018 100);
  --border-strong: oklch(58% 0.024 100);

  --text-primary: oklch(22% 0.024 100);
  --text-secondary: oklch(44% 0.02 100);
  --text-muted: oklch(46% 0.018 100);
  --text-on-accent: oklch(99% 0.005 145);

  --accent: oklch(50% 0.13 145);
  --accent-warm: oklch(66% 0.18 35);
  --accent-cool: oklch(60% 0.06 250);

  --focus-ring: oklch(50% 0.13 145 / 0.55);
}

:root[data-palette="forest"][data-theme="dark"] {
  --background: oklch(14% 0.014 145);
  --surface: oklch(17% 0.014 145);
  --surface-elevated: oklch(20% 0.016 145);
  --surface-overlay: oklch(4% 0.014 145 / 0.65);

  --border: oklch(96% 0.01 100 / 0.18);
  --border-strong: oklch(96% 0.01 100 / 0.45);

  --text-primary: oklch(96% 0.01 100);
  --text-secondary: oklch(76% 0.018 100);
  --text-muted: oklch(64% 0.018 100);
  --text-on-accent: oklch(15% 0.02 145);

  --accent: oklch(74% 0.13 145);
  --accent-warm: oklch(80% 0.16 35);
  --accent-cool: oklch(76% 0.06 250);

  --focus-ring: oklch(74% 0.13 145 / 0.65);
}
```

---

## 6. State layers (reusable `color-mix` recipes)

Hover and pressed layers mix the **neutral** `--text-primary` and therefore use `in oklab`
(the documented neutral-mix guard — `oklch` would drift the hue toward pink). The selected layer
mixes the **brand** `--accent` and stays in `oklch`. Disabled never uses `opacity` (ADR 0001 D3).

```css
.state-hover {
  background-color: color-mix(in oklab, var(--text-primary) var(--state-hover-mix), transparent);
}

.state-pressed {
  background-color: color-mix(in oklab, var(--text-primary) var(--state-pressed-mix), transparent);
}

.state-selected {
  background-color: color-mix(in oklch, var(--accent) var(--state-selected-bg-mix), var(--surface));
  border-color: color-mix(in oklch, var(--accent) var(--state-selected-border-mix), var(--surface));
}

/* No opacity (ADR 0001 D3) */
.state-disabled {
  color: var(--text-muted);
  border-color: var(--border);
  pointer-events: none;
}
```

---

## 7. Backward-compatibility aliases (legacy → new system)

Existing components keep consuming `var(--primary)`, `var(--card)`, etc. without changes. These
aliases are pure indirection: when `data-theme` changes, each alias follows the new token it
points to.

```css
:root {
  /* Text */
  --foreground: var(--text-primary);

  /* Surfaces */
  --surface-2: var(--surface-elevated);
  --card: var(--surface);
  --popover: var(--surface-elevated);

  /* Borders + inputs */
  --input: var(--border);
  --ring: var(--focus-ring);

  /* Accent / primary colors */
  --primary: var(--accent);
  --primary-foreground: var(--text-on-accent);
  --secondary: var(--accent);
  --secondary-foreground: var(--text-on-accent);
  --accent-foreground: var(--text-on-accent);

  /* Muted surfaces */
  --muted: var(--surface-elevated);
  --muted-foreground: var(--text-muted);

  /* Destructive foreground */
  --destructive-foreground: var(--text-on-accent);

  /* Highlight / link */
  --highlight: var(--accent);
  --highlight-foreground: var(--text-on-accent);
  --link: var(--accent);
  --link-hover: var(--accent);

  /* Logo — brand color in both modes */
  --logo: var(--accent);

  /* Eyebrow — computed dynamically from accent */
  --eyebrow-bg: color-mix(in oklch, var(--accent) 35%, transparent);
  --eyebrow-fg: var(--text-on-accent);
  --eyebrow-ring: color-mix(in oklch, var(--accent) 40%, transparent);
}
```

---

## 8. Canonical view-transition

The signature view-transition timing (tokens §7.3 + ADR 0001 D5). Reduced-motion keeps a gentle
~150ms cross-fade rather than `none` (ADR 0014 D1.4) — see §10.

```css
::view-transition-group(*) {
  animation-duration: var(--motion-base);
  animation-timing-function: var(--ease-vt-signature);
}
```

---

## 9. Keyframes and animation atoms

Canonical animation primitives. All are transform/opacity-only and each has a
`prefers-reduced-motion` fallback. **Do not remove or rename these without checking component
usage** — the listed components consume them by class name.

| Atom / keyframe          | Class                             | Consumed by                                                                             | Reduced-motion                             |
| ------------------------ | --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| `toast-progress`         | `.toast-countdown`                | auto-dismiss toasts (countdown hairline, `scaleX` from left, per-toast duration inline) | bar hidden, JS dismiss timer keeps running |
| `progress-indeterminate` | `.animate-progress-indeterminate` | indeterminate progress bar                                                              | static 50% fill                            |
| `wizard-pulse`           | `.animate-wizard-pulse`           | wizard sticky action bar (one-shot ring + lift hint on mobile)                          | none                                       |
| `skeleton-shimmer`       | `.skeleton`                       | canonical loading skeleton (ADR 0013)                                                   | static fill                                |
| `mascot-menu-pop`        | `.animate-mascot-menu`            | mascot context menu pop-in                                                              | none (menu still appears, instant)         |
| `check-zoom-in`          | `.animate-check-zoom`             | `Checkbox` + `Radio` check/dot zoom (hand-rolled; ADR 0010)                             | none                                       |

> **Skeleton neutral-mix guard.** `.skeleton` builds its gradient stops from
> `color-mix(in oklab, var(--text-primary) …)`. The `oklab` space is mandatory here for the same
> reason as the state layers: an `oklch` mix on a low-chroma neutral drifts the hue toward pink.
> The mix results are stored in `--skeleton-base` / `--skeleton-highlight` custom properties
> rather than inline gradient stops, because Lightning CSS (Tailwind v4) drops a rule whose
> gradient stop is `color-mix(…) <position%>`; indirecting through `var()` keeps the rule intact.

```css
.skeleton {
  --skeleton-base: color-mix(in oklab, var(--text-primary) 8%, transparent);
  --skeleton-highlight: color-mix(in oklab, var(--text-primary) 16%, transparent);
  background: linear-gradient(90deg, var(--skeleton-base), var(--skeleton-highlight), var(--skeleton-base));
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s linear infinite;
}
```

---

## 10. Base styles and `prefers-reduced-motion`

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}

/* Actionable controls get a pointer cursor (UA <button> defaults to default) */
@layer base {
  button:not(:disabled):not([aria-disabled="true"]) {
    cursor: pointer;
  }
  [role="button"]:not([aria-disabled="true"]) {
    cursor: pointer;
  }
}

/* Tabular numerals utility */
.numeric {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
    scroll-behavior: auto !important;
  }

  /* View transitions: reduced ≠ none (ADR 0014 D1.4). Drop the shared-element morph
     but keep a ~150ms opacity cross-fade so list → detail still reads as a transition. */
  ::view-transition-group(*) {
    animation-duration: 0.01ms !important;
  }
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 150ms !important;
  }
}
```

---

## 11. Public-surface recipes (marketing / auth / legal)

`src/app/globals.css` also carries the public-surface stylesheet (the `.mk-*`, `.auth-*`, and
`.legal-*` recipe classes for the marketing landing, auth screens, and legal documents). These
are component-level recipes ported 1:1 from the approved visual truth, not part of the token
contract: every color, shadow, and font in them resolves through the tokens above, so both themes
and any palette flow through automatically. They are intentionally not duplicated here — the token
contract is the stable surface this document mirrors; the public-surface recipes live with the
components they style. See `visual-foundations.md` and `interface-patterns.md` for the semantics
of those surfaces.

> **Neutral-mix note carries over.** Within the public-surface recipes, neutral overlays
> (e.g. the marketing header/minibar `--surface` blur fill and the `--text-primary` hover tints)
> also use `color-mix(in oklab, …)`, while brand glows and accent washes use `in oklch`. The same
> guard applies anywhere a neutral token is mixed.
