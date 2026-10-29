---
title: "ADR 0041 - Solid accent foregrounds meet AA in both themes"
date: 2026-10-29
status: accepted
session: primary button contrast correction
owner: Sergio Minei
trigger: Dark primary CTAs pair a bright lavender fill with near-white text at 2.48:1
updates: docs/design/visual-foundations.md, docs/design/tokens-css.md, docs/design/PLAYBOOK.md
extends: ADR 0003 decision 1 (Velvet), ADR 0008 (modal CTA contrast)
supersedes: visual-foundations.md near-white-in-dark contrast exception; ADR 0003 light focus alpha only
---

# 0041: Solid accent foregrounds meet AA in both themes

- Status: Accepted
- Date: 2026-10-29
- Owner: Sergio Minei
- Related feature: Shared design system, all solid primary CTAs

## Context

Dark `--accent: oklch(74% 0.19 290)` with `--text-on-accent: oklch(99% 0 0)` yields 2.48:1, falling to 2.16:1 under the pressed overlay. The playbook already calls for a dark foreground in dark mode, but visual foundations had granted a near-white exception that conflicts with the system's AA baseline. The owner explicitly requests an AA correction at token level.

`--accent` also drives links, progress bars, active sidebar/filter tints, chips, borders, toggle tracks, avatar fills, and focus-derived recipes. Darkening that shared token would disturb those roles.

## Decision

1. Keep the Velvet accent values in both themes. Set dark `--text-on-accent` to `oklch(15% 0.02 290)`, a near-black violet ink. Keep the light foreground unchanged.
2. Set light `--focus-ring` alpha to `0.7` instead of `0.55`, retaining its hue/chroma/lightness. The previous composited ring measured only 2.56:1 against the canvas; the corrected ring measures 3.46:1 (3.58:1 on elevated and 3.67:1 on surface). Keep the dark ring unchanged (3.84:1).
3. Enforce primary and destructive text >=4.5:1 at rest, hover, and active, and fill/focus >=3:1 against all three opaque surfaces. Read CSS token values and the shared Button recipe in `src/test/primary-button-contrast-guard.test.ts`. Calculate the state overlay above both text and fill, also checking uncovered text.
4. `--text-on-accent` remains a solid-fill foreground. Tonal chips, tinted badges, navigation, and avatar tints keep their existing accent/primary text. No screen-specific override or new primary-fill token is introduced. The unused legacy `--eyebrow-fg` is explicitly `--text-primary` over its 35% accent tint (8.00:1 light, 9.98:1 dark); `--accent` fails 4.5:1 on that tint in both themes. Its Tailwind alias stays unchanged.

## Alternatives considered

- **Dedicated deeper primary fill with near-white text:** can meet text contrast, but introduces a separate brand fill, requires migrating Button and other solid accent consumers to preserve consistency, and reduces boundary contrast on the dark canvas. The existing bright accent plus dark ink already meets both thresholds.
- **Darken shared `--accent`:** changes unrelated links, progress bars, selected states, and focus colors. This has a larger regression surface than correcting its paired foreground.
- **Retain near-white:** fails the requested AA contract and makes enabled actions look inactive.

## Consequences

Primary text becomes 7.73 / 7.08 / 6.28:1 in dark (rest / hover / active); light remains 7.62 / 7.15 / 6.67:1. The bright accent's visual identity and boundary contrast remain intact. Reference calculations use OKLCH conversion, sRGB channel clipping, alpha compositing, and WCAG luminance; rendered gamut mapping can differ slightly. Full ratios and the disabled treatment are recorded in visual foundations.

The foreground also improves dark solid destructive buttons/stepper states (2.81 -> 6.81:1), solid success stepper/modal states (2.10 -> 9.11:1), warning modal CTAs (1.73 -> 11.06:1), and the accent-to-warm avatar fallback (accent endpoint 7.73:1, warm endpoint 9.28:1). Calendar selection, checkboxes, search submit, pagination, filter-count badges, wizard numbers, product-picker selection, and legacy solid CTA aliases inherit the fix.

**Pre-existing limitation, outside this ADR:** light-theme solid warning/success modal CTAs still pair the near-white foreground with semantic fills at approximately 2.65:1 / 3.89:1. These remain below AA for normal text. Improving dark foregrounds does not establish an AA guarantee for those light semantic-fill overrides; they require a separate correction.

Changing light focus alpha affects every existing `--focus-ring` / `--ring` consumer, making its outline more visible without changing layout or interaction. Native disabled button colors remain unchanged. Existing disabled anchors only have ARIA pointer/opacity rules and therefore inherit the corrected enabled pair; changing that separate disabled styling contract is outside this correction.

## Rollout notes

- Three applied CSS token values change. Mirror the Velvet definitions in `tokens-css.md` and reconcile the playbook and affected FDD wording.
- No data migration, dependency, component API, route, flow, copy, or analytics change.
- Guard red on the old values: dark rest/hover/active and light focus fail. Guard green on the corrected values, with follow-up coverage for destructive buttons and the legacy eyebrow pair.

## References

- [Visual foundations](../visual-foundations.md#primary-button-contrast-contract)
- [Velvet palette, ADR 0003](0003-demo-decisions.md)
- [Modal CTA contrast, ADR 0008](0008-modal-enhancement.md)
- [WCAG 2.2 contrast minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum)
- [CSS Color 4 conversion code](https://www.w3.org/TR/css-color-4/#color-conversion-code)
