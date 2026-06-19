# Interface Patterns

This document is the normative source of truth for PandaTrack's reusable interaction and layout patterns: the collector app shell, content hierarchy, interaction states, buttons and controls, navigation, modals and overlays, forms in context, the Chip-Eyebrow + Top-Accent section header system, status chips, toasts, responsive behavior, accessibility, and monetary display.

It is paired with two companion documents that own adjacent concerns:

- `docs/design/visual-foundations.md` — colors, typography, spacing, radius, surfaces, layout containers, and the heading scale.
- `docs/design/components.md` — the component map (which canonical component lives where in `src/`).

Canonical component code lives under `src/components/core/` and `src/components/modules/`. **Reuse the established component before inventing a new pattern.** When a change introduces a new reusable rule, update the matching design doc in the same change.

> Historical note: PandaTrack runs a single design language ("Velvet"). Any legacy screen chrome predating it is replaced wholesale when a screen is redesigned — never partially mixed with current components.

---

## 1. Layout and Hierarchy

### The collector app shell

All authenticated `(app)` routes render inside one shell with a left navigation sidebar, a top bar, and a single main content column.

**Sidebar structure (inviolable order):**

1. Logo and product name (top)
2. Primary nav links (middle): Today, Orders, Deliveries, Stores, Settings
3. Account affordance (bottom): avatar plus username, with the collapse control beneath it

**Sidebar behavior:**

- **Expanded** — full width: logo plus name, labeled nav links, full account widget.
- **Collapsed** — narrow rail: nav icons only, compact logo, avatar.
- **The manual collapse/expand toggle PUSHes; hover-expand FLOATs.** The pinned toggle changes the shell grid width so the main content reflows (PUSH). Hover/focus-expand on the collapsed rail FLOATs instead: the rail widens to full width and overlays the content (raised `z-index` + shadow) without shifting the content column. This supersedes the original PUSH-on-hover rule (see [ADR 0003](decisions/0003-demo-decisions.md), updated 2026-06-17) — FLOAT-on-hover is the shipped, intended behavior.
- **Mobile / tablet** — the sidebar collapses into a burger-triggered drawer. The same account affordance that lives in the expanded sidebar footer appears in the drawer; do not split core account actions between the header and the drawer.

The sidebar collapse state persists per user.

**Top bar:** breadcrumb chain on the left (each ancestor is a link, the current segment is plain text), language and theme toggles on the right. The user avatar does **not** live in the top bar — it lives in the sidebar footer. The shell top bar title is a presentational line, not a second document heading, so the outline keeps exactly one primary title per view.

### Lower-shell account menu

Use one menu component across desktop and mobile placements, with stable action ordering:

- Desktop expanded sidebar: trigger sits above the collapse control, reads as a clean row (unframed avatar by default, surface feedback on hover), and opens upward.
- Desktop collapsed rail: keep the avatar visible and reveal the full trigger on hover/focus; keep the avatar anchor visually stable between collapsed and expanded so it does not appear to jump.
- Mobile drawer: anchored inline expansion rather than a floating panel.
- Footer of the menu keeps `Privacy Policy` and `Terms and Conditions` side by side with a subtle separator dot.
- The identity strip at the top of the panel uses the shared tinted-surface gradient so it stays in the hero family.
- The trigger must show hover, focus-visible, active, and open states; when open it stays visibly active with a stronger fill than hover.

### Content width

All `(app)` routes share one outer content width and horizontal padding via the shell main column (`APP_SHELL_MAIN_CLASSNAME` on `<main>`; see `visual-foundations.md` layout containers). Listings, detail pages, and settings use the full width of that column. **Do not** add per-route `mx-auto max-w-*` wrappers that fight the shell.

For long forms and reading-heavy stacks, wrap the relevant block in the shared form rail (`APP_SHELL_FORM_RAIL_CLASSNAME`) so fields stay at a comfortable measure while page chrome still aligns with other routes. When a create/edit form has a reactive summary aside, use a `grid lg:grid-cols-[1fr_18rem]` form inside the shell column rather than duplicating a width wrapper.

### Page headers — `AppPageHero`

Use `AppPageHero` (`src/components/modules/AppPageHero.tsx`) for authenticated routes that introduce a screen with a primary title: first-level areas, listing pages with one main CTA, create/edit flows, and detail views with a compact hero.

Structure:

1. optional eyebrow pill (small, primary-tinted chip) — optional, not mandatory; omit it when the breadcrumb plus `h1` already give enough context
2. page title: `Heading` as `h1` with the shared hero scale and title color
3. one short supporting line; when the page carries metadata chips (date, status, FX rate) render them as hero meta pills inside this slot
4. gradient border card wrapper (`rounded-2xl border bg-linear-to-br` plus the shared tinted-surface gradient, aligned with the rich-hero family)
5. optional `aside` slot for **primary page actions** (top-right)

**`aside` vs `description` slot rule (standard for all detail pages):**

| Content type                                           | Where it goes                                    |
| ------------------------------------------------------ | ------------------------------------------------ |
| Action buttons (edit, create, cancel, delete dropdown) | `aside` — top-right of the hero                  |
| Status badge, unpaid/warning pill, metadata chips      | `description` — below the title, as inline pills |

Users expect actionable controls in the top-right (F-pattern); status and metadata are descriptive and belong with date and context. On mobile the `aside` wraps below the title — wrap its content in `w-full md:w-auto` so it spans full width when stacked.

**Exception:** entity profile pages that need a rich profile hero (logo/avatar, KPI row, actions) may use a custom hero, but must reuse the same outer hero chrome (`rounded-2xl`, bordered, gradient wash, shared `h1` scale) so they read as the same family. The document `h1` for these screens lives in the hero.

### Section titles — `SectionTitleWithAccent`

Every visible section title under the screen's primary title must use `SectionTitleWithAccent` (`src/components/modules/SectionTitleWithAccent.tsx`). It is the only approved row: a vertical gradient accent bar plus the title. Do not use a bare `Heading` for that row, and do not reimplement the bar with ad hoc markup.

- **Major peer sections** (siblings under the page intro): `as="h2"` with a stable `id` when the parent `<section>` uses `aria-labelledby`.
- **Subsections** inside a column or nested block: `as="h3"` unless the outline requires `h2`.
- **`as="div"`** only when the string is not a heading in the outline (rare).
- Typography and spacing inside the component are fixed.
- **Do not** use it for transient overlay chrome (drawer / sheet / flyout header rows). Those titles belong to a narrow panel; use compact `Typography` or the modal's built-in title treatment.

**Icon-led variant** (`icon` plus `iconClassName` replaces the accent bar with a small colored icon): use on create/edit forms and detail panels where each section is a distinct concept. Reuse the same icon and color in the form section title and the matching detail panel so a section reads identically across create, edit, and read views. Allowed icon colors are the semantic theme tokens (`text-primary`, `text-highlight`, `text-success`, `text-info`, `text-warning`, `text-accent`) — never raw color values.

When a screen has both a page title and section headings, the `h1` must use a larger `Heading` size than the section `h2`s.

### Detail screens — primary column plus sticky rail

Collector detail pages choose one of two complementary layouts and use it intentionally rather than mixing them:

- **Split layout**: a wide primary reading column plus a sticky secondary rail.
- **Single reading flow**: compact summary surfaces and a responsive mid-page grid.

For the split layout:

1. `BackNavLink`
2. `AppPageHero` (or rich profile hero) with identity, status, metadata, and top-level actions
3. desktop two-column layout: left content column plus sticky right rail
4. mobile sequence that preserves the same priority order

Rules:

- The **left column** owns the long reading content (items, payments, history; reviews, contacts).
- The **right rail** owns volatile or summary-heavy, viewer-scoped content: compact financial summaries, secondary stats, and the secondary-actions card. The rail belongs to the viewer; the body belongs to the resource (see [ADR 0003](decisions/0003-demo-decisions.md)).
- Keep the rail sticky only on large screens; on mobile it dissolves into the natural vertical order (body → summary → actions → note).
- Section panels reuse the shared section surface with icon-led headers. Use inline row dividers and subtle hover fills for repeated records inside a section rather than nesting each row in its own card. When a panel mixes summary and action, keep the action in the header end so the title row stays the scannable anchor.

### Secondary actions on tinted panels (mobile detail, ADR 0011)

For detail screens of a single entity that expose one or two state-dependent primary CTAs plus a few secondary actions (edit, cancel/archive, delete), use an inline **"Actions" card at the foot of the page content** — not a kebab-triggered bottom sheet, not a separate "Danger Zone" card, not contextual actions in the static shell header (see [ADR 0011](decisions/0011-mobile-detail-secondary-actions.md)).

```text
┌─ ACTIONS ──────────────────┐
│ ✏  Edit X              ›   │  ← frequent, non-destructive
│ ⊘  Cancel X            ›   │  ← reversible, mid-priority
│ ──────── (subtle divider)   │
│ 🗑  Delete X           ›   │  ← destructive, irreversible, red
└─────────────────────────────┘
```

Rules:

1. One card titled "Actions" (uppercase muted eyebrow).
2. **Destructive row always last**, in `--destructive`, with a subtle divider above it only when it is not the first row (keeps single-row states clean).
3. **Reversible actions** (cancel, archive) are neutral rows, not destructive (Linear-style Archive vs Delete).
4. **No separate "Danger Zone"** for single-entity detail; that is a settings pattern reserved for multiple clustered destructive actions.
5. **State-aware visibility**: hide rows that do not apply to the current state instead of rendering them disabled. If only the destructive row remains, the card still renders (single row, no divider).
6. **Confirm dialog is mandatory** for irreversible destructive actions (type-to-confirm). The red color and last position complement the confirmation; they do not replace it.
7. **Same pattern cross-viewport** — on desktop this card lives in the right rail or at the end of the detail section. Do not migrate to header buttons on desktop.

When secondary actions on this card sit on a tinted hero, gradient band, or illustration, prefer a soft neutral border plus moderate shadow over a thick brand-colored outline (reserve strong outlines for the primary action), and keep the shared focus-visible treatment.

**Sticky bottom action bar (mobile) — single-primary hierarchy:**

1. **One primary button per bar.** If two actions compete, the lower-priority one uses the tonal variant. Two solid primaries side by side degrade hierarchy.
2. **Primary on the right, secondary on the left** (Apple HIG trailing edge, Material 3 affirmative-right, thumb zone).
3. **Pick the primary by frequency × FRD priority.** In PandaTrack, payment > shipment (FRD #3 vs #4).
4. **Single CTA is fine** when only one action applies to the current state (full-width).
5. **Never put a "More" / `⋯` trigger in the sticky bar.** Secondary actions live only in the inline "Actions" card.

---

## 2. Interaction States

Every interactive element must communicate state clearly: hover, focus-visible, active/pressed, selected, disabled, loading, and success/error feedback when relevant.

- **Hover** confirms interactivity without redefining the component. Typical: color shift, border emphasis, subtle background change, slight lift, underline for nav links. Keep it subtle in dense app UI.
- **Focus-visible is mandatory** for keyboard interaction; use a strong, theme-safe ring. Never rely on hover alone for important affordances.
- **Active / pressed** feels slightly denser or darker, not dramatically different.
- **Selected** stays obvious without relying on color alone.
- **Disabled** must render through a **muted token, not opacity** — the element stays readable while clearly non-interactive (disabled-gated cards keep eyebrow and title at full strength and replace only the body with a lock icon plus guidance copy).

### Success vs error feedback placement

The key rule: **errors stay with the form; success moves to a toast.** Errors must stay readable while the user decides what to do next; success is transient.

| Feedback type                                    | Where to show it                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Validation / field-level errors                  | Inline, directly below the control (after label/helper, before submit) |
| Auth / rate-limit errors tied to one field       | Inline, below that field                                               |
| Auth / rate-limit errors that are form-wide      | Inline above the actions (only when no single field owns the failure)  |
| Confirmed successful saves                       | Toast (bottom-right, auto-dismiss)                                     |
| Neutral live status (e.g. username availability) | Inline, below the field, while typing                                  |

Form field stack: label → optional helper → control → inline validation or live status → submit/server error → primary actions. When both live feedback and a server error can appear, keep live feedback directly under the input and the server error after it. Associate errors with their control via `aria-invalid` and `aria-describedby`.

---

## 3. Buttons and Interactive Controls

Button variants live in `src/components/core/Button/`.

### Variant hierarchy

| Variant             | When                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `primary`           | Main CTA of a screen or section. **One `primary` per area / viewport.** Solid accent fill.                                                       |
| `tonal`             | Additive secondary CTA with accent energy ("Add product", "Use this total", "Today" FX fetch, "Note payment"). Tinted accent fill + accent text. |
| `secondary`         | Neutral secondary CTA with weight, for actions that should not compete with accent color.                                                        |
| `ghost`             | Tertiary action ("Clear", wizard "Back", link-as-button). Has a visible border.                                                                  |
| `destructive`       | Irreversible destructive action (Delete, Cancel order). Solid destructive fill.                                                                  |
| `destructive-ghost` | Subtle destructive action (Report, Remove from list). Destructive border, no fill.                                                               |

Three-level hierarchy in forms and wizards: `primary` (final CTA) → `tonal` (in-section additive actions) → `ghost` (back, clear). Do **not** use `ghost` for additive buttons like "Add row" or "Load FX rate" — those are `tonal`. CTAs inside status banners (`role="status"`) use `tonal`, never `primary`.

`outline` and `link` are legacy — do not use for new code (use `secondary`/`ghost`; for inline hyperlinks use an `<a>` with accent + underline-offset).

### Detail hero action limit

For detail-page hero headers, never place three standalone buttons side by side:

- The visible action row stops at **two** affordances maximum.
- Prefer one primary action plus a `More` menu when more than two actions are needed.
- When one secondary action dominates, prefer a split secondary affordance (labeled button plus a small adjacent overflow trigger) that still reads as one secondary affordance.
- Move contextual navigation (e.g. "View store") into `More` rather than adding a third visible button.
- Applies across mobile and desktop; wrapping to a second line does not justify three visible hero buttons.

### Sizing, icon buttons, FAB

- Comfortable tap targets (≥ 44×44 on mobile at `md`/`lg`); controls must not feel cramped.
- Button text reads as an action, not as metadata.
- **Never break a button label onto a newline.** Keep labels on one line.
- Icon-only buttons require an accessible label.
- A floating action button (FAB), when used, follows the layout tokens; do not hand-roll its size.

### Form controls

Use shared form controls before custom markup. Keep labels, helper text, validation, and spacing consistent.

**Field error state (apply all three simultaneously):**

1. **Label turns destructive** (`[color:var(--destructive)]`).
2. **Control border turns destructive** via the control's `error` prop (plus `aria-invalid="true"`) — never add the red border manually.
3. **Error message replaces helper text** — translated string in `[color:var(--destructive)]` with `role="alert"`; helper text must not show simultaneously.

**Clear-on-interaction (mandatory):** as soon as the user edits a field with an error, that field's error clears immediately (label, border, message revert; helper text reappears). Untouched adjacent fields keep their error state. Manage field errors as a record so individual fields clear independently; reset on form reset/reopen so stale errors never bleed across sessions.

**Required vs optional labeling (mandatory, all collector forms):**

- **Required is the default** — required fields show only the field name. No asterisk, no "required" marker.
- **Optional fields** append `(opcional)` / `(optional)` to the label string in the i18n file, not via a separate inline `<span>`.
- Validation, accessibility, and `required` semantics are still driven by the schema and `aria-invalid`; the visual label only signals which fields are not required.
- Every form section has a visible section title via `SectionTitleWithAccent` (or the wizard step card), even with one or two fields. No anonymous sections.

### Toggle choice groups, switches, selects

- Use `ToggleChoiceGroup` (`src/components/core/ToggleChoiceGroup.tsx`) for one-or-many `aria-pressed` toggle choices: `appearance="chip"` (wrapping row, compact) or `appearance="tile"` (responsive grid, larger targets); `mode="single" | "multiple"`.
- **Default boolean control is `<Switch>`.** `<Checkbox>` is reserved for: multi-select with an indeterminate state, terms/conditions acceptance, and bulk-select in tables. When in doubt, choose the toggle.
- **Never use a native `<select>`** — use `Select` (short lists, opt-in search), `Combobox` (long lists, always-visible search, inline "create new"), or `MultiTagAutocomplete` (multi-select with tags inside the input).

---

## 4. Navigation Patterns

### Breadcrumbs

The shell top bar owns the breadcrumb chain: ancestors are links, the current segment is plain text. The breadcrumb is navigation; the back-link is a shortcut to the parent screen. Both can coexist; do not duplicate one as the other.

### Back / up navigation

Use `BackNavLink` (`src/components/core/BackNavLink.tsx`) — the canonical cross-app "back" control, placed as the first element above the page heading. Never wrap it in `Button`/`IconButton` or hand-roll a back-link.

| Appearance | When                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| `text`     | **Default.** Subtle text link above the page heading on detail/edit/create screens.          |
| `pill`     | Opt-in only where the back-link must float over dense content (hero, image, sticky overlay). |
| `button`   | Wizard footer next to the primary submit, when geometry must match the sibling CTA.          |

Copy is a short destination label, not an action ("Orders", "Back to Solaris Books") — never "Go back" or "Cancel".

### Tabs

Use tabs only when content groups are parallel (not parent-child), the user focuses on one group at a time, labels are short and clear, and showing everything at once would feel crowded. Keep the count small (two or three preferred). The active tab must read as selected in both themes. Do not repeat the active tab label as a major heading inside the panel unless it adds meaning.

Do **not** use tabs for sequential/top-to-bottom reading, side-by-side comparison, content small enough that tabs add more chrome than value, or critical information users could miss. Prefer instead: one structured vertical layout (hierarchical), stacked sections or a responsive grid (comparison), accordions (progressive disclosure), or a wizard (step-by-step choice).

---

## 5. Modals and Overlays

### The canonical adaptive `<Modal>` (Semantic Depth, ADR 0008)

There is exactly **one** modal component in the app: `<Modal>` (`src/components/modules/Modal/Modal.tsx`). The code is the source of truth for the contract; the component map (`docs/design/components.md`) and the repository rule `.agents/rules/modal-canonical-pattern.mdc` reinforce it.

- **Forbidden:** building a dialog/overlay from an ad-hoc `<Portal>` plus `<div>`, or copying the visual of any legacy modal.
- The public `<Modal>` is a smart wrapper that renders adaptively by viewport (see [ADR 0008](decisions/0008-modal-enhancement.md)):
  - **Desktop (≥ 768px)** → centered dialog with Semantic Depth (a 48px tonal icon-circle, title + subtitle in a header row, a footer divider, spring entrance).
  - **Mobile (< 768px)** → **bottom sheet** with drag handle, sticky CTA footer, and `safe-area-inset-bottom`, inheriting the same Semantic Depth language.
- Internally it delegates to `ModalDialog` (desktop), `ModalSheet` (mobile, built on **Vaul**), and a shared `ModalContent`. Callsites import only `<Modal>` — the others are internal and never imported directly.

**Tone system** (`tone` prop): `default` | `destructive` | `warning` | `info` | `success`. The tone colors the icon-circle and, where applicable, the primary CTA token. Pairings by scenario:

- Destructive confirm (Delete X): `tone="destructive"`, destructive icon, primary `variant="destructive"`, `role="alertdialog"`.
- Sensitive/reversible confirm (Report X, Mark as Y): `tone="warning"`, primary `variant="primary"`.
- Three-CTA decision without a destructive action: `tone="info"` with `primaryAction` + `secondaryAction` + `tertiaryAction`.
- Form embedded in a modal: `tone="default"`, `size="lg"`, validated form in the body, `role="dialog"`.

API surface: `tone`, `size` (`md | lg`), `primaryAction` (`variant: primary | destructive | success | warning`), `secondaryAction`, optional `tertiaryAction`, and `icon` (Lucide in the tonal icon-circle). ARIA: `role="alertdialog"` for destructive actions, `role="dialog"` for forms and pickers.

**Optimistic Confirmation:** modal and sheet flows **close synchronously on submit** so the user sees the optimistic change animate behind the closing surface; the parent coordinator owns rollback plus the failure toast (see the optimistic-updates rule and `docs/design/motion.md`).

**Exception (full-screen sheet):** when content exceeds roughly four sections / significant scroll on mobile, use a full-screen sheet instead of a bottom sheet. Centered-on-mobile is still correct only for media lightboxes, very long multistep wizards (full-screen page), and tiny non-destructive alerts.

### Modal vs right sidebar / drawer

Use a **modal** when the task needs focused attention, the rest of the page should recede, the interaction is short and self-contained, or the action is confirmatory/sensitive/interruptive (confirmations, short create/edit, reporting, compact focused summaries).

Use a **right sidebar / drawer** when the user must keep the base page visible, the task is exploratory or inspect-and-return, or the panel supports filters, previews, or contextual editing (filters, search refinement, item inspection while browsing).

Do not use a modal for long exploratory reading or repeated compare-and-switch. Do not use a right sidebar for critical confirmations or high-stakes destructive actions.

### FilterDrawer is not a Modal

The filter drawer (`src/components/modules/FilterDrawer/`) is a **separate, hand-rolled responsive pattern**, not a `<Modal>` (see [ADR 0003](decisions/0003-demo-decisions.md) D8). Desktop: a right side drawer; mobile: a bottom sheet with drag handle. Visual similarity with the modal bottom sheet is design-system coherence, not shared code. It does **not** close on outside click — only the close button and Esc dismiss it. Never use `<Modal>` as a filter container, and never mix the two patterns' code.

---

## 6. Forms in Context

### Wizard accordion (creation flows with 3+ steps)

Creation forms with three or more steps render as a wizard accordion (`WizardAccordion` + `WizardStep` + `Stepper`): only the active step is expanded; the rest collapse to thin cards showing number, eyebrow, title, and the completed value summary (see [ADR 0003](decisions/0003-demo-decisions.md) D5). One card open at a time; clicking a collapsed card or a stepper bullet opens it; "Continue" marks the step done and opens the next; the top stepper reflects the accordion. Completed steps show a value summary and a success bullet.

- Use `mode="wizard"` for create (progressive disclosure) and `mode="all-open"` for edit (all panels visible, static headers, no per-step buttons, top stepper hidden).
- When create and edit share 80%+ of UI, build one component with a `mode` discriminated union rather than separate files.
- A reactive **Summary** aside reflects current form values and updates as the user fills fields; it is informative, not a validation gate. On mobile it stacks below the step cards (no collapsible accordion).

**Wizard step CTAs are never disabled** (binding cross-app rule). Each step's "Continue" / "Create" is always clickable; `disabled` is reserved only for the final submit's loading state. A disabled button leaves the user without feedback ("why can't I continue?"); an enabled button plus inline validation on click says exactly what to fix:

- The validator runs on the primary click, sets per-field error state, and returns the validity boolean.
- If invalid, the step enters an errored state: its bullet, card border, and stepper marker turn destructive; each invalid field shows the red border plus an inline `AlertCircle` message; errors clear on the field's change.
- Use the same error pattern across modules — do not invent a per-module error style.
- **Mobile wizard checklist:** branch on `useIsMobile()`; compact stepper; sticky action bar per step with `Atrás` fixed-width and `Continuar` flex-grow; "Continue" always enabled (so the locked-step pulse hint works); hide the Summary aside on mobile; reserve bottom padding for the sticky bar; the desktop `h1` may be hidden on mobile since the top bar already shows the title.

### Field-as-attribute (prefilled by context)

When a field is prefilled from the originating context, render it as an attribute, not a blank input: an elevated wrapper with a mono badge (`↳ from PT-XXXXXX`), the value, and a ghost "Change" link.

### Locked (immutable) field in edit forms

When a field cannot change after creation (e.g. Store and Currency on an order edit), render it as a read-only `<div>` — never an `<input disabled>`: reduced-opacity tinted container with the entity value plus a small `lock` icon, helper text explaining why it is locked, and `aria-disabled="true"`. Pass the value as a hidden field so the action receives it; the backend never modifies it.

### Inline expand vs modal for "note X" / "add Y"

For contextual additions that need no information from another screen and only a couple of fields, expand the form **inline inside the card** (smooth height transition) rather than opening a modal. Use a modal only when the action is destructive/irreversible, needs context from another screen, or has more fields than fit comfortably inline.

### Filters: drawer, chips, trigger button

- Use `FilterDrawer` for list refinement (section types include pills, pills-search, icon-pills, autocomplete, tag-autocomplete, date-range, switches, text). Entity filters (store, user) use `MultiTagAutocomplete` with chips **inside** the bordered input, not below it.
- After applying, render a **filter chips row** above the list: each selected filter is a filled `primary` chip with a one-click remove (`<X>`). The active-filter shell reuses the shared collector card surface.
- Use `FilterTriggerButton` (`src/components/core/FilterTriggerButton/`) as the entry point, aligned with the create CTA. The badge counts **visible chips only** (drawer filters, one chip = one unit); the search query never increments the badge or paints the active state. Use `variant="icon-only"` with an `aria-label` when the button lives in the mobile top bar.

### Submit shortcut hint

Keep the primary submit CTA clean (label plus `Check` icon, no embedded chip). Communicate the keyboard shortcut as plain text beside the CTA: "o presiona ⌘ Enter" (desktop-only). Wire `⌘`/`Ctrl`+`Enter` on the `<form>`, excluding `shiftKey` (to avoid colliding with grid shortcuts) and mirroring the button's disabled guards so the shortcut never submits an unchanged or invalid form. The embedded `kbd` chip is reserved for contextual grid/list shortcuts, not the main submit.

---

## 7. Chip-Eyebrow + Top-Accent Section Header Pattern (frozen)

This is the canonical section-header language for detail pages where heterogeneous cards coexist in one viewport. **It is a frozen rule.**

### What it is

A coordinated visual pair, always applied together:

- **Chip Eyebrow** — the eyebrow (mono uppercase) rendered as a tinted pill: border plus background `color-mix(... <token> 9–14% ...)` with a leading Lucide icon. Use `<Eyebrow variant="chip" tone="..." icon={...}>`.
- **Top-Accent border** — the card carries a `2px` top border `color-mix(... <token> 55% ...)` using the same semantic token as the chip. Card wrappers accept a `topAccent` prop.

A chip without a top border, or a top border without a chip, breaks the pattern and reads as noise. The pattern is a **differentiator** — it only works while it stays scarce. Applied to every card, the eye stops registering it.

### Available tones (cross-module vocabulary — never invent per-module tones)

| Tone          | Token           | Communicates                          |
| ------------- | --------------- | ------------------------------------- |
| `accent`      | `--accent`      | Identity, primary content, actions    |
| `cool`        | `--accent-cool` | System, data, history, technical info |
| `warm`        | `--accent-warm` | Personal: notes, reviews, hobby       |
| `success`     | `--success`     | Positive terminal state               |
| `warning`     | `--warning`     | Attention (not error)                 |
| `destructive` | `--destructive` | Error / urgency                       |

### Frozen cross-module label vocabulary

These labels never vary their tone+icon between screens:

| Eyebrow                            | Tone                | Lucide icon  |
| ---------------------------------- | ------------------- | ------------ |
| Actions                            | `accent`            | `Zap`        |
| Your private note                  | `warm`              | `PencilLine` |
| Reviews                            | `warm`              | `Star`       |
| Products                           | `cool`              | `Boxes`      |
| History                            | `cool`              | `Clock3`     |
| Payments                           | state-aware (below) | `Wallet`     |
| Your order / delivery · {currency} | `accent`            | `Package`    |
| Categories / imports               | `cool`              | `Tags`       |
| Contact channels                   | `cool`              | `AtSign`     |
| Addresses                          | `cool`              | `MapPin`     |

Payments tone is derived from order state: fully paid → `success`; overdue → `destructive`; completed with an unpaid balance → `warning`; otherwise (active, cancelled) → `cool`.

### The two slot families for the aside summary card (frozen)

The first card of a detail aside is one of **two semantically distinct slots**. They are **never unified** because they communicate different things. Choose the family by what the card communicates, not by its position.

- **The accent family — "your things"** (the viewer's own activity / identity): tone `accent` + `Package`. It mirrors the `Your order` / `Your delivery` hero. Example: store-detail "Your orders here" (the viewer's orders at that store).
- **The cool family — "data recap"** (factual attributes of the entity itself): tone `cool` + `ClipboardList`. Same family as Products / History / Categories. Example: delivery-detail "Summary" (store, dates, source orders).

Each family is internally consistent. Use the accent family when the card is about _the user's own stuff_; use the cool family when the card is a _neutral summary of the entity's data_. (Order-detail has no dedicated summary slot — the hero plus the Payments card cover it.)

### When to use

- Detail pages (`order-detail`, `store-detail`, `delivery-detail`) where cards of **different natures** coexist and the user scans to find a specific card.
- The Settings screen and its sub-cards (Profile / Account / Preferences; Appearance `cool`, Collector `warm`).

### When NOT to use

- **Wizard step cards** — homogeneous, already differentiated by step number, with active/done states that already use tonal color on a progression axis.
- **Repeated list items** — homogeneous in series; per-row top accents dilute the signal into decoration.
- **Eyebrows inside modals/sheets** — the modal already uses its tonal icon-circle as the differentiator.
- **Internal filter-drawer sections** and **auxiliary wizard sidebar cards** (Summary, Shortcuts) — secondary, not "main type" surfaces.

### Tokens consumed

Chip background `color-mix(... <token> 9–14% ...)`; chip border `color-mix(... <token> 18–28% ...)`; card top border `2px solid color-mix(... <token> 55% ...)`. The percentages are calibrated for AA in light and dark — do not adjust without updating this doc.

---

## 8. Status, Badges, and Chips

Chips share compact softened geometry, compact sizing, medium/semibold weight, and muted or semantic fills. Use them for metadata classification, counts, compact state indicators, and lightweight grouping labels.

- **Do not default to `rounded-full`** for status tags, data tags, or counters — prefer `rounded-lg` / `rounded-xl` / `rounded-2xl` by size and prominence. Count indicators inside tags should read as integrated, not detached circular bubbles. (Rich profile hero meta pills keep `rounded-full` soft pills for neutral metadata.)
- `Chip` is generic (`success | warning | destructive | info | accent | neutral`, optional leading icon).
- `StatusChip` is a discriminated union by enum (`orderStatus | deliveryStatus | itemDeliveryState | derived`). The `info` kind requires both `icon` and `label` by TypeScript.

### Status enum mapping (ADR 0002)

These mappings keep a status visually stable across every surface (filter pill, row chip, detail chip, mobile card). The status icon is always the same for a given state (see [ADR 0002](decisions/0002-status-chip-mapping.md)).

**`OrderStatus` (primary chip):** `OPEN` neutral `clock` · `PARTIALLY_IN_TRANSIT` / `IN_TRANSIT` info `truck` · `PARTIALLY_DELIVERED` soft-success `package-open` · `COMPLETED` success `package-check` · `CANCELLED` neutral `ban`.

**`DeliveryStatus`:** `IN_TRANSIT` info `truck` · `DELIVERED` success `check-circle` · `CANCELLED` neutral `ban`.

**`OrderItemDeliveryState`:** `NONE` neutral `clock` · `ARRIVED_AT_STORE` success `check-circle` · `IN_TRANSIT` info `truck` · `DELIVERED` success `package-check`.

**Derived states** render as a secondary chip beside the primary one (never replacing it): Paid (`success`), partial payment (`accent` soft), unpaid (`neutral`), Overdue N days (`warning`). Priority when several apply: Overdue first (most urgent), then Paid; unpaid/partial otherwise live in the payment progress bar. The `neutral` variant exists for states without urgency (`OPEN`, `CANCELLED`, `NONE`): elevated-surface background, strong border, secondary text.

### Color is never the only signal (ADR 0006)

Every status uses **icon + label**, never color alone, so meaning survives color-blindness and grayscale (see [ADR 0006](decisions/0006-color-blindness-icon-label-contract.md)). Map product-category icons client-side per module; never invent a tone outside the cross-module vocabulary.

---

## 9. Cross-cutting States

Empty, loading, and error states are owned by `docs/design/states.md` (anatomy, the `EmptyState` / `Skeleton` / `SectionError` components, route vs section error boundaries, and the frozen state-tone vocabulary). Use that document — do not duplicate its rules here. The one rule that touches this doc: section-level empty/error surfaces use the Chip-Eyebrow + Top-Accent vocabulary (§7), and skeletons must match the real layout they replace.

---

## 10. Motion

Motion tokens, canonical micro-interactions, optimistic/undo timing, progress animation, success moments, and list→detail view transitions are owned by `docs/design/motion.md` (with reduced-motion rules). Animate only `transform` / `opacity`, respect `prefers-reduced-motion`, and keep default workflows calm.

---

## 11. Toast Notifications

Toasts are transient, auto-dismissing confirmations. They appear bottom-right on desktop and full-width at the bottom on mobile, and stack upward.

- **Use a toast when**: a save/mutation completes successfully, a background operation finishes, or a transient informational/success message needs no reading time.
- **Do not use a toast for**: inline field validation errors, errors requiring user action or explanation, or persistent status the user may re-read (use inline banners).

| Variant   | Token           | Use case                                  |
| --------- | --------------- | ----------------------------------------- |
| `success` | `--success`     | Confirming a completed save/action        |
| `error`   | `--destructive` | Non-form-level errors (e.g. network fail) |
| `info`    | `--info`        | Neutral informational messages            |
| `warning` | `--warning`     | Soft warnings that do not block           |

Default duration is 4000ms; pass a custom `duration` for longer copy. `useToast().addToast(...)` is available from any client component inside the app shell (the provider wraps the shell). Context/hook and components live under `src/contexts/ToastContext.tsx` and `src/components/core/Toast/`.

**Neutral-undo toast (reversible operations):** for reversible deletes/changes, apply the change optimistically in the UI, then show a **neutral** toast with a countdown and an "Undo" action; the consumer owns the `Z` shortcut and the inverse mutation. The server action is **deferred** until the window expires (5s default, 8s for a whole-record delete) — distinct from the standard optimistic pattern where the action fires immediately. Use it only when the cost of error is low and undo value is high; never for permanent destructive deletes (order, delivery, store), which require a confirm modal.

---

## 12. Responsive Rules

- **Mobile-first.** The breakpoint split is mobile (`< md`) vs desktop (`≥ md`); mobile is the baseline.
- Use spacing and layout changes before reaching for smaller typography.
- Protect tap targets; avoid cramped inline action clusters.
- When a desktop pattern becomes crowded on tablet/mobile, switch to a dedicated mobile pattern instead of forcing the same layout (the adaptive `<Modal>` and `FilterDrawer` already do this).

---

## 13. Accessibility Rules

- Every interactive control has a visible focus treatment.
- Text contrast stays readable in both themes; secondary text must remain readable, not merely decorative.
- Icon-only controls have accessible labels.
- Meaningful images have `alt`; status/feedback messages can be announced (`role="alert"` / `aria-live`) when relevant.
- Associate field errors with their control (`aria-invalid`, `aria-describedby`).
- Modals/sheets manage focus and use `role="dialog"` or `role="alertdialog"` appropriately.
- Status meaning never rests on color alone (§8, ADR 0006).
- Motion and glow treatments never reduce legibility, and respect `prefers-reduced-motion`.

---

## 14. Monetary Amount Display

Use the shared `formatAmount` utility (`src/lib/currency.ts`) for all monetary amounts shown to the user.

**Format: `{amount} {ISO-code}`** — number first, currency code after. Examples: `43.000 CLP`, `888.50 USD`, `1.200 JPY`.

- The number is always locale-formatted (`Intl.NumberFormat` with `style: "decimal"`).
- The ISO 4217 code follows, separated by a space.
- Trailing decimal zeros are omitted (`43.000 CLP`, not `43.000,00 CLP`).
- Never use currency symbols (`$`, `¥`, `€`) — they are ambiguous across countries.
- Never hardcode `code + " " + amount` or `amount.toFixed(2)` inline; always call `formatAmount`.

Rationale: reading left-to-right, the number (the primary information) reaches the eye before the identifier, and ISO codes are unambiguous where symbols are not (`$` = CLP, ARS, USD, MXN…).

---

## 15. Design System Usage Rules (anti-patterns)

Before implementing UI work, decide whether the task is mainly visual foundations or interface patterns, read the matching file in `docs/design/`, and reuse the established pattern before inventing a new one. If a new reusable rule is needed, update the matching design doc in the same change.

Do **not**:

- Create a component or pattern that already exists — **reuse the canonical component** (`src/components/core/`, `src/components/modules/`; see `docs/design/components.md`) before creating a parallel one. A near-duplicate ("almost the same but not") is debt — promote it to a shared component instead.
- Use a native `<select>` — use `Select` / `Combobox` / `MultiTagAutocomplete`.
- Build an ad-hoc Portal + `<div>` modal, or copy a legacy modal — use `<Modal>`.
- Confuse `<FilterDrawer>` with `<Modal>`; they are distinct patterns with independent code.
- Use `<input type="checkbox">` for a boolean toggle — default to `<Switch>`.
- Hardcode theme-blind colors (`#fff`, `text-white`, `bg-{color}-{n}`) — use semantic tokens (`--text-on-accent` resolves light/dark).
- Hardcode spacing, radius, or color literals, or layout magic numbers — use tokens.
- Place three standalone buttons in a detail hero, or break a button label onto a newline.
- Render disabled state via opacity — use the muted token.
- Apply the Chip-Eyebrow + Top-Accent pattern to homogeneous surfaces (wizard steps, list rows, modal/drawer internals), or use a tone outside the frozen cross-module vocabulary.
- Invent a new `tone`, `variant`, or reusable pattern without an ADR — extend the canonical component in place and document it.
