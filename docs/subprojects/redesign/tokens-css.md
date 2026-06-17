---
title: Mapping a CSS custom properties + Tailwind v4 @theme
last_updated: 2026-05-02
status: propuesta — no aplicada al repo
session: 03-tokens
owner: Sergio Minei
---

# Mapping a CSS / Tailwind v4

> **Esta propuesta NO está aplicada en `src/`.** La aplica **Sesión 12 — Handoff a implementación**. Mientras tanto vive sólo en `docs/redesign/`. El subproyecto produce contratos, no toca código de la app real.
>
> Convenciones:
>
> - Bloques `@theme` declaran tokens **una sola vez** con valores neutros / defaults.
> - El switch light/dark vive en `:root[data-theme="light"]` / `:root[data-theme="dark"]` para no duplicar la API generada por Tailwind.
> - Las paletas viven en `:root[data-palette="<id>"][data-theme="<mode>"]` y redefinen sólo lo que cambia con la marca.
> - State layers se publican como recetas `color-mix(in oklch, …)` reusables, no como tokens fijos.
>
> Para definiciones, reglas de uso, ratios y justificaciones, ver [`tokens.md`](./tokens.md).

---

## 1. Bloque `@theme` (declaraciones únicas, valores defaults o indirección)

```css
@import "tailwindcss";

@theme {
  /* ─── Familias tipográficas ─── */
  --font-sans: "Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Inter Display", "Inter Variable", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;

  /* ─── Escala tipográfica ─── */
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

  /* ─── Layout magic numbers semánticos ─── */
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
  --radius-full: var(--radius-pill); /* alias compatibilidad Tailwind */

  /* ─── Breakpoints ─── */
  --breakpoint-xs: 24rem;
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
  --breakpoint-2xl: 96rem;

  /* ─── Z-index ─── */
  --z-base: 0;
  --z-sticky: 10;
  --z-sidebar: 20;
  --z-header: 30;
  --z-mascot: 35;
  --z-popover: 40;
  --z-drawer: 50;
  --z-sheet: 60;
  --z-modal-backdrop: 70;
  --z-modal: 80;
  --z-toast: 90;
  --z-command: 100;
  --z-tooltip: 110;

  /* ─── Motion ─── */
  --motion-fast: 150ms;
  --motion-base: 280ms;
  --motion-slow: 480ms;

  --ease-emphasis: cubic-bezier(0.2, 0, 0, 1);
  --ease-out-expressive: linear(0, 0.5, 0.85, 0.97, 1);
  --ease-bounce: linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1);
  --ease-vt-signature: linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1);

  /* ─── Shadow / elevation (indirección — el valor real lo provee :root[data-theme=...]) ─── */
  --shadow-elevation-1: var(--elevation-1);
  --shadow-elevation-2: var(--elevation-2);
  --shadow-elevation-3: var(--elevation-3);
  --shadow-elevation-4: var(--elevation-4);

  /* ─── Color (los valores reales viven en los bloques de paleta + theme) ─── */
  /* Tailwind v4 expone --color-* automáticamente; los declaramos abajo en :root */
}

/* ─── Pesos tipográficos auxiliares (light defaults) ─── */
:root {
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-display: 700;
  --font-weight-title: 600;
  --font-weight-medium-body: 500;
  --font-weight-mono: 500;

  /* Status compartidos cross-paleta — light defaults */
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

## 2. Theme overrides (light / dark agnósticos a paleta)

### 2.1 `:root[data-theme="light"]`

Bloque base light (las paletas pueden sobrescribir lienzo, surfaces, accents, focus-ring, text-on-accent — pero los siguientes valores son el "esqueleto" cuando una paleta nueva no los redefine).

```css
:root[data-theme="light"] {
  color-scheme: light;

  /* Pesos auxiliares — defaults light */
  --font-weight-display: 700;
  --font-weight-title: 600;
  --font-weight-medium-body: 500;

  /* Status — light (cross-paleta, no se redeclaran en bloques de paleta) */
  --success: var(--color-success);
  --warning: var(--color-warning);
  --destructive: var(--color-destructive);
  --info: var(--color-info);
  --success-chip-text: var(--color-success-chip-text);
  --warning-chip-text: var(--color-warning-chip-text);
  --destructive-chip-text: var(--color-destructive-chip-text);
  --info-chip-text: var(--color-info-chip-text);

  /* Elevation — sombras reales suaves slate frío */
  --elevation-1: 0 1px 2px rgba(20, 22, 30, 0.04);
  --elevation-2: 0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20, 22, 30, 0.04);
  --elevation-3: 0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20, 22, 30, 0.06);
  --elevation-4: 0 24px 48px rgba(20, 22, 30, 0.12);
}
```

### 2.2 `:root[data-theme="dark"]`

```css
:root[data-theme="dark"] {
  color-scheme: dark;

  /* Pesos auxiliares — ajuste óptico por modo */
  --font-weight-display: 670;
  --font-weight-title: 580;
  --font-weight-medium-body: 480;

  /* Status — dark (cross-paleta) */
  --success: oklch(74% 0.16 152);
  --warning: oklch(82% 0.15 75);
  --destructive: oklch(70% 0.18 25);
  --info: oklch(78% 0.13 245);
  /* Chip text en dark = el color status base (pasa AA sobre chip @14% holgado) */
  --success-chip-text: var(--success);
  --warning-chip-text: var(--warning);
  --destructive-chip-text: var(--destructive);
  --info-chip-text: var(--info);

  /* Elevation — composiciones sin sombra real (tono + borde + highlight inset + glow) */
  --elevation-1: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 0 1px var(--border);
  --elevation-2: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 1px var(--border-strong);
  --elevation-3:
    inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px var(--border-strong),
    0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent);
  --elevation-4:
    inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px var(--border-strong),
    0 -1px 8px color-mix(in oklch, var(--accent) 6%, transparent),
    0 16px 64px -16px color-mix(in oklch, var(--accent-cool) 12%, transparent);
}
```

---

## 3. Paletas

### 3.1 Velvet (default) — light

```css
:root[data-palette="velvet"][data-theme="light"] {
  --background: oklch(93% 0.02 285);
  --surface: oklch(96.5% 0.014 285);
  --surface-elevated: oklch(95% 0.016 285);
  --surface-overlay: oklch(8% 0.02 285 / 0.55);

  --border: oklch(80% 0.024 285);
  --border-strong: oklch(58% 0.03 285);

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

### 3.2 Velvet — dark

```css
:root[data-palette="velvet"][data-theme="dark"] {
  --background: oklch(10% 0.028 265);
  --surface: oklch(13% 0.028 265);
  --surface-elevated: oklch(16% 0.03 265);
  --surface-overlay: oklch(4% 0.02 265 / 0.65);

  --border: oklch(96% 0.012 280 / 0.18);
  --border-strong: oklch(96% 0.012 280 / 0.45);

  --text-primary: oklch(96% 0.012 280);
  --text-secondary: oklch(76% 0.02 280);
  --text-muted: oklch(64% 0.02 280);
  --text-on-accent: oklch(15% 0.02 290);

  --accent: oklch(74% 0.19 290);
  --accent-warm: oklch(80% 0.15 25);
  --accent-cool: oklch(74% 0.11 215);

  --focus-ring: oklch(74% 0.19 290 / 0.65);
}
```

### 3.3 Lilac

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

### 3.4 Plum

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

### 3.5 Lagoon

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

### 3.6 Forest

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

## 4. State layers (recetas color-mix reusables)

```css
/* Hover overlay — aplicar como background-color por encima del control */
:root {
  --state-hover-mix: 6%;
  --state-pressed-mix: 12%;
  --state-selected-bg-mix: 14%;
  --state-selected-border-mix: 28%;
}
:root[data-theme="dark"] {
  --state-hover-mix: 8%;
  --state-pressed-mix: 14%;
}

/* Patrones reusables */
.state-hover {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-hover-mix), transparent);
}

.state-pressed {
  background-color: color-mix(in oklch, var(--text-primary) var(--state-pressed-mix), transparent);
}

.state-selected {
  background-color: color-mix(in oklch, var(--accent) var(--state-selected-bg-mix), var(--surface));
  border-color: color-mix(in oklch, var(--accent) var(--state-selected-border-mix), var(--surface));
}

/* Disabled — sin opacity (ADR 0001 D3) */
.state-disabled {
  color: var(--text-muted);
  border-color: var(--border);
  pointer-events: none;
}
```

---

## 5. Receta de avatar de tienda (`<StoreAvatar>` — ADR 0001 D16)

```css
.store-avatar {
  /* Sizes 24/32/40/56 vienen vía prop, no token */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--accent) 14%, var(--surface-elevated));
  border: 1px solid color-mix(in oklch, var(--accent) 28%, var(--border));
  color: var(--accent);
  font-family: var(--font-display);
  font-weight: 600;
  border-radius: var(--radius-pill); /* mobile */
}

@media (min-width: 48rem) {
  .store-avatar {
    border-radius: var(--radius-lg); /* desktop */
  }
}

/* Si hay logo: */
.store-avatar--with-logo {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
}
```

Letra: una sola, primera letra del nombre en mayúsculas. Tinte `--accent` 14% bg + borde 28% → ratio de la letra `--accent` sobre el bg tintado pasa ≥4.5:1 por construcción del color-mix.

---

## 6. Receta de toast neutral-undo (ADR 0001 D4)

```css
.toast-neutral-undo {
  background: var(--surface-elevated);
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  padding: var(--space-3) var(--space-4);
  max-width: var(--toast-max-w);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toast-neutral-undo__cta {
  /* ghost button con --accent */
  color: var(--accent);
  font-weight: var(--font-weight-medium-body);
  background: transparent;
  border: none;
  cursor: pointer;
}

.toast-neutral-undo__kbd {
  /* Z shortcut visible en desktop */
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-1_5);
}

.toast-neutral-undo__countdown {
  /* hairline 1px en --accent 40% al pie */
  height: 1px;
  background: color-mix(in oklch, var(--accent) 40%, transparent);
  transform-origin: left;
  animation: toast-countdown linear forwards;
  animation-duration: 5000ms; /* 8000ms para delete de pedido entero */
}

@keyframes toast-countdown {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

.toast-neutral-undo:hover .toast-neutral-undo__countdown,
.toast-neutral-undo:focus-within .toast-neutral-undo__countdown {
  animation-play-state: paused;
}
```

ARIA: `role="status"` + `aria-live="polite"` en el contenedor. Posición bottom-center mobile / bottom-right desktop con `z-index: var(--z-toast)`.

---

## 7. Receta de section card disabled-gated (ADR 0001 D3)

```css
.section-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--space-5); /* mobile */
}

@media (min-width: 48rem) {
  .section-card {
    padding: var(--space-6); /* desktop */
  }
}

.section-card--gated {
  /* eyebrow + title intactos al 100% — NO opacity */
  border-color: var(--border); /* no strong, señala "presente pero secundario" */
}

.section-card--gated .section-card__body {
  /* Reemplazado por sub-bloque guía */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  color: var(--text-muted);
}

.section-card--gated .section-card__lock-icon {
  width: 24px;
  height: 24px;
  color: var(--text-muted); /* NO destructive */
}
```

Copy guía en `Body` 13px (`--text-caption`) en `--text-muted`. Sin `opacity:.5` ni `pointer-events: none` global (las acciones del header siguen accesibles).

---

## 8. Receta de field-as-attribute (ADR 0001 D2)

```css
.field-as-attribute {
  background: var(--surface-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.field-as-attribute__eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  text-transform: uppercase;
  color: var(--text-muted);
  /* prefijo "↳ DESDE PT-XXXXXX" */
}

.field-as-attribute__value {
  /* Avatar (si aplica) + nombre */
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium-body);
}

.field-as-attribute__change {
  margin-left: auto;
  /* ghost button con ícono pencil */
  color: var(--text-secondary);
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.field-as-attribute__change:hover {
  color: var(--text-primary);
}
```

Ícono `pencil` (Lucide) 16px en `currentColor`. El click reemplaza por input editable y dispara confirm sheet si ya hay datos derivados.

---

## 9. Receta de micro-stat card del dashboard (`<MicroStatCard>` — ADR 0005)

Patrón canónico: cifra en `--text-primary` + **icon-tile circular soft-tint** con glyph Lucide del color funcional dentro. Aplica a los 4 slots del dashboard ("Este mes", "Próximos 30 días", "Atrasado", "Llega esta semana").

```css
.microstat-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  padding: var(--space-5); /* mobile */
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (min-width: 48rem) {
  .microstat-card {
    padding: var(--space-6);
  }
}

/* Header: icon-tile + eyebrow label */
.microstat-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.microstat-card__icon-tile {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* El bg + border + glyph color se setean via CSS variable --slot-accent en el componente */
  background: color-mix(in oklch, var(--slot-accent) 14%, var(--surface));
  border: 1px solid color-mix(in oklch, var(--slot-accent) 28%, var(--surface));
  color: var(--slot-accent);
}

@media (min-width: 48rem) {
  .microstat-card__icon-tile {
    width: 36px;
    height: 36px;
  }
}

.microstat-card__icon-tile > svg {
  width: 16px;
  height: 16px;
}

@media (min-width: 48rem) {
  .microstat-card__icon-tile > svg {
    width: 18px;
    height: 18px;
  }
}

.microstat-card__eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  letter-spacing: var(--text-eyebrow--letter-spacing);
  font-weight: var(--font-weight-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}

.microstat-card__value {
  font-family: var(--font-display);
  font-size: var(--text-display);
  line-height: var(--text-display--line-height);
  letter-spacing: var(--text-display--letter-spacing);
  font-weight: var(--font-weight-display);
  font-feature-settings: "ss01", "cv11", "tnum";
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.microstat-card__metadata {
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  color: var(--text-secondary);
}
```

Aplicación en JSX (orientativo para S4):

```tsx
<MicroStatCard
  accentToken="--accent-warm" // discriminated union: solo --accent | --accent-warm | --warning | --success
  glyph="calendar-clock" // Lucide
  eyebrow="Próximos 30 días"
  value="$ 1.247.500"
  metadata="3 pre-órdenes"
/>
```

El componente setea `style={{ '--slot-accent': `var(${accentToken})` }}` en el wrapper para inyectar el token correcto en la receta del icon-tile.

**Verificación de contraste:** el tile bg (color-mix 14%) y border (color-mix 28%) son **non-text** — cumplen WCAG 1.4.11 ≥3:1 sobre `--surface` adyacente. El glyph en color sólido sobre el tile soft también es non-text. La cifra en `--text-primary` sobre `--surface` cumple ≥13:1 holgado.

**Por paleta:** si la paleta Lilac (warm L=0.72) no llega a 3:1 en tile bg vs surface, subir el mix a 18% o 20% via override. Receta lo permite sin tocar el token.

---

## 10. Receta de chip de info con contrato ícono+label (ADR 0006)

```css
.chip-info {
  background: color-mix(in oklch, var(--info) 14%, var(--background));
  border: 1px solid color-mix(in oklch, var(--info) 28%, var(--background));
  color: var(--info-chip-text);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}

.chip-info > svg {
  width: 14px;
  height: 14px;
  color: var(--info-chip-text);
}

/* El componente debe rechazar render sin <icon> + <label>:
   <ChipInfo icon={<ClockIcon />} label="Pendiente en tienda" /> */
```

Implementación TypeScript (orientativa para S4):

```tsx
type StatusChipInfoProps = {
  kind: 'info';
  icon: ReactNode;        // OBLIGATORIO — TS rechaza si falta
  label: string;          // OBLIGATORIO
};

function StatusChip(props: StatusChipInfoProps | StatusChipSuccessProps | …) {
  if (props.kind === 'info') {
    return (
      <span class="chip-info">
        {props.icon}
        <span>{props.label}</span>
      </span>
    );
  }
  // …
}
```

Cualquier tentativa de `<StatusChip kind="info" />` (sin `icon` ni `label`) debe fallar en compile-time vía discriminated union.

---

## 11. Notas de implementación

Decisiones que **debe tomar S12** y que NO están resueltas acá:

1. **Inter Display licencia y alojamiento.** Confirmar si Google Fonts expone Inter con axis `opsz` (lo que activa los cuts Display automáticamente a tamaños grandes), o si requiere descargar variable WOFF2 y servirlos vía `next/font/local`. Si `opsz` está disponible, `--font-display` y `--font-sans` colapsan a una sola declaración con axis activado.
2. **Compatibilidad de `clamp()` en `--text-*` Tailwind v4.** Verificar que la versión instalada acepta `clamp(...)` directamente en `@theme`. Si no, mover el clamp a `:root { --text-display: clamp(...); }` y referenciarlo desde `@theme` con `var(--text-display)`.
3. **Soporte `linear()` timing function.** Chromium 113+, Safari 17.4+, Firefox 112+ soportan `linear()` con multistop. Para usuarios fuera de ese rango, fallback degrada a `linear` puro (sin overshoot). Validar el target oficial de PandaTrack.
4. **Soporte `color-mix(in oklch, …)` en `box-shadow`.** Funciona en todos los navegadores que ya soportan `color-mix`. Validar Safari 16.x si está en el target.
5. **`view-transition-name` dinámico en row.** Plan: delegación dinámica (set + clean) para evitar colisión de nombres en listas largas. Necesita un hook compartido (`useViewTransitionName`) — definir en S4.
6. **Container query support.** Si se quieren usar container queries para layouts adaptativos de cards, chequear soporte y declarar `container-type` en componentes contenedores.
7. **Auditar `font-bold`, `font-semibold` Tailwind hardcoded** en componentes legacy antes de migrar. Si quedan literal, no se ajustarán al peso óptico por modo. Convertir a `font-display`, `font-title`, etc. consumiendo `var(--font-weight-*)`.
8. **Auditar `text-white` hardcoded** en buttons / badges legacy. Romperá en dark con `--text-on-accent` oscuro. Convertir a `color: var(--text-on-accent)`.
9. **Linter regla "italic prohibido".** Considerar eslint plugin que bloquee `italic` Tailwind class y `font-style: italic` en CSS.
10. **Theme persistence.** ADR 0003 D2: clave `localStorage["pandatrack-theme"]`. Inferencia inicial vía `prefers-color-scheme` solo en primera carga; después fija en lo que el usuario elija. Implementar como inline script en `<head>` antes de hydration para evitar flash de tema incorrecto.
11. **Palette persistence.** Demo HTML usa `localStorage["pandatrack-demo-palette"]`. En producción definir si el switch de paleta es una preference real del usuario o queda solo en demo. Si es real, key `localStorage["pandatrack-palette"]` + sync a `preferences` schema cuando S3+ actualice.
