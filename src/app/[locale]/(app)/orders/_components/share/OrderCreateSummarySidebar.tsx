"use client";

import { useLocale, useTranslations } from "next-intl";
import { AsideSummary, AsideSummaryRow } from "@/components/modules/AsideSummary";

export type OrderCreateSummary = {
  storeName: string | null;
  currencyCode: string | null;
  orderDate: Date | null;
  deliveryFrom: Date | null;
  deliveryTo: Date | null;
  itemsCount: number;
  totalLabel: string | null;
};

type Props = {
  summary: OrderCreateSummary;
  className?: string;
};

export default function OrderCreateSummarySidebar({ summary, className }: Props) {
  const t = useTranslations("orders.create");
  const locale = useLocale();
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const fmtShort = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const emptyDash = t("summaryEmpty");

  const deliveryLabel = (() => {
    if (!summary.deliveryFrom && !summary.deliveryTo) return null;
    if (summary.deliveryFrom && summary.deliveryTo)
      return `${fmtShort(summary.deliveryFrom)} – ${fmt(summary.deliveryTo)}`;
    const anchor = (summary.deliveryFrom ?? summary.deliveryTo)!;
    return fmt(anchor);
  })();

  return (
    <AsideSummary eyebrow={t("summaryTitle")} ariaLabel={t("summaryTitle")} className={className}>
      <AsideSummaryRow label={t("summaryStore")} value={summary.storeName ?? emptyDash} muted={!summary.storeName} />
      <AsideSummaryRow
        label={t("summaryCurrency")}
        value={summary.currencyCode ?? emptyDash}
        muted={!summary.currencyCode}
      />
      <AsideSummaryRow
        label={t("summaryDate")}
        value={summary.orderDate ? fmt(summary.orderDate) : emptyDash}
        muted={!summary.orderDate}
      />
      <AsideSummaryRow label={t("summaryDelivery")} value={deliveryLabel ?? emptyDash} muted={!deliveryLabel} />
      <AsideSummaryRow
        label={t("summaryProducts")}
        value={summary.itemsCount > 0 ? t("summaryItems", { count: summary.itemsCount }) : emptyDash}
        muted={summary.itemsCount === 0}
      />
      <AsideSummaryRow
        label={t("summaryTotal")}
        value={summary.totalLabel ?? emptyDash}
        muted={!summary.totalLabel}
        strong={Boolean(summary.totalLabel)}
      />
    </AsideSummary>
  );
}
