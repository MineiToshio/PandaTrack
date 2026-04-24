"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import OrderHistoryRow from "./OrderHistoryRow";

type HistoryEntry = {
  id: string;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
};

type OrderHistoryListProps = {
  orderId: string;
  initialHistory: HistoryEntry[];
  locale: string;
};

export default function OrderHistoryList({ orderId, initialHistory, locale }: OrderHistoryListProps) {
  const t = useTranslations("orders");
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);

  function handleDeleted(id: string) {
    setHistory((prev) => prev.filter((entry) => entry.id !== id));
  }

  if (history.length === 0) return null;

  return (
    <section aria-labelledby="order-history-heading" className="space-y-3">
      <SectionTitleWithAccent as="h2" id="order-history-heading">
        {t("detail.history.sectionTitle")}
      </SectionTitleWithAccent>
      <ul className="divide-border/50 divide-y" role="list">
        {history.map((entry) => (
          <OrderHistoryRow key={entry.id} entry={entry} orderId={orderId} locale={locale} onDeleted={handleDeleted} />
        ))}
      </ul>
    </section>
  );
}
