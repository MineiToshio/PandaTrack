"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useToast } from "@/contexts/ToastContext";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { createStorePaymentAction } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import {
  StorePaymentSheet,
  useStorePaymentSheetOrders,
  type StorePaymentSheetSubmitInput,
} from "@/components/modules/StorePaymentSheet";
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
 *
 * Also owns the store payment sheet, shared by every group's "Registrar pago" button (one sheet
 * instance, `activeStoreId` tracks which group it is currently open for). A payment success
 * optimistically patches this view's own copy of `groups`: the store's debt figure, and every
 * pending product's `allocatedMinor`/`settled` for allocations that named a specific product. A
 * declaration line with no product (money "on account" against the order as a whole) has no single
 * pending-product row to attribute to in this view, so it only moves the debt figure — the row-level
 * `allocatedMinor` catches up on the next full page load, same as the classic per-order list already
 * does for order-level (non-declared) payments.
 */
export default function StoreGroupedView({ groups, locale, returnTo }: StoreGroupedViewProps) {
  const t = useTranslations("orderListing");
  const tPayment = useTranslations("orders.detail.storePayment");
  const { addToast } = useToast();
  const [collapsedStoreIds, setCollapsedStoreIds] = useState<Set<string>>(() => new Set());
  const [groupsState, setGroupsState] = useState<PendingProductsByStoreGroup[]>(groups);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const sheet = useStorePaymentSheetOrders();

  // Reset local state whenever the server hands down a genuinely different `groups` list (a new
  // navigation, a filter change) — never mid-flight of this view's own optimistic patch, which
  // already applied its change locally before any server round-trip.
  const groupsSignature = groups
    .map(
      (group) =>
        `${group.store.id}:${group.debts.map((debt) => `${debt.currencyCode}=${debt.debtMinor}`).join(",")}:${group.pendingProducts
          .map((product) => `${product.itemId}=${product.allocatedMinor}=${product.settled}`)
          .join(",")}`,
    )
    .join("|");
  const lastServerSignatureRef = useRef(groupsSignature);
  useEffect(() => {
    if (groupsSignature !== lastServerSignatureRef.current) {
      lastServerSignatureRef.current = groupsSignature;
      setGroupsState(groups);
    }
  }, [groupsSignature, groups]);

  const activeGroup = groupsState.find((group) => group.store.id === activeStoreId) ?? null;

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

  const handleOpenPayment = (storeId: string) => {
    setActiveStoreId(storeId);
    sheet.open(storeId, "orders_store_view");
  };

  const handleSubmitPayment = (input: StorePaymentSheetSubmitInput) => {
    const storeId = activeStoreId;
    if (!storeId) return;

    const previous = groupsState;
    setGroupsState((prev) =>
      prev.map((group) => {
        if (group.store.id !== storeId) return group;
        const itemDeltas = new Map<string, { amount: number; settled: boolean }>();
        for (const allocation of input.allocations) {
          if (!allocation.orderItemId) continue;
          const current = itemDeltas.get(allocation.orderItemId) ?? { amount: 0, settled: false };
          itemDeltas.set(allocation.orderItemId, {
            amount: current.amount + allocation.amountMinor,
            settled: current.settled || Boolean(allocation.settlesTarget),
          });
        }
        return {
          ...group,
          debts: group.debts.map((debt) =>
            debt.currencyCode === input.currencyCode ? { ...debt, debtMinor: debt.debtMinor - input.amount } : debt,
          ),
          pendingProducts: group.pendingProducts.map((product) => {
            const delta = itemDeltas.get(product.itemId);
            if (!delta) return product;
            return {
              ...product,
              allocatedMinor: product.allocatedMinor + delta.amount,
              settled: product.settled || delta.settled,
            };
          }),
        };
      }),
    );

    void createStorePaymentAction({
      storeId,
      amount: input.amount,
      paymentDate: input.paymentDate,
      currencyCode: input.currencyCode,
      note: input.note,
      allocations: input.allocations,
    }).then((result) => {
      if (!result.ok) {
        setGroupsState(previous);
        const key = `error.${result.error}` as const;
        addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
          variant: "error",
        });
        return;
      }
      addToast(tPayment("toastSuccess"), { variant: "success" });
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {groupsState.map((group) => {
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
              onRegisterPayment={() => handleOpenPayment(group.store.id)}
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
                  <ul role="list" className="flex flex-col">
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

      <StorePaymentSheet
        // Keyed by store: remounts the sheet's internal draft state (currency, amount, note,
        // allocations) whenever the active store changes, instead of relying on a `useState`
        // initializer that only ever runs once. Without this, the sheet's first-ever open mounts
        // with `debts=[]` (this view renders it unconditionally, before any store is active) and
        // every later open of a different store keeps replaying the previous store's currency and
        // draft — the sheet only reset on its own `handleClose`, never on switching targets.
        key={activeStoreId ?? "none"}
        isOpen={sheet.isOpen}
        onClose={sheet.close}
        storeName={activeGroup?.store.name ?? ""}
        debts={activeGroup?.debts ?? []}
        orders={sheet.orders}
        ordersLoading={sheet.isLoading}
        locale={locale}
        onSubmit={handleSubmitPayment}
      />
    </div>
  );
}
