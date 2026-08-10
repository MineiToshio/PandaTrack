"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import posthog from "posthog-js";
import Select from "@/components/core/Select";
import { MobilePicker, type MobilePickerOption } from "@/components/modules/MobilePicker";
import { ORDER_LIST_VIEW_COOKIE_NAME, POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { OrderListViewMode } from "../_utils/orderListingParams";

/** One year — matches the locale cookie's lifetime for a "remember my choice" preference. */
const VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type OrderListGroupByVariant = "select" | "compact";

type OrderListGroupByProps = {
  view: OrderListViewMode;
  /**
   * "select"  — desktop `Select` trigger showing only the active option as text: no icon, no
   *             tooltip, no segmented pair. Used from `lg` up, where the toolbar renders it inline.
   * "compact" — mobile pill trigger + `MobilePicker` sheet, the same shape `OrderCurrencyField` /
   *             `ItemTypePicker` use for their mobile variant. Used in the sticky mobile action row.
   * Default `"select"`.
   */
  variant?: OrderListGroupByVariant;
  id?: string;
  className?: string;
};

function isOrderListViewMode(value: string): value is OrderListViewMode {
  return value === "order" || value === "store";
}

/**
 * Replaces the old `OrderListViewToggle` segmented control. The Orders list "Por pedido / Por
 * tienda" choice is low-frequency and always binary, so it reads better as the ACTIVE VALUE (a
 * select trigger or a pill) than as a segmented pair showing both options at once — see
 * `docs/design/interface-patterns.md` §3 (measured: the segmented icon+label pair ran ~230px, the
 * value-as-select form ~111px, in either language). Writes the choice to a cookie (read
 * server-side on the next load) and to `?view=` (so the current load's URL is shareable /
 * bookmarkable), then swaps the list body — the per-order filters/search do not apply in store
 * view; see `OrderListFilters`.
 */
export default function OrderListGroupBy({ view, variant = "select", id, className }: OrderListGroupByProps) {
  const t = useTranslations("orderListing");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleChange = useCallback(
    (nextValue: string) => {
      if (!isOrderListViewMode(nextValue) || nextValue === view) return;

      document.cookie = `${ORDER_LIST_VIEW_COOKIE_NAME}=${nextValue}; path=/; max-age=${VIEW_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
      posthog.capture(POSTHOG_EVENTS.ORDER.LIST_VIEW_CHANGED, { view: nextValue, surface: variant });

      const params = new URLSearchParams(searchParams.toString());
      params.set("view", nextValue);
      params.delete("page");
      // The two views have disjoint sort domains (order view's default is "recent", store view's is
      // "arrival-asc") and only partially overlap in values — a `?sort=` picked in one view can name
      // a value the other doesn't offer, or silently mean something else. Drop it on every switch so
      // each view lands on its own default instead of carrying over a stale or mismatched sort.
      params.delete("sort");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams, variant, view],
  );

  const groupLabel = t("view.ariaLabel");

  if (variant === "compact") {
    const compactLabel = view === "order" ? t("view.compactOrder") : t("view.compactStore");
    const fullLabel = view === "order" ? t("view.order") : t("view.store");
    const options: MobilePickerOption[] = [
      { value: "order", label: t("view.order") },
      { value: "store", label: t("view.store") },
    ];

    return (
      <>
        <button
          type="button"
          id={id}
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={t("view.compactAriaLabel", { value: fullLabel })}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1 rounded-[var(--radius-pill)] px-3",
            "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)] font-medium",
            "[color:var(--text-primary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
            "cursor-pointer transition-colors [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
            "hover:[background:color-mix(in_oklab,var(--text-primary)_4%,var(--surface-elevated))]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            "focus-visible:[outline-color:var(--focus-ring)]",
            className,
          )}
        >
          {/* Same width-sizer technique `Select` uses for its own trigger: "Pedido"/"Tienda" (or
              "Order"/"Store") render at slightly different pixel widths, so a shrink-to-fit label
              shifted the pill's left edge by a couple px depending on which option was active —
              visible as the trigger nudging sideways when the view changed, which is exactly the
              x-position jump this control isn't supposed to have. An invisible zero-height stack of
              both labels sizes this wrapper to the wider one; the visible label then centers inside
              that now-fixed width, so the pill's width (and left edge) never depends on which
              option is currently shown. */}
          <span className="relative inline-block">
            <span aria-hidden className="pointer-events-none block h-0 overflow-hidden">
              <span className="block whitespace-nowrap">{t("view.compactOrder")}</span>
              <span className="block whitespace-nowrap">{t("view.compactStore")}</span>
            </span>
            <span className="block text-center whitespace-nowrap">{compactLabel}</span>
          </span>
          <ChevronDown size={14} aria-hidden="true" className="shrink-0 [color:var(--text-muted)]" />
        </button>

        <MobilePicker
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={groupLabel}
          options={options}
          selectedValue={view}
          onSelect={handleChange}
          searchable={false}
        />
      </>
    );
  }

  return (
    <Select
      id={id}
      aria-label={groupLabel}
      value={view}
      onChange={handleChange}
      size="md"
      className={cn("w-max", className)}
      options={[
        {
          heading: groupLabel,
          options: [
            { value: "order", label: t("view.order") },
            { value: "store", label: t("view.store") },
          ],
        },
      ]}
    />
  );
}
