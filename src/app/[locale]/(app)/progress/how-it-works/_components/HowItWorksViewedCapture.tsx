"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

/**
 * Fires "rules explainer viewed" once per mount. A tiny client island so the page itself stays
 * entirely server-rendered, mirroring `RankLadderViewedCapture`.
 *
 * It carries no property: the page is identical for every collector, so the only thing worth
 * counting is how often anybody goes looking for the rules at all.
 */
export default function HowItWorksViewedCapture() {
  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.PROGRESSION.PROGRESS_HOW_IT_WORKS_VIEWED);
  }, []);

  return null;
}
