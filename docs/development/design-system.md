# PandaTrack Design System

This document is the source of truth for PandaTrack's visual system and interface implementation rules.

It serves two purposes:

1. Describe the design foundations already established in the application.
2. Define the standards that all future UI work must follow unless a deliberate design decision updates this document.

This design system is implementation-facing. It is meant for product designers, frontend engineers, and coding agents working on PandaTrack.

## Scope

This document governs:

- design variables
- typography
- spacing and layout rhythm
- color and theme usage
- surface, border, and radius patterns
- interactive states
- component hierarchy and usage rules
- responsive and accessibility expectations

It applies to both:

- the public landing experience
- the private app/admin experience

## Design Principles

### 1. Semantic over ad hoc

Use semantic design variables and shared components before introducing one-off classes. New UI should be built from the existing system, not by restyling each screen independently.

### 2. Contrast with restraint

PandaTrack uses a dark-first visual language with strong contrast, but the interface should still feel clean and readable. Accent colors should guide attention, not compete with content.

### 3. Clear hierarchy first

Typography, spacing, and surface treatment must make it obvious what is primary, secondary, optional, or contextual.

### 4. Soft geometry

The product favors rounded surfaces, pill-shaped metadata, and softened containers instead of sharp, aggressive chrome. Radius is part of PandaTrack's personality.

### 5. Motion as emphasis, not decoration

Animation should reinforce hierarchy, focus, and product tone. It is appropriate for hero areas, overlays, and feedback moments, but should not make dense workflows harder to scan.

### 6. Theme safety by default

Every interface must work in both dark and light themes using semantic design variables. Hardcoded colors are not acceptable for product UI.

## Source Design Variables

### Core Variable Files

- `src/app/globals.css`: color, theme, and font variables
- `src/lib/fonts.ts`: font loading
- `src/components/core/Typography.tsx`: body text scale
- `src/components/core/Heading.tsx`: heading scale
- `src/components/core/Button/buttonVariants.ts`: button patterns

### Rule for future work

If a new reusable visual variable is needed:

1. Add it to `globals.css` using semantic naming.
2. Define it for both dark and light themes.
3. Use it through semantic classes or shared components.
4. Update this document in the same change.

## Typography

### Font Families

### Primary body font: Open Sans

Defined in `src/lib/fonts.ts` as `--font-regular` and mapped to Tailwind `font-sans`.

Use for:

- paragraphs
- form labels
- helper text
- table/list content
- buttons by default
- dense app content

Rationale:

- highly readable at small and medium sizes
- neutral enough for product workflows
- works well across both marketing and application surfaces

### Secondary display/structural font: Roboto Condensed

Defined as `--font-secondary`.

Use for:

- compact navigation
- structural labels where a tighter, more editorial tone helps
- section-level emphasis when the UI needs a stronger vertical rhythm without becoming decorative

Current reference usage:

- landing header navigation in `src/app/[locale]/(landing)/_components/Menu/HeaderNav.tsx`

Rule:

- do not use `font-secondary` for large reading blocks or form-heavy content
- keep it for navigational, structural, or accent usage

### Brand font: Zilla Slab Highlight

Defined as `--font-logo`.

Use only for:

- PandaTrack wordmark/logo

Current reference:

- `src/components/core/Logo.tsx`

Rule:

- never use the logo font for body copy, headings, buttons, cards, or form UI

### Type Scale

### Body scale

The shared body scale is implemented in `src/components/core/Typography.tsx`.

| Variable | Current class mapping | Use |
| --- | --- | --- |
| `2xs` | `text-xs` | fine-print, disclaimers, metadata labels |
| `xs` | `text-xs sm:text-sm` | helper text, compact descriptions, secondary labels |
| `sm` | `text-sm sm:text-base` | standard supporting text, card details, form guidance |
| `md` | `text-base sm:text-lg` | default paragraph and section text |
| `lg` | `text-lg sm:text-xl` | prominent body copy, hero/supporting intro text |

Rules:

- Use `md` as the default paragraph size for standard content sections.
- Use `sm` for dense application UI and supporting information.
- Use `xs` and `2xs` only for secondary information, never for primary actions or critical content.
- Do not introduce arbitrary paragraph sizes before checking whether `Typography` should be extended centrally.

### Heading scale

The shared heading scale is implemented in `src/components/core/Heading.tsx`.

| Variable | Current class mapping | Use |
| --- | --- | --- |
| `lg` | `text-5xl md:text-6xl lg:text-7xl` | hero headlines only |
| `md` | `text-4xl md:text-5xl lg:text-6xl` | large section headers or high-impact page titles |
| `sm` | `text-2xl md:text-3xl lg:text-4xl` | major section titles |
| `xs` | `text-lg font-semibold` | compact page titles, card titles, modal titles, subsection headers |

Rules:

- There should be one dominant `h1` per screen.
- `lg` and `md` belong mostly to landing and high-visibility sections.
- Private-app page titles should usually use `Heading size="xs"` or a nearby equivalent unless the screen is intentionally marketing-like.
- Avoid skipping hierarchy for visual effect alone.

### Font Weights

Observed weight system:

- `400` regular
- `500` medium
- `600` semibold
- `700` bold

Guidance:

- `400` regular: default reading text
- `500` medium: labels, metadata, minor emphasis, compact actions
- `600` semibold: section labels, key values, card headings, secondary emphasis
- `700` bold: hero headlines and major promotional emphasis

Rules:

- Prefer weight changes only when they signal hierarchy.
- Do not stack multiple emphasis signals without reason, for example bold plus oversized text plus bright accent plus uppercase.
- Avoid light weights for product UI; they reduce readability against PandaTrack's high-contrast surfaces.

### Letter Spacing and Text Transform

Observed patterns:

- headings use tighter tracking (`tracking-tighter`)
- eyebrow labels use wide tracking with uppercase
- body copy uses normal tracking

Rules:

- Tight tracking is allowed for display headings only.
- Wide tracking with uppercase is reserved for eyebrow-style labels, micro-badges, and high-level categorization.
- Do not uppercase large blocks of navigation or body text.

## Color System

### Theme Model

PandaTrack is dark-first, but must support both themes from the same semantic system.

Theme variables live in `src/app/globals.css`:

- `:root` is the dark baseline
- `:root[data-theme="light"]` defines explicit light theme
- `@media (prefers-color-scheme: light)` defines the light fallback when no explicit theme is selected

### Color Roles

### Foundations

| Variable | Dark | Light | Purpose |
| --- | --- | --- | --- |
| `background` | `#0b0f14` | `#f8fafc` | app/page background |
| `foreground` | `#e6edf3` | `#0f172a` | default high-contrast foreground |
| `surface` | `#111826` | `#ffffff` | primary elevated surface |
| `surface-2` | `#0f172a` | `#f1f5f9` | secondary or nested surface |
| `card` | `#111826` | `#ffffff` | card/dialog surfaces |
| `popover` | `#111826` | `#ffffff` | floating overlays |

Usage:

- `background` for pages and broad layout areas
- `surface` and `card` for containers that need separation from the page
- `surface-2` for nested surfaces, hover-adjacent sections, or subtle tonal depth

### Borders and inputs

| Variable | Dark | Light | Purpose |
| --- | --- | --- | --- |
| `border` | `#1f2a3a` | `#e2e8f0` | default border |
| `input` | `#1f2a3a` | `#e2e8f0` | input border |
| `ring` | `#8b5cf6` | `#7c3aed` | focus ring |

Rules:

- Use borders to define structure, not decoration.
- Standard surfaces should use low-contrast borders.
- Dashed or stronger borders are for empty states, drop zones, or explicit separation.

### Brand and action colors

| Variable | Dark | Light | Purpose |
| --- | --- | --- | --- |
| `primary` | `#8b5cf6` | `#7c3aed` | main CTA, selected states, key emphasis |
| `secondary` | `#6d28d9` | `#5b21b6` | deeper brand support, secondary filled accents |
| `accent` | `#f59e0b` | `#d97706` | highlight, warmth, warning-adjacent emphasis |
| `highlight` | `#a78bfa` | `#7c3aed` | glow, gradients, supporting brand accent |
| `link` | `#a78bfa` | `#6d28d9` | inline links |
| `link-hover` | `#c4b5fd` | `#7c3aed` | link hover |

Rules:

- `primary` is the default for the main action on a screen.
- `accent` is not a replacement for `primary`; it should highlight supporting emphasis, visual warmth, or selective data emphasis.
- `highlight` is primarily for gradients, glow layers, and softer emphasis, not as the default fill color for controls.
- Links should use the `link` variable, not body-text colors with underline-only styling.

### Text roles

| Variable | Dark | Light | Purpose |
| --- | --- | --- | --- |
| `text-title` | `#f2f6fb` | `#0f172a` | titles, labels with high importance |
| `text-body` | `#d6dee6` | `#1f2937` | default body copy |
| `text-muted` | `#a8b3c0` | `#64748b` | secondary/supporting text |

Rules:

- Titles and key numeric values should use `text-title`.
- Reading copy should use `text-body`.
- Helper text, secondary metadata, and low-priority descriptions should use `text-muted`.
- Avoid using raw `foreground` everywhere; prefer role-based text variables for consistency.

### Semantic feedback

| Variable | Dark | Light | Purpose |
| --- | --- | --- | --- |
| `destructive` | `#ef4444` | `#dc2626` | destructive actions and critical errors |
| `success` | `#22c55e` | `#16a34a` | success confirmations |
| `warning` | `#f59e0b` | `#d97706` | warnings and cautionary messaging |
| `info` | `#38bdf8` | `#0ea5e9` | informational emphasis |

Rules:

- Semantic colors should preserve meaning across themes.
- Do not use semantic colors for decoration when the state meaning is absent.

### Special-purpose variables

These are currently used for specific branded treatments:

- `eyebrow-*`: compact highlight labels in hero/section intros
- `logo`: logo foreground

Rule:

- Keep specialty variables scoped to their intended pattern unless the design system is explicitly extended.

### Theme Usage Rules

- Never hardcode theme-blind colors for product UI.
- Every new visual variable must be defined for dark and light themes together.
- Check contrast and hierarchy in both themes before considering a UI complete.
- Prefer semantic utility classes such as `bg-background`, `text-text-body`, and `border-border`.

## Spacing System

### Base Unit

PandaTrack currently behaves like a 4px-based system with most layout decisions landing on 8px multiples.

This should now be the explicit rule:

- 4px is the foundational spacing unit.
- 8px is the default rhythm for layout composition.

### Recommended spacing scale

| Value | Usage |
| --- | --- |
| `4px` | ultra-tight inline spacing |
| `8px` | default small gap |
| `12px` | compact grouped controls |
| `16px` | default component padding |
| `20px` | emphasized control/group spacing |
| `24px` | standard card/modal/header padding |
| `32px` | section spacing |
| `40px` | generous section spacing |
| `48px+` | hero, page-intro, and large composition spacing |

### Spacing Rules

- Use 8px rhythm by default for stack spacing, padding, and layout gaps.
- Use 4px increments only when finer control is genuinely needed.
- Dense app UI should usually stay within 8px, 12px, 16px, and 24px steps.
- Marketing sections may expand into 32px, 40px, and 48px spacing for stronger emphasis.
- Avoid arbitrary spacing values when an existing step already works.

### Layout Containers

Observed container patterns:

- `max-w-6xl` for landing and large app content areas
- `max-w-xl` and `max-w-sm` for auth and modal-width content
- page padding commonly uses `px-4`, `sm:px-6`, `lg:px-8`

Rules:

- Use `px-4` as the mobile baseline for page/container padding.
- Increase to `sm:px-6` and `lg:px-8` for larger viewports where the layout needs room.
- Keep readable text widths constrained; do not let long-form copy span full-width containers unnecessarily.

## Surface System

### Surface Hierarchy

### Level 0: Page background

Use `bg-background` for the canvas.

### Level 1: Primary containers

Use `bg-surface` or `bg-card` with `border-border` for:

- cards
- auth panels
- sidebars
- dialogs
- filter shells

### Level 2: Nested sections

Use muted or translucent nested surfaces for:

- grouped form sections
- metadata panels
- inset summaries
- nested action zones

Common patterns:

- `bg-muted/35`
- `bg-background/70`
- `bg-background/90`

Rule:

- nested surface changes should remain subtle; hierarchy should come from spacing, border, and content grouping before stronger background shifts

## Border Radius

PandaTrack uses soft rounded geometry consistently.

Observed radius families:

| Radius | Typical Tailwind class | Use |
| --- | --- | --- |
| small | `rounded-md` | form fields, buttons, compact controls |
| medium | `rounded-lg` | nav items, segmented controls, utility cards |
| large | `rounded-xl` | cards, accordions, elevated groups |
| extra large | `rounded-2xl` | prominent cards, detail modules, modal controls |
| hero/feature | `rounded-3xl` or custom `rounded-[28px]` | hero media, standout containers, modal shells |
| pill | `rounded-full` | eyebrow labels, back links, toggle tracks/thumbs, circular decorative shapes |

Rules:

- `rounded-md` is the default radius for fields and standard buttons.
- `rounded-xl` and `rounded-2xl` are preferred for card-based product UI.
- `rounded-3xl` and custom large radii should be reserved for high-emphasis containers, not used everywhere.
- `rounded-full` should be reserved for eyebrow labels, back navigation, toggles, and truly circular decorative or icon-based shapes.
- Status tags, data tags, filter chips, and compact badges should default to `rounded-lg`, `rounded-xl`, or `rounded-2xl` depending on density and prominence.
- Count badges inside tags should not default to fully circular shapes unless the UI intentionally needs an icon-style counter.

## Borders and Elevation

Observed pattern:

- borders are used more often than heavy shadows
- shadows exist, but mostly as soft depth for hero cards, detail cards, and modal surfaces

Rules:

- use borders as the first separation tool
- use shadows as secondary depth, not as the only separator
- avoid strong drop shadows in dense app screens unless a component is intentionally elevated

## Shadows

PandaTrack should use shadows sparingly, but intentionally.

The product is not meant to feel flat or lifeless. It is meant to feel layered, polished, and modern without becoming glossy or noisy.

### Shadow Levels

#### Level 0: No shadow

Use for:

- most standard layout blocks
- dense app lists
- simple form sections
- surfaces that are already separated by border and background contrast

#### Level 1: Soft elevation

Use for:

- standard cards that need gentle lift
- hover states on selectable rows or cards
- summary panels that need slightly more separation than surrounding content

Typical visual behavior:

- soft blur
- low opacity
- short spread

#### Level 2: Elevated surface

Use for:

- modals
- floating drawers
- spotlight cards
- hero media containers
- sticky elements that should feel above the page

Typical visual behavior:

- deeper blur
- larger spread
- more visible depth, but still soft-edged

#### Level 3: Atmospheric glow or dramatic emphasis

Use only for:

- marketing hero treatments
- gradient showcase panels
- celebratory or high-attention moments

Rule:

- this level should be rare in the private app

### Shadow Rules

- In the private app, start with border and surface contrast before adding shadow.
- In dark theme, shadows may be subtle or nearly invisible; that is acceptable when the surface hierarchy is already clear.
- Prefer soft shadows over hard, black-looking shadows.
- Hover elevation should usually be one level stronger than resting elevation, not dramatically different.
- Avoid stacking multiple strong shadows on the same component.

## Gradients

Gradients are part of PandaTrack's visual personality, but they should signal emphasis, not become the default fill for everything.

### When gradients are appropriate

Use gradients for:

- hero sections
- primary page-intro panels
- spotlight containers
- decorative glow backgrounds
- highlighted headings or visual accents

Current product-aligned examples:

- landing hero background treatments
- spotlight card treatments in the store detail header
- the intro panel in the stores listing page

### When gradients are not appropriate

Do not use gradients as the default for:

- standard cards
- most forms
- dense data areas
- list items repeated many times
- low-priority controls

### Gradient Rules

- Gradients should support hierarchy, warmth, and momentum.
- Keep gradients soft and layered, not loud or rainbow-like.
- Prefer brand-adjacent blends such as `primary`, `highlight`, `accent`, and `info`.
- Let gradients live on backgrounds, glows, or headline text before using them on control fills.
- In the private app, gradients should appear mainly on page intros, hero-like summary blocks, or elevated callout surfaces.

## Interaction States

Every interactive element must communicate state clearly.

That includes:

- hover
- focus-visible
- active/pressed
- selected
- disabled
- loading
- success or error feedback when relevant

## Hover

### When hover is required

Use a hover state for any desktop-visible interactive element, including:

- buttons
- links
- clickable cards
- nav items
- icon buttons
- segmented controls
- interactive tags and filters

### Typical hover behaviors

- color shift
- border emphasis
- subtle background change
- slight lift
- underline or underline reveal for navigation links
- glow or halo only for high-emphasis actions

### Hover Rules

- Hover should confirm interactivity, not redefine the component.
- Most hover states should stay subtle in dense app UI.
- Cards may use a tiny lift plus border/color reinforcement.
- Primary CTAs may use stronger visual energy than secondary or ghost actions.
- Avoid hover-only affordances for essential meaning; mobile users must not lose clarity.

## Focus

- Focus-visible states are mandatory for keyboard interaction.
- Focus should be more reliable than hover, not more decorative.
- Use semantic ring colors and offsets already aligned with the theme.

## Active and pressed states

Use active states to make controls feel responsive.

Preferred patterns:

- slight scale-down
- reduced translate-y
- darker or stronger fill
- tighter shadow

Rule:

- active states should feel tactile, especially for younger mobile-first users, but should stay fast and controlled

## Selected states

Use selected states for:

- filter chips
- segmented controls
- nav selection
- toggles
- selected cards or rows

Selected states should be more persistent and clearer than hover states.

## Disabled states

- Disabled controls must look inactive, not broken.
- Reduce opacity and interaction feedback, but keep the label readable.
- Do not rely on color alone if the disabled state needs explanation; add helper text where needed.

## Motion System

PandaTrack should feel more dynamic, especially for users in the 18 to 25 range, but motion must remain purposeful.

The goal is not to animate everything. The goal is to make the product feel responsive, alive, and rewarding to use.

### Motion Categories

#### 1. Functional motion

Use for:

- drawers opening and closing
- modals entering and leaving
- accordions expanding and collapsing
- filter panels sliding in
- navigation transitions
- loading and status transitions

Purpose:

- explain layout change
- preserve spatial understanding

#### 2. Feedback motion

Use for:

- button presses
- successful submits
- copied states
- toggle changes
- selection changes
- hover lifts

Purpose:

- make interactions feel tactile and responsive

#### 3. Attention-guiding motion

Use for:

- onboarding highlights
- important summaries
- newly revealed content
- visual emphasis for a primary CTA or a key status area

Purpose:

- direct the eye toward the next meaningful action

#### 4. Atmospheric motion

Use for:

- hero glows
- floating decorative orbs
- gentle pulse around a spotlight CTA
- subtle gradient shimmer in marketing-like surfaces

Purpose:

- create personality and energy

Rule:

- atmospheric motion belongs mostly to landing pages, page intros, and selected high-emphasis product surfaces

## Recommended motion patterns

### Entrance

Use:

- fade in + slight upward movement
- fade in + slight scale up
- staggered reveal for grouped content

Use for:

- hero content
- cards appearing after load
- section intros

### Expansion and collapse

Use:

- height transitions
- opacity transitions
- chevron rotation

Use for:

- accordions
- filters
- detail disclosure

### Slide transitions

Use:

- left-to-right or right-to-left slide for drawers
- bottom-up or top-down movement for sheets, banners, or mobile overlays

Use for:

- side panels
- mobile navigation
- temporary overlays

### Tactile micro-interactions

Use:

- slight scale-down on press
- slight lift on hover
- soft glow pulse for premium CTA moments

Use for:

- buttons
- interactive cards
- important filters

### Rotational motion

Use:

- chevrons
- loading spinners
- expand/collapse indicators

Rule:

- avoid playful spins on standard content unless the moment is explicitly celebratory or system-driven

## Motion Rules

- Default app motion should be quick, soft, and readable.
- Use stronger motion only when it clarifies interaction or creates meaningful delight.
- Repeated surfaces in data-heavy views should not all animate at once.
- If multiple elements animate together, stagger them deliberately.
- Motion should never slow down primary workflows.
- Respect reduced-motion preferences whenever motion becomes substantial.

## Delight and Product Energy

PandaTrack should feel useful first, but also rewarding and a bit fun.

That does not mean playful everywhere. It means adding controlled moments of energy where users benefit from it emotionally or behaviorally.

### Good places for delight

- hero sections
- empty states
- successful submissions
- share actions
- state transitions after completing a task
- onboarding or first-use moments
- selected high-value summary cards

### Good forms of delight

- soft glow behind a key panel
- animated icon or accent when a task succeeds
- subtle reveal of newly available actions
- progress or completion motion that rewards the user
- slightly more expressive CTA states in key moments

### Avoid

- constant pulsing across many surfaces
- motion that competes with reading
- decorative movement in dense form flows
- loud effects in repetitive list items

## Making the Product Feel More Interactive

When a future UI feels too static, consider these improvements before adding new visual decoration:

- add clearer hover, selected, and active states
- introduce small lift or border-emphasis on clickable cards
- animate layout changes instead of snapping instantly
- reveal secondary actions progressively when context supports it
- use success and feedback transitions after submits, saves, and copies
- add gentle spotlight treatment to key summary areas

Rule:

- prefer interactivity that improves clarity and responsiveness over decoration that only adds movement

## Buttons and Interactive Controls

Base button patterns are defined in `src/components/core/Button/buttonVariants.ts`.

### Button Variants

### Primary

Use for:

- the main action on a screen
- submit, continue, confirm, create

Visual role:

- filled with `primary`
- highest visual prominence

### Secondary

Use for:

- non-destructive supporting actions
- alternate actions near a primary action
- utility actions that still need button chrome

Visual role:

- muted surface with border
- lower emphasis than primary

### Outline

Use for:

- alternate actions that still need clear affordance
- feature-level secondary CTA in marketing or spotlight sections

### Ghost

Use for:

- subtle navigation
- low-emphasis utility actions
- back/up affordances when the flow already uses that pattern

Rule:

- one screen should usually have one visually dominant primary action
- avoid multiple competing primary buttons in the same action group

### Control Sizing

Observed standards:

- small: 36px tall
- medium: 40px tall
- large: 48px tall
- mobile touch targets often use 44px minimum or larger

Rules:

- interactive controls should generally be at least 40px tall
- touch-priority controls should target 44px minimum
- keep icon buttons visually aligned with the same height scale

### Form Controls

Current shared field patterns:

- `src/components/core/Input.tsx`
- `src/components/core/Textarea.tsx`
- `src/components/core/Select.tsx`
- `src/components/core/Label.tsx`

Rules:

- fields use `rounded-md`, `border-input`, `bg-background`, and semantic focus rings
- labels should stay medium or semibold in emphasis, never lighter than body copy
- error states should change border and focus ring to semantic destructive feedback
- placeholders should remain lower emphasis than entered values

## Navigation Patterns

### Back Navigation

Use `src/components/core/BackNavLink.tsx` when the action means going back or up a level and the flow already uses the pill-back pattern.

### Primary Navigation

Patterns currently established:

- landing header nav uses `font-secondary`, subtle underline hover, and low-density inline links
- app sidebar uses rounded navigation rows or icon rails with active-state fills
- top app header uses breadcrumb links plus a compact page title

Rules:

- reuse the existing navigation pattern for the same product area
- do not invent a new back, sidebar, or local nav style when a canonical pattern already exists nearby

## Content Hierarchy

### Standard Hierarchy Recipe

For most screens:

1. eyebrow or context label if needed
2. page/section title
3. one supporting paragraph
4. main action row
5. content blocks grouped by surface and spacing

Rules:

- keep intros concise in app screens
- allow more expressive hierarchy in landing sections
- every surface should have a clear reason to exist: title, summary, action set, grouped inputs, or status block

## Status, Badges, and Chips

Common traits:

- compact softened geometry
- compact sizing
- medium or semibold weight
- muted or semantic fills

Use for:

- metadata classification
- counts
- compact state indicators
- lightweight grouping labels

Rules:

- Do not default to `rounded-full` for status tags, data tags, or small counters.
- Prefer `rounded-lg`, `rounded-xl`, or `rounded-2xl` depending on size and prominence.
- Count indicators inside tags should feel integrated with the tag, not like detached circular bubbles, unless the component explicitly needs an icon-style counter.

Do not use chips as replacements for full buttons when the user expectation is an explicit action button.

## Motion

See `Motion System`, `Delight and Product Energy`, and `Making the Product Feel More Interactive`.

Summary rules:

- motion should support clarity, feedback, delight, or depth
- default product workflows should remain stable and calm
- stronger motion should be reserved for hero, spotlight, onboarding, or success moments
- always preserve usability when motion is reduced or absent

## Responsive Rules

- Mobile is the baseline.
- Use spacing and layout changes before resorting to smaller, harder-to-read typography.
- Protect tap targets and avoid cramped inline action clusters.
- If a desktop pattern becomes crowded on tablet/mobile, switch to a dedicated mobile pattern instead of forcing the same layout.

Existing examples:

- landing header swaps to a burger/drawer pattern
- sidebar behavior changes between desktop and smaller viewports

## Accessibility Rules

- Every interactive control must have visible focus treatment.
- Text contrast must remain readable in both themes.
- Icon-only controls must have labels.
- Secondary text must remain readable, not merely decorative.
- Motion and glow treatments must never reduce legibility of core content.

## Design System Usage Rules

When implementing UI:

1. Start with existing core and module components.
2. Use semantic design variables before custom values.
3. Match the established radius, spacing, and typography scales.
4. Reuse area-specific navigation and layout patterns.
5. Validate the result in dark and light theme.
6. Validate the result across mobile, tablet, and desktop.

## When to Update This Document

Update this file whenever one of these changes:

- a new reusable color variable is introduced
- a typography scale or font role changes
- spacing or radius conventions change
- a new shared surface/control pattern becomes standard
- the design language materially evolves

## Current Design Character Summary

PandaTrack's current design language is:

- dark-first
- softly rounded
- purple-led with amber and cool-highlight support
- high-contrast but not harsh
- editorial in selected landing/navigation moments
- practical and compact in app workflows

Future UI work should strengthen this identity, not dilute it with one-off styling decisions.
