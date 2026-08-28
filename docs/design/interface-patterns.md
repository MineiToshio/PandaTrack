# Interface Patterns

This document is the normative source of truth for PandaTrack's reusable interaction and layout patterns: the collector app shell, content hierarchy, interaction states, buttons and controls, navigation, modals and overlays, forms in context, the Chip-Eyebrow + Top-Accent section header system, status chips, toasts, responsive behavior, accessibility, monetary display, and trend charts.

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

### Page headers

`AppPageHero` was the shared component for this pattern; every screen has since moved off it (listing pages use a bare `h1` at the shared hero scale, detail/profile pages use a route-local hero component such as `OrderDetailHero.tsx`), and the component was removed as dead code. The structural intent below still applies to routes that need it:

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
2. a route-local hero (e.g. `OrderDetailHero.tsx`) with identity, status, metadata, and top-level actions
3. desktop two-column layout: left content column plus sticky right rail
4. mobile sequence that preserves the same priority order

Rules:

- The **left column** owns the long reading content (items, history, reviews, contacts) — anything the viewer scrolls and explores.
- The **right rail** owns volatile or summary-heavy, viewer-scoped content: compact financial summaries, secondary stats, and the secondary-actions card. The rail belongs to the viewer; the body belongs to the resource (see [ADR 0003](decisions/0003-demo-decisions.md)).
- **The split is by shape, not by subject.** _(Clarified 2026-08-10.)_ "Payments" used to be listed as left-column content outright, which contradicted `OrderPaymentsAsideCard` sitting in the order detail's rail and invited agents to "fix" whichever side they read second. The real criterion is: **a compact summary goes to the rail; a long, explorable list goes to the body** — and a feature may be split down the middle, with its summary in the rail and its list in the body. The order detail's payments card is in the rail because an order has one to three payments in a fixed row shape; the store detail's payments list is in the body because a store can have a hundred and each row must carry an order reference plus a product name. Before moving a list into the rail, do the width arithmetic: 320px of rail is 278px of usable width inside `Card padding="md"`.
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
6. **The bar is mobile-only, and it always has a desktop counterpart.** A bar pinned to the viewport bottom on a wide monitor spans the whole window and reads as detached from the column it belongs to. Every fixed bottom bar therefore carries a hide variant (`md:hidden` on form-style screens, `lg:hidden` on detail screens whose desktop shape is the sticky rail), and the same actions are rendered a second time for the wider viewport. On a **form-style screen** that second copy is an inline footer at the end of the content: right-aligned, top border, secondary before primary (`hidden ... md:flex md:justify-end`, as in `OrderEditForm`, `WizardStep`, and the image-intake review screen). On a **detail screen** it is the sticky rail (see above).
7. **A batch-selection bar belongs to its group's card, not to the viewport.** When a list is grouped into cards and the selection is scoped to one group (the orders "Por tienda" view, `FR-05-48`), the actions bar is `sticky bottom-0` **inside that card's own body**, in normal flow, at `--z-sticky`. Rule 6 above is about bars `fixed` to the viewport, and it does not apply here: a card-anchored bar is the same control at every width, so it needs no desktop counterpart and no `lg:hidden` twin. The reason to anchor it is meaning, not layout — a bar pinned to the window cannot say which group it acts on, and this one is about to write an irreversible record scoped to exactly one store. Rules it inherits unchanged: one primary, primary on the right, no `⋯` trigger. Rules of its own:
   - **It declares the quantity, never asks "¿confirmar?"** — "3 productos de 2 pedidos". If a monetary total cannot be computed for every row (43% of pending products have no derivable price), it shows **no** total rather than a blank or a lie.
   - **It does not mount at zero.** No permanent chrome for a feature most groups never use.
   - **The declaration is never truncated, so the row wraps instead.** The count is the bar's only
     information, and it competes with two `shrink-0` buttons in a single flex row: on a phone the
     buttons alone are wider than what a count needs beside them ("Cancelar" 82px + "Ya me llegó"
     121px + gap = 210px of the 228px a 320px viewport leaves inside the card, 283px at 375px), so
     `truncate` on the text renders even the SHORTEST message, "1 producto seleccionado", as
     "1 produ…". There is no copy short enough to rescue that row, so the row is the thing that
     gives: `flex-wrap` on the bar plus `flex-[1_1_13rem]` on the count. Flex line-breaking measures
     the **basis**, not the shrunk width, so 13rem is the promise that the count shares a line only
     when it would be fully readable there; otherwise the buttons drop to their own line (`ml-auto`
     keeps the primary trailing) and the count takes the bar's full width. Size the basis off the
     WIDEST string the ICU message can produce, not the one on screen — 208px against the 196px of
     "1024 productos de 999 pedidos" at `--text-caption`. This costs ~24px of bar height on phones
     and nothing from ~507px up, where the single row already fits; a viewport breakpoint would
     have cost that height at widths where the text fits fine, and would go stale the moment the
     copy or a locale changes.
   - **Touch clears the FAB with the shared contract**, `max-lg:bottom-[calc(var(--fab-offset)+var(--fab-h)+var(--space-3))]`, the same one `ToastContainer` uses. Never a hand-rolled offset, and never a literal `z-30`.
   - **The card must not clip.** `overflow-hidden` on any ancestor turns the card into a scrollport and `sticky` stops working. Remove it and verify the corners in both themes; if children paint to the corners and the clip is load-bearing, the acceptable fallback is the bar in flow without `sticky`.
   - **The live count goes in its own `sr-only role="status"` node**, never on the toolbar container: `role="status"` implies `aria-atomic`, so the button labels would be re-read on every change.
   - `role="toolbar"` with an `aria-label` naming the group.
8. **Hide with `display`, and reserve room only where the bar exists.** `hidden` / `md:hidden` drop the copy from the accessibility tree too, so a screen reader hears exactly one primary at any width; hiding with opacity or off-screen positioning would announce both. The bottom padding that clears the fixed bar (`pb-[calc(...+env(safe-area-inset-bottom))]`) must be gated to the same breakpoint, or the desktop layout ends in dead space.

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

### Sizing and icon buttons

- Comfortable tap targets (≥ 44×44 on mobile at `md`/`lg`); controls must not feel cramped.
- Button text reads as an action, not as metadata.
- **Never break a button label onto a newline.** Keep labels on one line.
- Icon-only buttons require an accessible label.

**No generic floating action buttons.** The app shell does not mount FABs for arbitrary screens, and no module should introduce one of its own. The mobile primary CTA on detail-style screens still lives in each screen's **sticky bottom action bar** — see the _Sticky bottom action bar (mobile)_ rules under [Secondary actions on tinted panels](#secondary-actions-on-tinted-panels-mobile-detail-adr-0011). A labeled, state-aware bar keeps the primary action consistent with the desktop hierarchy instead of floating an unlabeled icon over the content.

**Exactly one exception exists:** `<CreateOrderFab>` (`modules/CreateOrderFab/`), the single-action "Nuevo pedido" entry point defined by FRD-11. It is a labelled pill (icon plus text, never a bare circle), route- and breakpoint-gated (Dashboard and Orders list only, below `1024px` only — see `fabRouteGate.ts`), performs one action (open `OrderCreateMethodSelector`), and never fans out into a menu. Do not copy this pattern for other create flows without a new FRD-level decision; it exists because order creation specifically needed one door reachable from two list-like surfaces that otherwise have no bottom action bar.

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
- **A control that also writes a value into an adjacent field is not a boolean.** Model it as a
  **fill button** (quick-pick), never as a checkbox or a switch: a boolean claims a persistent state
  the user revisits, while this is a one-way write whose result the neighbouring field already
  shows. Put the **fact** in the visible label ("Falta S/ 90.00") and the **outcome** in the
  accessible name (`aria-label="Asignar S/ 45.00 a …"`). The two figures **differ by design**
  whenever the outcome is capped by something outside the line (a payment smaller than the line's
  own balance, an order with less room left): the label states the line's fact, the accessible name
  promises the number that will actually be written, and only the accessible name is a promise about
  the write. Both are recomputed live from the same draft. Disable it with an explicit `title` when
  there is nothing left to write, and undo it by clearing the field. **The undo outranks the row's
  own read-only state:** when a row can become read-only from data the server owns (a line that
  comes back settled), it must still accept the edit that EMPTIES it, and only lock again once it is
  empty. Locking a field that already holds a value strands that value where nothing but a
  wipe-everything control can reach it, and the promised undo becomes a lie. **Spell that lock
  `readOnly`, never `disabled`** (add `tabIndex={-1}` to keep the tab order the disabled version
  had): it closes on the very keystroke that empties the field, with the caret still inside, and a
  field that turns `disabled` under the caret drops the focus onto `<body>`, from where the next
  `Tab` walks into the page behind the modal (`ModalDialog` traps `Tab` only on its first and last
  focusable, and does not portal). Precedents: `OrderInlinePaymentForm`'s "Todo · {amount}"
  quick-pick, `StorePaymentSheet`'s "Falta" cell. (Corrected 2026-08-14: the inline form's chip has
  never read "Restante"; it reads "Todo · {amount}", beside "50%" and "20%".) Modelling that gesture as a checkbox is what
  produced a zero-amount record in the payment history and a one-way door with no undo.
- **Never use a native `<select>`** — use `Select` (short lists, opt-in search), `Combobox` (long lists, always-visible search, inline "create new"), or `MultiTagAutocomplete` (multi-select with tags inside the input).
- **A `Select` popup is exactly as wide as its trigger, and the control is sized by its longest
  option.** `Select` renders an invisible zero-height sizer holding every option label, so an
  intrinsically-sized control (`w-max` in a toolbar) takes the width of the longest option rather
  than of whichever one happens to be selected. Options then never wrap or truncate, and because
  the popup matches the trigger it can never overflow the viewport (the listbox is `left-0` with no
  horizontal flip) nor be clipped by an `overflow-hidden` ancestor. Callers that set an explicit
  width (`w-full`, `w-[4.5rem]`) are unaffected. The listbox caps at `17rem`, which clears seven
  38px rows, so a sort menu never scrolls.
- **A control that only exists in the `lg` toolbar needs a stand-in below `lg`, not below `md`.**
  The list toolbars render at `lg:flex`; the filter drawer stands in for them underneath. Gating
  that stand-in on `useIsMobile()` (<768px) instead of on the toolbar's own breakpoint left
  768-1023px with the toolbar hidden and no replacement, so the sort control did not exist at
  tablet widths at all. Use `useHasDesktopToolbar()` (`src/hooks/useMediaQuery.ts`), which shares
  the 1024px constant with the `lg:` classes and defaults to `true` on the server so hydration
  does not flip the layout.
- **A `multi: false` pill section is a radio group.** `FilterDrawer` renders exclusive options with
  `role="radiogroup"` + `role="radio"`; as checkboxes, six mutually-exclusive sort options announce
  as six independent toggles.
- **A toolbar's control order is invariant across breakpoints and views; only the form of each
  control adapts.** Pick one canonical order once (e.g. the Orders toolbar's Search < Filter <
  Sort < Group by < New order) and render only a _subsequence_ of it at any given breakpoint/view,
  never a permutation — a control that drops out (no room, doesn't apply to the current view)
  simply isn't in the row; the controls that remain keep their relative order. This is what lets a
  control collapse to a narrower form (a labeled button to icon-only, a row to a drawer) without
  the whole row visibly reshuffling as the viewport crosses a breakpoint. When a trailing group of
  controls must stay pinned to the row's right edge even when nothing precedes it (e.g. a view with
  no search/filter), wrap just that group in its own `ml-auto` container rather than trying to
  center or space the whole row — a leading `flex-1` control elsewhere in the row makes the margin
  a no-op, but it's what pins the group right when that leading control is absent.
- **Below the toolbar's breakpoint, a search input and a value-showing `Select` cannot share the
  row: collapse the select to an icon trigger + `MobilePicker`.** A `Select`'s intrinsic width is
  floored by its longest OPTION (the invisible width sizer), so at 375px a sort select alone claims
  ~170px and leaves a search box next to it around 70px; letting it shrink instead is worse, since
  the popup matches the trigger's width and wraps every option onto two lines. The rule that falls
  out of this is a general one for listing toolbars: **below `lg`, sort is a control you OPEN, not
  a value you read** — the Orders list already did this in its "Por pedido" view (sort moves inside
  the `FilterDrawer`), and the "Por tienda" view, which has no drawer, does it with a 44px
  `ArrowUpDown` trigger opening the same options in a `MobilePicker` (`StoreViewSortCompact`). Give
  the trigger the field name plus its active value as its accessible name ("Ordenar por: Llegada
  más próxima"), since the value is no longer visible. Keeping both views' second slot at the same
  44px is also what pins the trailing controls' x position across a view switch.
- **A low-frequency, always-binary switch is shown as its ACTIVE VALUE, not as a segmented
  control.** Two chips/segments showing both options side by side is the right shape for a choice
  the user compares and re-visits often (e.g. a theme toggle); a switch that is set once and rarely
  revisited (e.g. the Orders list "Por pedido / Por tienda" grouping) reads better as a single
  control naming its current value; touching it flips it. Measured on the Orders toolbar: the
  segmented icon+label pair ran ~230px; the value-as-select form (`Select` in controlled/grouped
  mode, `variant="select"` in `OrderListGroupBy`) runs ~106px (EN) / ~115px (ES), and needs no
  tooltip because the visible text already says what's selected. Below the toolbar's own breakpoint,
  the same value shows as a short pill (`variant="compact"`) that opens a `MobilePicker` sheet.
- **Every listing-page select declares its own heading, in the listbox and in the mobile picker
  title alike ("Verb by" pattern).** A trigger's visible value ("Newest", "Pedidos") does not say
  what field it belongs to once several selects sit side by side in a toolbar: the desktop listbox
  and the mobile `MobilePicker`/`FilterDrawer` section must both open on a short heading naming the
  choice ("Sort by" / "Ordenar por", "Group by" / "Agrupar por"). For a plain (non-grouped)
  `Select`, wrap its `options` in a single-entry `SelectGroup[]` (`options={[{ heading: t("sort.label"),
options: sortOptions }]}`), rather than adding a parallel prop: the component already supports
  grouped options, and every listing sort rendered as a `Select` (`orders-sort`, `deliveries-sort`,
  `store-sort`) and `OrderListGroupBy` use this exact shape. A `MobilePicker` gets the same text via
  its own `title` prop, which is how the orders list's mobile sort declares it in both views (inside
  the `FilterDrawer` section in "Por pedido", inside `StoreViewSortCompact`'s sheet in "Por
  tienda"). A `FilterDrawer` pills/radiogroup section already renders its `label` as a
  visible `Eyebrow` above the options, so a drawer-hosted sort section needs no extra change as long
  as its `label` reuses the same translation key as the toolbar's `Select` (e.g. `sort.label` /
  `filters.sortSectionLabel` both resolving to "Sort by"). Scope: toolbar and drawer selects on a
  listing screen. A form select paired with its own persistent, always-visible `<label>` (e.g.
  `PerPageSelect`'s "Per page") already names itself outside the trigger and does not need a
  duplicate in-listbox heading.
- **A `SelectGroup.heading` must never wrap inside the open listbox.** `Select`'s invisible width
  sizer floors the control's width to fit its widest content, but a heading renders in different
  typography than an option (mono, uppercase, tracked eyebrow vs. the plain body font), so a
  heading can be visually wider than every option despite having fewer characters ("Agrupar por"
  over "Pedidos"/"Tiendas"). The sizer accounts for both: it stacks the heading text using the
  heading's own font plus the listbox's own padding, alongside the option labels stacked in the
  trigger's font plus the trigger's own padding, and the control's floor is the wider of the two.
  Do not shorten a heading to make it fit; the sizer, not the copy, is what should widen the
  control.
- **A value shown next to another control must name the unit, not read as that control's domain.**
  `OrderListGroupBy`'s value used to be "By order" / "By store" next to a Sort `Select`: in English
  it read as "order" the sort concept, not "pedido" the grouping unit, because the two controls sit
  side by side. The fix is a plain plural noun for the unit ("Orders" / "Stores", "Pedidos" /
  "Tiendas"), matching the "Group by: <value>" pattern common in list tooling (Linear/Jira "Group
  by: Assignee"). Use the exact same value string in every surface that shows it (the desktop
  `Select` trigger, the mobile pill, and the pill's own width-sizer, both labels, so the pill's width
  and x-position stay constant regardless of which option is active), rather than a shorter
  "compact" variant with its own key; a second short form is what produced the divergence in the
  first place.

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

**The `underline` recipe draws its rule with an inset box-shadow, and its items carry no negative margin.** The pair is one decision, not two. The bar keeps `overflow-x-auto` so a bar of many tabs can scroll on a phone, and that makes it a scroll container in **both** axes — CSS gives an element whose other axis is `visible` an implied `auto`. So the common `-mb-px` on the items, used to pull the active underline over the bar's own `border-b`, hangs one pixel past the scrollport, and the browser answers with a full vertical scrollbar down the side of a 44px tab bar (observed in `Progreso`, 2026-08-26). An inset shadow paints the same one-pixel rule **inside** the box, so nothing overhangs, and the active item's `border-b-2` still covers it because a parent's inset shadow paints beneath its descendants. The same reasoning applies to any horizontally scrollable strip: nothing inside it may extend past its box on the axis it does not scroll.

### List pagination (ADR 0018)

Canonical for every collector-app list (orders, deliveries, stores) via `ListPagination` (`src/components/modules/ListPagination.tsx`), paired with `PerPageSelect` (`src/components/modules/PerPageSelect.tsx`) — see [components.md](components.md). One shared component, one URL contract; no module hand-rolls its own paginator.

- **Page size.** `PAGE_SIZE_OPTIONS` = 10 / 25 / 50 / 100, `DEFAULT_PAGE_SIZE` = 25 (`src/lib/constants.ts`), unified across all three lists. The choice is user-selectable, never a fixed module constant.
- **Desktop — one row, `justify-between`.** Left: the results summary, `"Mostrando 1–25 de 92"` (en dash in the numeric range, `--text-muted`, `tabular-nums`). Right: the per-page `Select` (core `Select`, **never** a native `<select>`) immediately followed by the numbered page nav (`«`/`‹` … page numbers … `›`/`»`). `flex-wrap` is the only overflow behavior at narrow desktop widths — the right-hand cluster drops to its own line, it never shrinks the numbered nav or duplicates the summary.
- **Mobile — summary + "Cargar más".** A centered results summary above a single centered "Cargar más" button. No numbered pages, no per-page selector on mobile — the load-more button already covers "see more" at that breakpoint (see also [Responsive Rules](#12-responsive-rules)).
- **URL contract.** `?perPage=` is present only when it differs from the default (25); changing the page size resets `?page=` to `1`; changing any other filter preserves the current `?perPage=` value. `?page=` follows the existing omit-when-`1` convention.
- **History.** Supersedes [ADR 0001](decisions/0001-s2-closure-decisions.md) Decision 9 (fixed per-module page size, no user control); see [ADR 0018](decisions/0018-list-pagination-page-size-and-desktop-summary.md) for the full record, including why stores' prior mobile numbered-pages/no-summary layout was folded into this shared pattern.

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

**A dialog's header never restates a number the dialog's own body can change.** A subtitle composed by the caller ("3 productos de 2 pedidos") is a snapshot of the moment the dialog opened; if the body lets the user uncheck a row, the count belongs to the body's own live line and to the primary's label, and the header names the scope instead (the store, the order). Two counts on one surface, one of them frozen, reads as the dialog having lost track of what it is about to write.

**A conditionally mounted dialog must have its open flag follow the condition down.** When a modal is rendered as `isOpen && somethingLive && …` — a live selection, a row that may vanish on a resync, an entity still being fetched — the `&&` only controls the _mount_. The boolean that opened it keeps its own value, so the moment the condition comes back the dialog re-appears with no one having asked for it, already filled in, and its primary one click away. The condition and the flag are the same fact: reset the flag whenever the mount condition turns false, adjusting it **during render** (`if (isOpen && !condition) setIsOpen(false)`) rather than from an effect, which would paint the bad state first and trips the repo's `react-hooks/set-state-in-effect` rule. Cheap to miss and worst exactly where it matters, because the dialogs guarded this way are the ones confirming a write. Shipped case: the store-scoped arrival of `FR-05-48d`, whose dialog mounts on a live product selection that a background resync can prune to nothing.

**A short, occasional detail list goes behind a trigger that states its size, not into the foot of the thing it explains.** When a card or a group carries a supplementary list — a handful of rows the user consults sometimes, to decide what to open next — a permanent block at the foot charges its vertical space to every visit of every instance, including the majority that have nothing to show, and on a long list it lands a screen away from the header the user is reading. Put it behind a **low-weight trigger in the header, labelled with the concept and the count** (`Button variant="ghost" size="sm"`, text-only when a filled action already sits beside it so the two do not read as peers), and open it in the canonical `<Modal>` with `tone="info"`, an icon-circle, the scope (the store, the order) as the subtitle, **no footer actions**, and `bodyClassName="pb-6"` so the body supplies the breathing room a footer would have. Three properties the foot did not have: the count answers "is it worth opening" before it is opened, the list is reachable with the section collapsed, and rows can be full-width links at `min-h-11` (the row IS the target, so no pseudo-element and no contested band). Render neither trigger nor overlay when the list is empty. Shipped: `StoreGovernanceSummaryModal` (store detail) and `StoreUndetailedPaymentsModal` (orders "Por tienda").

**A header action row has a width budget, and the fourth labelled control is usually over it.** Before adding a control to an existing right-aligned cluster, add up the boxes at `--text-caption` against what the card actually leaves at 320-430px — a `Button size="sm"` with an icon runs ~140px, a text link ~80px, an icon button 36px, plus the row's gaps. The orders "Por tienda" group header is ~278px of the ~252-307px a phone leaves inside the card with three controls, so a fourth needs a viewport no phone has. Letting the row `flex-wrap` is rarely the answer: it strands the trailing icon button alone on a third line. Give the control a **different touch slot** instead (§12: switch to a dedicated mobile pattern), mount both slots and pick between them in CSS (`hidden md:inline-flex` / `md:hidden`) rather than with `useIsMobile()`, and size the touch slot to the 44px box rather than expanding it with a pseudo when its neighbours are other content.

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

### File attach surface: picker, drop, paste

An attach surface offers up to three doors into the **same** handler, never three code paths: the file `<input>` plus its visible button, a drop, and a clipboard paste. Canonical implementation: `IntakeUploadPanel` in the image-intake flow.

- **The picker is the primary and only guaranteed door.** Dragging needs a pointer and pasting needs a keyboard with an image already on the clipboard, so neither may ever be the only way in. Keep the `<input>` visually hidden (`sr-only`) with a real `<button>` in front of it.
- **The whole panel is the drop target**, not just the dashed card: a photo released over the thumbnails or the CTA must still attach rather than make the browser navigate to the image. `preventDefault()` on both `dragover` and `drop`, always.
- **Track drag nesting with a depth counter, never a boolean.** Entering a child element fires `dragleave` on the element left behind, so a flag switches the highlight off while the pointer is still inside the zone.
- **Drag-active state** paints on the dashed card only: dashed border in `var(--accent)` plus the selected-surface tint `color-mix(in oklch, var(--accent) var(--state-selected-bg-mix), var(--surface))`, matching the `.state-selected` language. The card's title swaps to a "drop here" label while the drag hovers.
- **Filter by MIME type and say so.** Anything outside the accepted list (a PDF, a folder, an iPhone HEIC) reuses the surface's existing format error instead of being ignored. A mixed payload attaches what it can and still reports the rest.
- **A paste listener is document-scoped, and that is only safe with two guards.** Bind it on the document (a `paste` event reaches only the focused element, and after a screenshot nothing in the panel has focus), then: mount the listening surface only in the phase where attaching is valid, so leaving that phase removes the listener, and ignore any paste whose target is an `input`, `textarea`, `select`, or `contenteditable`. A paste carrying no image is left uncancelled so ordinary typing keeps working.
- **The drag/paste hint is CSS-gated to `md:` and up**, not branched on a viewport hook: neither gesture exists on touch, and a hydration-time read would render the desktop wording first and swap it.

### Ordered attachment list (when the order of the files is data)

When a list of attached files is read as a **sequence** rather than as a set, the order stops being a layout detail and becomes content the user must be able to see and correct. Canonical implementation: the thumbnail grid in `IntakeUploadPanel`, whose photos are read as one conversation from the first to the last.

- **State the position on every tile.** A small numbered badge (pill on `--surface-elevated`, `1px solid var(--border)`, top-left, with a `GripVertical` glyph as the drag affordance). Visible number for sighted users, plus an `sr-only` full phrase ("Photo 2") so the badge is not read as a bare digit.
- **Two ways to move an item, always both.** Native HTML drag events on the list item for a pointer, and a pair of earlier / later icon buttons on every tile for everything else. Dragging fires no events at all on a touch screen and is unreachable by keyboard, so the buttons are the guaranteed path, not the fallback. No drag-and-drop library (ADR 0010: hand-roll).
- **Name the direction and the subject in the button label**: "Move photo 2 earlier", never a bare "Move up". Disable, do not hide, the move that would fall off either end.
- **Announce every move in a polite live region** (`role="status" aria-live="polite"`, `sr-only`) stating the new position and the total. A reorder has no other spoken evidence: the grid rearranges silently.
- **Route every gesture through one move function** so the live region is written exactly once per move and cannot drift from the list.
- **Keep the reorder drag out of the file-drop path.** The surface-wide dropzone keys off `dataTransfer.types` containing `"Files"`; an internal reorder carries `text/plain` (also required by Firefox to start a drag at all) and `stopPropagation()`s its own `dragover`/`drop`.
- **Drag feedback:** the dragged tile at `opacity-50`, the hovered target outlined in `var(--accent)` with a 2px offset. Set `draggable={false}` on the thumbnail image, or the browser starts an image drag instead.
- **Auto-ordering is a guess about NEW files only.** Sort each incoming batch by its own file dates and append it at the end; never re-sort the whole list on an add, which would silently undo the order the user just set by hand.

### Costed re-do offer (asking for one more input after an expensive step)

When a result screen can be improved by one more input, but getting it means re-running a step the user already paid for (a metered AI read, a paid lookup), offer it as a **priced, pointed, non-blocking** suggestion. Canonical implementation: the product-page-screenshot offer on the image-intake review screen (`IntakeReviewScreen`).

- **Point at the row, never at the screen.** The notice names the specific item it would fix and why that item is weak. A generic "some data may be incomplete" banner is noise, because the user cannot act on it without hunting.
- **State the cost in the unit the user is metered in**, as a real number, in the same notice: not "this may use more of your quota" but "reading again spends the 3 photos you already uploaded once more, plus the new one". Say why, in one clause, when the cost is counter-intuitive (here: the read is a single pass over the whole batch).
- **Show the balance when a cap applies**, and when the balance cannot pay for the re-do, keep the notice and drop the button rather than offering a door that leads to a blocked submit.
- **Never block the primary path.** The notice closes with the way forward without accepting it ("you can save it as is and rename it later"), and the primary CTA stays enabled.
- **Accepting returns to the input surface with the previous input intact**, so the user adds only what was missing. Discard the derived result (it is about to be replaced), never the inputs.
- **Surface:** `AlertBanner tone="info"` with the reason list as the body, the cost line at `--text-caption`, and the re-do action in the banner's `action` slot. The offer is derived from live state, so it disappears by itself once the user fixes the item another way.

### Permanent informational note inside a flow (canonical: `AlertBanner tone="info"`)

A rule of use that is always true on a step (not a validation error, not a state that just changed, nothing to dismiss) renders as **`<AlertBanner tone="info">`** with a Lucide icon at 16 px. That is the canonical treatment, and it is the component the design system already owns: `--info` at 9% background and 22% border, body at `--text-body`, `role="note"` by default. Canonical implementation: the pre-upload guidance in `IntakeUploadPanel`.

- **Never hand-roll the tinted box.** A local `div` with its own `color-mix` and its own font size is how the same note ends up in three sizes across three flows.
- **Emphasise the rule inside the sentence**, not by adding a title: `t.rich` with a `strong` tag at `--font-weight-semibold` / `--text-primary`. The `title` slot is for a note that genuinely has a heading and a body.
- **One banner, several lines, when the lines are one thought.** Two rules about the same submission share a banner and one icon (`<p>` plus `<p className="mt-1">`); two banners stacked read as an alert wall, and the second one stops being read.
- **`info` is not `warning`.** A rule that is always true has not materialised into a risk; `warning` is reserved for a condition the user must resolve now (see `ux-copy.md` §6).
- **The icon must carry meaning alongside the text** so the tone colour is never the only signal (ADR 0006).
- **A permanent note is not a disclosure.** What every user needs on every pass stays visible; what a minority needs goes behind a labelled trigger beside it, never inside the banner.

**Pending migration.** Two earlier hand-rolled versions of this exact pattern predate the rule and still ship: the step-3 info banner in `OrderCreateForm` and the review-step info banner in `DeliveryCreateWizard`. Both paint `--info` at 6% with 12.5 px text and a 14 px icon, so the same note is visually lighter there than here. They are known deviations to be migrated onto `AlertBanner tone="info"` in a pass of their own; do not copy them, and do not add a third variant.

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

**Derived states** render as a secondary chip beside the primary one (never replacing it): Paid (`success`), Overdue N days (`warning`), outstanding balance (`warning`, `alert-triangle`). Priority when several apply: Overdue first (most urgent), then Paid. The `neutral` variant exists for states without urgency (`OPEN`, `CANCELLED`, `NONE`): elevated-surface background, strong border, secondary text.

**Arrival delay (`FRD-05 · FR-05-56`, [ADR 0030](decisions/0030-arrival-window-shown-at-declared-granularity.md)).** A late expected ARRIVAL is **`warning`-toned wherever it appears**, the tone the PLAYBOOK fixes for `Atrasado (N días)` and the one the order-list chip already uses for a late order. **Tone is not the same thing as the label's colour, and the two paragraphs below used to disagree about it:** the order-list chip is cited here as the precedent for the `warning` TONE, which it always was, while its own label sat on the raw `--warning` at 2.23:1 on its 12% wash — the exact spelling the second rule below forbids. The chip's tone was never the defect; its label token was, and it was corrected on 2026-08-17 (`orderListStatusChip.tsx`, and `orderItemDeliveryChip.tsx` beside it in the same list). Cite this line for the tone, never as licence for the token. It never earns a second tone — a `destructive` arrival would exist on one surface only, and the same order would read amber in the per-order list, in its detail and in deliveries, and red there. From **60 days** the label states the magnitude in months ("Atrasado 7 meses") instead of days: past two months the exact day count stops being readable and forces mental arithmetic, and the gradation of a delay belongs in the words. The **unit** is the surface's to choose while the arithmetic is shared: a chip abbreviates ("Atrasado 47d") because a pill pays for every pixel, a line of text spells it out ("Atrasado 47 días"). Where it IS a chip, the icon is `alert-triangle`; `alert-circle` stays reserved for a late DELIVERY. As a line of text it carries no icon (see below), and takes `--warning-chip-text`.

**Not every derived state should be a chip, and the "Por tienda" arrival is the worked example** ([ADR 0030](decisions/0030-arrival-window-shown-at-declared-granularity.md) §8, revised 2026-08-17). That row's arrival state is **one line of text**, not a pill: `Llega sept 2026` and `Ya llegó a la tienda` in `--text-muted`, and, when it is late, `Atrasado 17 días` in `--warning-chip-text` — same typeface, same size, **replacing** the estimate rather than sitting beside it. Two rules come out of it.

First, **a derived state earns a chip when it is a status a row does not otherwise state, and earns a line when it is a better version of something the row is already saying.** A delay is the second: "Esperada 26 jul" asks the reader to subtract and "Atrasado 17 días" is the answer, so printing both spends a pill on a question the row can just stop asking. This one was a chip first, and it cost two deviations from the secondary-chip rule and a width arithmetic re-measured three times — all of which dissolved the moment the state stopped being a pill. When a chip needs a declared deviation to fit, ask whether it should be a chip.

Second, **a status colour used as TEXT takes the `--{status}-chip-text` alias, never the raw token — inside a chip too.** `--warning` is 2.46:1 on `--surface` in light and `--info` is 3.83:1: they are calibrated as chip fills. The aliases are the calibrated status-text values (`--warning-chip-text`: 8.42:1 light / 11.30:1 dark). A chip does not exempt itself by carrying its own wash: a 12% fill of the same hue lifts nothing, so the orders list read 2.23 / 3.33 / 3.14:1 (warning / info / success) until 2026-08-17, against 7.62 / 7.00 / 6.13 with the alias, while `Chip` and `StatusChip` had been on the alias all along. `design-token-guard` now holds this as a third scan — a zero budget against a per-file map of the remaining, unaudited debt — so the orders list and its shared chip helpers are at zero and a regression there is red. It still computes no contrast: it can tell you the token is the wrong one, never that a new pairing is readable. See `visual-foundations.md` § Status color as text.

Colour still never carries the distinction alone (ADR 0006): the words differ (`Llega` / `Ya llegó a la tienda` / `Atrasado`), which is what makes the line conformant where a coloured line saying the SAME sentence as its neighbour would not have been — the reason the state formerly called `soon` was merged away rather than given a colour of its own.

**"Beside, never instead" is what makes a money signal possible at all.** A finished order's primary chip is `COMPLETED`/`success` by definition, so the only place a "still owes money" signal can live is a second chip; recolouring the primary one would make the surface lie about fulfilment in order to tell the truth about money. Orders apply this as the `Saldo pendiente` chip on completed rows (`FRD-05 · FR-05-35a`). _(Updated 2026-08-11: the former "partial payment (`accent` soft)" and "unpaid (`neutral`)" derived states, and the payment progress bar this line used to defer to, were retired by [ADR 0025](decisions/0025-store-level-payments-declared-allocations.md) — a per-order payment percentage is no longer a fact the data can state. Only the binary balance signal replaced them.)_

### Color is never the only signal (ADR 0006)

Every status uses **icon + label**, never color alone, so meaning survives color-blindness and grayscale (see [ADR 0006](decisions/0006-color-blindness-icon-label-contract.md)). Map product-category icons client-side per module; never invent a tone outside the cross-module vocabulary.

### A state chip may drop its LABEL on mobile, but only for the value the list is already about

The narrow exception to the line above, and the conditions are all of them, not a menu. A list whose
subject IS one state prints that state's label on nearly every row, and on a phone that label is the
widest thing competing with the row's actual content. Measured on the orders "Por tienda" mobile
cards: "Pendiente en tienda" is 131.3px of a 309px line at 375px (42.5%, 51.7% at 320px), on 61 of
the 67 rows, while the group header two lines above already says "28 productos pendientes". So below
`md` those rows keep the glyph and drop the words. Conditions:

1. **The surface already states it in words.** A group header, a page title, a filter chip — something
   a reader passes on the way in. If nothing says it, the label stays.
2. **Only the DEFAULT value goes quiet.** Every state that deviates keeps icon + label at full size,
   which is what turns the exception into a feature: the interesting row is now the loud one. Never
   quiet two values, and never quiet the deviation.
3. **The glyph stays, and it is a SHAPE.** ADR 0006's subject is colour; a distinct icon is a
   non-colour signal and is what still carries the state here. A chip reduced to a tinted dot with no
   glyph is out.
4. **The control does not change.** If the chip is also a control (it usually is), the button, its
   accessible name and its `title` are untouched — dropping words must never drop a capability. Check
   the tap target separately: a label-less pill is ~22px wide, so an `inset-x-0` overlay stops working
   and the box has to be pinned and grown on both axes (§12).
5. **It ends at `md`.** From the tablet band up the row has the room, and the label costs nobody
   anything.

Precedent: `OrderItemStateChip`'s `labelDisplay="exceptional"`, passed only by
`StorePendingProductCard`.

### A text link inside a dense two-line row: expand to the clearance that exists, and say where it stops

`::before` / `::after` expansion (§12) grows a hit area without growing the box, which is what keeps a
dense list dense. It works only into space that holds nothing else, and in a two-line row that space
is asymmetric: the card's own padding above, the inter-line gap below, and then another control.

The product-name link of `StorePendingProductCard` is the worked example. It expands vertically into
10px of card padding and the 4px gap (`before:[inset:-10px_0_-4px]`), which takes it from 22px to
36px, and stops there because line 2 carries the paid mark and the "Añadir precio" link directly
underneath, and overlapping their hit areas trades one defect for a worse one. The 22px is the
element's real height and not an estimate: the link is an `inline-flex` holding one line of
`--text-body`, whose line height is `1.375rem`. Resizing to `min-h-11`
instead was rejected: it grows every row of a 73-row list by a third. **36px is short of the 44px
floor and is written down rather than rounded up in prose** — the honest options were this, a taller
list, or a collision, and the last two are worse. The same shape has a precedent: `StoreGroupHeader`'s
"ver tienda" link reached 44 only because `min-h-9` already gave it 36. `tap-target-guard` sees
neither (its KNOWN LIMITS 1 and 4), so a text link's height is measured by hand, in the browser.

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
- **Padding does not enlarge a fixed-size box.** `p-*` (or a negative `-m-*` meant to compensate for it) inside an element that also carries `size-*` / explicit `h-* w-*` has no effect on the hit area: the box's width and height are already pinned, so the padding is consumed by the box, not added around it, and the negative margin only repositions the same fixed box. To grow the tap target of a small icon control without changing its visual size, expand the hit area outward instead, the way `IconButton` (`src/components/core/IconButton.tsx`) does: a `relative` button with `before:absolute before:[inset:-Npx] before:content-['']`, sized so the box plus `2N`px reaches ≥44×44 on mobile.
- **Two `::before`-expanded controls need `2N` between their boxes, or one of them silently loses.** The expansion is invisible, so nothing on screen shows the collision: with `inset:-Npx` on each, any clearance under `2N` means the two pseudo-elements overlap, and in the overlap the control **later in the DOM** takes the whole contested band (both are `position: relative` with `z-index: auto`, so paint order decides). The earlier control keeps its visible size and loses the hit area it was written to have, which is exactly the failure the expansion existed to prevent. Measure the clearance between the two **boxes**, not between what you can see, and make it an explicit `gap`/margin rather than a value that depends on a line box or a descender. This bites hardest when a control moves to its own line on mobile: a `mt-1` between rows is 4px, not 16px. Precedent: `StorePaymentRow`'s delete button and breakdown toggle, which stay side by side on one line at both breakpoints for this reason (on desktop `md:before:inset-0` removes the expansion, so the tighter desktop gap is fine).
- **A non-square box needs a per-axis inset, not one number.** `inset:-Npx` is shorthand for all four sides, so applying the value that fixes the short axis overshoots the long one and eats clearance the neighbours were counting on. Use the two-value form: the 38×22 switch track in `InlineSwitch` reaches 44×44 with `before:[inset:-11px_-3px]` (22 + 2×11 tall, 38 + 2×3 wide), not with `inset:-11px`.
- **A control that only ever renders on desktop is out of scope.** The 44×44 floor is the touch floor, and every expansion in this repo is dropped from `md:` up with `md:before:inset-0`. A button inside a `hidden … lg:block` container (`OrdersTable`, `DeliveriesTable`, the PUSH `Sidebar`'s 40px nav rows) is never seen by a touch pointer, so it needs no expansion. These exceptions are recorded, with their reason, in `DELIBERATELY_SMALL` in `src/test/tap-target-guard.test.ts`.
- **A dense cluster is RESIZED, never expanded.** This is the general rule; the `::before` recipe above is the special case that holds only while the space around a control is dead space. As soon as the nearest neighbour is another control — a segment, a chevron, a chip in the row above, the same button one row down — no inset is safe, because two expansions closer than `2N` overlap and the later one in the DOM silently takes the whole band. The fix that **cannot** mis-target is to make the BOX itself 44×44 for the band where a finger uses it and drop back to the compact box at the breakpoint where the pointer gets precise: two boxes in normal flow cannot overlap at all, so there is no contested band to lose. Three spelling rules, each of which has already burned someone:
  - **Write the touch size as the UNPREFIXED utility and the compact one behind the variant** — `size-11 md:size-[18px]`, never `max-md:size-11`. Base-is-mobile is the model `src/test/tap-target-guard.test.ts` reads, so the `max-*` spelling of identical geometry is invisible to it.
  - **Express the compact end as a box too** (`md:size-[18px]`), not as padding. `size-11 … md:p-0.5` trips the "padding inside a fixed box" check on a control that is in fact correct — that checker strips variants before matching.
  - **Pick the breakpoint from where the control renders, not from a habit.** `md` for a control that exists at every width; `lg` for one whose component only mounts it from 768px up (`StoreCombobox`, `OrderCurrencyField`, `OrderItemsGrid` all defer to a `MobilePicker`/card list below `md`), because then the 768-1023px tablet band _is_ its touch band. `lg` is the width this repo already treats as "no finger will touch this" in `DELIBERATELY_SMALL`.

  Precedent: `core/ThemeToggle.tsx`'s segments (`h-11 w-11 md:h-[26px] md:w-[26px]`, 2px apart), plus every case below.

- **A box may grow into its OWN parent's padding; it may never grow into a sibling's clearance.** A 44px box pulled out with a negative margin equal to the parent's padding (`-my-[var(--space-3)] -mr-[var(--space-4)]` against a field trigger's `py-3 px-4`; `-my-3 -mr-3` against a toast's `py-3 px-4`) reaches the surface's edge, costs nothing in layout, and takes nothing from anyone: padding is dead space, and the parent underneath is this control's fallback, not its peer. This is **not** the "padding inside a fixed box" antipattern — there the box was pinned and the padding was expected to grow it; here the box really is 44px and the margin only decides where it sits.

- **A field's trailing cluster holds one touch target.** A 46px field (`h-[2.875rem]`) clears a 44px control vertically with 1px a side; horizontally it does not clear two, and a clear button `gap-1` from a chevron is the exact shape no pseudo can fix. Resolve it by rank rather than by geometry: the **clear** is the only real control, because nothing else performs it, while the chevron / calendar glyph is **decoration** — the field body itself opens the list or the picker, and it is the largest target on the screen. So below the compact breakpoint the cluster shows exactly one thing: the clear when there is a value, the state icon when there is not, which is when that affordance still has something to say. Measured on `SearchableSelect`: `18 + 4 + 20 + 8 = 50px` of cluster before, `44 + 8 = 52px` after — the target's area grows ~6× and the field gives up 2px. Applied in `Select`, `SearchableSelect`, `DateInput`, `DateRangePickerInput`, `StoreCombobox` and `OrderCurrencyField`; on the last two the toggle is already `aria-hidden`/`tabIndex={-1}`, which is the proof it was decoration all along.

- **A removable chip is 44px tall on touch, and its remove reaches the chip's own edges.** Chips wrap at `gap-1`/`gap-1.5`, so vertical clearance between one row's remove and the next row's is 4-6px against the 22px each would need — the case where an expansion does not merely overlap but **removes a different chip**. Size the remove instead (`size-11`, `md:` back to the 10-16px glyph box) and cancel the chip's own padding with the matching negative margins, so the chip lands at exactly 44px tall rather than 48 and gains no width beyond the target. Applied in `Combobox`, `MultiTagAutocomplete` and `FilterDrawer`. The negative margins are coupled to `Chip`'s padding (`px-[9px] py-[3px]` at `size="md"`, `px-[var(--space-2)] py-[var(--space-0_5)]` at `size="sm"`) — change one and change the other.

- **A dense grid is fixed by its row pitch, not by a pseudo.** The `::before` recipe assumes the neighbour worth protecting is beside the control; in a table it is the same control one row down, so two expansions overlap and paint order hands the band to the LOWER row: an edge tap reorders or deletes the wrong item. `OrderItemsGrid`'s 14px drag handle and 21px delete were the case — ~32-36px rows, 11-15px of pitch against the 11.5px each side they needed. Both are 44×44 boxes now for the grid's touch band (768-1023px; below that its callers render `OrderItemsMobileList` instead) and go back to 14px/21px from `lg`, which relaxes the row pitch to ~48px as a consequence rather than as a separate change. The handle column follows (`w-[50px] lg:w-6`), and the grid's `overflow-x-auto` wrapper absorbs the ~40px the two columns gain.

- **A clipping ancestor rules the pseudo out entirely, and a box back in.** `overflow-hidden` anywhere above a control removes its `::before` from hit-testing — the clip is at the padding box, so a pseudo at a negative inset is simply not there for the pointer. `Toast` is the case: its root clips the countdown bar to the rounded corners. The dismiss is a 44×44 box with `-my-3 -mr-3`, exactly the toast's own padding, so it spans the toast's full height, stays inside the clip, and leaves both the toast's height and the message's width untouched at every breakpoint — which is why it has no compact variant to drop back to. `DENSITY_EXCEPTIONS` in the guard, the list of controls that no mechanism can fix, is **empty** as a result; read its header before adding to it.
- **When a control looks too heavy, shrink what it PAINTS, not the box it occupies.** The two are
  routinely the same size and routinely must not be. A box earns its size from layout duties that are
  invisible in a screenshot — the column it aligns to, the tap target it carries, the neighbour it
  keeps at arm's length — and none of those care what is drawn inside it. `PendingProductSelectToggle`
  is the case: its 32px box is what the column-header strip indents its master checkbox by so
  "Producto" stays over the product names, and on touch its 36px box plus a `::before` is the 44px
  target. Making the selected state lighter therefore meant painting a 16px checkbox centred in that
  unchanged box (1024px² of accent down to 256px², check glyph 14px → 10px), not resizing the box —
  which would have slid the whole column left and broken the touch floor in one edit. Two riders:
  pick the smaller paint from an existing token rather than by eye (16px here is exactly
  `Checkbox size="sm"`, the control that heads that very column and the mobile "Marcar todo" strip,
  so the column reads as one object at one size), and expect the crossfade between a full-box glyph
  and a smaller painted control to change size — that is the Gmail avatar-to-checkbox swap and it is
  fine, as long as no box ANIMATES its size.
- **The hit-area pseudo may be `::before` or `::after`, and both count.** The recipe below is written
  with `::before` because `IconButton` uses it, but a component whose paint order matters can only
  spare the other one: `OrderItemStateChip` buys its target with `after:absolute`, because it has to
  paint above the card's own link overlay. `src/test/tap-target-guard.test.ts` accepts either
  (`hasPseudoHitArea`); it hardcoded `before` until 2026-08-13, which meant any `::after`-expanded
  control was one `size-*` away from being reported as an undersized control it is not.
- **A custom-painted checkbox is a `<label>` around a visually hidden `<input>`, and the label is the tap target.** When a control needs full visual freedom (`PendingProductSelectToggle`, the tile that replaced the decorative package icon in the orders "Por tienda" rows), keep a real `<input type="checkbox">` — `Space`, the announced role, the checked state and the accessible name all come free — hide it visually, and let the `<label>` carry the whole box. Two consequences: the label needs the `::before` expansion (or a 44px box) like any other control, and `peer-hover:` does **not** work on a fully hidden peer, so the hover branch is `group-hover:` on the label while `peer-focus-visible:` and `peer-checked:` still key off the input. `src/test/tap-target-guard.test.ts` counts a `<label>` wrapping a checkbox/radio as interactive; it was blind to this shape until 2026-08-13. **Write the box size as a literal inside the tag's `className`** — a size hoisted into a `const box = …` variable is invisible to the guard, and that is how an undersized control ships green.
  - **Do not reach for `sr-only` when the input itself is the click target.** `sr-only` hides via `clip-path: inset(50%)` on a 1×1px box, which zeroes the element's HIT-TESTABLE area, not merely its visible one. A pointing human never notices — clicking anywhere in the label's box activates the input through the browser's native `<label>` association, which never hit-tests the input itself — but a tool that hit-tests the input's own reported box directly (Playwright's `.check()`/`.click()` on that locator) finds `document.elementFromPoint` at the input's center resolving to the `<label>`, forever, regardless of any `pointer-events-none`/stacking cleanup on the layers above it. `PendingProductSelectToggle`'s input instead uses `absolute inset-0 opacity-0`: invisible and the same footprint as the label (so it stays topmost for its own row, never bleeding into a neighbor's), but a real box at its reported position. This is scoped to controls that ARE the click target — an ordinary decorative `sr-only` node (status text, a visually-hidden label for an otherwise-visible control) is never hit-tested directly and is unaffected.
- **`min-h-*` is a real tap target and an invisible one.** A floor under 44px still renders under 44px, and `src/test/tap-target-guard.test.ts` cannot see it: a floor is not a box, and proving the rendered height needs font metrics the scanner does not have (its `KNOWN LIMITS` says so). The "ver tienda" link in `StoreGroupHeader` was 36px tall from `min-h-9` for exactly this reason and was found by reading the file. When only the height is short, expand on one axis — `before:[inset:-4px_0]` — so the fix cannot eat a neighbour's horizontal clearance. Check `min-h-*` controls by hand; the guard will stay green either way.
- When a desktop pattern becomes crowded on tablet/mobile, switch to a dedicated mobile pattern instead of forcing the same layout (the adaptive `<Modal>` and `FilterDrawer` already do this).

---

## 13. Accessibility Rules

- Every interactive control has a visible focus treatment.
- Text contrast stays readable in both themes; secondary text must remain readable, not merely decorative.
- Icon-only controls have accessible labels.
- Meaningful images have `alt`; status/feedback messages can be announced (`role="alert"` / `aria-live`) when relevant.
- Associate field errors with their control (`aria-invalid`, `aria-describedby`). When one rule
  invalidates a GROUP of fields but writes its message once (an order-level rule over a block of
  lines, say), point every marked field's `aria-describedby` at that one message. A field that
  announces "invalid" with nothing to explain it is worse than one that is merely wrong.
- **A live region holds text, not a toolbar, and never re-reads on every keystroke.** A running
  total that changes as the user types must not itself be `role="status"`: put the announcement in
  a separate `sr-only` `role="status" aria-live="polite"` node, debounced until typing settles, and
  leave the visible bar (with its buttons) out of it. `role="status"` implies `aria-atomic`, so a
  live container re-reads its buttons' labels too, and nesting a `role="alert"` inside it makes
  several readers announce twice. Precedent: `StorePaymentAllocationPanel`'s totals bar.
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

### A figure printed in a list partitions its quantity, never replicates it ([ADR 0027](decisions/0027-allocation-list-figures-partition-never-replicate.md))

A list is read in aggregate, so a per-row figure has to survive being summed. For every quantity `Q` a list names, the printed figures derived from `Q` must add up to at most `Q`. Amount fields the user fills pass this by construction (validation caps their sum); a per-row **ceiling** does not, because rows share their ceiling and N rows then advertise N times the room that exists. The store payment sheet printed each product's remaining base against an order that could take a fifth of their sum, and printing the live ceiling instead would have replaced 5,4x with 2,0x, not fixed it.

**Name `Q` exactly, and never the nearest total on screen.** The invariant is only as true as the quantity it is written against. Two figures that look interchangeable on a screen are routinely different magnitudes — the store payment sheet's per-order balances sum to what those orders can still take (money **declared**), which is greater than or equal to the store's debt (money **paid**), and equal to it only while every payment is fully assigned, which is precisely what that sheet exists to let the user not do. State the sum against the quantity the figures are computed from, and when a neighbouring total looks like it should match, write down why it does not.

**One calculation, stated once.** Where a control writes a computed amount, that amount is the only figure attached to it, and its accessible name is where it is stated (recomputed live). A second, "informational" figure beside the control is how the two drift apart: the number the row shows stops being the number the row writes, and nothing fails.

**Name the shared budget once, where it belongs.** The constraint several rows compete for is a property of the group, not of the row: state it once per group (on the group's first row when the list has no group container), from pre-draft data so it cannot become a derived figure by the back door. Give it **its own line**, not a slot in the row's metadata line: a group-level figure sharing a line with a row-level control reads as a second figure for that control, and the mobile layout is where this bites, because that is where a trailing cell folds onto the metadata line. Compare [ADR 0026](decisions/0026-declared-product-payment-coverage.md) §6, which names order-level money per order rather than spreading it across products.

**A control that cannot act still has to say why, and `disabled` is how that sentence gets lost.** `disabled` removes the control from the tab order (its accessible name is never read) and suppresses pointer events (a `title` tooltip never opens, and touch had no hover anyway), so a reason parked in `title` on a disabled button is copy no user of any input device can reach. Use `aria-disabled` plus a no-op handler, put the reason in `aria-describedby`, and state the **visible** half once per scope it belongs to — a payment-level reason above the list, a group-level one on the group's message anchor — never once per row. Precedent: the fill shortcut in `StorePaymentAllocationRow`.

**Two surfaces hold this rule, and the second is where it bites hardest.** The store payment sheet's
allocation list came first; the order detail's payment breakdown panel
([ADR 0028](decisions/0028-order-scoped-payment-breakdown.md)) adopts it whole. On a single-order
list the temptation is stronger and the failure bigger: a per-row ceiling there is a genuinely
correct number line by line, and on an order of six products with no price captured an empty draft
makes every one of those ceilings the WHOLE payment, so the list advertises six times the money that
exists. The fix is the same shape on both: no payment-derived figure inside the list, the budget
named once above it, and the fill control reduced to the word "Máx." with the live amount in its
accessible name.

---

## 15. Progress Meters

There is exactly one track + fill progress meter in the app: `ProgressBar` (`src/components/core/ProgressBar.tsx`). Its consumers are the order detail hero, the delivery detail hero, the orders store-view product rows and the store detail's payment progress block. Do not hand-roll a fourth. (`PasswordStrengthMeter` is deliberately outside this: it is a segmented meter with `aria-valuemax={4}`, a different widget with a different contract. Leave it alone.)

**`role="progressbar"`, not `<meter>`.** `<meter>` is semantically the better fit for "a measurement within a range", but it can only be themed through per-engine pseudo-elements (`::-webkit-meter-*`, `::-moz-meter-bar`), which breaks the light/dark token contract. The real accessibility problem was never the role.

**`aria-valuetext` is required, not optional.** A bare `aria-valuenow` makes a screen reader announce "88%", which hides the denominator from those users exactly the way a lone percentage hides it from sighted ones. Every bar passes a full sentence: "1,519.60 PEN pagados de 3,874.60 PEN en pedidos activos, 39 por ciento". The prop is required by the component's type so no consumer can skip it, and it is also where a bar states the scope of what it measures when that scope is narrower than the surrounding card.

**Never show the percentage alone.** The absolute pair the percentage came from must be on screen next to it. A payment bar's denominator moves: recording a new order raises what is committed, so the bar shrinks with nothing un-paid. The absolute pair is what makes that legible instead of alarming. **Both operands carry their currency**, even though it repeats: the pair is read at a glance and next to figures in other currencies, and the operand without a code is the one that gets mistaken for a count.

**No denominator, no bar.** A zero denominator has no ratio, and a track filled anyway reads as "complete" in a shape indistinguishable from real progress. When the set a bar measures is empty, drop the bar **and** the percentage, keep whatever else the block was saying, and put a caption in their place that names why ("Sin pedidos activos"). Dropping the whole block instead is the wrong fix: on the store detail that state is the majority case, and the block still has an answer to give.

**A bar's denominator can be narrower than its card, if it says so.** The store detail's payment bar measures the pedidos activos while the card around it also shows lifetime figures. That is allowed because every figure names its own scope, in the visible caption and in `aria-valuetext`. What is not allowed is two figures that both read as totals and are computed differently; when a real gap opens between them, name it in a line of its own rather than leaving the reader to subtract. **A gap has two directions and both need naming.** It is easy to write the line for the direction that prompted it and drop the other as "already covered elsewhere"; check that claim against the case that is actually reachable, because the reader hits an unexplained difference just as hard when the headline is smaller than the bar's own arithmetic as when it is bigger.

**Never draw past 100%.** A track filled beyond its own end is a graphical lie. Where a value can exceed its own maximum, the bar must not be the thing that carries it: say it in words plus tone, per [ADR 0006](decisions/0006-color-blindness-icon-label-contract.md). Clamping is not enough on its own if the clamped bar then contradicts the words beside it.

**Endpoints are reserved.** 100% means the remainder is exactly zero and 0% means nothing has been paid; everything in between is floored into `[1, 99]`. Rounding puts "100%" next to a live balance and "0%" next to money already handed over.

**Mechanics (do not "modernize" these).** The fill is a gradient (`--accent` → `--accent-warm`, or `--warning` → `--accent-warm` for the overdue/unpaid family), never a flat token. It moves with `transform: scaleX` and `transition-transform`, never `width`: the track clips the rounded ends, so the fill itself stays square-edged, because scaling a `rounded-full` fill distorts its corners. A consumer that drives the value frame by frame (`useAnimatedNumber`) passes `transition={false}`, or the CSS easing lags behind the counter beside it.

Sizes: `xs` = 3px for dense list rows, `sm` = 4px for cards and heroes. The track is `color-mix(in oklch, var(--text-primary) 10%, transparent)`; width always comes from the caller.

---

## 16. Trend Charts

The dashboard's "Tendencias" section is the system's only charting surface, and its rules are written here rather than per-screen because the next analytical view must inherit them. The canonical implementation is `DashboardLineChart` (hand-rolled SVG, no charting dependency, per `ui-libs-policy.mdc`); the screen-level record is [`fdd-06-dashboard.md`](../product/prd-02-collector-app/frd-06-dashboard/fdd-06-dashboard.md). Series colors come from the semantic tokens, not from a categorical palette (see [visual-foundations.md → Chart series colors](visual-foundations.md)).

### The chart renders 1:1 (measured `viewBox`)

**A chart's `viewBox` must track its measured pixel width**, so one SVG user unit is one CSS pixel and a declared `font-size={12}` really renders at 12px. The component measures its container with a `ResizeObserver` and sets `viewBox="0 0 {measuredWidth} 220"`.

Do **not** give a chart a fixed `viewBox` plus `width:100%`. That scales _everything_ with the container, type included: the previous fixed `600×220` viewBox rendered axis labels at 5.5px in a three-column grid and 5.0px on a 375px phone. There is no CSS escape hatch, `vector-effect: non-scaling-size` is unimplemented in every browser, which is why Highcharts, ECharts, Recharts, nivo, Vega and Observable Plot all measure instead. A measured width of `0` means "not laid out" (`display:none`, jsdom), never "0px wide", and must be discarded in favour of a fallback so the plot cannot collapse.

Everything below depends on this contract. Break it and every pixel constant in the chart silently becomes a ratio.

### 12px is the floor for chart text

Axis labels, legends, and tooltips never go below **12px**. IBM Carbon's type scale has no token under it, Atlassian treats 12px as fine-print-only, the Urban Institute style guide specifies 12px for axis labels, and Chart.js defaults there. Datawrapper's rule is ">12px", with the explicit instruction that when the labels do not fit you **enlarge the chart rather than shrink the type**, which is what the column rule below does.

### Column count comes from a minimum card width, not from breakpoints

A grid of charts sizes itself by **minimum card width**:

```
grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))]
```

Viewport breakpoints are the wrong input, because the content column also narrows when the app sidebar expands: a `md:grid-cols-2` rule handed an 820px tablet two 320px plots, exactly the cramping the layout exists to prevent. `min(100%, …)` keeps a single card from overflowing a container narrower than the floor.

**460px** is the floor for a month-bucketed line: it leaves ~428px of plot, enough for twelve 12px month labels. Measured results at that value: a 1440px viewport resolves to 2 columns at 478px of plot, 820px to 1 column at 692px, and 375px to 1 column at 271px with no horizontal overflow. Because the dashboard content column is capped at `max-w-6xl` (1152px), the rule never resolves to three columns, which is the intent.

Precedent for deriving columns from a minimum panel width: Grafana's auto-grid uses a 448px standard column width (capped at three), SAP Fiori sets a 20rem/320px minimum chart-card width, and Datawrapper's small-multiples "auto" mode derives its column count from a minimum panel size.

### Aspect ratio: aim near 2:1

At two columns a trend plot is ~478×220 ≈ **2.18:1**, inside the band between Tufte's ~1.5:1 and Cleveland's banking-to-45° ~2.5:1, and near Observable Plot's 1.62 default. Both ends of that band are real failures, not preferences: a full-width single column would be 1008×220 ≈ 4.6:1, and Heer & Agrawala ("Multi-Scale Banking to 45°", IEEE InfoVis 2006) show with the Mauna Loa CO₂ series that a very wide ratio (7.87) makes the low-frequency trend bend hard to see. The old three-column layout was ~1.37:1, cramped the other way.

### Density-aware markers and labels

Decoration that stops being readable is removed, never overlapped:

- **Point markers** are dropped once the spacing between points falls under `MIN_MARKER_SPACING` (14px), because the markers are 8px across and start touching. Below the threshold only the **hovered** point keeps a marker, so the crosshair still has a target.
- **Axis labels** thin to the capacity implied by `MIN_LABEL_SPACING` (36px), keeping evenly spaced ticks and **always the final month**, so the series' most recent bucket is never anonymous.

### A time axis prints the year when the range spans one

When a range crosses a year boundary, the axis prints the **year** at the first tick and wherever the year changes, as a `<tspan>` under the month, so a multi-year range never shows "ago … ago" for two different years. The hover tooltip header carries the year on the same condition.

### The trailing-card rule (house rule)

**When a grid of cards would leave the last row half empty, add a card rather than stretch the trailing one full width.** No design system publishes guidance on this, so it is a house rule and named as one.

The reasoning is Gestalt: NN/g's similarity principle holds that an item differing in size within a group reads as _not belonging to_ the group, and their visual-design principles hold that bigger reads as more important. Stretching the trailing card would therefore say "this chart is a different kind of thing, and more important than its siblings", which is false. The dashboard's trends section resolves this by shipping a fourth chart (comprometido por mes) so the two-column grid closes evenly.

If no honest fourth metric exists, leave the gap. Inventing a chart to fill space is worse than white space.

---

## 17. Design System Usage Rules (anti-patterns)

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
- Give a chart a fixed `viewBox` plus `width:100%` — that scales the type along with the drawing; measure the container instead (§16).
- Size a grid of charts by viewport breakpoints, or stretch a trailing card to fill a half-empty row (§16).
- Hand-roll a track + fill progress bar, animate one with `width`, round a progress figure to 100% while a balance is still live, or show a progress percentage with no absolute pair beside it — use `ProgressBar` and read §15.
- Move a long, explorable list into the right rail because it is "viewer-scoped". Do the width arithmetic first (§1): the rail leaves 278px, and the split is by shape, not by subject.
