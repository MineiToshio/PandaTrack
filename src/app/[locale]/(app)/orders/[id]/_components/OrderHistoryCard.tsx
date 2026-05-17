import CollapsibleSubcard from "./CollapsibleSubcard";
import OrderHistoryRow from "./OrderHistoryRow";
import { getTranslations } from "next-intl/server";

type HistoryEntry = {
  id: string;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
};

type OrderHistoryCardProps = {
  history: HistoryEntry[];
  locale: string;
  /** When true, dim the history body items to match the cancelled productos card so the
   *  whole detail reads as a single "frozen" record. The eyebrow + count + chevron stay
   *  at full opacity (same scope as productos). */
  isCancelled?: boolean;
};

export default async function OrderHistoryCard({ history, locale, isCancelled = false }: OrderHistoryCardProps) {
  const t = await getTranslations({ locale, namespace: "orders" });

  if (history.length === 0) return null;

  return (
    <CollapsibleSubcard
      eyebrow={t("detail.history.sectionTitle")}
      meta={String(history.length)}
      defaultOpen={false}
      bodyClassName={isCancelled ? "opacity-60" : undefined}
    >
      {/* Demo `.activity-list`: flex column gap 4px, no dividers between items. */}
      <ul className="flex list-none flex-col gap-1" role="list">
        {history.map((entry) => (
          <OrderHistoryRow key={entry.id} entry={entry} locale={locale} />
        ))}
      </ul>
    </CollapsibleSubcard>
  );
}
