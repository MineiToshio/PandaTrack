"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

/**
 * Fires the "admin space entered" analytics event once when the admin landing mounts. Kept as a
 * tiny client island so the surrounding admin surface stays server-rendered. Entering the space is
 * a view, so it is captured client-side; privileged mutations emit server-side elsewhere.
 */
export default function AdminSpaceEnteredCapture() {
  useEffect(() => {
    // Space-entered analytics fire once per mount; the event name is a module constant, no deps.
    posthog.capture(POSTHOG_EVENTS.ADMIN.SPACE_ENTERED);
  }, []);

  return null;
}
