import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/styles";
import type { ModerationQueueItem } from "@/lib/data/admin/moderationQueueQueries";
import { getItemVisual, itemHref } from "../_utils/moderationItemView";

type QueueRowProps = {
  item: ModerationQueueItem;
  locale: string;
  isSelected: boolean;
};

/**
 * A single compact queue row: leading severity glyph, category eyebrow, entity label, a short meta
 * line, and a chevron. The whole row is a link to `?item=<type>:<id>` (server-resolved selection). The
 * selected row carries an accent-tinted surface and rail, not color alone (a text category label and a
 * glyph accompany the severity color).
 */
export default async function QueueRow({ item, locale, isSelected }: QueueRowProps) {
  const tQueue = await getTranslations({ locale, namespace: "admin.queue" });
  const tReview = await getTranslations({ locale, namespace: "admin.review" });
  const tCountries = await getTranslations({ locale, namespace: "countries" });

  const { Icon, severityColorVar } = getItemVisual(item.type);
  const category = tQueue(`category.${item.type}`);

  let entityName: string;
  let metaText: string;
  switch (item.type) {
    case "flag":
      entityName = item.store.name;
      metaText = tQueue("reportsAccumulated", { count: item.reports.length });
      break;
    case "report":
      entityName = item.store.name;
      metaText = tReview(`reportReason.${item.report.reason}`);
      break;
    case "pending_store":
      entityName = item.store.name;
      metaText = `${tReview(`sellerType.${item.store.sellerType}`)} · ${tCountries(item.store.countryCode)}`;
      break;
    case "change_request":
      entityName = item.store.name;
      metaText = item.request.storeDriftedSinceSubmission
        ? tQueue("driftTag")
        : tQueue("fieldsChanged", { count: item.request.fieldRows.length });
      break;
    case "product_type":
      entityName = item.request.suggestedName;
      metaText = `@${item.request.requester.username}`;
      break;
  }

  return (
    <a
      href={itemHref(item.type, item.id)}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-md)] border p-3 transition-colors",
        "[border-left-width:3px]",
        isSelected
          ? "[border-color:color-mix(in_oklch,var(--accent)_55%,transparent)] [background:color-mix(in_oklch,var(--accent)_8%,var(--surface))]"
          : "border-border bg-surface hover:[border-color:var(--border-strong)]",
      )}
      style={{ borderLeftColor: severityColorVar }}
    >
      <span className="flex size-8 items-center justify-center" style={{ color: severityColorVar }}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className="[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] uppercase"
          style={{ color: severityColorVar }}
        >
          {category}
        </span>
        <span className="text-text-primary truncate text-sm font-medium">{entityName}</span>
        <span className="truncate text-xs [color:var(--text-muted)]">{metaText}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 [color:var(--text-muted)]" aria-hidden />
    </a>
  );
}
