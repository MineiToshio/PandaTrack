"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

type InboxItemOpenedCaptureProps = {
  /** Normalized item category (`report` / `report_cluster` / `pending_store` / `change_request` / `product_type`). */
  itemType: string;
};

/**
 * Fires the "inbox item opened" analytics event when a review is shown. Selection is server-routed, so
 * each opened item remounts this island; the effect keys on `itemType` so re-opening a different item
 * re-emits. A view event, so it is client-side; the mutation events stay inside the FRD-04 actions.
 */
export default function InboxItemOpenedCapture({ itemType }: InboxItemOpenedCaptureProps) {
  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.ADMIN.INBOX_ITEM_OPENED, { item_type: itemType });
  }, [itemType]);

  return null;
}
