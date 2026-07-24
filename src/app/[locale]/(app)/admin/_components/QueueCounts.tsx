import { getTranslations } from "next-intl/server";
import type { ModerationQueueCounts } from "@/lib/data/admin/moderationQueueQueries";

type QueueCountsProps = {
  counts: ModerationQueueCounts;
  locale: string;
};

/**
 * The per-category counter row above the queue. Four counters map to the four persisted categories;
 * the derived flag-candidate rows are already folded into the `stores` count (FDD-02 section 6.1).
 */
export default async function QueueCounts({ counts, locale }: QueueCountsProps) {
  const t = await getTranslations({ locale, namespace: "admin.inbox" });

  const items: Array<{ key: keyof ModerationQueueCounts; colorVar: string }> = [
    { key: "reports", colorVar: "var(--destructive)" },
    { key: "stores", colorVar: "var(--warning)" },
    { key: "changes", colorVar: "var(--warning)" },
    { key: "types", colorVar: "var(--info)" },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {items.map(({ key, colorVar }) => (
        <li
          key={key}
          className="border-border bg-surface-elevated text-text-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
        >
          <span className="size-2 rounded-full" style={{ background: colorVar }} aria-hidden />
          <span>{t(`counts.${key}`)}</span>
          <span className="text-text-primary font-semibold">{counts[key]}</span>
        </li>
      ))}
    </ul>
  );
}
