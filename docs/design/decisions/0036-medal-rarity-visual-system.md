---
title: "ADR 0036 - Medal rarity uses a five-grade print-run system, never color alone, and strong motion stays out of the dashboard"
date: 2026-08-23
status: accepted
session: collector-progression medal rarity design (FRD-12, 2026-08-23)
owner: Sergio Minei
trigger: FRD-12's collectible medals need a rarity system that reads as native to collecting rather than to generic gamification, that stays legible for a collector who cannot distinguish the rarity colors, and that does not turn the dashboard into a distraction on the surface the product treats as its main decision screen
updates: docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md, docs/product/glossary.md
extends: ADR 0006 (icon+label contract for color-blindness), ADR 0002 (status chip mapping, frozen small vocabulary), ADR 0014 (motion system and reduced-motion budget)
---

# ADR 0036 - Medal rarity uses a five-grade print-run system, never color alone, and strong motion stays out of the dashboard

## Context

A medal needs to communicate how rare it is at a glance, on surfaces ranging from a dense album grid to a single celebration moment. Two decisions were open: what the rarity vocabulary itself should be, and where the expressive motion that makes a rare medal feel special is allowed to live.

PandaTrack targets general collecting, not one hobby (trading cards, action figures, plushies, and beyond), so the rarity vocabulary needed to read as native to collecting in general rather than borrow the generic tier language every other gamified product already uses. Bronze/silver/gold is the incumbent default (Duolingo, Stack Overflow, most loyalty programs) and, precisely because it is everywhere, it does not read as belonging to PandaTrack. A percentage-of-collectors figure ("3% of users have this") was also considered and rejected early: with the collector base PandaTrack has today, that number is either uncomputable or moves on its own as the user base grows, which makes a medal's rarity change without the collector doing anything, an odd property for something meant to feel earned.

The owner reviewed a working prototype of the five-grade system below with full animation on every surface, dashboard included, and the shimmer read as distracting on a screen meant for fast decisions, not display. That review is the source of §3.

## Decision

### 1. Five grades, named with the vocabulary of a print run, not a generic tier

**Normal, primera edición / first edition, edición limitada / limited edition, holográfica / holographic, firmada / signed**, ascending in rarity. This is the vocabulary a collector already has from trading cards and collectibles generally (a first-edition stamp, a limited print run, a holographic variant, a signed piece), so a medal's rarity is legible without the product teaching a new scale, and it is deliberately not the bronze/silver/gold ladder that would make PandaTrack's medals read as interchangeable with any other app's.

### 2. Each grade owns one frozen visual treatment

- **Normal**: matte, no seal.
- **Primera edición**: a gold ring with a seal mark.
- **Edición limitada**: an engraved ring with a numbered plate.
- **Holográfica**: an iridescent ring with rotation and a light sweep.
- **Firmada**: a two-tone ring with a warm halo and a traced signature.

This is a small, frozen vocabulary in the same spirit as ADR 0002's status-chip mapping and ADR 0005's icon-tile pattern: five named treatments, reused everywhere a medal renders, never a one-off "shinier" variant invented per screen. A medal's artwork occupies a fixed square slot, sized per surface (album grid, detail, celebration), identified by a `data-medal` attribute, with a sober placeholder standing in until the final art exists per medal.

### 3. The rarity label is always present in text; color and effect are never the only signal

Every medal shows its grade as a text label next to the visual treatment, on every surface, with no exception. This is the same contract ADR 0006 already imposes on `--info` and `--accent-cool` for WCAG 1.4.1: a five-way rarity gradient is at least as hard to distinguish by color alone as the two-hue case ADR 0006 was written for, and a collector who cannot see the ring's iridescence or its color still has to be able to tell a holográfica medal from a firmada one.

### 4. Strong motion lives in the album, the medal detail, and celebrations; the dashboard stays calm

The shimmer sweep, the rotation, and any reveal/unlock animation render only where the collector is deliberately looking at their collection: the album, a medal's own detail view, and the celebration moment when a medal is newly earned. The dashboard, the product's primary decision surface (per the collector-app's own dashboard-clarity priority), shows medals with static rings and no animation, the same visual treatment minus motion, never a simplified or recolored substitute.

This follows the same locality principle ADR 0013 already applies to the mascot (present in empty/success states, prohibited in errors and confirmations, because the context decides whether an expressive treatment helps or gets in the way) and sits inside ADR 0014's motion budget: a decorative shimmer looping on a surface visited every session competes with the numbers the dashboard exists to show, and reduced-motion users get the calm treatment everywhere by definition, which is one more reason the "no animation on dashboard" rule is not a loss for them.

## Alternatives considered

- **Metal/gem tiers (bronze, silver, gold, or a gem ladder).** Legible on its face, and rejected for being the incumbent default: Duolingo, Valorant, and Stack Overflow all use some variant of it already, so it reads as generic gamification rather than as something native to PandaTrack's collecting identity.
- **Rarity as a computed percentage of collectors who hold the medal.** Rejected: uncomputable meaningfully at PandaTrack's current user volume, and even once computable it makes a medal's rarity move on its own as the collector base grows, which is the wrong property for something meant to feel earned at the moment it is unlocked.
- **Full animation on every surface, dashboard included.** This was the prototype's original shape. Rejected after the owner's own review: the shimmer read as distracting on the dashboard, which the product treats as the primary fast-decision surface, not a display case.
- **Color-only rarity encoding, no persistent text label.** Rejected outright as incompatible with ADR 0006's existing icon+label contract and WCAG 1.4.1; a five-grade color gradient is a harder discrimination task than the two-hue case that contract was written to cover, not an easier one.

## Consequences

### Positive

- A frozen five-grade vocabulary keeps every future medal-bearing screen consistent by construction, the same benefit ADR 0002's status-chip mapping already delivers for order/delivery state.
- Accessibility is guaranteed at the vocabulary level: a text label is part of the grade's definition, not a per-screen choice a future implementer could skip.
- The dashboard's decision-first character is protected: a collector's fastest, most frequent screen never competes with a shimmer loop for attention.

### Negative / tradeoffs

- Five distinct visual treatments, each needing a light and dark rendering, is real design and implementation surface that the FDD must specify fully (ring color, seal/plate/signature art, the iridescent sweep's keyframes) before any medal ships; this ADR fixes the vocabulary and its rules, not the token values.
- "No strong motion on the dashboard" means a real celebration moment (a medal earned while looking at the dashboard) cannot play out on the dashboard tile itself; the FDD must route that moment to a separate celebration surface (a modal, or a deep link into the album) rather than animating in place.
- The print-run metaphor is a deliberate bet on being legible to a general collector rather than to any one hobby's sub-vocabulary (card grading, figure boxing, and so on); FRD-12/FDD copy has to keep the five grade names hobby-neutral as new medal types are added.

## Addendum: token values (2026-08-23)

This ADR fixed the vocabulary and rules but deliberately left the token values open (see "Negative / tradeoffs" above). Those values are now defined: `--rarity-normal`, `--rarity-first-print`, `--rarity-limited`, `--rarity-holo`, `--rarity-signed` (each with a light/dark ring color and a chip-text alias, measured against WCAG AA: ≥3:1 for the ring, ≥4.5:1 for the chip-text), plus a `--rank-band-*` alias family for the rank ladder's conquered/current/locked/top states. Full literal declarations are in [`tokens-css.md` §12](../tokens-css.md#12-medal-rarity-and-rank-band-tokens); the semantics, hue reasoning, and measured ratio tables are in [`visual-foundations.md` § Medal rarity](../visual-foundations.md#medal-rarity) and [§ Rank bands](../visual-foundations.md#rank-bands). `--rarity-*` is applied in `src/app/globals.css` as of the medal album (FRD-12, WO-05); `--rank-band-*` still ships with the rank ladder's own surface.

## References

- [ADR 0006 - Icon+label contract (color-blindness)](0006-color-blindness-icon-label-contract.md)
- [ADR 0002 - Status chip mapping](0002-status-chip-mapping.md)
- [ADR 0005 - Dashboard micro-stat icon-tile](0005-dashboard-microstat-icon-tile.md)
- [ADR 0013 - Cross-cutting state system](0013-cross-cutting-state-system.md) (mascot/expressive-treatment locality precedent)
- [ADR 0014 - Motion system and View Transitions](0014-motion-system-and-view-transitions.md)
- Prototype: `docs/product/prd-02-collector-app/frd-12-collector-progression/prototype/collector-progression.html`
- `docs/product/prd-02-collector-app/frd-12-collector-progression/fdd-12-collector-progression.md`
