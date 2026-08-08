"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import StoreGroupHeader from "./StoreGroupHeader";
import StorePendingProductCard from "./StorePendingProductCard";
import StorePendingProductRow, { STORE_PRODUCT_ROW_GRID } from "./StorePendingProductRow";

type StoreGroupedViewProps = {
  groups: PendingProductsByStoreGroup[];
  locale: string;
  returnTo: string;
};

/**
 * Orders list "Por tienda" view: one collapsible card per store with its pending products. Each
 * group's expand/collapse state is local to this component (a fresh `Set` per mount) — deliberately
 * NOT `useListExpansion`, which is the shared multi-open state the classic per-order list already
 * owns; sharing it here would let this view's toggles bleed into that one's "expand/collapse all".
 * Groups default open: this view exists precisely to show every pending product at once (no
 * pagination), so collapsing is an opt-out a collector reaches for once they know what they're
 * hiding, not the default they land on.
 */
export default function StoreGroupedView({ groups, locale, returnTo }: StoreGroupedViewProps) {
  const t = useTranslations("orderListing");
  const [collapsedStoreIds, setCollapsedStoreIds] = useState<Set<string>>(() => new Set());

  const handleToggle = (storeId: string) => {
    setCollapsedStoreIds((prev) => {
      const next = new Set(prev);
      const willCollapse = !next.has(storeId);
      if (willCollapse) next.add(storeId);
      else next.delete(storeId);
      posthog.capture(
        willCollapse ? POSTHOG_EVENTS.ORDER.LIST_STORE_GROUP_COLLAPSED : POSTHOG_EVENTS.ORDER.LIST_STORE_GROUP_EXPANDED,
        { store_id: storeId },
      );
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const isExpanded = !collapsedStoreIds.has(group.store.id);
        const bodyId = `store-group-body-${group.store.id}`;

        return (
          <section
            key={group.store.id}
            className="overflow-hidden rounded-[var(--radius-2xl)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
          >
            <StoreGroupHeader
              store={group.store}
              openOrdersCount={group.openOrdersCount}
              pendingProductCount={group.pendingProducts.length}
              debts={group.debts}
              locale={locale}
              isExpanded={isExpanded}
              onToggleExpand={() => handleToggle(group.store.id)}
            />

            {isExpanded && (
              <div id={bodyId} className="px-4 pb-3 [border-top:1px_solid_var(--border)] md:px-5 md:pb-4">
                {/* Desktop: column headers + grid rows */}
                <div className="hidden lg:block">
                  <div
                    className={`grid gap-3 pt-3 pb-1 [font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase ${STORE_PRODUCT_ROW_GRID}`}
                  >
                    <span>{t("storeView.columnProduct")}</span>
                    <span className="text-right">{t("storeView.columnPrice")}</span>
                    <span className="text-center">{t("storeView.columnArrival")}</span>
                    <span className="text-right">{t("storeView.columnPaid")}</span>
                  </div>
                  <ul role="list" className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
                    {group.pendingProducts.map((product) => (
                      <StorePendingProductRow
                        key={product.itemId}
                        product={product}
                        locale={locale}
                        returnTo={returnTo}
                      />
                    ))}
                  </ul>
                </div>

                {/* Mobile: two-line cards */}
                <ul role="list" className="flex flex-col pt-2 lg:hidden">
                  {group.pendingProducts.map((product) => (
                    <StorePendingProductCard
                      key={product.itemId}
                      product={product}
                      locale={locale}
                      returnTo={returnTo}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
