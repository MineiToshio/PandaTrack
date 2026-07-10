# Visual Foundations

This document is the source of truth for the PandaTrack **Velvet** visual foundations: the theme model, the semantic color tokens, typography, spacing, border radius, surfaces and elevation, gradients, and the rules that hold the system together. Every value here is normative. Components consume the semantic tokens defined below — never hardcoded colors, sizes, or radii. The literal CSS-variable declarations (the `oklch(...)` values) live in [`tokens-css.md`](tokens-css.md) and in `src/app/globals.css`; this file documents the contract, the intent, and the durable reasoning.

## Number and currency formatting

**Always use a period (`.`) as the decimal separator.** Never use a comma.
**Never use a thousand separator.** Display amounts as a single continuous number — `1240.00`, not `1,240.00` and not `1.240,00`.

### Monetary amounts

- All monetary display goes through the helpers in `src/lib/currency.ts`:
  - `formatAmount(minorUnits, currencyCode)` → `{value} {code}` (e.g. `888.50 USD`, `43000 CLP`)
  - `formatAmountSymbolOnly(minorUnits, currencyCode, locale)` → `{symbol}{value}` (e.g. `$496.00`, `S/ 6765.00`)
  - `formatAmountWithSymbol(...)` → `{symbol}{value} {code}` when the symbol is ambiguous (e.g. `$496.00 USD`)
- All three helpers force `"en"` locale + `useGrouping: false` in `Intl.NumberFormat` so the decimal separator is always a period and there is never a thousand separator, regardless of the user's UI language.
- The `locale` argument to the symbol variants is used only to resolve the currency's narrow symbol (e.g. `S/` for PEN in `es`); it does **not** affect the number layout.

#### Storage vs presentation (decimals per currency)

- **Storage is uniform:** every money value is persisted as an integer minor unit scaled `×100` for **every** currency, so FX arithmetic stays internally consistent and no data migration is needed.
- **Presentation follows the ISO 4217 exponent.** `getCurrencyDecimals(currencyCode)` returns the fraction-digit count each currency shows and accepts: `0` for zero-decimal currencies (CLP, JPY, KRW in the catalog) and `2` for the rest. The formatters above read this, so `43000 CLP` renders with no decimals while `888.50 USD` keeps two.
- A whole-major amount for a zero-decimal currency always lands on a multiple of `100` in minor units; `isWholeMajorAmount(minorUnits)` checks this and backs the input, parser, and server-validation rules below.

### Decimal inputs (prices, payment amounts)

- Use `type="text" inputMode="decimal"` for price and payment inputs — **not** `type="number"`.
  - `type="number"` renders the value using the OS locale (comma in Spanish/European) which conflicts with the period standard.
  - `type="text" inputMode="decimal"` keeps display under our control while still showing the numeric keyboard on mobile.
- Store and read values as dot-separated strings (`"888.50"`); on the server convert to minor units with `parseDecimalToMinorUnits(value, currencyCode)` from `src/lib/money/parseDecimalToMinorUnits.ts`, which rejects malformed input (and a decimal separator for zero-decimal currencies).
- Apply `sanitizeDecimalInput(value, currencyCode)` from `src/lib/decimalInput.ts` on every `onChange` — it strips non-numeric characters, keeps one period, and limits the fraction to the currency exponent. For a zero-decimal currency it truncates at the separator (so `"43000.50"` becomes `"43000"`, never a concatenated `"4300050"`). Pass the selected currency code wherever the field is a currency amount; omit it for non-currency decimals such as the FX rate.
- Validate with `isValidPositiveDecimal(value, currencyCode)` from the same module before submitting — rejects empty, zero, trailing-dot (`"25."`), non-numeric values, and any decimal for zero-decimal currencies.
- **Validation order**: client-side first (immediate field error, no server round-trip), server-side second (Zod schema as safety net against bypassed JS). Zero-decimal currencies additionally get a `superRefine` "whole major amount" rule in `orderValidation`/`deliveryValidation` (the `*_FRACTIONAL_SUBUNITS` codes). Never rely on server validation alone for user-facing feedback.
- **Never** format a number with `toLocaleString()` or `Intl.NumberFormat` without explicitly passing `"en"` as the locale.

### Ratings and other decimals

- Use `.toFixed(1)` or `.toFixed(2)` for display — these always produce period-separated output.
- Do not pass them through `Intl.NumberFormat` with a non-`"en"` locale.

## Color System

### Theme model

Light and dark are **siblings, not inversions.** Every token has an independently calculated value for each mode. There are no tokens that "flip" and there is never a `filter: invert(1)`. The two modes are designed to feel like the same product viewed under different light, not like a photo and its negative.

Two hard constraints anchor the whole palette:

- **Never pure black or pure white.** The light canvas is a warm lead-violet "old letter paper", not hospital white; the dark canvas is a deep night blue-violet, not `#000`. Even `--text-on-accent` (the one near-white) carries a faint chroma in light mode.
- **WCAG 2.2 AA is inviolable** for every foreground/background pair. Body, labels, and chip text meet ≥4.5:1; UI components, focus rings, and functional borders meet ≥3:1; text over `--accent` targets ≥4.5:1. `--text-muted` is held to 4.5:1 even at 12–13px so that timestamps and helper text stay legible at the smallest sizes the system renders.

The theme toggle exposes **only `light` and `dark`** — there is no separate "system / auto" token set; the two values above are the entire surface.

### The Velvet palette

**Velvet is the default palette.** It is a nocturnal atelier: deep violet in light (a lead-violet canvas with the feel of antique letter paper) and a night blue-violet in dark. The character is "collectible / hobby warmth" — premium and elegant without being childish or clinical.

The Velvet base hue is approximately **h≈285 in light** and **h≈265 in dark** for surfaces and text, with the accent landing at **h≈290** in both modes.

Four alternative palettes share the **exact same semantic token names** and differ only in their values:

| Palette    | Character                              |
| ---------- | -------------------------------------- |
| **Velvet** | Premium "elegant night" — **default**  |
| Lilac      | Cheerful diary without losing elegance |
| Plum       | Editorial boutique with presence       |
| Lagoon     | Analytical calm, dashboard-leaning     |
| Forest     | Sustainable / herbarium / collected    |

Switching palette changes token _values_, never token _names_. Status colors do **not** change with the palette (see below). All contrast and usage rules in this document apply to every palette; Velvet is documented as the reference set.

### Semantic tokens

The literal `oklch(...)` values for every token (light and dark) live in [`tokens-css.md`](tokens-css.md) and `src/app/globals.css`. Below is the contract: what each token means, where it is allowed, and where it is banned. Velvet values are quoted inline where they carry meaning; treat the CSS mirror as authoritative for the exact numbers.

#### Surfaces

| Token                | Velvet light                 | Velvet dark                  | Use                                                                                                                                                                                                              |
| -------------------- | ---------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background`       | `oklch(93% 0.020 285)`       | `oklch(10% 0.028 265)`       | Root app canvas. Never inside cards or sub-surfaces.                                                                                                                                                             |
| `--surface`          | `oklch(96.5% 0.014 285)`     | `oklch(13% 0.028 265)`       | Default card, list, primary detail panel. Never as an accent.                                                                                                                                                    |
| `--surface-elevated` | `oklch(95% 0.016 285)`       | `oklch(16% 0.030 265)`       | Only when there is real hierarchy against `--surface` (sub-card inside a card, drawer/sheet body, popover, scroll-spy header). In light it is **slightly darker** than `--surface` (paper-overlap), not lighter. |
| `--surface-overlay`  | `oklch(8% 0.020 285 / 0.55)` | `oklch(4% 0.020 265 / 0.65)` | Only the modal scrim, sheet backdrop, command-palette overlay. Never as a content background.                                                                                                                    |

There is intentionally no `--surface-warm` token: `--surface` is already a warm lead-violet, an extra warm surface would be imperceptible and would break the `background → surface → surface-elevated` ladder. When a sub-card needs warm differentiation, mix the accent into the surface (`color-mix(in oklch, var(--accent-warm) 14%, var(--surface))`).

#### Borders

| Token             | Role                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--border`        | **Decorative** divider, card outline, idle input. Low contrast (~1.5–1.7:1). Never the sole functional separation between two semantic zones.                   |
| `--border-strong` | **Functional**, ≥3:1. Focused input pre-ring, separator between semantic zones, avatar-fallback border, any border that carries meaning. Never pure decoration. |

If a border must do real separating work, escalate from `--border` to `--border-strong`.

#### Text

| Token              | Role                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--text-primary`   | Body, headings, central dashboard numbers, the label of a focused input. Never for secondary metadata.                                                                                                                                                                                                                                 |
| `--text-secondary` | Subtitles, field labels, short descriptions, breadcrumbs. **Code identifiers (`PT-XXXXXX` and derivatives) live here** — they are the outdoor-critical case and need the higher contrast (see [ADR 0007](decisions/0007-text-muted-outdoor-code-mono-reassignment.md)). Use only when a nearby `--text-primary` defines the hierarchy. |
| `--text-muted`     | Timestamps, uppercase eyebrows, helper text 11–13px, non-identifier inline mono. Holds **4.5:1 even at 12–13px**. Never for primary body, the first visible label of a field, or code identifiers (those go in `--text-secondary`).                                                                                                    |
| `--text-on-accent` | Text over solid `--accent` only (primary CTA, accent-solid badge). Near-white in both modes. Never over an accent tint or state layer.                                                                                                                                                                                                 |

`--text-on-accent` is intentionally near-white in both modes to match the mental model "button = white text". In dark mode this is a deliberate, human-ratified exception to the strict AA math against the bright accent. Any `<Button>` or accent badge consumes `var(--text-on-accent)`; nothing hardcodes `text-white`.

#### Accents

| Token           | Velvet light          | Velvet dark           | Role                                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--accent`      | `oklch(46% 0.20 290)` | `oklch(74% 0.19 290)` | Primary CTA, primary link, focus-ring base, progress bar, avatar fallback (14% bg tint / 28% border tint). Never category icons or non-interactive decoration.                                                                                                                                       |
| `--accent-warm` | `oklch(64% 0.20 22)`  | `oklch(80% 0.15 25)`  | **Decorative only.** Achievement halo, "accent soft" chip tint, and the dashboard micro-stat **icon-tile** (soft-tint circle with a warm Lucide glyph inside — see [ADR 0005](decisions/0005-dashboard-microstat-icon-tile.md)). Never text over `--background`, never a CTA, never a metric figure. |
| `--accent-cool` | `oklch(58% 0.10 215)` | `oklch(74% 0.11 215)` | **Icon color only, always with an adjacent label** ([ADR 0006](decisions/0006-color-blindness-icon-label-contract.md)): category Lucide icons, and inline info when it coexists with `--accent`. Never a background, border, text color, CTA, focus, semantic status, or icon-only-without-label.    |

`--accent-warm` cannot carry small text on the light canvas (it fails AA there across palettes), which is exactly why it is reserved for non-text decoration. The metric figure it "owns" (the dashboard slot for upcoming payments) is rendered in `--text-primary` with a warm icon-tile decorator, not in warm color.

`--accent-cool` (a soft blue-grey, h215) lives close to `--info` (h245) in normal trichromatic vision but collapses to the same region under deuteranopia/protanopia. Moving the hues does not fix this; the robust mitigation is structural — see the color-blindness contract below.

#### Status (shared across all palettes)

| Token           | Velvet light          | Velvet dark           | Meaning                                                                                                                                                                                                                          |
| --------------- | --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--success`     | `oklch(58% 0.15 152)` | `oklch(74% 0.16 152)` | Confirmed payment, completed delivery, achievement chip, success toast. Never non-semantic decoration.                                                                                                                           |
| `--warning`     | `oklch(70% 0.16 75)`  | `oklch(82% 0.15 75)`  | Overdue payment, "N days late". Never "waiting without urgency" (that is `--info`).                                                                                                                                              |
| `--destructive` | `oklch(54% 0.21 25)`  | `oklch(70% 0.18 25)`  | Delete confirmation, error feedback, destructive toast. Never decoration or "attention without risk".                                                                                                                            |
| `--info`        | `oklch(58% 0.14 245)` | `oklch(78% 0.13 245)` | "Pending, no urgency" — **chip always carries a `clock` icon + a text label** ([ADR 0006](decisions/0006-color-blindness-icon-label-contract.md)), neutral inline notice. Never a CTA, focus, category icon, or color-only chip. |

`--info` sits at **h245** (a franker blue) specifically to read distinctly from `--accent-cool` (h215) in normal vision. Status tokens are identical across all five palettes.

**Chip recipes.** Status chips are built with `color-mix`, not bespoke colors:

```css
background: color-mix(in oklch, var(--success) 14%, var(--background));
border: 1px solid color-mix(in oklch, var(--success) 28%, var(--background));
color: var(--success-chip-text); /* light: dedicated chip-text alias; dark: the status base token */
```

In light mode the base status color does not reach 4.5:1 on a 14% chip, so each status has a darker `--{status}-chip-text` alias for light; in dark the chip text is the base status token. These aliases are also shared across all palettes.

#### Focus and state layers

| Token / state  | Recipe                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--focus-ring` | Accent-derived ring (`oklch(46% 0.20 290 / 0.55)` light, `oklch(74% 0.19 290 / 0.65)` dark). Outline of any `:focus-visible`. Never a fill, never on `:hover`.                               |
| `hover`        | `color-mix(in oklch, var(--text-primary) 6%, transparent)` (light) / `8%` (dark), applied as an overlay above the control surface.                                                           |
| `pressed`      | `color-mix(in oklch, var(--text-primary) 12%, transparent)` (light) / `14%` (dark), replacing the hover layer during `:active`.                                                              |
| `selected`     | bg `color-mix(in oklch, var(--accent) 14%, var(--surface))`, border `color-mix(in oklch, var(--accent) 28%, var(--surface))`. Active filter chip, active sidebar item, selected list option. |
| `disabled`     | text → `var(--text-muted)`, border → `var(--border)`. **Never `opacity`.** Low contrast is achieved with semantic tokens, not a global `opacity:.5`.                                         |

### Categorical palette

There is **no categorical palette** in the system (see [ADR 0004](decisions/0004-categorical-palette-removal.md)). Category identity is carried by **Lucide icons in `--accent-cool` with an adjacent label**, not by per-category colors. The MVP ships no charts or analytical views; carrying unused color tokens would be visual and technical debt and would tempt accidental decorative use. When a future data-visualization need arrives, a fresh `--chart-1…N` set is to be **designed from scratch** with proper data-viz calibration (perceptual uniformity, color-blind safety, ordered sequences) — not revived from any historical reserve.

## Typography

### Families

| Family                  | Token            | Role                                                                        |
| ----------------------- | ---------------- | --------------------------------------------------------------------------- |
| Inter Variable          | `--font-sans`    | Body, UI, forms, controls, lists, tables — every tier at or below Subtitle. |
| Inter Display           | `--font-display` | Display and Title (hero numbers, ceremonial headings, dashboard hero).      |
| JetBrains Mono Variable | `--font-mono`    | Code, mono badges, IDs, uppercase eyebrows, secondary tabular numerals.     |

Inter Display is the optical cut of the same Inter family activated at large sizes (via the `opsz` axis), so body and display never produce a metric jump. The font wiring lives in `src/lib/fonts.ts`.

Declared stacks:

- `--font-sans`: `"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif`
- `--font-display`: `"Inter Display", "Inter Variable", "Inter", system-ui, sans-serif`
- `--font-mono`: `"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace`

**Zilla Slab is used only for the logo / wordmark.** It is wired as `--font-logo` and consumed exclusively by the Logo component, the favicon, and OG images (`src/lib/og.ts`). It must **never** be used for UI text — no headings, body, controls, cards, or any product copy. This is a hard boundary: the logo is the only place Zilla Slab appears.

### Type scale

Each tier exposes three Tailwind v4 sub-properties: `--text-{name}` (size), `--text-{name}--line-height`, and `--text-{name}--letter-spacing`. Weights are listed light / dark; the dark value is reduced to compensate for optical thickening (see "Weights").

| Tier     | Tailwind class  | Size                                | Line-height | Letter-spacing | Weight (light / dark)        | Family           | Use                                                        |
| -------- | --------------- | ----------------------------------- | ----------- | -------------- | ---------------------------- | ---------------- | ---------------------------------------------------------- |
| Display  | `text-display`  | `clamp(2.5rem, 4vw + 1rem, 3.5rem)` | 64px        | `-0.03em`      | 700 / 670                    | `--font-display` | Dashboard hero number, primary "next payment" amount.      |
| Title    | `text-title`    | 32px                                | 40px        | `-0.02em`      | 600 / 580                    | `--font-display` | Page titles, detail-section headings.                      |
| Subtitle | `text-subtitle` | 22px                                | 28px        | `-0.01em`      | 600 / 600                    | `--font-sans`    | Card headings, modal title, sub-section.                   |
| Body-L   | `text-body-lg`  | 17px                                | 26px        | `0`            | 400 / 400                    | `--font-sans`    | Hero descriptive subtitle, empty-state body, modal intro.  |
| Body     | `text-body`     | 15px                                | 22px        | `0`            | 400 / 400 (medium 500 / 480) | `--font-sans`    | Default body: card, paragraph, label, value.               |
| Caption  | `text-caption`  | 13px                                | 18px        | `+0.005em`     | 500 / 500                    | `--font-sans`    | Helper text, footnote, microcopy.                          |
| Mono-L   | `text-mono-lg`  | 15px                                | 22px        | `0`            | 500 / 500                    | `--font-mono`    | Codes shown in detail cards.                               |
| Mono     | `text-mono`     | 13px                                | 18px        | `+0.02em`      | 500 / 500                    | `--font-mono`    | Inline mono in body, mono badge, micro-stat tabular label. |
| Eyebrow  | `text-eyebrow`  | 11px                                | 14px        | `+0.08em`      | 500 / 500                    | `--font-mono`    | Ceremonial uppercase eyebrow.                              |

The body scale and heading scale are implemented in `src/components/core/Typography.tsx` and `src/components/core/Heading.tsx`. One dominant `h1` per screen; it must read as the strongest heading on the page, larger and heavier than in-page section `h2`s.

### Weights

Auxiliary weight tokens decouple components from raw numbers, so mode-specific weight reduction happens in one place:

```
--font-weight-regular: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-display: 700   (dark: 670)
--font-weight-title: 600     (dark: 580)
--font-weight-medium-body: 500 (dark: 480)
--font-weight-mono: 500
```

Components consume `var(--font-weight-display)` and friends — never a literal `font-weight: 700`. The only typographic differences between modes are these reduced display/title/body-medium weights and body color resolving to 96% L (not 100%) in dark via `--text-primary`. Italics are prohibited in every tier.

### Letter-spacing and feature settings

| Tier                      | `font-feature-settings`  | Why                                                                                   |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Display / Title           | `"ss01", "cv11", "tnum"` | Inter Display editorial alternates, serif-free `1` for hero numbers, tabular nums.    |
| Subtitle / Body / Caption | (none by default)        | Neutral body. Activate `tnum` only when rendering figures via the `.numeric` utility. |
| Mono-L / Mono / Eyebrow   | `"calt", "ss01"`         | JetBrains Mono contextual alternates (separates `1` from `l`, `0` from `O`).          |

**Cross-cutting rule:** every figure the system renders uses `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum"`, exposed as the `.numeric` utility.

## Spacing

The base step is `--spacing = 0.25rem` (4px), with 8px as the default composition rhythm. Named scale:

| Token         | px  | Typical use                                                          |
| ------------- | --- | -------------------------------------------------------------------- |
| `--space-0`   | 0   | Reset; never to separate legible content.                            |
| `--space-px`  | 1   | Hairline borders.                                                    |
| `--space-0_5` | 2   | Fine typographic adjustments, badge-dot micro-padding.               |
| `--space-1`   | 4   | Icon-to-icon gap within a group.                                     |
| `--space-1_5` | 6   | Auxiliary.                                                           |
| `--space-2`   | 8   | Chip vertical padding, label-to-input gap.                           |
| `--space-3`   | 12  | Input/button internal padding, gap between fields in a row.          |
| `--space-4`   | 16  | Small card base padding, vertical gap between fields.                |
| `--space-5`   | 20  | Section-card internal padding on mobile.                             |
| `--space-6`   | 24  | Section-card internal padding on desktop; gap between section cards. |
| `--space-8`   | 32  | Gap between page blocks.                                             |
| `--space-10`  | 40  | Auxiliary; control-height baseline.                                  |
| `--space-12`  | 48  | Gap between thematic sections; desktop header height.                |
| `--space-16`  | 64  | Collapsed sidebar width; empty-state top padding.                    |
| `--space-24`  | 96  | Full-page empty-state vertical padding.                              |
| `--space-32`  | 128 | Landing hero vertical padding (desktop).                             |
| `--space-48`  | 192 | Landing splash only. Never inside the admin app.                     |

Binding applications:

- Section-card padding: `--space-6` (24px) desktop / `--space-5` (20px) mobile.
- Form field row gap: `--space-4`; label-to-input column gap: `--space-2`.
- Section-to-section gap: `--space-6` mobile / `--space-8` desktop.

### Layout magic numbers

These are shell contracts, not spacing. No component declares a literal `240px`, `64px`, or `440px` for layout — it references the token.

| Token                     | px    | Use                                                                    |
| ------------------------- | ----- | ---------------------------------------------------------------------- |
| `--sidebar-w-expanded`    | 240   | Expanded admin sidebar (push, not overlay, at `≥ lg`).                 |
| `--sidebar-w-collapsed`   | 64    | Collapsed sidebar (icons only).                                        |
| `--header-h`              | 56    | Sticky mobile header.                                                  |
| `--header-h-desktop`      | 64    | Sticky desktop header.                                                 |
| `--drawer-w`              | 440   | Right-side filter drawer (desktop); becomes a bottom sheet below `md`. |
| `--sheet-max-h`           | 92svh | Mobile bottom-sheet max height.                                        |
| `--modal-max-w`           | 512   | Centered modal default.                                                |
| `--modal-max-w-lg`        | 768   | Large centered modal (multi-step forms).                               |
| `--toast-max-w`           | 352   | Single-toast max width.                                                |
| `--container-max-w`       | 1280  | Admin page max width.                                                  |
| `--container-max-w-prose` | 672   | Prose / reading max width.                                             |
| `--fab-size`              | 56    | FAB diameter (mobile).                                                 |
| `--fab-offset`            | 16    | FAB offset from the viewport edge.                                     |

## Border Radius

Seven radius tokens:

| Token           | px  |
| --------------- | --- |
| `--radius-xs`   | 4   |
| `--radius-sm`   | 6   |
| `--radius-md`   | 8   |
| `--radius-lg`   | 12  |
| `--radius-xl`   | 16  |
| `--radius-2xl`  | 20  |
| `--radius-pill` | ∞   |

Per-component assignment:

| Component                                                 | Token                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| input, button                                             | `--radius-md`                                                                |
| icon button, chip / badge, FAB, mobile avatar             | `--radius-pill`                                                              |
| list card, sub-card inside section, toast, popover / menu | `--radius-lg`                                                                |
| section card (form), centered modal, command palette      | `--radius-xl`                                                                |
| desktop avatar                                            | `--radius-lg`                                                                |
| mobile sheet                                              | `--radius-2xl` (top corners only: `var(--radius-2xl) var(--radius-2xl) 0 0`) |
| desktop filter drawer                                     | `--radius-xl` (left corners only: `var(--radius-xl) 0 0 var(--radius-xl)`)   |
| tooltip                                                   | `--radius-sm`                                                                |
| skeleton placeholder                                      | inherits from its component                                                  |

**Fine-detail note.** The Checkbox check mark is a hand-rolled glyph with a **1.5px stroke** — a deliberate sub-token detail that is not expressible as one of the seven radius tokens and must be preserved when the component is touched.

## Surfaces & Elevation

Elevation uses the same identifiers in both modes (`--elevation-1` … `--elevation-4`) with mode-specific values. **Light uses real soft shadows** with low-alpha cool slate (`rgba(20, 22, 30, …)`). **Dark uses composition, not real shadows** — an inset top highlight + a border ring + a punctual accent micro-glow. This keeps depth readable on the dark canvas without the muddy halos that real shadows produce there.

### Light (real soft shadows)

| Token           | Value                                                                  | Use                                             |
| --------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `--elevation-1` | `0 1px 2px rgba(20, 22, 30, 0.04)`                                     | List cards.                                     |
| `--elevation-2` | `0 4px 12px rgba(20, 22, 30, 0.06), 0 1px 2px rgba(20, 22, 30, 0.04)`  | Section cards, popover, dropdown, right drawer. |
| `--elevation-3` | `0 12px 24px rgba(20, 22, 30, 0.08), 0 2px 6px rgba(20, 22, 30, 0.06)` | Mascot bubble.                                  |
| `--elevation-4` | `0 24px 48px rgba(20, 22, 30, 0.12)`                                   | Command palette, expanded assistant.            |

### Dark (compositions, no real shadow)

Each dark elevation is an inset highlight plus a border ring, with `--elevation-3` and `--elevation-4` adding a faint accent / accent-cool glow:

- `--elevation-1`: `inset 0 1px 0 rgba(255,255,255,0.03)` + `0 0 0 1px var(--border)`.
- `--elevation-2`: `inset 0 1px 0 rgba(255,255,255,0.04)` + `0 0 0 1px var(--border-strong)`.
- `--elevation-3`: the above (stronger inset) + a `--accent` 6% micro-glow.
- `--elevation-4`: the above + an `--accent-cool` 12% wide glow.

(Exact composite declarations live in [`tokens-css.md`](tokens-css.md).)

### Per-component elevation

| Component                                                                      | Elevation                               |
| ------------------------------------------------------------------------------ | --------------------------------------- |
| List card                                                                      | `1`                                     |
| Row hover                                                                      | `0` (uses a state layer, does not lift) |
| Section card (form), popover / dropdown, right drawer, neutral-undo toast, FAB | `2`                                     |
| Mascot bubble                                                                  | `3`                                     |
| Centered modal (desktop)                                                       | `--modal-shadow` (bespoke, see below)   |
| Achievement toast                                                              | `3` + achievement halo (composition)    |
| Command palette                                                                | `4`                                     |

The achievement halo is an ad-hoc composition over `--elevation-3` (a warm ring + warm wide glow built from `--accent-warm`), not a reusable token.

**`--modal-shadow`** (ADR 0008 Semantic Depth) is a dedicated, bespoke token for the centered `<Modal>` desktop panel — warm-tinted `oklch(20% 0.02 50 / …)` real shadow in light, an inset highlight + border ring + `--accent` 5% micro-glow in dark. It intentionally differs from `--elevation-3` (which is neutral cool-slate in light) because the modal panel carries the Semantic Depth accent-glow language on its own. Exact declarations live in [`tokens-css.md`](tokens-css.md).

**Depth discipline.** Borders separate before shadows do. One main surface per region is expected; a second visual level is fine for grouped content; a third should be rare and justified. Do not nest cards inside cards inside cards — resolve dense content with whitespace, typography, dividers, and section headings rather than stacking bordered containers.

## Gradients

Gradients are part of PandaTrack's personality but signal emphasis; they are not a default fill.

**Appropriate:** hero sections, primary page-intro panels, spotlight containers, decorative glow backgrounds, highlighted headings or accents.

**Not appropriate as a default for:** standard cards, most forms, dense data areas, repeated list items, low-priority controls.

Rules:

- Keep gradients soft and layered, not loud.
- Prefer brand-adjacent blends built from `--accent`, `--accent-warm`, and the status / info tints rather than bespoke color stops.
- In the private app, gradients appear mainly on page intros, hero-like summaries, or elevated callout surfaces.

### Private-app page wash (authenticated shell)

The authenticated app may apply a **very soft vertical wash** to the root canvas — brand-adjacent stops (accent / accent-warm) at very low opacity, roughly the **~3%** range — so the UI keeps personality without forcing a different panel tint per section. Elevated panels rely on their own border, ring, and fill for contrast against this wash, not on one-off per-block background colors. When several sibling panels must read as one family on top of the wash, drive them from one shared class or component so opacity, border, and ring stay in sync. KPI / metric tiles in a horizontal row stay visually quiet (prefer a thin solid brand top edge over a gradient strip per tile) so the grid does not compete with the hero or the numbers.

## Layout primitives: z-index, breakpoints, motion

These foundation tokens exist and are normative, but their detail is owned by adjacent documents so this file stays focused on the visual language:

- **Z-index** — the stacking scale (`--z-sticky`, `--z-sidebar`, `--z-header`, `--z-mascot`, `--z-popover`, `--z-drawer`, `--z-sheet`, `--z-modal-backdrop`, `--z-modal`, `--z-toast`, `--z-command`, `--z-tooltip`, `--z-fab`) is declared in [`tokens-css.md`](tokens-css.md). Always use a token; never a literal `z-index` value.
- **Breakpoints** — the breakpoint tokens (`--breakpoint-xs` … `--breakpoint-2xl`, with PandaTrack's extra `xs` at 360px) live in [`tokens-css.md`](tokens-css.md); the mobile cutoff (`< md` mobile, `≥ md` desktop) and the responsive rules that consume them are in [`interface-patterns.md`](interface-patterns.md).
- **Motion** — durations, easings, the transform/opacity rule, reduced-motion policy, and View Transitions are owned by [`motion.md`](motion.md). Their literal CSS values are in [`tokens-css.md`](tokens-css.md).

## Rules & anti-patterns

- **Golden rule: ≤3–4 chromatic tokens visible per screen.** A typical screen uses `--accent` plus one status, optionally one punctual `--accent-warm` or `--accent-cool` element. Six or more visible colors at once means the screen is broken.
- **Light and dark are siblings.** Define every theme-dependent value for both modes; never invert.
- **Color is never the only signal.** Status and category meaning always pair color with an icon and a text label ([ADR 0006](decisions/0006-color-blindness-icon-label-contract.md)).
- **`--accent-cool` is icon-only.** Never a background, border, text color, or CTA.
- **`--accent-warm` is decorative.** Never small text on the canvas, never a metric figure, never a CTA.
- **Disabled uses the muted token, not `opacity`.**
- **No theme-blind colors.** `#fff`, `text-white`, `#000`, and literal hex in app UI are banned — always a semantic token.
- **No hardcoded spacing, radius, or layout sizes.** Reference the scale and the layout magic-number tokens, never literal `px` values.
- **No categorical color palette.** Category identity is a Lucide icon + label; any future data-viz palette is designed fresh ([ADR 0004](decisions/0004-categorical-palette-removal.md)).

> _Historical note: this Velvet system replaced an earlier indigo-and-amber design language. References to that prior palette in legacy material are historical only and must not be replicated in code._
