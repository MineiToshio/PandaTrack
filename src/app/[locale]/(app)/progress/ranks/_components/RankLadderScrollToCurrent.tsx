"use client";

import { useEffect } from "react";

/** The one rung `RankLadder` marks with `data-rank-current="true"`: the collector's own rank. */
const CURRENT_RUNG_SELECTOR = "[data-rank-current='true']";

/**
 * Scrolls the viewport to the collector's current rung right after the ladder mounts.
 *
 * The ladder always paints summit first, so without this a collector below the top ranks lands on
 * a page that opens on someone else's achievement and has to scroll past it to find their own
 * (owner feedback, 2026-08-25). A tiny client island, mirroring `RankLadderViewedCapture`, so
 * `RankLadder` itself stays entirely server-rendered: the only thing this component does is read
 * the DOM once and call the platform's own `scrollIntoView`, nothing here needs to re-render.
 *
 * Two guards keep it from being a worse experience than doing nothing:
 *
 * - **Skips the jump when the rung is already fully visible.** A collector at rank 1, or on any
 *   viewport tall enough to show the whole ladder, would otherwise be scrolled for no reason, and
 *   a "position" that moves when nothing was hidden reads as a bug rather than as help.
 * - **Drops the smooth animation for `prefers-reduced-motion`**, the same `matchMedia` check
 *   `useAnimatedNumber` already uses, so it snaps into place instead of animating.
 */
export default function RankLadderScrollToCurrent() {
  useEffect(() => {
    const rung = document.querySelector<HTMLElement>(CURRENT_RUNG_SELECTOR);
    if (!rung) return;

    const rect = rung.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const isFullyVisible = rect.top >= 0 && rect.bottom <= viewportHeight;
    if (isFullyVisible) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    rung.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
  }, []);

  return null;
}
