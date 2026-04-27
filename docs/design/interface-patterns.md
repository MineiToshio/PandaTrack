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

### Success vs. Error Feedback Placement

Use this split consistently across all settings and mutation flows:

| Feedback type                                       | Where to show it                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation errors, field-level errors               | **Inline, directly below the control** — place the message immediately under the affected input (after label and helper text, before submit when the block is a single field). Do not render field errors above the label; that breaks scan order and looks unrelated to the control. |
| Auth errors, rate-limit errors tied to one field    | **Inline, below that field** — same placement as other field errors when the failure maps to a specific input.                                                                                                                                                                        |
| Auth errors, rate-limit errors that are form-wide   | **Inline above the actions** — only when no single field owns the failure (e.g. session expired on a multi-field form).                                                                                                                                                               |
| Confirmed successful saves                          | **Toast** — transient notification in the bottom-right corner. Dismisses automatically.                                                                                                                                                                                               |
| Neutral status updates (e.g. username availability) | **Inline** — below the field as real-time feedback while typing.                                                                                                                                                                                                                      |

**Form field stack (recommended):** label → optional helper → control → **inline validation or live status (if any)** → **submit or server error (if any)** → primary actions.

For a field with **only** simple validation, the error line still sits directly under the control. When **both** live feedback (e.g. username availability) and a **submit or server error** can appear, keep live feedback **directly under the input** and the server error **after** that block so typing, real-time state, and save failures stay in a clear order and the failure sits just above the submit button.

Associate errors with the control using `aria-invalid` and `aria-describedby` pointing at the error message `id` when the message is present.

The key rule: **errors stay with the form; success moves to a toast.** Errors must remain readable while the user decides what to do next. Success is a transient confirmation that can disappear on its own.

See the _Toast Notifications_ section below for the full component API, variants, and duration guidance.

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

### Detail hero action limit

For detail-page hero headers, never place three standalone buttons side by side.

Rules:

- the visible action row must stop at **two** affordances maximum
- prefer **one primary action + one `More` menu** when the screen needs more than two actions
- when one secondary action is clearly dominant, prefer a **split secondary affordance**: a labeled secondary button plus a small adjacent overflow trigger that opens the remaining actions
- if a contextual navigation action (for example `View store`) competes with edit or destructive actions, move it into the `More` menu instead of adding a third visible button
- split buttons are allowed only when they still read as one secondary affordance, not as a third standalone action
- this rule applies across mobile and desktop; wrapping to a second line does not justify keeping three visible buttons in the same hero

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
- identity strip at the top of the menu panel should use `TINTED_SURFACE_GRADIENT_STOPS` from `src/lib/styles.ts` with `bg-linear-to-br` so it stays aligned with the shared hero family
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

### Standard in-page section title (mandatory)

Every **visible section title** under the screen’s primary title (the `h1` inside `AppPageHero`, a rich profile hero, or equivalent) must use **`SectionTitleWithAccent`** from `src/components/modules/SectionTitleWithAccent.tsx`. It is the only approved row: vertical gradient accent bar plus title. Do **not** use a bare `Heading` for that row, and do **not** reimplement the bar with ad hoc markup.

Rules:

- **Major peer sections** (sibling blocks at the same level under the page intro): `as="h2"` and a stable `id` when the parent `<section>` uses `aria-labelledby`.
- **Subsections** inside a column, card stack, or nested block: `as="h3"` unless the document outline requires `h2`.
- **`as="div"`** only when the string is not a section heading in the outline (rare).
- Typography and spacing inside the component are fixed (`Heading` `size="xs"`, `tracking-tighter`, shared with `visual-foundations.md`).
- **Do not** use `SectionTitleWithAccent` for **transient overlay chrome** (drawer, sheet, or flyout **header row**). Those titles belong to a narrow panel, not the main page column; use compact **`Typography`** (or the modal/drawer’s built-in title treatment) instead.

**Store create/edit steps:** **`StoreFormSectionCard`** renders the optional step **eyebrow** (`Typography` muted, e.g. “Step 1”) on the line above **`SectionTitleWithAccent`** (`as="h3"`) for the card title, so wizard sections match the same accent title row as the rest of the shell.

### Collector shell content width

All authenticated `(app)` routes share one **outer** content width and horizontal padding via `APP_SHELL_MAIN_CLASSNAME` on `<main>` in `AppLayout` (see `visual-foundations.md` layout containers). Listings, detail pages, and settings use the full width of that column. **Do not** add per-route `mx-auto max-w-4xl` / `max-w-6xl` wrappers that fight the shell.

For **long forms and reading-heavy stacks**, wrap the relevant block in `APP_SHELL_FORM_RAIL_CLASSNAME` so fields stay at a comfortable measure while the page chrome still aligns with other routes.

### Collector listing page recipe

Use this recipe for collector listing pages:

1. `AppPageHero` for context, title, and primary screen CTA
2. compact summary row with total count and range currently shown
3. filter entry point on the right, grouped with the create action
4. optional active-filter shell directly above the results
5. one vertical stack of repeated listing cards
6. pagination at the bottom

Rules:

- keep the main stack at `space-y-6` inside `APP_SHELL_FORM_RAIL_CLASSNAME`; these screens intentionally read as a narrower task column rather than a full-bleed dashboard
- the summary line belongs outside the filter shell, aligned with the action row, so users can scan count + actions before they decide to refine
- active filters, when present, live in their own `COLLECTOR_CARD_SURFACE_CLASSNAME` shell above the results instead of inside every card or under the hero
- result cards should remain a single-column vertical list with consistent `space-y-4`, not a masonry or dashboard grid

#### Collector listing card anatomy

Listing cards can vary by domain, but they should share this structure:

1. full-card click target using an absolutely positioned `Link`
2. content above the overlay with `pointer-events-none`
3. top row: title on the left, status or trust indicators on the right
4. middle row: dense metadata or grouped content
5. bottom row: chips, progress, or expandable secondary detail
6. optional local action restored with `pointer-events-auto` above the overlay

Rules:

- the card title is always `Heading size="xs"` and stays visually dominant over every badge or chip in the card
- use hover as reinforcement only: border emphasis, slightly stronger shadow, and minimal lift
- metadata density is created with typography, chip rhythm, and dividers before adding extra nested containers
- when a card includes progressive disclosure, keep it inside the same surface with a top divider rather than opening a nested card

#### Listing filter entry patterns

Use one of these filter entry patterns depending on density:

- button-triggered overlay panel plus active-filter shell in-page
- right drawer for deeper refinement plus active-filter shell in-page

Shared rules across both:

- the trigger is a secondary button aligned with the create CTA
- the active-filter shell reuses `COLLECTOR_CARD_SURFACE_CLASSNAME`
- selected filter chips use filled `primary` treatment and expose a one-click remove affordance
- filter controls keep comfortable height (`min-h-11`) and rounded-xl geometry
- use a drawer or overlay when filters are multi-field and should not permanently consume vertical space in the list

### Private-app hero header (collector shell)

Use **`AppPageHero`** (`src/components/modules/AppPageHero.tsx`) for authenticated routes that introduce a screen with a primary title, especially:

- first-level areas that need a standard intro block
- listing pages with one main CTA
- create and edit flows
- detail views that keep a compact hero and action cluster

**Exception:** entity profile pages that need a **rich profile hero** (logo or avatar, KPI row, actions) may use a custom hero instead of `AppPageHero`, but they must reuse the same **outer hero chrome** as `AppPageHero`: `rounded-2xl`, `border-border/70`, `border`, `bg-linear-to-br`, `TINTED_SURFACE_GRADIENT_STOPS`, `shadow-sm`, and the same **`Heading` `h1` scale** (`size="sm"`) so they still feel like the same family.

Structure of `AppPageHero`:

1. optional eyebrow pill (`text-xs`, `Sparkles`, primary-tinted chip)
2. page title: `Heading` as `h1` with `size="sm"` and `text-text-title`
3. one short supporting line: `Typography size="sm"` with `text-text-muted`; when a page has metadata chips (date, status, FX rate), render them as `STORE_HERO_META_PILL_CLASSNAME` spans inside this slot
4. gradient border card wrapper: `rounded-2xl border bg-linear-to-br` plus `TINTED_SURFACE_GRADIENT_STOPS` from `src/lib/styles.ts` (aligned with the shared rich-hero family and landing section washes)
5. optional `aside` prop on `AppPageHero` for **primary page actions** (edit, create, destructive-action dropdown); this is the top-right slot, always used for actionable controls, never for status badges

#### `aside` vs. `description` slot rule

This is the standard for all detail pages using `AppPageHero`:

| Content type                                           | Where it goes                                         |
| ------------------------------------------------------ | ----------------------------------------------------- |
| Action buttons (edit, create, cancel, delete dropdown) | `aside` prop — top-right of the hero                  |
| Status badge, unpaid/warning pill, metadata chips      | `description` prop — below the title, as inline pills |

**Rationale:** users expect actionable controls in the top-right corner (standard F-pattern). Status and metadata are descriptive — they belong next to date and other context, not in the action slot. Mixing them inverts the visual hierarchy and buries the buttons.

On mobile the `aside` wraps below the title thanks to `flex-wrap` on the hero. Wrap the `aside` content in `<div className="w-full md:w-auto">` so it spans full width when stacked on small screens.

Rules:

- the **document `h1`** for these screens lives in `AppPageHero` (or the rich profile hero variant). The sticky shell bar title in `ContentHeader` is a **presentational** line (`p` with heading-like classes), not a second heading, so the outline stays one primary title per view
- detail-route eyebrow pills are optional, not mandatory. Omit them when the breadcrumb plus `h1` already provide enough context and the pill would only repeat "Detail"
- when the flow needs parent navigation (create/edit store), place `BackNavLink` (`appearance="pill"`) in a `space-y-3` stack **above** `AppPageHero`
- keep `h1` typography aligned across routes that share this pattern
- major sections below the hero use **`SectionTitleWithAccent`** (`as="h2"`), not a standalone `Heading`, unless the page is intentionally using icon-led panel headers as its primary section language (see **Standard in-page section title** and detail panel patterns below)

#### Detail hero action cluster

Collector detail screens with top-level actions use one shared responsive pattern:

- desktop: render the action cluster inline on the right edge of the hero, using labeled buttons with icons and soft elevation
- mobile: stack the same actions below the descriptive content, full width, in the same order as desktop
- avoid icon-only hero actions on mobile; labels improve clarity, touch confidence, and accessibility
- preserve each screen's action hierarchy: primary action stays primary, supporting actions stay secondary, and destructive actions remain inside `More` when that workflow already exists
- use matching height, spacing, and shadow treatment across sibling detail screens so the collector shell reads as one system even when the exact actions differ

#### Collector detail page family

Collector detail pages should generally choose one of these two complementary layouts:

- split layout with a primary reading column and a sticky secondary rail
- single main reading flow with compact summary surfaces and a responsive mid-page grid

Use these patterns intentionally rather than mixing them.

#### Split detail layout with sticky secondary rail

Recommended structure:

1. `BackNavLink`
2. `AppPageHero` with entity identity, status, metadata, and top-level actions
3. desktop two-column layout: left content column + sticky right rail
4. mobile sequence that preserves the same priority order as desktop

Rules:

- the left column owns the long reading content
- the right rail owns volatile or summary-heavy content
- keep the right rail sticky only on large screens; on mobile it dissolves into the natural vertical order
- section panels reuse `SectionSurfaceCard` with icon-led headers instead of accent-title rows
- use inline row dividers and subtle hover fills for repeated records inside a section instead of nesting each row in another card
- when a panel mixes summary and action, keep the action in `headerEnd` so the title row remains the scannable anchor

#### Single-flow profile or entity detail sections

Use the same surface chrome as other detail panels: compact icon-led header when the section has a natural title, horizontal separators where needed, and one structured body area.

Rules:

- keep the page in a single reading flow after the hero: status callout, compact summary, responsive paired sections, then full-width review and note sections
- use `SectionSurfaceCard` for contact channels, addresses, reviews, and private note
- when a combined store-detail panel has no natural umbrella title (for example product types + import countries, or the top block of profile facts), use the same surface styling as `SectionSurfaceCard` but omit the synthetic grouped heading
- when two small related groups belong together (for example product types and import countries, or sales channels and shopping options), prefer sibling `SectionSurfaceCard` panels when each group can stand on its own clearly
- product types and import countries can share a responsive two-column row on desktop when content is typically compact; stack them naturally on smaller screens
- prefer a single main reading column when the top area starts to feel fragmented; avoid a competing metadata sidebar for low-priority facts
- show sales channels and shopping options in one compact summary surface directly under the hero, without an extra section title, using small labels plus chips instead of full secondary panel headers
- use inset cards for contact methods and addresses when each record needs its own affordance or structured three-line block, but keep them visually quieter than the outer section
- use Lucide icons in section headers and nested subsection titles instead of `SectionTitleWithAccent` when the page's main section language is icon-led panels

### Settings-style structured sections

- page title block: `AppPageHero` with the same `h1` scale and supporting line as other collector routes (`visual-foundations.md` heading scale).
- major section titles (Profile, Account, Preferences): `SectionTitleWithAccent` as `h2` (see **Standard in-page section title**).
- stack major sections (Profile, Account, Preferences) as **sibling** level-1 surfaces with **identical** chrome: use `COLLECTOR_PRIMARY_SECTION_CLASSNAME` from `src/lib/styles.ts` (re-exported as `SETTINGS_SECTION_SURFACE_CLASSNAME` in `settingsSectionChrome.ts`). Store create/edit step cards use the same class via `StoreFormSectionCard`. Do not invent a third panel treatment for equivalent blocks.
- inset rows and placeholders inside those sections (email block, “coming soon” copy): use `COLLECTOR_MUTED_INSET_CLASSNAME` from `src/lib/styles.ts` instead of one-off `bg-muted/32` stacks.
- rely on the shared shell main column (`APP_SHELL_MAIN_CLASSNAME`); use `space-y-8` between the hero and major sections only (no extra page-level `max-w-6xl` or horizontal padding wrapper).
- dense copy inside sections: prefer `Typography size="sm"` for placeholders and primary read values; use `Typography size="xs"` for field labels and subsection captions.
- form groups: `space-y-3` (12px) between stacked fields in dense settings forms.
- informational account states (for example pending email verification after a change request): semantic **info** treatment (`bg-info/12`, `border-info/35`, `rounded-xl`), not ad hoc `primary` fills.
- shared class for the three main section panels: `src/app/[locale]/(app)/settings/settingsSectionChrome.ts` (`SETTINGS_SECTION_SURFACE_CLASSNAME`).

#### Sub-section typography hierarchy inside settings cards

Three tiers exist inside each settings card; each must use a distinct visual weight to avoid competition:

| Tier                     | Use                                                                     | Treatment                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Form section heading     | Heads a form block (e.g. "Cambiar contrasena")                          | `Typography size="sm" className={SETTINGS_FIELD_GROUP_TITLE_CLASSNAME}` - `font-semibold text-foreground` |
| Form field label         | Directly labels an `<input>` via `htmlFor` (e.g. "Contrasena actual")   | `Label` component - `font-medium text-foreground`                                                         |
| Display-only block label | Categorical eyebrow above a read-only value (e.g. "CORREO ELECTRONICO") | `Typography size="2xs" className={SETTINGS_DISPLAY_BLOCK_EYEBROW_CLASSNAME}` - uppercase, tracked, muted  |

Both constants live in `src/app/[locale]/(app)/settings/settingsSectionChrome.ts`.

**Display-only data blocks** (read-only values with an optional action): wrap in `COLLECTOR_MUTED_INSET_CLASSNAME` so the block reads as "data being shown" rather than "a form to fill". Inside:

1. Eyebrow label (category) at the top using `SETTINGS_DISPLAY_BLOCK_EYEBROW_CLASSNAME`
2. Helper description (`Typography size="xs" className="text-text-muted"`)
3. The prominent value (`font-semibold text-text-title`) plus action button in a flex row

**Subsections within a card** (avatar, display name, username): separate with `border-t border-border/45` dividers; each subsection starts with its `<Label>` (tied to its input) followed by helper text and then the control.

### Pattern: Secondary actions on a tinted or gradient panel

When **`secondary`** (or equivalent low-emphasis) controls sit on a **tinted hero, gradient band, or illustration**, default fills can blend in.

Rules:

- prefer **soft neutral border** (`border-border` at low-to-mid opacity) plus **moderate shadow** (`shadow-md`, slightly stronger on hover) over **thick brand-colored outlines** unless the control is the **primary** action
- keep **focus-visible** treatment from the shared button styles; do not rely on hover alone
- respect **`prefers-reduced-motion`** for any decorative motion on the same panel

### Pattern: Multi-line structured location block

For **addresses, venues, or pick-up points** in lists or cards:

1. **Locality line**: optional leading icon, **locality + region or country** in **semibold**, `text-text-muted`, body scale `sm`, vertically centered with the icon
2. **Street line**: full address line, same scale, muted
3. **Reference line** (optional): one step smaller (`xs`), muted

Use locale-aware formatting and i18n for labels; keep copy plain language for end users.

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

## Toast Notifications

Toasts are transient, auto-dismissing notifications used to confirm actions the user just performed. They appear in the bottom-right corner on desktop and full-width at the bottom on mobile, and stack upward when multiple toasts are active.

### When to use toasts

Use a toast when:

- a mutation or save action completes successfully (e.g. profile saved, password updated)
- a background operation finishes and the user needs a brief confirmation
- the result is transient and does not require reading time (success, quick informational message)

Do not use a toast for:

- inline field validation errors - those must remain inline next to the offending field
- errors that require user action or explanation beyond a short line
- persistent status that the user may need to re-read (use inline banners or status blocks instead)

### Variants

| Variant   | Semantic color  | Use case                                  |
| --------- | --------------- | ----------------------------------------- |
| `success` | `--success`     | Confirming a completed save or action     |
| `error`   | `--destructive` | Non-form-level errors (e.g. network fail) |
| `info`    | `--info`        | Neutral informational messages            |
| `warning` | `--warning`     | Soft warnings that do not block the user  |

### Duration

The default duration is 4000ms. Pass a custom `duration` (in milliseconds) to `addToast` when the content requires more reading time (e.g. longer messages).

### API

```tsx
const { addToast } = useToast();

addToast("Profile photo updated.");
addToast("Rate limit exceeded.", { variant: "error", duration: 6000 });
```

The `ToastProvider` is registered in `AppLayout` and wraps the entire authenticated app shell. `useToast` can be called from any client component inside the app shell.

### Rule: errors stay inline, success goes to toast

- **Inline**: field validation errors, server errors that relate to a specific form field, any error the user must read before retrying.
- **Toast**: all success confirmations; generic transient errors from mutations that do not relate to a specific field.

### Component location

- Context and hook: `src/contexts/ToastContext.tsx`
- Toast item: `src/components/core/Toast/Toast.tsx`
- Container (Portal-rendered): `src/components/core/Toast/ToastContainer.tsx`
- Public exports: `src/components/core/Toast/index.ts`

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

**Public catalog and profile chips:** reuse `src/app/[locale]/(app)/stores/_components/share/storePublicChipClassnames.ts` for product-type, import-country, presence, and business-signal chips. Listing-card metadata uses `STORE_LISTING_CARD_META_CHIP_CLASSNAME` for compact bottom-row facts (`rounded-lg`, same rhythm as business-signal chips). Rich profile heroes keep `STORE_HERO_META_PILL_CLASSNAME` (`rounded-full`, soft `bg-background/80`) for neutral metadata pills.

**Collector listing cards and active-filter shells:** reuse `COLLECTOR_CARD_SURFACE_CLASSNAME` from `src/lib/styles.ts` so listing cards, active-filter containers, and detail panels share the same base surface (`bg-surface-2`, `border-border`, `rounded-2xl`, `shadow-sm`). Add spacing or hover behavior on top of that token set instead of redefining the surface ad hoc.

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

## Monetary Amount Display

Use the shared `formatAmount` utility from `src/lib/currency.ts` for all monetary amounts shown to the user.

**Format: `{amount} {ISO-code}`** — number first, currency code after.

Examples: `43.000 CLP`, `888.50 USD`, `1.200 JPY`.

Rules:

- Number is always locale-formatted (thousands separator, decimal separator) using `Intl.NumberFormat` with `style: "decimal"`.
- The ISO 4217 currency code follows, separated by a space.
- Trailing zeros after the decimal are omitted (`43.000 CLP`, not `43.000,00 CLP`).
- Never use currency symbols (`$`, `¥`, `€`) — they are ambiguous across countries.
- Never hardcode `CurrencyCode + " " + amount` or `amount.toFixed(2)` inline. Always call `formatAmount`.

Rationale: reading left-to-right, the number (the primary information) reaches the eye before the identifier. ISO codes are unambiguous, unlike symbols (`$` = CLP, ARS, USD, MXN...).

## Design System Usage Rules

Before implementing UI work:

1. decide whether the task is mainly visual foundations or interface patterns
2. read the matching file in `docs/design/`
3. reuse the established pattern before inventing a new one
4. if a new reusable rule is needed, update the matching design doc in the same change
