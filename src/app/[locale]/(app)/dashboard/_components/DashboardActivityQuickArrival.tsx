"use client";

import { PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import { QuickArrivalModal } from "@/components/modules/QuickArrival";
import { useQuickArrival } from "@/components/modules/QuickArrival/useQuickArrival";
import type { ArrivalQuickItem } from "@/lib/data/dashboard/dashboardTypes";

export type DashboardActivityQuickArrivalProps = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  items: ArrivalQuickItem[];
  baseCurrencyCode: string | null;
  locale: string;
  /** `upcoming` or `overdue`, so the funnel can tell which list converts. */
  listKey: string;
};

/**
 * Trailing quick-arrival control on a dashboard arrival row: the only interactive island inside a
 * row whose navigation is a full-bleed link overlay.
 *
 * This is what closes the loop the arrival reminders open. The `ARRIVAL_OVERDUE` push and the
 * "Atrasados" tab both already tell the collector something should have arrived; until now the
 * nearest action was a four-step wizard two navigations away.
 *
 * The visible label is short because it shares a narrow row with a status chip; the full sentence
 * lives in `aria-label`, naming the order so screen-reader users can tell the rows apart.
 */
export default function DashboardActivityQuickArrival({
  orderId,
  humanReadableId,
  storeName,
  items,
  baseCurrencyCode,
  locale,
  listKey,
}: DashboardActivityQuickArrivalProps) {
  const t = useTranslations("dashboard");
  const quickArrival = useQuickArrival({ orderId, locale, source: "dashboard_activity", sourceList: listKey });

  return (
    <>
      <Button
        type="button"
        variant="tonal"
        // `md` is the size that carries the system's 44px mobile tap target (40px from md+);
        // `sm` is 32px, which is under the guideline for what is a primary action on a phone.
        size="md"
        onClick={quickArrival.open}
        leadingIcon={<PackageCheck size={14} aria-hidden />}
        aria-label={t("activity.quickArrival.ariaLabel", { code: humanReadableId, store: storeName })}
      >
        {t("activity.quickArrival.action")}
      </Button>

      <QuickArrivalModal
        isOpen={quickArrival.isOpen}
        onClose={quickArrival.close}
        subtitle={`${humanReadableId} · ${storeName}`}
        items={items}
        baseCurrencyCode={baseCurrencyCode}
        locale={locale}
        orderId={orderId}
        storeName={storeName}
        onSubmit={quickArrival.submit}
      />
    </>
  );
}
