# Interface Patterns

This document defines PandaTrack's reusable interaction and layout patterns: interface states, hierarchy, buttons, forms, navigation, tabs, modals, right sidebars, motion, responsive behavior, and accessibility.

## Interaction States

Every interactive element must communicate state clearly.

That includes:

- hover
- focus-visible
- active or pressed
- selected
- disabled
- loading
- success or error feedback when relevant

### Hover

Use a hover state for any desktop-visible interactive element, including:

- buttons
- links
- clickable cards
- nav items
- icon buttons
- segmented controls
- interactive tags and filters

Typical hover behaviors:

- color shift
- border emphasis
- subtle background change
- slight lift
- underline for navigation links

Rules:

- hover should confirm interactivity, not redefine the component
- most hover states should stay subtle in dense app UI

### Focus

- focus-visible states are mandatory for keyboard interaction
- use strong, theme-safe ring treatment
- never rely on hover alone for important affordances

### Active, Selected, Disabled

- active or pressed states should feel slightly denser or darker, not dramatically different
- selected states should remain obvious without relying only on color
- disabled states should remain readable while clearly non-interactive

## Motion System

Motion should support clarity, feedback, delight, or depth.

### Motion Categories

Use motion for:

- entrance and reveal
- expansion and collapse
- slide transitions
- tactile micro-interactions
- rotational or emphasis motion in rare highlight moments

### Motion Rules

- default product workflows should remain stable and calm
- stronger motion belongs to hero, spotlight, onboarding, or success moments
- respect `prefers-reduced-motion`

## Buttons And Interactive Controls

Base button patterns live in `src/components/core/Button/buttonVariants.ts`.

### Button hierarchy

- `primary`: main action on the screen
- `secondary`: supportive but still important action
- `outline`: lower-emphasis action with structural visibility
- `ghost`: contextual or inline action

### Control sizing

- use comfortable tap targets
- controls should not feel cramped on mobile
- button text should read as an action, not as metadata

### Form controls

Use shared form controls before custom markup. Keep labels, helper text, validation, and spacing consistent.

### Toggle choice groups (chip and tile)

Use `src/components/core/ToggleChoiceGroup.tsx` when the user picks one or many options via `aria-pressed` toggle buttons that share one visual language:

- **`appearance="chip"`**: wrapping row, compact height, rounded-xl (multi-select tags, filters).
- **`appearance="tile"`**: responsive two-column grid on larger viewports, larger targets, rounded-lg (single prominent choice).

Set `mode` to `"single"` or `"multiple"` to match the data shape. Prefer this component over duplicating toggle-button markup in feature routes.

## Navigation Patterns

### Back navigation

Use `src/components/core/BackNavLink.tsx` for parent-route navigation.

- **`appearance="pill"`** (default): compact rounded control with blur for page chrome (for example above a hero or under a page title).
- **`appearance="button"`**: `outline` variant at `md` size so it matches `Button` next to a primary submit in form footers.

### Primary navigation

Rules:

- reuse the existing navigation pattern for the same product area
- do not invent a new back, sidebar, or local nav style when a canonical pattern already exists nearby

### Reusable Pattern: Lower Shell Account Menu

Use this pattern for the authenticated collector shell account affordance.

Recommended structure:

1. place the account trigger in the lower navigation area rather than the page header
2. show avatar plus username when space allows
3. keep the whole trigger row interactive
4. open the menu upward from the trigger
5. keep legal/trust links visible inside the menu footer

Rules:

- desktop expanded sidebar: place the trigger above the sidebar expand/collapse control
- desktop collapsed sidebar: keep the avatar or fallback visible in the lower rail and reveal the full trigger on hover or focus expansion
- mobile/tablet drawer: replace any sign-out-only footer control with the same account trigger
- reuse one menu component across desktop and mobile placements
- keep the menu ordering stable when the same actions appear on different surfaces
- desktop may use a floating upward panel, but mobile/tablet drawer should prefer an inline anchored expansion for stability
- do not split core account actions between header and sidebar in the same shell
- the trigger must have hover, focus-visible, active, and pointer feedback
- the menu should feel visually anchored to the lower navigation area, not like a detached center-screen popover
- desktop trigger should read as a clean row, not a filled pill: keep the avatar unframed by default and let hover supply the surface feedback
- desktop floating panel may be slightly wider than the trigger row when needed so legal links fit cleanly
- place `Privacy Policy` and `Terms and Conditions` side by side in a compact footer row, using smaller text and a subtle separator dot
- when the account menu is open, the trigger should remain visibly active with a stronger filled state than hover
- keep the avatar anchor visually stable between collapsed-rail and expanded-sidebar states so expansion does not make the identity affordance appear to jump

## Content Hierarchy

### Standard Hierarchy Recipe

For most screens:

1. eyebrow or context label if needed
2. page or section title
3. one supporting paragraph
4. main action row
5. content blocks grouped by surface and spacing

Rules:

- keep intros concise in app screens
- every surface should have a clear reason to exist
- when a section becomes visually cramped, reduce surface nesting before reducing content
- if a tab already establishes the parent context, do not add another full-width outer card unless it adds real value
- if a subsection represents personal user data, do not render that subsection at all when the user has no item to show
- inside a tab panel, prefer one open reading layout with headings, spacing, and structured subsections over repeated cards unless each block truly needs independent emphasis
- sibling subsections must use the same chrome for equivalent roles
- subsection titles must still read as headings, not helper text
- equivalent subsection actions should appear in the same place across similar sections
- when a screen has both a page title and major section headings, the page `h1` must use a **larger** `Heading` size than those section `h2`s (see `visual-foundations.md` heading scale)

### Private-app hero header (collector shell)

Use the same top-of-page header block for comparable collector flows (for example `/settings` and `/stores` listing). Implement it with `src/components/modules/AppPageHero.tsx` so markup and tokens stay in sync.

1. optional eyebrow pill (`text-xs`, `Sparkles`, primary-tinted chip)
2. page title: `Heading` as `h1` with `size="sm"` and `text-text-title`
3. one short supporting line: `Typography size="sm"` with `text-text-muted`
4. gradient border card wrapper: `rounded-2xl border bg-linear-to-br from-primary/12 via-background to-accent/10` (match existing pages)
5. optional `aside` prop on `AppPageHero` for a trailing column (flex row with wrap)

Rules:

- keep `h1` typography aligned across routes that share this pattern (settings and stores listing use the same `Heading` size)
- major sections below use `Heading` as `h2` with `size="xs"` and `text-text-title` unless a different density is documented for that route

### Collector settings route (`/settings`)

- page title block: `AppPageHero` with the same `h1` scale and supporting line as other collector routes (`visual-foundations.md` heading scale).
- major section titles (Profile, Account, Preferences): `Heading` as `h2` with `size="xs"` and `text-text-title`.
- stack major sections (Profile, Account, Preferences) as **sibling** level-1 surfaces with **identical** chrome: `bg-card`, `border-border`, `rounded-xl`, and the same padding scale (`p-4 sm:p-6`). Do not vary translucent `bg-card/*` opacity between equivalent blocks.
- container: `max-w-6xl`, horizontal padding `px-4 sm:px-6 lg:px-8`, vertical rhythm `space-y-8` between the header and sections (`visual-foundations.md` layout containers).
- dense copy inside sections: prefer `Typography size="sm"` for placeholders and primary read values; use `Typography size="xs"` for field labels and subsection captions.
- form groups: `space-y-3` (12px) between stacked fields in dense settings forms.
- informational account states (for example pending email verification after a change request): semantic **info** treatment (`bg-info/12`, `border-info/35`, `rounded-xl`), not ad hoc `primary` fills.
- shared class for the three main section panels: `src/app/[locale]/(app)/settings/settingsSectionChrome.ts` (`SETTINGS_SECTION_SURFACE_CLASSNAME`).

### Reusable Pattern: Dense Summary Modal

Use this pattern when a modal needs to present:

- two or more parallel content groups
- a mix of personal and community or system information
- dense read-only summaries with one or two light actions

Recommended structure:

1. modal title and description
2. tab navigation if the top-level groups are parallel
3. inside each tab, go directly to the useful subsections
4. render each subsection as a sibling second-level panel
5. place optional edit or continue actions in the top-right of the subsection header

Recommended subsection anatomy:

- leading icon
- subsection title
- one short metadata line if needed
- structured content rows or grouped chips below

Rules:

- do not repeat the active tab title again as a full subsection header unless it adds new information
- do not wrap all subsection panels in another parent card if the tab already provides the parent context
- personal subsections should appear first when they exist
- personal subsections should be omitted entirely when there is no relevant user-specific content
- community or aggregate subsections may remain visible on their own when personal content is absent
- sibling subsections inside the same tab must use the same surface pattern, spacing logic, and action placement
- use icons to differentiate sibling subsections when that improves scanability more than numeric markers

Avoid:

- tab title, then the same title repeated again inside the panel
- empty personal panels that only say there is nothing to show
- one subsection with an inline action header and another with the action buried at the bottom
- a card inside a card inside a card just to create hierarchy

### When To Use Tabs

Tabs are useful when they reduce density without breaking understanding.

Use tabs when:

- the content groups are parallel, not parent-child
- the user only needs to focus on one group at a time
- each tab has a clear, short label
- showing everything at once would make the surface feel crowded or repetitive
- the hidden content is still easy to discover because the tab labels make the available groups obvious

Do not use tabs when:

- the content is sequential or depends on top-to-bottom reading
- the user needs to compare sections in one continuous scan
- one tab would be empty or nearly empty most of the time
- the labels are vague, repetitive, or require extra explanation
- the content behind each tab is so small that tabs add more chrome than value
- hidden content contains critical information that users are likely to miss

Prefer another pattern instead of tabs when:

- sections are hierarchical: use one structured vertical layout
- sections must be compared together: use stacked sections or a responsive grid
- content is progressively disclosed: use accordions
- the user is making a step-by-step choice: use steps, segmented controls, or a wizard depending on the flow

Tab rules:

- keep the number of tabs small; two or three is the preferred range for dense product UI
- tab labels should describe the content category, not an action
- the active tab should clearly feel selected in both themes
- do not repeat the active tab label as a major heading inside the panel unless it adds new meaning
- if one tab is almost always empty, reconsider whether that content should be merged into the main layout

### Modal vs Right Sidebar

Use a modal when:

- the task needs focused attention
- the rest of the page should temporarily recede
- the interaction is short and self-contained
- the action is confirmatory, sensitive, or interruptive

Use a right sidebar or right panel when:

- the user needs to keep the base page visible
- the task is exploratory, comparative, or inspect-and-return
- the panel supports filters, quick detail inspection, previews, or contextual editing
- closing the panel should feel like leaving an inspection state, not canceling a focused task

Prefer a modal for:

- confirmations
- short create or edit tasks
- reporting flows
- compact summaries that deserve focused reading

Prefer a right sidebar for:

- filters
- search refinements
- item inspection while staying in a listing
- contextual details that support ongoing browsing

Do not use a modal for:

- long exploratory reading
- repeated compare-and-switch behavior
- surfaces where losing page context would hurt comprehension

Do not use a right sidebar for:

- critical confirmations
- high-stakes destructive actions
- tasks that need full focus and interruption of the base interface

## Status, Badges, And Chips

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

- do not default to `rounded-full` for status tags, data tags, or small counters
- prefer `rounded-lg`, `rounded-xl`, or `rounded-2xl` depending on size and prominence
- count indicators inside tags should feel integrated, not like detached circular bubbles

## Responsive Rules

- mobile is the baseline
- use spacing and layout changes before resorting to smaller typography
- protect tap targets and avoid cramped inline action clusters
- if a desktop pattern becomes crowded on tablet or mobile, switch to a dedicated mobile pattern instead of forcing the same layout

## Accessibility Rules

- every interactive control must have visible focus treatment
- text contrast must remain readable in both themes
- icon-only controls must have labels
- secondary text must remain readable, not merely decorative
- motion and glow treatments must never reduce the legibility of core content

## Design System Usage Rules

Before implementing UI work:

1. decide whether the task is mainly visual foundations or interface patterns
2. read the matching file in `docs/design/`
3. reuse the established pattern before inventing a new one
4. if a new reusable rule is needed, update the matching design doc in the same change
