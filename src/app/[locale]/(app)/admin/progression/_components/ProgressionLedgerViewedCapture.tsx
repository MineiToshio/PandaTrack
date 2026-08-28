"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

/**
 * Fires the "progression ledger viewed" event once when a collector's ledger is opened. Kept as a
 * tiny client island so the surface itself stays server-rendered, mirroring `AuditViewedCapture`.
 * Opening a ledger is a view, so it is captured client-side and carries no properties: which
 * collector an administrator looked at belongs to the audit boundary, not to product analytics.
 */
export default function ProgressionLedgerViewedCapture() {
  useEffect(() => {
    // Fires once per mount; the event name is a module constant, so there are no dependencies.
    posthog.capture(POSTHOG_EVENTS.ADMIN.PROGRESSION_LEDGER_VIEWED);
  }, []);

  return null;
}
