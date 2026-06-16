# PandaTrack Design System

This folder is the source of truth for PandaTrack's design system — the "Velvet" visual language and the reusable interface decisions that go with it. It is split into focused documents so both humans and coding agents can load only the part they need while implementing.

## How to use this folder

Read this file first, then open the matching topic document.

| Document                                       | Open it for                                                                                                                                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [visual-foundations.md](visual-foundations.md) | Color (light + dark), typography, spacing, radius, surfaces & elevation, gradients, number/currency formatting.                                                                                                       |
| [tokens-css.md](tokens-css.md)                 | The literal CSS-variable contract (the `@theme` block, `:root[data-theme]` overrides, palettes, recipes) — the human-readable mirror of `src/app/globals.css`.                                                        |
| [interface-patterns.md](interface-patterns.md) | Layout & app shell, page hero & section titles, interaction states, buttons & controls, navigation, modals & overlays, forms, the Chip-Eyebrow + Top-Accent pattern, status chips, toasts, responsive, accessibility. |
| [motion.md](motion.md)                         | Motion token taxonomy, the transform/opacity rule, reduced-motion policy, View Transitions, microinteraction recipes.                                                                                                 |
| [states.md](states.md)                         | Cross-cutting empty / loading / error states — skeleton vs spinner, error tiers, Sentry ownership, mascot policy.                                                                                                     |
| [ux-copy.md](ux-copy.md)                       | Voice (constant) + tone (by context), the do/don't library, neutral Spanish, copy patterns for empty states, banners, errors, confirmations, toasts, CTAs, helper text.                                               |
| [components.md](components.md)                 | The component map: what exists, when to use which, and where the canonical code lives. Read **before building any UI**.                                                                                               |
| [decisions/](decisions/)                       | The accepted ADRs (0001–0014) that govern the system.                                                                                                                                                                 |
| [PLAYBOOK.md](PLAYBOOK.md)                     | The operational playbook — the mandatory workflow, anti-patterns, and self-audit checklist for building UI in this repo.                                                                                              |

## How the design system is enforced

The visual line is held by three reinforcing layers — none optional:

1. **The spec** — the topic docs in this folder define the WHAT and WHY.
2. **The playbook** — [PLAYBOOK.md](PLAYBOOK.md) defines the HOW (workflow + anti-patterns + self-audit). Each topic doc also carries its own inline "Rules & anti-patterns" block, so the constraints reach you even when you load only one file.
3. **The cursor rules** — several `.cursor/rules/*.mdc` (several `alwaysApply: true`) make the above mandatory: `design-system-playbook.mdc`, `modal-canonical-pattern.mdc`, `ui-libs-policy.mdc`, `optimistic-client-updates.mdc`, `theme-light-dark.mdc`.

## Why modular, not one file

PandaTrack uses a modular design-system structure instead of one large file because:

- a single-file system grows too large to scan quickly;
- AI-assisted development works better when documentation is split by decision domain;
- visual foundations and interface patterns evolve at different speeds;
- smaller topic files reduce the chance of loading irrelevant context.

Rules:

- treat this folder, not any single file, as the design-system source of truth;
- before changing reusable UI, open the relevant topic document;
- if a change introduces a new reusable visual or structural rule, update the matching file here in the same change, and update this README's file-selection table if a new file is added.

## Design principles (the decálogo)

1. **Light and dark are sibling products, not a toggle.** Each theme is designed independently; never invert.
2. **One screen, one decision.** Reduce what the user must decide at once; progressive disclosure.
3. **Validation that helps, not scolds.** Errors propose a next step; they don't blame.
4. **Motion with purpose and a small vocabulary.** Emphasis, never decoration ([motion.md](motion.md)).
5. **Information density with breathing room.** Dense, but scannable.
6. **Personality in moments, not a sticker everywhere.** The mascot appears in celebratory/empty moments — never in errors or confirmations.
7. **Voice: informal, complicit, brief, no corporatese** ([ux-copy.md](ux-copy.md)).
8. **Accessibility WCAG 2.2 AA**, light and dark, no exceptions.
9. **Data is the hero; chrome serves the data.**
10. **Mobile-first for real; desktop is extra room.**

## Design character

PandaTrack is dark-first in feel, contrast-led, softly rounded, and youthful without becoming noisy. The default palette is **Velvet** (a warm lead-violet in light, a nocturnal blue-violet in dark). The interface should feel structured, confident, and modern: strong hierarchy, softened geometry, restrained gradients, and intentional motion are core parts of the product personality.

## Source variable files

- `src/app/globals.css` — color, theme, font, motion, spacing, radius, z-index variables (mirrored by [tokens-css.md](tokens-css.md)).
- `src/lib/fonts.ts` — font loading.
- `src/components/core/Typography.tsx` — body text scale.
- `src/components/core/Heading.tsx` — heading scale.
- `src/components/core/Button/` — button variants.
- `src/components/modules/AppPageHero.tsx` — private-app page intro header.
- `src/components/modules/SectionTitleWithAccent.tsx` — in-page section title row.

## Rule for new reusable variables

1. Add it to `src/app/globals.css` using semantic naming.
2. Define it for both dark and light themes.
3. Use it through semantic classes or shared components.
4. Update [visual-foundations.md](visual-foundations.md) (and [tokens-css.md](tokens-css.md)) in the same change.
