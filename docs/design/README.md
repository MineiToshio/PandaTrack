# PandaTrack Design System

This folder is the source of truth for PandaTrack's design system and reusable interface decisions.

It is split into focused documents so both humans and coding agents can load only the part they need during implementation.

## How to use this folder

Read this file first, then open the matching topic document:

- `docs/design/visual-foundations.md`: visual language, semantic design variables, typography, color, spacing, surfaces, radius, shadows, gradients
- `docs/design/interface-patterns.md`: interaction states, navigation, content hierarchy, tabs, modals, right sidebars, motion, status patterns, responsive and accessibility rules

## Decision

PandaTrack intentionally uses a modular design-system structure instead of one large file.

Reasoning:

- the previous single-file design system grew too large to scan quickly
- AI-assisted development works better when documentation is split by decision domain
- visual foundations and interface patterns evolve at different speeds
- smaller topic files reduce the chance of loading irrelevant context during implementation

Rule:

- treat this folder, not a single standalone file, as the design-system source of truth
- before changing reusable UI, open the relevant design document for that task
- if a change introduces a new reusable visual or structural rule, update the matching file in this folder in the same change

## File Selection Guide

Open `visual-foundations.md` when the task involves:

- colors
- typography
- spacing
- borders
- surfaces (including **repeated elevated panels** and **KPI tiles** on washed backgrounds)
- radius
- shadows
- gradients (including **soft private-app page wash**)

Open `interface-patterns.md` when the task involves:

- layout and hierarchy (including **collector shell content width**, **`AppPageHero` page headers**, **primary column + sticky rail**, **section title with accent**, **secondary actions on tinted panels**)
- tabs
- modals
- right sidebars or drawers
- buttons and controls
- hover, focus, active, selected, disabled states
- dense summaries
- status chips or badges
- navigation patterns
- motion and interactivity
- responsive behavior

## Design Principles

1. Semantic over ad hoc
2. Contrast with restraint
3. Clear hierarchy first
4. Soft geometry
5. Motion as emphasis, not decoration
6. Theme safety by default

## Source Variable Files

- `src/app/globals.css`: color, theme, and font variables
- `src/lib/fonts.ts`: font loading
- `src/components/core/Typography.tsx`: body text scale
- `src/components/core/Heading.tsx`: heading scale
- `src/components/core/Button/buttonVariants.ts`: button patterns

## Rule For New Reusable Variables

If a new reusable visual variable is needed:

1. Add it to `src/app/globals.css` using semantic naming.
2. Define it for both dark and light themes.
3. Use it through semantic classes or shared components.
4. Update the matching file in this folder in the same change.

## Current Design Character Summary

PandaTrack is dark-first, contrast-led, softly rounded, and youthful without becoming noisy. The interface should feel structured, confident, and modern. Strong hierarchy, softened geometry, restrained gradients, and intentional motion are core parts of the product personality.
