"use client";

import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import SectionSurfaceCard from "@/components/modules/SectionSurfaceCard";
import OrderHistoryRow from "./OrderHistoryRow";

type HistoryEntry = {
  id: string;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
};

type OrderHistoryListProps = {
  initialHistory: HistoryEntry[];
  locale: string;
};

export default function OrderHistoryList({ initialHistory, locale }: OrderHistoryListProps) {
  const t = useTranslations("orders");

  if (initialHistory.length === 0) return null;

  return (
    <section aria-labelledby="order-history-heading">
      <SectionSurfaceCard
        title={t("detail.history.sectionTitle")}
        titleId="order-history-heading"
        titleAs="h2"
        icon={History}
        iconClassName="text-warning"
      >
        <ul className="divide-border/50 list-none divide-y" role="list">
          {initialHistory.map((entry) => (
            <OrderHistoryRow key={entry.id} entry={entry} locale={locale} />
          ))}
        </ul>
      </SectionSurfaceCard>
    </section>
  );
}
