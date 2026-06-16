---
title: Motion system
status: normative
last_updated: 2026-06-16
related:
  - decisions/0014-motion-system-and-view-transitions.md
  - tokens-css.md
  - interface-patterns.md
  - states.md
  - ux-copy.md
---

# Motion system

This is the source of truth for motion in PandaTrack. It defines the token vocabulary,
the hard performance and accessibility rules, the `prefers-reduced-motion` policy, the
View Transitions policy, and the canonical microinteraction recipes.

Governed by [ADR 0014](decisions/0014-motion-system-and-view-transitions.md).

## 1. Principle: motion is emphasis, not decoration

Motion exists to **confirm an action**, **communicate hierarchy**, or **transport an object**
across a navigation. It is never decorative. The test for any animation is simple: does it help
the user understand what just happened or where something came from? If not, the surface stays
still.

The vocabulary is deliberately **small and fixed**. Every animation composes from the tokens in
§2. A new easing or duration is a written-justification event, not a default — each component
inventing its own curve is the anti-pattern the system exists to prevent. Personality lives in
the brand, typography, and the mascot (within the limits in §8), not in motion sprinkled on every
hover.

## 2. Token taxonomy

Tokens live in `tokens-css.md` and `src/app/globals.css`. Compose from them; do not hardcode
durations or curves in components.

### 2.1 Durations — scaled by complexity and distance travelled

| Token              | Value   | Use                                                          |
| ------------------ | ------- | ------------------------------------------------------------ |
| `--motion-instant` | `100ms` | Discrete feedback: toggle flip, "paid" checkmark, count tick |
| `--motion-fast`    | `150ms` | Hover, focus ring, tooltip, control state transitions        |
| `--motion-base`    | `280ms` | Modal, sheet, drawer, page/step, view transitions            |
| `--motion-slow`    | `480ms` | Expressive feedback, celebrations, indeterminate progress    |

Count-roll settling (the `useAnimatedNumber` hook) runs at `600ms`. It is a hook constant, not a
CSS token, because it interpolates a value rather than driving a CSS transition.

### 2.2 Easings — named curves

| Token                   | Curve                                        | Use                                                           |
| ----------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `--ease-emphasis`       | `cubic-bezier(0.2, 0, 0, 1)`                 | `opacity`, `color`, focus ring, small UI, state transitions   |
| `--ease-out-expressive` | `linear(0, 0.5, 0.85, 0.97, 1)`              | Surface enters: sheet, modal, drawer, page/step               |
| `--ease-bounce`         | `linear(0, 0.32, 0.68, 0.92, 1.08, 1.04, 1)` | **Celebrations only** (overshoot, low-frequency)              |
| `--ease-vt-signature`   | `linear(0, 0.18, 0.5, 0.78, 0.95, 1.02, 1)`  | **View transitions only** — auditable, never reused elsewhere |

`--ease-bounce` and `--ease-vt-signature` are reserved. Do not reach for bounce outside genuine
celebrations (§7.5), and do not apply the signature curve to anything but a view transition — its
exclusivity is what makes view-transition usage auditable.

**Material 3 / Apple HIG crosswalk.** These names map onto familiar systems so the right curve is
easy to pick: `--ease-emphasis` ≈ M3 _Standard_; `--ease-out-expressive` ≈ M3 _Emphasized
decelerate_ ≈ SwiftUI `.smooth`; `--ease-bounce` ≈ M3 _Emphasized_ with overshoot ≈ SwiftUI
`.bouncy`. Apple HIG works in physical springs (damping/response) rather than named béziers; our
multistop `linear()` curves are the perceptual analogue.

## 3. Hard rules (performance)

1. **Animate only `transform` and `opacity`.** These stay on the compositor. **Never** animate
   `width`, `height`, `top`, `left`, `margin`, or `padding` — they trigger layout. The same
   animation that drops ~1% of frames on `transform` drops ~50% on `top`/`left`.
2. **INP ≤ 200ms at p75** (Core Web Vital), never above 500ms. Keep interaction handlers' main-thread
   work short; push the visual work to transform/opacity.
3. **Reduced vocabulary.** Compose from §2. A new easing requires written justification for why the
   existing tokens do not serve.
4. **`will-change` sparingly.** Apply it only to the element being animated and only during the
   animation; never leave it permanent (it consumes compositor memory).
5. **Cap staggers.** PandaTrack does not stagger list entry by default (lists appear instantly). If a
   bounded stagger is ever introduced, cap it to the first few items; never animate dozens of rows.

### Canonical migrations

Two surfaces that historically animated `width` must use `transform: scaleX()` with
`transform-origin: left` instead:

- **Toast countdown hairline** — `scaleX(1 → 0)`, not `width: 100% → 0%`.
- **Payment progress fill** — `scaleX(pct)` on the fill, container keeps its width, not animated
  `width %`.

## 4. Reduced motion (`prefers-reduced-motion`)

The policy is **reduced ≠ none**. Under reduced-motion we keep a subtler animation that still
expresses the relationship (typically a cross-fade), not a hard kill of all feedback. The browser
does not auto-honor reduced-motion for view transitions or most custom motion — it must be written.

**Global floor is a safety net, not the whole answer.** `src/app/globals.css` carries a global
`@media (prefers-reduced-motion: reduce)` block that clamps durations as a backstop. It is a hammer:
for the list→detail view transition, a hard clamp equals _none_ (no morph, no fade). So every
expressive surface ships its **own explicit** `motion-safe:` / `motion-reduce:` treatment; the floor
only catches anything missed.

| Surface                        | Full motion                 | Reduced-motion                                              |
| ------------------------------ | --------------------------- | ----------------------------------------------------------- |
| View transition list→detail    | Shared-element morph, 280ms | **Explicit cross-fade ~150ms** (instant position, no morph) |
| Count-roll                     | Interpolate 600ms           | Snap to final value                                         |
| Toggle (switch/checkbox/radio) | translate/zoom 150ms        | Instant, no transition                                      |
| Toast enter/exit + countdown   | translateX + opacity; bar   | Appear/disappear without slide; bar hidden, timer runs      |
| Modal / Sheet                  | spring 280ms                | Cross-fade ~200ms                                           |
| Drawer                         | rise/slide 280ms            | Direct appearance                                           |
| Skeleton                       | shimmer                     | Static fill                                                 |

**Binding rule:** any new expressive surface ships its explicit reduced-motion treatment. Verify
each surface with the OS flag active — do not trust the global floor alone.

## 5. View Transitions policy

The list→detail shared-element morph is **Option A**: CSS `view-transition-name` on the shared
elements plus a thin navigation wrapper that calls `document.startViewTransition()`. We do **not**
use React's canary `<ViewTransition>` component, which keeps an experimental, API-unstable
dependency out of the path (see [ADR 0014](decisions/0014-motion-system-and-view-transitions.md)).

The wrapper component is `ViewTransitionLink` in `src/components/core/`.

### Double gate + graceful fallback

The transition fires only behind **both**:

1. The Next experimental flag, and
2. A runtime feature flag (PostHog), so it can be turned off without a redeploy.

With no browser support or the flag off, navigation proceeds normally — **the app works
identically, it just doesn't animate**. The view transition is never a hard dependency.

### Naming contract

Shared elements carry unique names per entity, so only the navigated pair morphs:

- `order-{humanId}`
- `dlv-{id}`
- `store-{slug}`

### Signature and verification

- Duration `--motion-base` (280ms) + `--ease-vt-signature`. Do not customize per screen.
- Reduced-motion: explicit cross-fade ~150ms (instant position), not the global floor's hard clamp.
- **Safari spot-check is mandatory** before enabling — it is the highest-risk browser for the API.
  Verified support: Chrome/Edge 111+, Safari 18.0+, Firefox 144+.

## 6. Microinteraction recipes

### 6.1 Toggle (Switch / Checkbox / Radio)

- Track / circle: `transition-[background-color,border-color]`, `--motion-fast`, `--ease-emphasis`.
- Thumb: `transition-transform`, same timing.
- Check / dot: `motion-safe:zoom-in-50`, `--motion-fast` (the discrete flip may use `--motion-instant`).
- Reduced-motion: instant, no transition.

### 6.2 Optimistic + undo window (neutral-undo toast)

The canonical reversible-mutation pattern (see `.cursor/rules/optimistic-client-updates.mdc`).

- **Undo window:** **5s** for light reversibles (reopen, soft-delete of a payment, bulk select);
  **8s** for whole-entity delete/cancel (more data at stake).
- Pause on hover/focus so a slow reader keeps the window.
- Countdown hairline tied to the duration via `transform: scaleX(1 → 0)`, origin-left. Reduced-motion:
  bar hidden, timer still runs.
- Keyboard shortcut `Z` undoes while the toast is visible and no input is focused. `aria-live="polite"`.
- Enter/exit: translateX + opacity, `--motion-base` + `--ease-emphasis`.
- **No mascot** in undo/confirm flows (see §8 and `ux-copy.md` voice).
- **Optimistic Confirmation:** modal/sheet flows close synchronously on submit; the parent
  coordinator owns rollback + toast if the server rejects.

### 6.3 Payment progress

- Fill: `transform: scaleX(pct)` + `transform-origin: left`. Container keeps its width; the fill
  scales. Drive the value via `useAnimatedNumber` (600ms, reduced → snap).
- Color swap (warning ↔ accent on a real state change) is instant — that is honest, it tracks an
  actual change.
- Indeterminate (route/async load): `translateX` loop, `--motion-slow` + `--ease-emphasis`.
  Reduced → static.

### 6.4 Count / number change

- Use `useAnimatedNumber` (600ms cubic-out, no animation on first mount, reduced → snap) for **any
  tabular figure that changes via an optimistic update**: balance, percentage, totals, dashboard
  micro-stats.
- `tabular-nums` is mandatory on figures that update, to avoid jitter.

### 6.5 Success micro-moment

Success is felt through **settling, not confetti**. The canonical pattern is the count rolling to
its target and the state block appearing only when it lands (e.g. the amount counts to `$0`, then is
replaced by a "paid in full" block). Replicable for "mark as arrived".

### 6.6 List → detail view transition

The shared-element morph from a card/row thumbnail to its detail hero, per §5. List entry itself is
**not** animated (no stagger) — restraint over decoration.

## 7. Cross-references

- **Tokens:** `tokens-css.md` and `src/app/globals.css`.
- **View transition wrapper:** `ViewTransitionLink` in `src/components/core/`.
- **Mascot rules:** voice in `ux-copy.md`, emotional states in `states.md`.
- **Governing ADR:** [ADR 0014](decisions/0014-motion-system-and-view-transitions.md).

## 8. Rules & anti-patterns

**Always**

- Animate only `transform` and `opacity`.
- Compose from the §2 token vocabulary.
- Ship an explicit reduced-motion treatment for every expressive surface (reduced ≠ none).
- Gate view transitions behind the double flag with graceful fallback.

**Never**

- Animate layout props (`width`, `height`, `top`, `left`, `margin`, `padding`).
- Add decorative motion — no animation that does not explain something.
- Show the mascot in undo, confirm, or error flows.
- Reuse `--ease-vt-signature` outside a view transition, or `--ease-bounce` outside a genuine
  celebration.
- Use motion to mask fetch latency, or leave `will-change` permanently applied.
