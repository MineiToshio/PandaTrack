"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

/**
 * Fires the "audit viewed" analytics event once when the audit log viewer mounts. Kept as a tiny
 * client island so the viewer itself stays server-rendered, mirroring `AdminSpaceEnteredCapture`.
 * Opening the viewer is a view, so it is captured client-side; privileged mutations emit elsewhere.
 */
export default function AuditViewedCapture() {
  useEffect(() => {
    // Audit-viewed analytics fire once per mount; the event name is a module constant, no deps.
    posthog.capture(POSTHOG_EVENTS.ADMIN.AUDIT_VIEWED);
  }, []);

  return null;
}
