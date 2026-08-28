"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

type MedalDetailViewedCaptureProps = {
  medalKey: string;
  rarity: string;
  unlocked: boolean;
};

/** Fires "medal detail viewed" once per mount, carrying which medal and whether it is held. */
export default function MedalDetailViewedCapture({ medalKey, rarity, unlocked }: MedalDetailViewedCaptureProps) {
  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.PROGRESSION.MEDAL_DETAIL_VIEWED, {
      medal_key: medalKey,
      rarity,
      unlocked,
    });
  }, [medalKey, rarity, unlocked]);

  return null;
}
