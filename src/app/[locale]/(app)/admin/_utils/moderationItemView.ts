import { GitCompare, Layers, Pencil, ShieldAlert, Store, Tag, type LucideIcon } from "lucide-react";
import type { ModerationQueueItemType } from "@/lib/data/admin/moderationQueueQueries";

type ItemVisual = {
  /** Lucide glyph shown at the row leading edge and the review eyebrow. */
  Icon: LucideIcon;
  /** Severity color as a CSS variable, driving the queue-row rail and glyph. */
  severityColorVar: string;
};

const ITEM_VISUALS: Record<ModerationQueueItemType, ItemVisual> = {
  report_cluster: { Icon: Layers, severityColorVar: "var(--destructive)" },
  report: { Icon: ShieldAlert, severityColorVar: "var(--destructive)" },
  pending_store: { Icon: Store, severityColorVar: "var(--warning)" },
  change_request: { Icon: Pencil, severityColorVar: "var(--warning)" },
  product_type: { Icon: Tag, severityColorVar: "var(--info)" },
};

export function getItemVisual(type: ModerationQueueItemType): ItemVisual {
  return ITEM_VISUALS[type];
}

/** Eyebrow icon for the change-request drift variant, distinct from the clean variant. */
export const DRIFT_EYEBROW_ICON = GitCompare;

/** Builds the `?item=<type>:<id>` selection href read by the inbox Server Component. */
export function itemHref(type: ModerationQueueItemType, id: string): string {
  return `?item=${type}:${id}`;
}

/**
 * Analytics `item_type` value. The row types are already the event vocabulary the FDD observability
 * contract names (`report`, `report_cluster`, `pending_store`, `change_request`, `product_type`), so
 * this stays the single boundary where that is asserted rather than a mapping table.
 */
export function analyticsItemType(type: ModerationQueueItemType): string {
  return type;
}
