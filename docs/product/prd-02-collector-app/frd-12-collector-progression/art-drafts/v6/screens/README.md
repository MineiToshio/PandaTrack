# Rank artwork, integrated (2026-08-25)

Every screenshot here was taken against the owner's real dev data on the local dev server, read-only:
signed in, navigated, captured. Nothing was written to the database. Captured at 2x and stored at 1x.

| Prefix       | What it shows                                                                      |
| ------------ | ---------------------------------------------------------------------------------- |
| `progress-`  | `Resumen` tab, above the fold: the rank hero (`lg` on mobile, `xl` on desktop)    |
| `progress-full-` | The same tab, full page, so the mini ladder's `xs` (38 px) plates are in frame |
| `ranks-`     | `Rangos` tab: all ten rungs, full page                                             |
| `dashboard-` | The dashboard, for context                                                         |
| `widget-`    | The dashboard progression card on its own (`sm` on mobile, `md` on desktop)        |

Each comes in `desktop` (1440x950) and `mobile` (390x844), in `dark` and `light`.

## The two `harness-` sets

The owner's account stands at **rank 1 with 0 points**, so two things cannot appear on their real
data: the `conquered` band (there is no rank below rank 1) and the rank-up celebration. Both were
captured with a single input forced in a temporary local edit that was reverted immediately
afterwards, so the component tree, the tokens and the artwork are the real ones and only the datum is
staged:

- `harness-ranks-*`: the ladder page rendered with `currentRankIndex={6}`, which puts all three states
  on one screen at once (conquered below, current in the middle, locked above, summit locked at the
  top).
- `harness-celebration-*`: `ProgressionCelebration` mounted with a fixed rank-7 payload (previous rank
  6), which is the surface `FR-12-37` describes.

Neither edit is in the repository. The states they show are also asserted in
`src/components/core/_tests/RankEmblem.test.tsx` and
`src/app/[locale]/(app)/progress/ranks/_components/_tests/RankLadder.test.tsx`.
