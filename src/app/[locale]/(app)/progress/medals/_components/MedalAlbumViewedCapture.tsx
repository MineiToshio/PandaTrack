"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

type MedalAlbumViewedCaptureProps = {
  unlockedCount: number;
  shippedCount: number;
};

/**
 * Fires "album viewed" once per mount. A tiny client island so the album itself stays entirely
 * server-rendered, mirroring `AuditViewedCapture`.
 */
export default function MedalAlbumViewedCapture({ unlockedCount, shippedCount }: MedalAlbumViewedCaptureProps) {
  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.PROGRESSION.MEDAL_ALBUM_VIEWED, {
      unlocked_count: unlockedCount,
      shipped_count: shippedCount,
    });
  }, [unlockedCount, shippedCount]);

  return null;
}
