"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, CornerDownLeft, Info, Truck, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import StatusChip from "@/components/core/StatusChip";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { foldSearchText } from "@/lib/strings/foldSearchText";
import { cn } from "@/lib/styles";
import type { EligibleProduct, EligibleProductsGroup } from "@/lib/data/deliveries/deliveryQueries";

type DeliveryProductsPickerProps = {
  groups: EligibleProductsGroup[];
  selectedIds: string[];
  onToggleProduct: (productId: string) => void;
  onToggleGroup: (productIds: string[]) => void;
  query: string;
  onQueryChange: (next: string) => void;
  /** Group rendered first (from-order entry: the source order). */
  primaryOrderId?: string;
  /**
   * Edit mode: ids currently linked to the delivery. Selected-current items show the
   * "En esta entrega" chip; deselected-current rows tint warning with the FR-08-24 notice.
   */
  currentIds?: string[];
  /** Restores the initial selection (create-mode footer "Deshacer"). */
  onUndo?: () => void;
  /** DOM id for the search input (the `/` shortcut focuses it). */
  searchInputId?: string;
};

/**
 * Shared eligible-product selector (create paso 2 + edit Productos card). Groups by
 * source order with per-order select-all, binary checks per OrderItem (FR-08-04a),
 * client-side accent-folded search (FR-08-34), and per-item state chips.
 */
export default function DeliveryProductsPicker({
  groups,
  selectedIds,
  onToggleProduct,
  onToggleGroup,
  query,
  onQueryChange,
  primaryOrderId,
  currentIds,
  onUndo,
  searchInputId,
}: DeliveryProductsPickerProps) {
  const t = useTranslations("deliveries");
  const locale = useLocale();
  const isEditMode = currentIds != null;
  const currentIdSet = useMemo(() => new Set(currentIds ?? []), [currentIds]);
  const [collapsedOrderIds, setCollapsedOrderIds] = useState<string[]>([]);

  const orderedGroups = useMemo(() => {
    if (!primaryOrderId) return groups;
    const primary = groups.filter((g) => g.orderId === primaryOrderId);
    const rest = groups.filter((g) => g.orderId !== primaryOrderId);
    return [...primary, ...rest];
  }, [groups, primaryOrderId]);

  const foldedQuery = useMemo(() => foldSearchText(query), [query]);
  const filteredGroups = useMemo(() => {
    if (!foldedQuery) return orderedGroups;
    return orderedGroups
      .map((group) => ({
        ...group,
        products: group.products.filter((p) => foldSearchText(p.orderItemName).includes(foldedQuery)),
      }))
      .filter((group) => group.products.length > 0);
  }, [orderedGroups, foldedQuery]);

  function handleGroupCollapse(orderId: string) {
    setCollapsedOrderIds((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "2-digit" });
  }

  return (
    <div className="space-y-3.5">
      <Input
        id={searchInputId}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t("create.products.searchPlaceholder")}
        aria-label={t("create.products.searchAriaLabel")}
      />

      {filteredGroups.length === 0 && foldedQuery ? (
        <p className="text-[13px] [color:var(--text-muted)]">{t("create.products.noMatches", { query })}</p>
      ) : (
        filteredGroups.map((group) => {
          const productIds = group.products.map((p) => p.orderItemId);
          const allSelected = productIds.length > 0 && productIds.every((id) => selectedIds.includes(id));
          const isCollapsed = collapsedOrderIds.includes(group.orderId);

          return (
            <div
              key={group.orderId}
              className="overflow-hidden rounded-xl [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
            >
              <div className="flex items-center gap-2 px-3 py-2.5 [border-bottom:1px_solid_var(--border)]">
                <button
                  type="button"
                  onClick={() => handleGroupCollapse(group.orderId)}
                  aria-expanded={!isCollapsed}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="shrink-0 font-mono text-[12px] font-semibold [color:var(--text-primary)]">
                    {group.orderHumanReadableId}
                  </span>
                  <span className="min-w-0 truncate text-[12px] [color:var(--text-muted)]">
                    · {formatDate(group.orderDate)} ·{" "}
                    {t("create.products.eligibleCount", { count: group.products.length })}
                  </span>
                  <ChevronDown
                    size={14}
                    aria-hidden
                    className={cn(
                      "shrink-0 [color:var(--text-muted)] transition-transform duration-150",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleGroup(productIds)}
                  className="flex shrink-0 items-center gap-1.5 text-[12px] [color:var(--text-secondary)] hover:[color:var(--text-primary)]"
                  aria-pressed={allSelected}
                >
                  <CheckBox checked={allSelected} />
                  {t("create.products.selectAll")}
                </button>
              </div>

              {!isCollapsed && (
                <ul role="list" className="flex flex-col px-1.5 py-1">
                  {group.products.map((product) => {
                    const isSelected = selectedIds.includes(product.orderItemId);
                    const isCurrent = currentIdSet.has(product.orderItemId);
                    const isBeingRemoved = isEditMode && isCurrent && !isSelected;
                    const ItemIcon = getStoreProductTypeIcon(product.productTypeKey ?? "");

                    return (
                      <li key={product.orderItemId}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => onToggleProduct(product.orderItemId)}
                          className={cn(
                            "grid w-full [grid-template-columns:18px_32px_minmax(0,1fr)_44px] items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors",
                            "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
                            isBeingRemoved && "[background:color-mix(in_oklch,var(--warning)_6%,transparent)]",
                          )}
                        >
                          <CheckBox checked={isSelected} />
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_10%,transparent)]"
                            aria-hidden
                          >
                            <ItemIcon width={14} height={14} />
                          </span>
                          <span className="flex min-w-0 flex-col items-start gap-1">
                            <span className="w-full min-w-0 truncate text-[13.5px] [color:var(--text-primary)]">
                              {product.orderItemName}
                            </span>
                            {isBeingRemoved ? (
                              <span className="flex items-center gap-1 text-[12px] [color:var(--warning)]">
                                <CornerDownLeft size={11} aria-hidden className="shrink-0" />
                                {t.rich("edit.products.removalNotice", {
                                  strong: (chunks) => <strong className="font-semibold">{chunks}</strong>,
                                })}
                              </span>
                            ) : isEditMode && isCurrent ? (
                              <StatusChip
                                kind="info"
                                icon={<Truck size={14} aria-hidden />}
                                label={t("edit.products.inThisDelivery")}
                                size="sm"
                              />
                            ) : (
                              <StatusChip
                                kind="itemDeliveryState"
                                value={product.deliveryState === "ARRIVED_AT_STORE" ? "ARRIVED_AT_STORE" : "NONE"}
                                size="sm"
                              />
                            )}
                          </span>
                          <span className="text-right text-[12.5px] [color:var(--text-secondary)] tabular-nums">
                            ×{product.quantity}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}

      <p className="flex items-start gap-1.5 text-[12px] [color:var(--text-muted)]">
        <Info size={12} aria-hidden className="mt-0.5 shrink-0" />
        {isEditMode ? t("edit.products.note") : t("create.products.note")}
      </p>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] [color:var(--text-muted)]" aria-live="polite">
          {t("create.products.selectedCount", { count: selectedIds.length })}
        </span>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium [color:var(--accent)] hover:underline"
          >
            <Undo2 size={13} aria-hidden />
            {t("create.products.undo")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Demo `.check` — 18px rounded square that fills with the accent when checked. */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] transition-colors",
        checked
          ? "[color:var(--text-on-accent)] [background:var(--accent)]"
          : "[background:transparent] [border:1.5px_solid_var(--border-strong)]",
      )}
    >
      {checked && <Check size={12} strokeWidth={3} aria-hidden />}
    </span>
  );
}

export type { EligibleProduct };
