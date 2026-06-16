# Cross-cutting states — loading, empty, error

> Normative spec for the three families of cross-cutting state in PandaTrack:
> **Loading** (Skeleton), **Empty** (EmptyState), and **Error**. Each family derives
> from a canonical primitive and shares a frozen tone vocabulary. The governing
> decision is [ADR 0013](decisions/0013-cross-cutting-state-system.md).

These states are not features of any one module. They are a system: one skeleton recipe,
one empty anatomy, one error system with defined tones. Every list, detail, form, and
error surface must derive from the primitives below rather than reinventing a local recipe.

| Family      | Primitive                                       | Surfaces it covers                                     |
| ----------- | ----------------------------------------------- | ------------------------------------------------------ |
| **Loading** | `Skeleton` (atom + compositions)                | list-row, card, detail-hero, form loading states       |
| **Empty**   | `EmptyState` (tone-extended)                    | first-run and no-results empties across modules        |
| **Error**   | `EmptyState appearance="page"` + `SectionError` | route error, global error, 404, section error, offline |

The frozen tone vocabulary (see [ADR 0013](decisions/0013-cross-cutting-state-system.md), D4):

| State              | Tone          | Lucide icon                                   |
| ------------------ | ------------- | --------------------------------------------- |
| Empty · first-run  | `accent`      | contextual (`PackageOpen`, `Truck`, `Store`…) |
| Empty · no-results | `neutral`     | `SearchX`                                     |
| Route error (full) | `destructive` | `TriangleAlert`                               |
| Section error      | `destructive` | `TriangleAlert`                               |
| 404 not-found      | `neutral`     | `Compass`                                     |
| Offline            | `warning`     | `WifiOff`                                     |

A **404 is not an error** — the content is absent or moved, so it is `neutral`. Offline is
**transitory**, so it is `warning`. Only a real failure (server/render/fetch) is `destructive`.

---

## 1. Loading — `Skeleton`

### 1.1 The `.skeleton` atom

The atom is a single shipped CSS class, `.skeleton`: a neutral gradient shimmer derived from
`--text-primary`, animated across `background-size: 200% 100%`. Under `prefers-reduced-motion`
the animation is removed and the fill becomes static.

```css
.skeleton {
  /* color-mix is indirected through custom properties, NOT placed as a gradient
     color-stop: Lightning CSS (Tailwind v4) drops the rule if a stop is
     `color-mix(…) <pos%>`. */
  --skeleton-base: color-mix(in oklab, var(--text-primary) 8%, transparent);
  --skeleton-highlight: color-mix(in oklab, var(--text-primary) 16%, transparent);
  background: linear-gradient(90deg, var(--skeleton-base), var(--skeleton-highlight), var(--skeleton-base));
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--skeleton-base);
  }
}
```

Three rules are load-bearing:

- **`color-mix` via custom property, never in the color-stop.** Lightning CSS discards the rule
  if the `linear-gradient` carries a `color-mix(…) <position%>` stop. Indirect through `var()`.
- **`in oklab`, not `in oklch`.** Over neutral tokens such as `--text-primary`, oklch drifts the
  hue toward pink; oklab keeps a clean gray on every surface.
- **`--text-primary` mix, not `--border`.** The neutral mix holds consistent contrast over canvas
  (`--background`), `--surface`, and `--surface-elevated`. `--border` flattens in dark mode.

The shimmer is **shimmer, not pulse**: do not use `animate-pulse`. See
[motion.md](motion.md) for the shimmer/reduced-motion token taxonomy — it is not duplicated here.

### 1.2 Canonical compositions

All ad-hoc per-module skeletons collapse into these four compositions, each built from the atom:

| Composition   | Anatomy                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| `list-row`    | circle 36 + two text lines (70% / 50%) + status pill                              |
| `card`        | header (circle 40 + two lines) + status pill + progress bar                       |
| `detail-hero` | circle 52 + title 18 + subtitle + status chip + divider + 3 stat tiles            |
| `form`        | label + input ×N + right-aligned submit button; the wizard variant adds a stepper |

### 1.3 Skeleton vs spinner vs nothing

This decision is mandatory (see `react-next-components.mdc`):

- **Skeleton** — via `loading.tsx` or `<Suspense>` when Next resolves **server** work (slow DB / RSC)
  for a screen whose layout is predictable (lists, detail, form). The UI arrives by SSR, not by a
  client chunk. Never fake this with a client fallback (`dynamic(…, { loading })`) for UI that is
  delivered server-side — the skeleton almost never shows and it adds complexity.
- **Spinner** (`Loader2`) — only for short, indeterminate async that the **user initiates**: a pending
  submit (`Button loading`), an in-flight search (`Input loading`), autosave. It is scoped to the
  control, never used as a route fallback.
- **Nothing** — optimistic mutations. The change is applied locally at once; no loading state is shown.
  See `optimistic-client-updates.mdc`.

---

## 2. Empty — `EmptyState`

### 2.1 One anatomy, two tone/voice classes

Every list/flow empty uses `EmptyState appearance="card"`: a dashed card over `--surface-elevated`,
`--radius-2xl`, a 64px icon circle, a heading, a `--text-secondary` subtitle, and CTAs. Only the
**icon tone** and copy change between the two classes:

| Class          | `iconTone` | Icon example  | CTA                     | Voice (see [ux-copy.md](ux-copy.md))          |
| -------------- | ---------- | ------------- | ----------------------- | --------------------------------------------- |
| **First-run**  | `accent`   | `PackageOpen` | primary (verb + object) | Forward-looking, inviting — "Add your first…" |
| **No-results** | `neutral`  | `SearchX`     | ghost "Clear filters"   | Neutral, offers an exit — "Try adjusting…"    |

A first-run empty always offers an actionable primary CTA when there is an obvious action. A
no-results empty offers a way back out (clear filters) rather than a dead end.

### 2.2 `appearance` and extended tones

- **`appearance: "plain" | "card" | "page"`.** `card` is the default list/flow empty. `page` is the
  centered full-page state used as the base for route error, 404, and offline (§3): a 72px icon-well,
  an optional mono eyebrow, an `h1` title, and a viewport `min-height`.
- **`iconTone: "neutral" | "accent" | "warning" | "destructive"`.** `warning` and `destructive`
  extend the empty primitive so the same centered block can render error and offline bases.

### 2.3 Documented exceptions

- A **chip-level empty** (a dashed pill standing in for "catalog field with no values") is legitimately
  specific and is not a region. It does not use `EmptyState`.
- Empties inside modals/sheets are covered by the modal's own icon-circle and do not nest `EmptyState`.

---

## 3. Error

The error family reuses the centered block from `EmptyState appearance="page"` for full-page tiers,
and introduces `SectionError` for region-level failures. The shell (sidebar + topbar) is **kept** for
route error and 404 — the failure or absence is in the segment, not in the layout.

### 3.1 Route error — `error.tsx`

- Centered full-page block, tone **`destructive`**: 72px circular icon-well
  (`color-mix(--destructive 12%)` + `--destructive` icon), `TriangleAlert`, mono eyebrow, 20px title,
  subtitle ≤440px.
- Actions: primary "Try again" (`RotateCw`, calls `reset()`) + ghost "Go home".
- `role="alert"`. Keeps the shell.
- **Sentry:** captures with `tags.area` + `extra.digest`.

### 3.2 Global error — `global-error.tsx`

This replaces the root layout, so it has no access to providers or next-intl.

- **Self-contained inline:** inline styles + tokens (or minimal CSS), **bilingual copy inline** —
  never `useTranslations`.
- Keeps the destructive icon-well + retry vibe, but fully standalone.
- **Sentry:** bare `captureException(error)`.

### 3.3 404 — `not-found.tsx`

- Same centered block, tone **`neutral`** — a 404 is not a failure; the content is absent or moved.
- `Compass` icon, mono eyebrow ("Error 404"), title, primary "Back to home" (`Home`) + ghost
  "View my orders".
- Keeps the shell.
- **Sentry: does NOT capture.** A 404 is expected, not an exception.

> Next routing: `not-found()` triggers `not-found.tsx` (neutral, no Sentry); a thrown error triggers
> `error.tsx` (destructive, with Sentry).

### 3.4 Section error — `SectionError`

A region (card / list) fails to load while the rest of the page lives. This is a new pattern
(see [ADR 0013](decisions/0013-cross-cutting-state-system.md), D3).

- **Visual:** the Chip-Eyebrow + Top-Accent vocabulary in tone **`destructive`** (default) — a card on
  `--surface-elevated` with a 2px destructive top-border, a mono chip eyebrow ("Couldn't load",
  `TriangleAlert`), a `--text-secondary` message, and a ghost "Try again" button (`RotateCw`).
- **Mechanics (App Router):** a small Client Component with a retry button. Retry calls `onRetry`,
  defaulting to `router.refresh()` to re-run the Server Components. Loading stays SSR — no fake client
  fallback. To catch a sub-area failure without taking down the route, the consumer wraps the fallible
  fetch in a `try/catch` (Server Component) and renders `SectionError` in the `catch`, or scopes a
  client error boundary to that sub-area.
- **a11y:** `role="alert"` + `aria-live="polite"` — announces the region's failure without stealing focus.
- **`tone="warning"` = offline** (transitory, not a hard error).

### 3.5 Offline

- Full-page: the centered block, tone **`warning`**, `WifiOff`, "You appear to be offline".
- Section-level: `SectionError tone="warning"`.
- It is transitory → `warning`, never `destructive`. **Sentry: does NOT capture.**

### 3.6 Sentry ownership — one capture per error

| Owner                 | What                                 | Context                                                            |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `error.tsx`           | render error of the `(app)` segment  | `tags.area` + `extra.digest`                                       |
| `global-error.tsx`    | root layout error                    | bare `captureException`                                            |
| Server actions        | their own expected/unexpected errors | already implemented — do not touch                                 |
| `SectionError`        | **does not capture**                 | the fallible fetch that caused it captures once in its `try/catch` |
| `not-found` / offline | **do not capture**                   | expected / transitory                                              |

Rule: every error is reported **exactly once**. `SectionError` is presentation; capture lives in the
data layer that failed. See `sentry-error-handling.mdc`.

---

## 4. Mascot policy

The mascot is **prohibited** in every error state (route, section, 404, offline) and in every
confirmation. This is a hard anti-pattern (see [ADR 0013](decisions/0013-cross-cutting-state-system.md), D5).

In empties, the mascot is **not mounted by default** — the canonical icon-well is sufficient. The
`EmptyState` `visual` slot is reserved for a future sleeping-mascot empty-hero once the assets exist;
it is not mounted with a mascot today.

---

## 5. Accessibility per family

- **Loading:** the container carries `aria-busy="true"` and an `aria-label` or `aria-live="polite"`
  describing what is loading ("Loading orders"); the skeleton atoms are `aria-hidden`. The shimmer
  respects `prefers-reduced-motion` (static fill).
- **Empty:** the title is part of the heading outline (on list pages, an `h2` under the `h1`); the
  icon-well is decorative and `aria-hidden`.
- **Route error / 404:** `role="alert"` on the block (route error); move focus to the heading or
  primary button when the boundary mounts. Buttons carry verb + object labels.
- **Section error:** `role="alert"` + `aria-live="polite"` — announce the region's failure without
  stealing focus.
- **Offline:** `role="status"` + `aria-live="polite"` — transitory, not urgent.

---

## 6. Component contracts

The built components are the source of truth for their exact APIs. The contracts below are the
durable prop-level shape.

### 6.1 `Skeleton` — `src/components/core/Skeleton.tsx`

```ts
type SkeletonProps = {
  /** Shape. `text` lines, `circle` avatar, `rect` block, `pill` chip. Default `rect`. */
  variant?: "text" | "circle" | "rect" | "pill";
  width?: string | number;
  height?: string | number;
  /** For `text`: number of lines (the last at 60–80%). */
  lines?: number;
  className?: string;
};
```

- Renders a `<span>` carrying the `.skeleton` atom class.
- **a11y attributes belong on the container, not the atom.** The atom is `aria-hidden`; the
  composition wrapper carries `aria-busy="true"` (+ `aria-live="polite"` / `aria-label`).
- The compositions (`ListRowSkeleton`, `CardSkeleton`, `DetailHeroSkeleton`, `FormSkeleton`) live
  beside the atom or as module helpers, depending on reuse. Per-module loading skeletons consume the
  atom and the shimmer recipe.

### 6.2 `EmptyState` — `src/components/modules/EmptyState.tsx`

- `appearance: "plain" | "card" | "page"`.
- `iconTone: "neutral" | "accent" | "warning" | "destructive"`.
- Slots: `visual` / `icon` / `title` / `subtitle` / `actions`.
- Extensions are additive — existing consumers keep their defaults, no breaking change.

### 6.3 `SectionError` — `src/components/modules/SectionError.tsx`

```ts
type SectionErrorProps = {
  /** Chip eyebrow. Defaults to i18n `components.sectionError.title`. */
  title?: string;
  /** Message. Context-specific copy passed by the consumer. */
  message: string;
  /** Tone. `destructive` error, `warning` offline/transitory. Default `destructive`. */
  tone?: "destructive" | "warning";
  /** Retry handler. Default `router.refresh()`. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};
```

- Client Component (`"use client"`, for the retry button).
- `role="alert"` + `aria-live="polite"`.

### 6.4 Boundaries

- `error.tsx`: Client Component, full-page destructive block, `reset()` on the primary.
- `global-error.tsx`: Client Component, self-contained, bilingual inline copy (no i18n).
- `not-found.tsx`: Server Component, full-page neutral block.

All user-facing copy for these states follows the voice in [ux-copy.md](ux-copy.md).

---

## 7. Rules & anti-patterns

- Do not write an ad-hoc per-module skeleton recipe. Use the `.skeleton` atom / `Skeleton`.
- Do not use `animate-pulse` without `motion-safe:`. The shimmer is the canonical animation, and it
  must go static under `prefers-reduced-motion`.
- Do not fake a client fallback (`dynamic(…, { loading })`) for UI that is delivered by SSR.
- Do not mount the mascot in any error or confirmation state.
- Do not use a `destructive` tone for a 404 — it is `neutral` (content absent, not a failure).
- Do not capture the same error twice. `SectionError` does not capture; the failing data layer does.
- Do not close or collapse the shell in `error.tsx` or `not-found.tsx` — the failure is in the
  segment, not the layout.
- Do not use a spinner as a route fallback. Spinner only for short, user-initiated actions.
- Do not ship an empty without an actionable CTA when there is an obvious next action.
