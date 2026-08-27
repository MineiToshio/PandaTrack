---
id: WO-04
type: WORK_ORDER
slug: progreso-section-and-dashboard-widget
title: Progreso Section and Dashboard Widget
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0021
source_issue: 143
implementation_status: IN_PROGRESS
last_updated: 2026-08-26
---

# WO-04 Progreso Section and Dashboard Widget

## Summary

Ship the collector-facing `Progreso` section: the route, its three tabs (`Resumen`, `Medallas`, `Rangos`), the URL-persisted active tab, the dashboard's `"Tu rango"` widget, and the navigation entry. Depends on [`WO-03`](wo-03-rank-ladder.md) for the ladder data and [`WO-05`](wo-05-medal-album.md) for the album data, since this is the first slice that renders the whole engine end to end. Writes the ADR for the phased social surface.

## In Scope

- route `src/app/[locale]/(app)/progress/page.tsx`: the section shell, opened on `Resumen`
- the three-tab contract: `tab` URL param, omitted when it equals the default (`Resumen`), following the same pattern already used by orders/stores/deliveries list filters (`FR-12-30`)
- `getProgressSummary(userId)` query (in `src/lib/data/progression/progressionQueries.ts`, extending `WO-01`'s module): current/highest rank index and key, `"Rango N de 10"`, derived total, next threshold, points missing, merit-lock counts once rank 6+, this month's point breakdown by rule group, cache age
- triggering `recomputeUserProgress` (from `WO-01`) when `lastRecomputedAt` is older than six hours, before rendering `Resumen` (`FR-12-11`); render cached values immediately while a stale recompute is in flight, with a "may be a few minutes old" notice (`PROGRESS_RECOMPUTE_BUSY`)
- `"Resumen"` tab content: rank hero (emblem placeholder, name, `"Rango N de 10"`), progress bar to next threshold, merit-lock counter (rank 6+), this month's breakdown, the permanent honesty line (`FR-12-41`: `"Los puntos miden tu registro, no tu gasto."`)
- `"Rangos"` tab content: the full ten-rank ladder from `WO-03`, current rank marked, past ranks legible, future ranks in silhouette with threshold and lore visible (not hidden, `FR-12-33`)
- the disabled comparison placeholder (`FR-12-39`): `"Próximamente: compara con otros coleccionistas."`, no link, no opt-in, collects nothing
- the honest empty state before any points exist (`FR-12-40`): `"Todavía no tienes puntos. Registra tu primer pedido y empieza."`
- dashboard widget `src/app/[locale]/(app)/dashboard/_components/DashboardProgressWidget.tsx`: compact strip (emblem, rank name, `"Rango N de 10"`, bar, points missing, last few unlocked medals), one link into `/progress`, no mutation (`FR-12-35`, `FR-06-15`)
- navigation entry into `Progreso`, hidden entirely while `ProgressionSettings.hideProgression` is `true` (`FR-12-38`, `AC-12-13`'s navigation-absence half; the toggle's write path itself is `WO-06`)
- `Progreso` section unreachable (including direct URL access) while `hideProgression` is `true`
- `ADR 0039`, the phased social surface (`FR-12-39`, `BR-12-21`)
- PostHog events wired: `progress_viewed` (carries active tab), `progress_tab_changed`, `progress_rank_ladder_viewed`, `progress_widget_clicked`

## Out of Scope

- the `"Medallas"` tab's content and the medal detail subview (belongs to `WO-05`; this slice renders the tab shell and routes into it, `WO-05` fills the panel)
- the unlock toast and rank celebration modal (belongs to `WO-06`)
- the settings hide toggle and purge action UI (belongs to `WO-06`; this slice only reads `hideProgression`, it does not write it)
- the Notion backfill's welcome celebration (belongs to `WO-06`)

## Requirements

- `FR-12-30` through `FR-12-33` (section, three tabs, URL persistence, ladder tab content)
- `FR-12-35` (dashboard widget)
- `FR-12-38` (nav entry and section hidden while `hideProgression` is on, read-only half)
- `FR-12-39` (disabled comparison placeholder)
- `FR-12-40` (honest empty state)
- `FR-12-41` (permanent honesty line)
- `FR-12-48` (the rules explainer, a subview of `Resumen` reached from a quiet inline link beside the honesty line; added 2026-08-26)
- `FR-06-15` (dashboard stays read-only)
- `BR-12-02` (one collector's data is never shown to another; every query here is scoped to the session `userId`, with no user parameter anywhere in the route contract)
- `BR-12-10` (no streaks/leagues/annual goals rendered)
- `BR-12-21` (the placeholder collects nothing, no opt-in preference)

## Blueprints

- [`BP-01`](../bp-01-collector-progression.md) — the `Progreso` section data contract (`getProgressSummary`), the recompute-on-open behavior
- [`FRD-12` Screens and Data Contract](../../frd-12-collector-progression.md#screens-and-data-contract) — route shapes, states, and the "no user parameter anywhere" rule this slice must satisfy

## Route and State Notes

- All routes live under `/{locale}/(app)/progress`, authenticated, scoped to the session user; there is no user-id route param anywhere, so a progression surface belonging to another user is not addressable (Screens and Data Contract, `FRD-12`).
- Loading state: skeleton, matching the existing dashboard skeleton pattern (`DashboardLoadingSkeleton.tsx`) rather than inventing a new one.
- The recompute-in-progress notice renders over cached values, never blocking the page (Screens and Data Contract).
- The whole section, including its nav entry, is unreachable while `hideProgression` is on: this slice implements the read side of that gate (a server-side redirect or 404-equivalent when the section is requested directly), while `WO-06` implements the toggle that flips the flag.
- Navigation is implemented against the app's real navigation shell, not against the FDD prototype's chrome. The prototype's bottom tab bar on mobile does not exist in the app: the real mobile navigation is `AppNavDrawer` (`src/app/[locale]/(app)/_components/AppLayout/AppNavDrawer.tsx`), a slide-out drawer opened from the header, not a persistent bottom bar. The prototype also drops `Entregas` from its sidebar to make room for `Progreso`; that removal is not an option here, since `Entregas` remains a first-class app entry.
- **Navigation decision.** `Progreso` is appended as a new, top-level primary entry, after `Entregas` and before `Ajustes`, with no reordering or visual demotion of any existing entry. Concretely: add `"progress"` to the `NavItemId` union and to `PRIMARY_NAV_ITEM_IDS` in `src/app/[locale]/(app)/_components/AppLayout/navigationConfig.ts` (today: `["dashboard", "stores", "orders", "deliveries"]`, four items feeding `getPrivateAppNavItems()`), add its icon to `NAV_ICON_MAP` in both `AppNavDrawer.tsx` (which renders the four primary items plus, for admins, a grouped `Administración` section) and `src/components/modules/Sidebar.tsx` (the desktop persistent sidebar, which already renders a fifth `settings` entry with its own `Settings` icon, so it goes to six), and add the `nav.progress` label key to `src/i18n/locales/{es,en}/app-layout.json`. A `Trophy` or `Award` icon (`lucide-react`, per `.agents/rules/icons.mdc`) is recommended over a medal glyph, since medal iconography is reserved for the album's own rarity chips (`ADR 0036`).
  - **Why append, not group or reorder.** Grouping `Progreso` into a secondary/utility section (mirroring the admin group) would under-signal a primary, always-visible surface every collector has, unlike admin tooling gated to a few accounts. Reordering or demoting an existing entry has no product justification and would break muscle memory built on the current five-item order.
  - **Mobile impact: negligible.** Neither real nav surface is a fixed-width horizontal bar with a hard slot ceiling. `AppNavDrawer` is a vertical, scrollable slide-out list (`overflow-y-auto`); a sixth link is one more row, not a layout risk. The desktop `Sidebar` is likewise a vertical `flex-col` list, already handling a variable-length admin group beneath the primary items. The FDD prototype's five-item bottom-tab-bar constraint (`fdd-12-collector-progression.md § 2.1`) does not apply to this app's real chrome.

## Technical Notes

- **Tab persistence.** The selection is carried by the **path**, not by a `?tab=` query parameter, and the module is `src/app/[locale]/(app)/progress/_utils/progressTabs.ts` (`resolveProgressTab(pathname)` + `buildProgressTabHref(locale, tab)`) rather than the originally planned `progressTabParams.ts`. **Reason, decided during implementation:** `WO-05` had already shipped the album as its own route, `/progress/medals`, with the medal detail hanging off it at `/progress/medals/[medalKey]`. A `?tab=medallas` parameter on top of that would have given the same panel two addresses and left the detail subview parented to neither, so the album would have had to be either duplicated or reached by a link that leaves the tab bar's own contract. The observable contract `FR-12-30` states is unchanged and no FRD-level edit is needed: the active tab is still persisted in the URL, the default (`Resumen`) still writes no segment of its own and lives at the bare `/progress`, an unknown segment still falls back to the default instead of erroring, and the medal detail keeps its parent tab marked. The three routes are `/progress` (`Resumen`), `/progress/medals` (`Medallas`, already shipped) and `/progress/ranks` (`Rangos`).
- **Recompute-on-open.** `recomputeUserProgress` (`WO-01`) must run when `lastRecomputedAt` is older than six hours, without blocking the page on its result (`FR-12-11`, Route and State Notes above). This slice triggers it with Next's `after()` (`next/server`, stable on the Next `16.2.10` this repo runs): the page's server component reads the cached `UserProgress` row for the immediate render, then schedules `after(() => recomputeUserProgress(userId))` so the recompute runs post-response instead of adding latency to the request the collector is waiting on. This is a new pattern for the repo (no other route currently defers work with `after()`); if the deployment target cannot run it reliably, the fallback is a client-side effect that fires a dedicated `triggerProgressRecomputeAction` Server Action after mount, at the cost of one extra round-trip before the "may be a few minutes old" notice can clear. The `PROGRESS_RECOMPUTE_BUSY` notice (Error Contract, `BP-01`) renders whenever `lastRecomputedAt` is stale, regardless of which mechanism is triggering the refresh.
- **Gating while hidden.** The server component calls `notFound()` (`next/navigation`) when `ProgressionSettings.hideProgression` is `true`, for both the section route and any deep link into it, satisfying the "direct request does not render the section" half of `AC-12-13`. This is the first route in the app gated this way; no existing precedent to reconcile against.
- **Dashboard widget slot.** `FR-12-35` fixes the widget's content but not its position in the dashboard's twelve-column grid (`src/app/[locale]/(app)/dashboard/page.tsx`); the FDD explicitly leaves the exact slot as "an open amendment to `fdd-06-dashboard.md`, to be resolved in the same change that ships this widget" (`fdd-12-collector-progression.md § 2.1`). **Decision:** place `DashboardProgressWidget` as a third card in the existing right-hand column stack (`lg:col-span-4`, currently `DashboardBudgetZone` + `DashboardPunctualityZone`), after `DashboardPunctualityZone`. This keeps a non-monetary, non-actionable widget below `ZONA 1 · Caja y obligaciones` (the page's primary decision, decálogo #9 "data is the hero"), matches the FDD's "calm surface, no strong motion" treatment for the dashboard instance of the widget, and reuses the column's existing width rather than spanning full-width like a primary zone. This slice must add the corresponding slot to `fdd-06-dashboard.md`'s dash-grid documentation in the same change (**FRD-06 · `docs/product/prd-02-collector-app/frd-06-dashboard/fdd-06-dashboard.md`**, § 2.1), since that file is the source of truth the FDD itself points at for the amendment.
- **Out of scope: sidebar footer glance.** The prototype shows a persistent `"Tu progreso"` line in the sidebar footer on every screen (`fdd-12-collector-progression.md § 2.1`, "prototype-only, not a named FRD-12 surface"). `FRD-12`'s Surfaces section names exactly four surfaces (section, medal detail, dashboard widget, global overlays) and this is not one of them; it also touches the sidebar's otherwise-fixed structure (`interface-patterns.md § 1`). This slice does not implement it.
- **Loading state.** Reuse the existing `DashboardLoadingSkeleton.tsx` pattern for `/progress`'s own `loading.tsx`, per this WO's own Route and State Notes; no new skeleton primitive.
- **Design tokens.** `docs/design/tokens-css.md` § 12 and `docs/design/visual-foundations.md` (Medal rarity, Rank bands) define the `--rarity-*` and `--rank-band-*` CSS variable families as an approved contract, explicitly not yet declared in `src/app/globals.css`. This slice declares **both** families in `globals.css` (light and dark blocks per the documented values) as part of its work, even though `--rarity-*` is primarily consumed by `WO-05`'s medal chips: `WO-04` is the first slice that renders the whole engine end to end (Rangos tab using `--rank-band-*`, the Medallas tab shell and the dashboard widget's medal tick row touching `--rarity-*`), so declaring both once here avoids `WO-05` re-opening `globals.css` for a family this slice already needs adjacent tokens from. `WO-03` itself ships no UI and must not declare either family.
- **Reused components.** `Tabs` (`src/components/modules/Tabs/Tabs.tsx`) for the three-tab subnav, extended in place for the underline-active recipe if it does not already support it (`fdd-12-collector-progression.md § 2.2`); `ProgressBar` (`src/components/core/ProgressBar.tsx`) for every bar this slice renders (rank hero, dashboard widget, ladder current-rung); no new hand-rolled meter or tab bar.

## As Built

Recorded during implementation, so the next reader does not have to diff the code against the plan:

- **Three routes, not one route with a param.** See the Tab persistence note above. `/progress/ranks` is new; `/progress/medals` was already shipped by `WO-05`.
- **The gate lives in the section layout.** `src/app/[locale]/(app)/progress/layout.tsx` reads `getProgressionVisibility(userId)` and calls `notFound()`, so every current and future page under `/progress` inherits it and none of them can forget to ask. The nav and the dashboard widget read the same function server-side; `showProgression` is threaded through `AppLayout` into `Sidebar` and `AppNavDrawer`, and `getPrivateAppNavItems`/`getAllNavItems` take the flag so one filter serves both surfaces.
- **`Tabs` was extended in place**, as this order required, rather than forked: it gained an `underline` variant for the in-page subnav recipe and optional `href` items that render real links (a tab that is its own URL has to survive a middle click and a bookmark). `onChange` still fires on selection in both recipes, which is what carries `progress_tab_changed` without wrapping the bar in a click-delegating container.
- **`RankEmblem` (`src/components/core/RankEmblem.tsx`) is new**, and is registered in `docs/design/components.md`. It shipped with the same sober placeholder `MedalStage` used for medal art (plate, band ring, the rank numeral in the mono face) rather than ten guessed crests. It draws no animation of its own, which is what lets the dashboard instance be calm without an override. **Artwork landed 2026-08-25** (`rank-art-guide.md` §9): the ten emblems live in `public/ranks/` and the component resolves them by convention through `resolveRankArtSrc(rankIndex)`, so no call site and no catalogue row changed. With the art in place the numeral left the plate (every surface here already prints `"Rango N de 10"` beside it), the band ring became the plate's own border, and a locked rank renders as its real artwork desaturated with no padlock. One behaviour change followed in `RankLadder`: the summit takes the warm `top` band only once it is reached, instead of unconditionally, so rank 10 is not the single emblem shown in full colour above a desaturated rank 9.
- **No per-rank reached date is rendered.** The prototype's `"alcanzado el 21 jul 2026"` line has no data behind it: nothing in the schema stores when a rank was reached (`UserProgress` keeps only `highestRankIndex`). The conquered rungs therefore show the `Conquistado` label and a check, and no date. Storing the date would be a schema change and belongs to its own order.
- **The ladder's spine is a per-rung band strip**, not the prototype's absolutely-positioned timeline with dots. The prototype's offsets are hand-tuned pixel values that break inside the mobile disclosure and at 320px; a 3px strip on each rung's leading edge, painted with the rung's own `--rank-band-*` token, carries the same information at every width.
- **The mobile disclosure renders its collapsed band twice**, once inside `<details>` (`md:hidden`) and once flat (`hidden md:flex`), because CSS cannot force a `<details>` open at a breakpoint. Exactly one is displayed at any width, and every threshold stays reachable either way (`FR-12-33`).
- **A held secret medal is named on every surface**, including the dashboard tick row, matching the album's own `isMedalRevealed` rule: secrecy ends at the unlock (`FR-12-25`), and a second, stricter rule for the same medal on one surface would be a bug waiting to be reported as one.
- **The rules explainer shipped as a subview, not a fourth tab** (2026-08-26, `FR-12-48`, `BR-12-22`). `/{locale}/progress/how-it-works` renders six cards, each stating one rule and, beneath it, the reason that rule exists; the way in is a quiet inline accent link in the `Puntos de este mes` card footer, beside the honesty line. A tab was rejected because it would rank a document read once with the album and the ladder, which are read every visit; a modal was rejected because a page of prose has to be linkable and would become a full-height scrolling sheet on mobile. The page loads no collector data, so it needs no query, no cache and no state. What it publishes is the rule and its reason; every figure of the point table stays reserved, guarded by `howItWorksCopy.test.ts`, which fails on any digit under `progress.howItWorks`. The block catalogue lives in `_utils/howItWorksBlocks.ts` so adding a seventh rule has to bring its copy in both locales.
- **`applyCapsDetailed` was added to `recompute.ts`** so the monthly breakdown can report what each entry actually contributed. `applyCaps` now delegates to it, so there is still exactly one cap implementation.

## Security Notes

- `getProgressSummary(userId)` and every other query this slice adds take `userId` from the authenticated session only; the route contract carries no user-id parameter anywhere, so a progression surface belonging to another user is not addressable by URL (`BR-12-02`, Route and State Notes above).
- The `hideProgression` gate (`notFound()` on direct access) is a server-side check on every request to `/progress`, not a client-side UI hide; a collector who disables the switch cannot reach the section by guessing or bookmarking the URL.
- The dashboard widget and the nav entry read `hideProgression` server-side before rendering, consistent with the gate above; neither renders a flash of the hidden state on the client.

## Assumptions

- `ADR 0039` is authored by this slice, continuing `BP-01`'s numbering plan, and documents the phased social surface decision already settled by `FR-12-39`/`BR-12-21`: the disabled placeholder ships now, a future comparison FRD needs the preconditions listed in `frd-12-collector-progression.md`'s Out of Scope section (50 opted-in users, age gate, Ley 29733 consent, real deletion, a formally constituted operator).
- `src/i18n/locales/{es,en}/progress.json` already exists by the time this slice starts (created by `WO-03` for the `ranks.*` keys); this slice extends the same file with `tabs.*`, `resumen.*`, `rangos.*`, `widget.*`, and the honesty/placeholder/empty-state copy keys, rather than opening a second namespace.
- The `POSTHOG_EVENTS.PROGRESSION` group (`src/lib/constants.ts`) does not exist yet; this slice creates it and adds the four events named in Summary (`PROGRESS_VIEWED`, `PROGRESS_TAB_CHANGED`, `PROGRESS_RANK_LADDER_VIEWED`, `PROGRESS_WIDGET_CLICKED`), following the same nested-group shape as `POSTHOG_EVENTS.DASHBOARD` and `POSTHOG_EVENTS.DELIVERY`.

## Analytics

- `progress_viewed`: fired on `/progress` render, carries `{ active_tab }`.
- `progress_tab_changed`: fired when the `tab` URL param changes, carries `{ from_tab, to_tab }`.
- `progress_rank_ladder_viewed`: fired when the `"Rangos"` tab's ladder becomes visible (tab activation, not scroll), carries `{ current_rank_index }`.
- `progress_how_it_works_viewed`: fired once per mount of the rules explainer, with no properties. The page is identical for every collector, so the only thing worth counting is how often anybody goes looking for the rules.
- `progress_widget_clicked`: fired on the dashboard widget's click-through, carries `{ current_rank_index }`, consistent with other dashboard zone-link events (`dashboard_top_store_cta_clicked`, `dashboard_reconcile_cta_clicked`) already using `data-ph-event`/`data-ph-props`.
- The existing `app_shell_nav_clicked` event already fires for every primary nav entry (`AppNavDrawer.tsx`, `Sidebar.tsx`) with `{ destination, navigation_level }`; the new `"progress"` `NavItemId` is covered automatically once added to `navigationConfig.ts`, no new event needed for the nav click itself.

## E2E Acceptance Tests

- Given a collector with existing progression data opens `/progress`
- When the page loads
- Then it renders on the `"Resumen"` tab by default with no `tab` param in the URL, showing the rank hero, `"Rango N de 10"`, the progress bar, this month's breakdown, and the permanent honesty line

- Given the collector switches to the `"Rangos"` tab
- When the tab changes
- Then the URL gains `?tab=rangos` (or the section's chosen param value), the full ten-rank ladder renders with future ranks in silhouette but their threshold and lore visible, and switching back to `"Resumen"` removes the param

- Given a collector with zero ledger entries
- When they open `/progress`
- Then the empty-state copy renders instead of a zero-value dashboard, and the album (rendered by `WO-05`'s content inside this slice's tab shell) shows `"0 de 12"`

- Given a collector enables `"Ocultar mi progresión"` (state written by `WO-06`, read by this slice)
- When they navigate the app
- Then the `Progreso` nav entry and the dashboard widget are both absent, and a direct request to `/progress` does not render the section (`AC-12-13`, read-only half)

- Given the dashboard widget is visible
- When the collector clicks it
- Then they land on `/progress` on the `"Resumen"` tab, and `progress_widget_clicked` fires

## Unit Test Matrix

### `progressTabs.test.ts`

| Scenario                               | Expected                                           |
| -------------------------------------- | -------------------------------------------------- |
| `/{locale}/progress`                   | resolves to `"summary"` (default)                  |
| `/{locale}/progress/ranks`             | resolves to `"ranks"`                              |
| `/{locale}/progress/medals`            | resolves to `"medals"`                             |
| `/{locale}/progress/medals/[medalKey]` | still resolves to `"medals"` (the parent tab)      |
| An unknown segment                     | falls back to `"summary"`, never throws            |
| Building an href for the default tab   | writes no segment of its own, `/{locale}/progress` |
| Building an href for a non-default tab | writes `/{locale}/progress/<segment>`              |
| Round trip                             | every href it builds resolves back to its own tab  |

### `getProgressSummary` (integration-level, `progressionQueries.test.ts`)

| Scenario                               | Expected                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cached row present                     | the cached total and rank are reported, never a total re-derived behind the collector's back |
| Bar between two thresholds             | progress is measured across the current rung, not from zero                                  |
| An entry in an older civil month       | counted in the total, absent from this month's breakdown                                     |
| A points cap truncating the last entry | the breakdown reports the CREDITED figure, not the face value                                |
| Zero ledger entries                    | `hasPoints` is `false`, so the page renders the empty state rather than a zero-value layout  |
| `lastRecomputedAt` older than 6 hours  | `stale` is `true`, which is what schedules `after(() => recomputeUserProgress(...))`         |
| `lastRecomputedAt` within 6 hours      | `stale` is `false`, no recompute scheduled                                                   |
| Current rank below 6                   | `meritLock` is `null`                                                                        |
| Current rank 6+                        | `meritLock` points at the next merit-locked rank above, with its live denominator            |

### Rules explainer (`HowItWorksLink.test.tsx`, `HowItWorksGuide.test.tsx`, `howItWorksCopy.test.ts`)

| Scenario                                              | Expected                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| The entry link rendered for a locale                  | href is `/{locale}/progress/how-it-works`, never the unprefixed path            |
| The trailing arrow of the entry link                  | stays out of the link's accessible name                                         |
| The guide rendered with the six blocks                | six level-2 headings, each followed by what the rule does and why it exists     |
| A block's glyph                                       | hidden from the accessible name of its heading                                  |
| Explainer copy, both locales                          | every block declared by the surface has `title`, `body` and `why`               |
| Any digit or percent sign under `progress.howItWorks` | fails: the page publishes rules and reasons, never the point table (`BR-12-22`) |

### Navigation gate (`navigationConfig.test.ts`, `AppNavDrawer.test.tsx`)

| Scenario                     | Expected                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Default visibility           | `progress` is appended last, no existing entry reordered or demoted            |
| `showProgression: false`     | the entry is dropped entirely, the other four (five with `settings`) unchanged |
| Drawer with the layer hidden | no `Progreso` link rendered, the rest of the primary nav untouched             |
