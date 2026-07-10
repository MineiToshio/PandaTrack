import { getTranslations } from "next-intl/server";
import { AlertTriangle, Boxes, Package, Store, Wallet, type LucideIcon } from "lucide-react";
import type { DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import { formatDashboardMoney } from "../_utils/dashboardMoney";

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
  /** Set when the figure excludes FX-unreconciled orders, so it is not read as a complete total. */
  partialNote?: string;
};

/**
 * Four-tile overview of the collection: orders, products, committed value, and stores.
 * "Committed" is `Order.totalCost`, labelled distinctly so it never reads as disbursed spend
 * (`BR-06-05`). Cancelled orders are excluded from every figure (`BR-06-07`).
 */
export default async function DashboardKpiStrip({ data, locale }: DashboardKpiStripProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const { collection, paidVsOutstanding, baseCurrencyCode } = data;

  const tiles: KpiTile[] = [
    {
      key: "orders",
      icon: Package,
      accent: "var(--accent)",
      value: collection.totalOrders.toLocaleString(locale),
      label: t("kpi.orders"),
    },
    {
      key: "products",
      icon: Boxes,
      accent: "var(--accent-cool)",
      value: collection.totalProducts.toLocaleString(locale),
      label: t("kpi.products"),
    },
    {
      key: "committed",
      icon: Wallet,
      accent: "var(--accent-warm)",
      value: formatDashboardMoney(paidVsOutstanding.committedMinor, baseCurrencyCode, locale),
      label: t("kpi.committed"),
      // The counts above include FX-pending orders; the money does not (FR-06-13). Say so.
      partialNote:
        paidVsOutstanding.isPartial && paidVsOutstanding.excludedOrderCount > 0
          ? t("kpi.committedPartial", { count: paidVsOutstanding.excludedOrderCount })
          : undefined,
    },
    {
      key: "stores",
      icon: Store,
      accent: "var(--success)",
      value: collection.totalStores.toLocaleString(locale),
      label: t("kpi.stores"),
    },
  ];

  const partialNote = tiles.find((tile) => tile.partialNote)?.partialNote;

  return (
    <div>
      <ul role="list" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
                {tile.partialNote && (
                  <AlertTriangle
                    size={11}
                    aria-hidden="true"
                    className="shrink-0 [color:var(--warning)]"
                  />
                )}
              </span>
            </span>
          </li>
        );
      })}
      </ul>
      {partialNote && (
        <p className="mt-2 [font-size:12px] [line-height:1.5] [color:var(--text-muted)]">{partialNote}</p>
      )}
    </div>
  );
}
