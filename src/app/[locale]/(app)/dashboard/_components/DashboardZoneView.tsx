"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export type DashboardZoneViewProps = {
  event: string;
  props?: Record<string, unknown>;
};

/**
 * Fires a PostHog "viewed" event once when the dashboard zone mounts. Kept as a tiny client
 * island so the surrounding zone stays server-rendered.
 */
export default function DashboardZoneView({ event, props }: DashboardZoneViewProps) {
  useEffect(() => {
    posthog.capture(event, props);
    // Zone-view analytics fire once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
