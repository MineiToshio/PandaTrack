import { GitCompare, Pencil, ShieldAlert, Store, Tag, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ModerationQueueItemType } from "@/lib/data/admin/moderationQueueQueries";

type ItemVisual = {
  /** Lucide glyph shown at the row leading edge and the review eyebrow. */
  Icon: LucideIcon;
  /** Severity color as a CSS variable, driving the queue-row rail and glyph. */
  severityColorVar: string;
};

const ITEM_VISUALS: Record<ModerationQueueItemType, ItemVisual> = {
  flag: { Icon: TriangleAlert, severityColorVar: "var(--destructive)" },
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
 * Analytics `item_type` value. Mirrors the persisted category names, mapping the derived `flag` row to
 * `flag_candidate` so the event vocabulary matches the FDD observability contract.
 */
export function analyticsItemType(type: ModerationQueueItemType): string {
  return type === "flag" ? "flag_candidate" : type;
}
