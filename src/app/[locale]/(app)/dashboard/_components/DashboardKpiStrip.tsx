import { getTranslations } from "next-intl/server";
import { Boxes, Package, Store, Wallet, type LucideIcon } from "lucide-react";
import type { DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import { formatDashboardMoney } from "../_utils/dashboardMoney";
import DashboardKpiInfoTooltip from "./DashboardKpiInfoTooltip";

export type DashboardKpiStripProps = {
  data: DashboardData;
  locale: string;
};

type KpiTile = {
  key: string;
  icon: LucideIcon;
  /** Section-identity token; drives the top edge and the tinted icon well. */
  accent: string;
  value: string;
  label: string;
  /** When set, a tooltip explains what the figure means (warning-toned when `partial`). */
  info?: { hint: string; note: string; partial: boolean };
};

/**
 * Four-tile overview of the collection: orders, products, committed value, and stores.
 * "Committed value" is Σ `Order.totalCost` (paid + still owed) across active orders, labelled and
 * explained via an always-available tooltip so it never reads as disbursed spend. When FX-pending
 * orders are excluded, the tooltip turns into a warning and names the excluded count. Cancelled
 * orders are excluded from every figure.
 */
export default async function DashboardKpiStrip({ data, locale }: DashboardKpiStripProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const { collection, paidVsOutstanding, baseCurrencyCode } = data;

  const committedPartial = paidVsOutstanding.isPartial && paidVsOutstanding.excludedOrderCount > 0;
  const committedMeaning = t("kpi.committedMeaning");
  const committedNote = committedPartial
    ? `${committedMeaning} ${t("kpi.committedPartial", { count: paidVsOutstanding.excludedOrderCount })}`
    : committedMeaning;

  const tiles: KpiTile[] = [
    {
      key: "orders",
      icon: Package,
      accent: "var(--accent)",
      value: collection.totalOrders.toLocaleString("en"),
      label: t("kpi.orders"),
    },
    {
      key: "products",
      icon: Boxes,
      accent: "var(--accent-cool)",
      value: collection.totalProducts.toLocaleString("en"),
      label: t("kpi.products"),
    },
    {
      key: "committed",
      icon: Wallet,
      accent: "var(--accent-warm)",
      value: formatDashboardMoney(paidVsOutstanding.committedMinor, baseCurrencyCode, locale),
      label: t("kpi.committed"),
      info: {
        hint: committedPartial ? t("kpi.committedPartialHint") : t("kpi.committedInfoHint"),
        note: committedNote,
        partial: committedPartial,
      },
    },
    {
      key: "stores",
      icon: Store,
      accent: "var(--success)",
      value: collection.totalStores.toLocaleString("en"),
      label: t("kpi.stores"),
    },
  ];

  return (
    <div>
      <ul role="list" className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 sm:grid-cols-4">
        {tiles.map((tile) => {
          const TileIcon = tile.icon;
          return (
            <li
              key={tile.key}
              className="flex items-center gap-[11px] rounded-[12px] px-3.5 py-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
              style={{ borderTop: `3px solid ${tile.accent}` }}
            >
              <span
                aria-hidden
                className="grid size-[34px] shrink-0 place-items-center rounded-[10px]"
                style={{
                  color: tile.accent,
                  background: `color-mix(in oklch, ${tile.accent} 14%, transparent)`,
                }}
              >
                <TileIcon size={18} />
              </span>
              <span className="flex min-w-0 flex-col gap-px">
                <span className="truncate [font-size:19px] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.02em] [color:var(--text-primary)] tabular-nums">
                  {tile.value}
                </span>
                <span className="flex items-center gap-1 [font-size:11px] [letter-spacing:0.05em] [color:var(--text-muted)] uppercase">
                  {tile.label}
                  {tile.info && (
                    <DashboardKpiInfoTooltip label={tile.info.hint} note={tile.info.note} partial={tile.info.partial} />
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
