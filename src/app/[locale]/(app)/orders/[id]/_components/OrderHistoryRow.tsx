"use client";

import { useTranslations } from "next-intl";
import Typography from "@/components/core/Typography";

type HistoryEntry = {
  id: string;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
};

type OrderHistoryRowProps = {
  entry: HistoryEntry;
  locale: string;
};

function formatEventLabel(t: ReturnType<typeof useTranslations>, entry: HistoryEntry): string {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const key = `detail.history.events.${entry.eventType}` as const;

  if ((entry.eventType === "PAYMENT_ADDED" || entry.eventType === "PAYMENT_DELETED") && meta.amount != null) {
    const currency = typeof meta.currencyCode === "string" ? meta.currencyCode : "";
    const amount = `${currency} ${((meta.amount as number) / 100).toFixed(2)}`.trim();
    return t(key as Parameters<typeof t>[0], { amount });
  }
  return t(key as Parameters<typeof t>[0]);
}

export default function OrderHistoryRow({ entry, locale }: OrderHistoryRowProps) {
  const t = useTranslations("orders");

  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(entry.createdAt));

  return (
    <li className="py-2">
      <Typography size="sm" className="text-text-body">
        {formatEventLabel(t, entry)}
      </Typography>
      <Typography size="xs" className="text-text-muted">
        {dateLabel}
      </Typography>
    </li>
  );
}
