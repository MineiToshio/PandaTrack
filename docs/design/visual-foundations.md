# Visual Foundations

This document defines PandaTrack's visual language: semantic design variables, typography, color, spacing, surfaces, radius, elevation, shadows, and gradients.

## Number and currency formatting

**Always use a period (`.`) as the decimal separator.** Never use a comma.
**Never use a thousand separator.** Display amounts as a single continuous number — `1240.00`, not `1,240.00` and not `1.240,00`.

### Monetary amounts

- All monetary display goes through the helpers in `src/lib/currency.ts`:
  - `formatAmount(minorUnits, currencyCode)` → `{value} {code}` (e.g. `888.50 USD`, `43000 CLP`)
  - `formatAmountSymbolOnly(minorUnits, currencyCode, locale, { alwaysShowDecimals })` → `{symbol}{value}` (e.g. `$496.00`, `S/ 6765.00`)
  - `formatAmountWithSymbol(...)` → `{symbol}{value} {code}` when the symbol is ambiguous (e.g. `$496.00 USD`)
- All three helpers force `"en"` locale + `useGrouping: false` in `Intl.NumberFormat` so the decimal separator is always a period and there is never a thousand separator, regardless of the user's UI language.
- The `locale` argument to the symbol variants is used only to resolve the currency's narrow symbol (e.g. `S/` for PEN in `es`); it does **not** affect the number layout.

### Decimal inputs (prices, payment amounts)

- Use `type="text" inputMode="decimal"` for price and payment inputs — **not** `type="number"`.
  - `type="number"` renders the value using the OS locale (comma in Spanish/European) which conflicts with the period standard.
  - `type="text" inputMode="decimal"` keeps display under our control while still showing the numeric keyboard on mobile.
- Store and read values as dot-separated strings (`"888.50"`); parse with `parseFloat` or `Math.round(parseFloat(v) * 100)`.
- Apply `sanitizeDecimalInput` from `src/lib/decimalInput.ts` on every `onChange` — it strips non-numeric characters, keeps one period, and limits to two decimal digits.
- Validate with `isValidPositiveDecimal` from the same module before submitting — rejects empty, zero, trailing-dot (`"25."`), and non-numeric values.
- **Validation order**: client-side first (immediate field error, no server round-trip), server-side second (Zod schema as safety net against bypassed JS). Never rely on server validation alone for user-facing feedback.
- **Never** format a number with `toLocaleString()` or `Intl.NumberFormat` without explicitly passing `"en"` as the locale.

### Ratings and other decimals

- Use `.toFixed(1)` or `.toFixed(2)` for display — these always produce period-separated output.
- Do not pass them through `Intl.NumberFormat` with a non-`"en"` locale.

## Typography

### Font Families

#### Primary body font: Open Sans

Defined in `src/lib/fonts.ts` as `--font-regular` and mapped to Tailwind `font-sans`.

Use for:

- paragraphs
- form labels
- helper text
- table and list content
- buttons by default
- dense app content

#### Secondary display and structural font: Roboto Condensed

Defined as `--font-secondary`.

Use for:

- compact navigation
- structural labels that need stronger editorial rhythm
- selective section emphasis

Rule:

- do not use `font-secondary` for long reading blocks or form-heavy content

#### Brand font: Zilla Slab Highlight

Defined as `--font-logo`.

Use only for:

- PandaTrack wordmark and logo

Rule:

- never use the logo font for body copy, headings, controls, or cards

### Type Scale

#### Body scale

Implemented in `src/components/core/Typography.tsx`.

| Variable | Current class mapping  | Use                                                   |
| -------- | ---------------------- | ----------------------------------------------------- |
| `2xs`    | `text-xs`              | fine print, disclaimers, metadata labels              |
| `xs`     | `text-xs sm:text-sm`   | helper text, compact descriptions, secondary labels   |
| `sm`     | `text-sm sm:text-base` | standard supporting text, card details, form guidance |
| `md`     | `text-base sm:text-lg` | default paragraph and section text                    |
| `lg`     | `text-lg sm:text-xl`   | prominent body copy, intro text                       |

Rules:

- use `md` as the default paragraph size
- use `sm` for dense app UI
- use `xs` and `2xs` only for secondary information

#### Heading scale

Implemented in `src/components/core/Heading.tsx`.

| Variable | Current class mapping              | Use                                                                                                             |
| -------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `lg`     | `text-5xl md:text-6xl lg:text-7xl` | hero headlines only                                                                                             |
| `md`     | `text-4xl md:text-5xl lg:text-6xl` | large section headers and high-impact titles                                                                    |
| `sm`     | `text-2xl md:text-3xl lg:text-4xl` | **private-app screen titles (`h1`)** when the page stacks major sections below; large marketing section headers |
| `xs`     | `text-lg font-semibold`            | **major section titles (`h2`) under that private-app `h1`**; card titles, modal titles, compact in-card headers |

Rules:

- one dominant `h1` per screen; it must read as the strongest heading on the page (larger and heavier than in-page section `h2`s)
- `lg` and `md` belong mostly to landing and high-visibility sections
- on private-app pages that combine a top hero header with sibling section panels, use `Heading size="sm"` for the page `h1` and `Heading size="xs"` for each major section `h2`; do not shrink the `h1` with body utilities such as `text-base`, or section headings will visually outrank the page title
- titles inside modals, tab panels, and dense summary surfaces must still read as titles, not helper text

### Font Weights

Observed weight system:

- `400` regular
- `500` medium
- `600` semibold
- `700` bold

Guidance:

- `400`: default reading text
- `500`: labels, metadata, minor emphasis
- `600`: section labels, key values, card headings
- `700`: hero headlines and major promotional emphasis

Rules:

- prefer weight changes only when they signal hierarchy
- avoid light weights in product UI

### Letter Spacing And Text Transform

Observed patterns:

- headings use tighter tracking
- eyebrow labels use wide tracking with uppercase
- body copy uses normal tracking

Rules:

- tight tracking is for display headings only
- wide uppercase tracking is reserved for eyebrow labels, micro-badges, and high-level categorization

## Color System

### Theme Model

Theme variables live in `src/app/globals.css`:

- `:root` is the dark baseline
- `:root[data-theme="light"]` defines explicit light theme
- `@media (prefers-color-scheme: light)` defines the light fallback when no explicit theme is selected

### Color Roles

#### Foundations

| Variable     | Dark      | Light     | Purpose                          |
| ------------ | --------- | --------- | -------------------------------- |
| `background` | `#0b0f14` | `#f8fafc` | page background                  |
| `foreground` | `#e6edf3` | `#0f172a` | default high-contrast foreground |
| `surface`    | `#111826` | `#ffffff` | primary elevated surface         |
| `surface-2`  | `#0f172a` | `#f1f5f9` | secondary or nested surface      |
| `card`       | `#111826` | `#ffffff` | card and dialog surfaces         |
| `popover`    | `#111826` | `#ffffff` | floating overlays                |

#### Borders and inputs

| Variable | Dark      | Light     | Purpose        |
| -------- | --------- | --------- | -------------- |
| `border` | `#1f2a3a` | `#e2e8f0` | default border |
| `input`  | `#1f2a3a` | `#e2e8f0` | input border   |
| `ring`   | `#8b5cf6` | `#7c3aed` | focus ring     |

#### Brand and action colors

| Variable     | Dark      | Light     | Purpose                                      |
| ------------ | --------- | --------- | -------------------------------------------- |
| `primary`    | `#8b5cf6` | `#7c3aed` | main CTA, selected states, key emphasis      |
| `secondary`  | `#6d28d9` | `#5b21b6` | deeper brand support                         |
| `accent`     | `#f59e0b` | `#d97706` | highlight, warmth, warning-adjacent emphasis |
| `highlight`  | `#a78bfa` | `#7c3aed` | glow, gradients, softer brand accent         |
| `link`       | `#a78bfa` | `#6d28d9` | inline links                                 |
| `link-hover` | `#c4b5fd` | `#7c3aed` | link hover                                   |

#### Text roles

| Variable     | Dark      | Light     | Purpose                       |
| ------------ | --------- | --------- | ----------------------------- |
| `text-title` | `#f2f6fb` | `#0f172a` | titles and key labels         |
| `text-body`  | `#d6dee6` | `#1f2937` | default body copy             |
| `text-muted` | `#a8b3c0` | `#64748b` | secondary and supporting text |

#### Semantic feedback

| Variable      | Dark      | Light     | Purpose                                 |
| ------------- | --------- | --------- | --------------------------------------- |
| `destructive` | `#ef4444` | `#dc2626` | destructive actions and critical errors |
| `success`     | `#22c55e` | `#16a34a` | success confirmations                   |
| `warning`     | `#f59e0b` | `#d97706` | warnings and cautionary messaging       |
| `info`        | `#38bdf8` | `#0ea5e9` | informational emphasis                  |

### Applied semantic color patterns in collector UI

Reuse these meanings before introducing new chip or badge colors.

#### Store taxonomy and trust chips

- product types: `primary` tint (`border-primary/15 bg-primary/8 text-primary`)
- import countries: `success` tint (`border-success/15 bg-success/8`)
- presence and online/offline reach: `info` tint (`border-info/15 bg-info/8`)
- hero metadata pills: neutral `bg-background/80` surface with semantic icon color when needed

#### Order state and finance chips

- open state: `info`
- in transit and partially in transit: `primary`
- partially delivered: `highlight`
- completed: `success`
- unpaid or attention-needed financial state: `warning`
- destructive or invalid state: `destructive`

Rules:

- use semantic tint plus label together - never rely on color alone to communicate meaning
- keep the tint soft (`/8` to `/20` backgrounds, `/15` to `/40` borders) so chips stay readable in dense dark UI
- prefer icon color to carry the strongest semantic cue inside neutral hero pills instead of tinting the whole pill

### Theme Rules

- use semantic variables, not theme-blind colors
- define every new theme-dependent variable for both themes
- verify hierarchy and contrast in both themes

## Spacing System

### Base Unit

PandaTrack behaves like a 4px-based system with most layout decisions landing on 8px multiples.

Rule:

- 4px is the foundational unit
- 8px is the default composition rhythm

### Recommended scale

| Value   | Usage                                |
| ------- | ------------------------------------ |
| `4px`   | ultra-tight inline spacing           |
| `8px`   | default small gap                    |
| `12px`  | compact grouped controls             |
| `16px`  | default component padding            |
| `20px`  | emphasized control spacing           |
| `24px`  | standard card, modal, header padding |
| `32px`  | section spacing                      |
| `40px`  | generous section spacing             |
| `48px+` | hero and large composition spacing   |

### Spacing Rules

- use 8px rhythm by default
- use 4px increments only when finer control is genuinely needed
- avoid arbitrary spacing values when an existing step already works

### Layout Containers

Observed patterns:

- `max-w-6xl` for landing and large app content
- **Private collector shell** (`src/app/[locale]/(app)/`): one shared content column for every route. The `<main>` element uses `APP_SHELL_MAIN_CLASSNAME` in `src/lib/constants.ts` (`max-w-6xl` plus `px-4 py-6 sm:px-6 sm:py-8 lg:px-8`). The sticky top header row uses the same max width via `APP_SHELL_CONTENT_MAX_WIDTH_CLASSNAME` so breadcrumbs and page titles align with the main column. Do not wrap individual pages in another `mx-auto max-w-*` shell. For form-heavy flows (for example store create/edit), constrain the form stack with `APP_SHELL_FORM_RAIL_CLASSNAME` (`max-w-3xl`) **inside** the main region, not by changing the page wrapper.
- `max-w-xl` and `max-w-sm` for auth and modal-width content
- page padding commonly uses `px-4`, `sm:px-6`, `lg:px-8`

## Surface System

### Surface Hierarchy

#### Level 0: Page background

Use `bg-background` for the canvas.

#### Level 1: Primary containers

Use `bg-surface` or `bg-card` with `border-border` for:

- cards
- auth panels
- sidebars
- dialogs
- filter shells

#### Level 2: Nested sections

Use muted or translucent nested surfaces for:

- grouped form sections
- metadata panels
- inset summaries
- nested action zones

Common patterns:

- `bg-muted/35`
- `bg-background/70`
- `bg-background/90`
- `COLLECTOR_MUTED_INSET_CLASSNAME` from `src/lib/styles.ts` for compact secondary groups inside cards and listing modules

#### Collector app surface family: listings and detail panels

Use one shared panel family for:

- entity listing cards
- transaction listing cards
- active-filter shells
- profile detail sections
- detail sections with repeated summary panels

Base token set:

- `COLLECTOR_CARD_SURFACE_CLASSNAME` from `src/lib/styles.ts`
- `bg-surface-2`
- `border-border`
- `rounded-2xl`
- `border`
- `shadow-sm`

Rules:

- start from this shared surface for repeated app cards before adding page-specific chrome
- add hover motion, inner separators, sticky positioning, or denser padding on top of the shared token set instead of redefining the base panel
- use `COLLECTOR_MUTED_INSET_CLASSNAME` as the preferred second visual level inside these cards for grouped metadata, compact summaries, and nested read-only rows
- when a detail panel needs a tighter inset card inside the main section, keep it neutral (`bg-card`, `border-border/70`, `rounded-2xl`, `shadow-sm`) so the outer section remains the dominant surface

#### Repeated elevated panels on a washed background

When the **page canvas** uses a very soft vertical tint (see Gradients / private shell below) and you need **several sibling panels** (detail sections, rails, full-width blocks) to feel like one family:

- prefer **one shared class or component** for those panels so opacity, border, and ring stay in sync
- typical stack: semi-opaque canvas-relative fill (`bg-background/80` to `bg-background/90`), defined border (`border-border/60` to `border-border/70`), **inset** brand ring for depth (`ring-1 ring-inset ring-primary/10` to `ring-primary/15`), `rounded-3xl`, `border`, `shadow-sm`, responsive padding `p-5 sm:p-6`
- allow **dense exceptions** (alerts, compact callouts) by overriding padding only, not the whole token set

**Metric or KPI tiles** in a **horizontal row** should stay visually quiet: prefer a **thin solid brand top edge** (`border-t-2` + `border-t-primary` at moderate opacity) over repeating **gradient strips** on every tile, so the grid does not compete with the hero or with the numbers.

### Maximum Visual Depth

Avoid turning the UI into a visible stack of boxes inside boxes inside boxes.

#### 🚨 Anti-Pattern: Box-in-Box Syndrome

**NEVER** encase every piece of information in its own bordered container. This creates a noisy, heavy, and claustrophobic interface.

- **Do not** put a card inside a card inside a card.
- **Do not** use borders to separate every single group of data.
- **Instead**, use whitespace (margins/padding), typography (size/weight/color), and subtle dividers (`border-b` or `border-t`) to establish hierarchy.
- Let the content breathe on the page background (`bg-background`) whenever possible.

Rule of thumb:

- one main surface is expected
- a second visual level is acceptable for grouped content
- a third visual level should be rare and justified
- beyond that, prefer flatter layouts with dividers, headings, spacing, and inline grouping

Prefer solving dense content with:

- section titles
- spacing
- divider lines
- compact labels
- grid or list layouts
- tabs when the content represents parallel sections
- a soft second-level subsection container when sibling groups need to feel clearly separated

Avoid solving dense content with:

- repeated nested cards
- multiple bordered containers inside already elevated containers
- different tinted backgrounds at every level
- stacking rounded boxes when the content could read as one structured section

## Border Radius

| Radius          | Typical Tailwind class            | Use                                                             |
| --------------- | --------------------------------- | --------------------------------------------------------------- |
| small           | `rounded-md`                      | form fields, buttons, compact controls                          |
| medium          | `rounded-lg`                      | nav items, segmented controls, utility cards                    |
| large           | `rounded-xl`                      | cards, accordions, elevated groups                              |
| extra large     | `rounded-2xl`                     | prominent cards, detail modules, modal controls                 |
| hero or feature | `rounded-3xl` or `rounded-[28px]` | hero media, standout containers, modal shells                   |
| pill            | `rounded-full`                    | eyebrow labels, back links, toggles, circular decorative shapes |

Rules:

- `rounded-md` is the default for fields and standard buttons
- `rounded-xl` and `rounded-2xl` are preferred for card-based product UI
- reserve `rounded-full` for eyebrow labels, back navigation, toggles, and truly circular decorative or icon-based shapes
- status tags, data tags, filter chips, and compact badges should default to `rounded-lg`, `rounded-xl`, or `rounded-2xl`
- count badges inside tags should not default to fully circular shapes

## Borders, Elevation, And Shadows

Observed pattern:

- borders are used more often than heavy shadows
- shadows exist mainly as soft depth for hero cards, detail cards, and modal surfaces

Rules:

- use borders as the first separation tool
- use shadows as secondary depth
- avoid strong drop shadows in dense app screens

### Shadow Levels

#### Level 0: No shadow

Use for standard layout blocks and dense app surfaces already separated by border and contrast.

#### Level 1: Soft elevation

Use for:

- standard cards that need gentle lift
- hover states on selectable rows or cards
- summary panels that need slightly more separation

#### Level 2: Elevated surface

Use for:

- modals
- floating drawers
- spotlight cards
- hero media containers
- sticky elements that should feel above the page

#### Level 3: Atmospheric glow or dramatic emphasis

Use only for marketing hero treatments, celebratory states, or standout showcase panels.

### Shadow Rules

- in the private app, start with border and surface contrast before shadow
- in dark theme, subtle shadows are acceptable when hierarchy is already clear
- hover elevation should usually be one level stronger than resting elevation
- selectable listing cards use this exact pattern: resting `shadow-sm`, hover `shadow-md` plus a light border emphasis and slight `-translate-y-0.5`

## Gradients

Gradients are part of PandaTrack's visual personality, but they should signal emphasis, not become the default fill for everything.

### When gradients are appropriate

Use gradients for:

- hero sections
- primary page-intro panels
- spotlight containers
- decorative glow backgrounds
- highlighted headings or accents

### When gradients are not appropriate

Do not use gradients as the default for:

- standard cards
- most forms
- dense data areas
- repeated list items
- low-priority controls

### Gradient Rules

- keep gradients soft and layered, not loud
- prefer brand-adjacent blends such as `primary`, `highlight`, `accent`, and `info`
- in the private app, gradients should appear mainly on page intros, hero-like summaries, or elevated callout surfaces
- reuse the shared Tailwind stop bundles in `src/lib/styles.ts`: `TINTED_SURFACE_GRADIENT_STOPS` (pair with `bg-linear-to-br` or `bg-linear-to-r`) and `TINTED_SURFACE_GRADIENT_TOP_WASH` (pair with `bg-linear-to-b` for vertical fades to transparent) so heroes, modals, and marketing section overlays stay aligned

### Private-app page wash (authenticated shell)

The authenticated app may use a **very soft vertical wash** on the root canvas (brand-adjacent `via` / `to` stops at **low opacity**, for example primary and accent in the **~3%** opacity range) so the UI keeps personality without forcing **different panel tints** per section. **Elevated panels** (see above) should rely on their own border, ring, and fill for contrast against this wash, not on one-off background colors per block.
