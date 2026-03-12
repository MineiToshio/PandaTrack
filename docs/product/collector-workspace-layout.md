# Collector Workspace Layout

## Purpose

Define the product-level layout direction for PandaTrack's private collector workspace.

This document captures how the app layout should feel, how users move through it, and how the structure can grow without a redesign when dashboard, stores, purchases, shipments, quick actions, compact stats, and lightweight gamification mature.

## Product intent

The private app should feel:

- clear and controlled
- fun and rewarding
- expressive without becoming confusing
- approachable for first-time users
- expandable for more advanced collectors over time

The design goal is not a neutral admin panel. It should still feel like a collector product for a hobby audience, especially younger users who expect personality, momentum, and visible progress.

## Core layout structure

The collector workspace uses:

- a full-height left sidebar
- a content-area header
- a main content canvas to the right

The header belongs to the content area only. It should not span the full viewport width above the sidebar.

This keeps navigation and page context visually separate:

- the sidebar answers "where am I going?"
- the header answers "where am I right now?"

## Navigation model

The MVP private navigation is:

1. Dashboard
2. Stores
3. Purchases
4. Shipments
5. Settings

`Pre-orders` stay within `Purchases` for MVP rather than becoming a top-level navigation section.

The dashboard is the default entry point after sign-in and should become the strongest "home" experience inside the product.

## Desktop sidebar behavior

The desktop layout uses a hybrid sidebar model:

- Expanded:
  - shows icons and labels
  - pushes the content area
  - stays fixed when pinned
- Collapsed:
  - becomes a narrow icon rail
  - keeps the content area wide
- Floating preview:
  - when the collapsed rail is hovered or keyboard-focused, the full menu appears as a floating panel
  - the content area does not resize or shift

This model gives power users a stable layout while preserving more screen space when they want a lighter view.

The expanded/collapsed preference should be remembered locally in the browser.

## Header model

The collector header should stay intentionally lightweight.

It is responsible for:

- page title
- breadcrumbs only on deeper routes
- locale switcher
- theme switcher
- profile menu
- optional contextual action for the current page

It should not include a global search field in MVP.

## Search strategy

For MVP, search belongs inside the relevant module rather than in the global layout.

Examples:

- Stores page search
- Purchases page search
- Shipments page search

This keeps the layout simpler while the team learns which search behaviors users actually need. A future global search or command palette can be reconsidered later based on usage.

## Information density

The layout should begin from a low-friction, easy-to-understand baseline.

PandaTrack should be understandable even for users with little experience in complex productivity tools, while still leaving room for denser and more advanced views later through per-page patterns and settings.

The layout itself should stay medium-density:

- enough structure to feel useful
- enough breathing room to feel inviting

## Motion and personality

The layout should feel polished and alive, but not noisy.

Useful motion areas:

- sidebar expand/collapse
- floating navigation preview
- drawer open/close on touch devices
- active navigation states
- subtle page-context transitions in the header

The visual tone should feel more like a playful premium collector workspace than a generic admin dashboard.

## Responsive behavior

Desktop:

- hybrid sidebar with hover/focus floating expansion

Tablet and mobile:

- touch-friendly drawer pattern
- no hover-dependent navigation
- simplified but still expressive header controls

Responsive behavior should preserve the same information architecture even when the interaction model changes.

## Future-ready zones

The layout should reserve structural room for compact future additions without making MVP visually heavy.

Likely future additions:

- quick actions such as `Add purchase`
- compact numeric sidebar stats
- upcoming payments count
- in-transit shipments count
- monthly spend summary
- collector progress or lightweight gamification signals

These future surfaces should stay compact and glanceable. The sidebar is not intended to become a dense data dashboard full of lists.

## Product constraints

- Keep dashboard-first orientation
- Keep the layout simple enough for first-time users
- Keep all layout copy localized in `es` and `en`
- Keep navigation stable across product growth
- Keep future expansion possible without rethinking the entire app layout
