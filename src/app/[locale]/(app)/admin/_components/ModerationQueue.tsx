import { getTranslations } from "next-intl/server";
import type { ModerationQueueItem } from "@/lib/data/admin/moderationQueueQueries";
import QueueRow from "./QueueRow";

type ModerationQueueProps = {
  items: ModerationQueueItem[];
  selectedItem: ModerationQueueItem | null;
  locale: string;
};

/** The impact-ordered queue column (master): one selectable row per item. */
export default async function ModerationQueue({ items, selectedItem, locale }: ModerationQueueProps) {
  const t = await getTranslations({ locale, namespace: "admin.inbox" });

  return (
    <nav aria-label={t("queueLabel")} className="flex flex-col gap-2">
      {items.map((item) => (
        <QueueRow
          key={`${item.type}:${item.id}`}
          item={item}
          locale={locale}
          isSelected={selectedItem?.type === item.type && selectedItem?.id === item.id}
        />
      ))}
    </nav>
  );
}
