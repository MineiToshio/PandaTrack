"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

type RankLadderViewedCaptureProps = {
  currentRankIndex: number;
};

/**
 * Fires "rank ladder viewed" once per mount. A tiny client island so the ladder itself stays
 * entirely server-rendered, mirroring `MedalAlbumViewedCapture`.
 */
export default function RankLadderViewedCapture({ currentRankIndex }: RankLadderViewedCaptureProps) {
  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.PROGRESSION.PROGRESS_RANK_LADDER_VIEWED, {
      current_rank_index: currentRankIndex,
    });
  }, [currentRankIndex]);

  return null;
}
