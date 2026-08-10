"use client";

import type { MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListOrdered, Store, type LucideIcon } from "lucide-react";
import posthog from "posthog-js";
import Tooltip from "@/components/core/Tooltip";
import { ORDER_LIST_VIEW_COOKIE_NAME, POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { OrderListViewMode } from "../_utils/orderListingParams";

/** One year — matches the locale cookie's lifetime for a "remember my choice" preference. */
const VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type OrderListViewToggleVariant = "label" | "icon-only";

type OrderListViewToggleProps = {
  view: OrderListViewMode;
  className?: string;
  /**
   * "label"     — icon + visible text per option. Used in the desktop toolbar, where there is
   *               room to spell out both positions.
   * "icon-only" — icon only; the accessible name and a hover/focus `Tooltip` carry the text.
   *               Used in the mobile sticky row (mirrors `FilterTriggerButton`'s `icon-only`
   *               convention) so the switch never competes with the search field for width.
   * Default `"label"`.
   */
  variant?: OrderListViewToggleVariant;
};

const VIEW_OPTIONS: { value: OrderListViewMode; icon: LucideIcon }[] = [
  { value: "order", icon: ListOrdered },
  { value: "store", icon: Store },
];

/**
 * Compact segmented "Por pedido / Por tienda" switch for the Orders list — same visual grammar as
 * `ThemeToggle` (pill container, per-option `aria-pressed`, accent-tint active state) instead of
 * two independent full-width chips, so the always-binary choice reads as one small control rather
 * than two competing actions. Writes the choice to a cookie (read server-side by the page on the
 * next load) and to the `?view=` param (so the current load's URL is shareable/bookmarkable), then
 * swaps the list body — the per-order filters/search do not apply in store view; see
 * `OrderListFilters`.
 */
export default function OrderListViewToggle({ view, className, variant = "label" }: OrderListViewToggleProps) {
  const t = useTranslations("orderListing");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Reads the target view off the clicked button's `data-view` instead of closing over `value`
  // inside the options loop below — a stable handler reference (like the previous single
  // `onChange={handleChange}` this replaced) rather than a fresh per-option inline arrow.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.dataset.view as OrderListViewMode | undefined;
    if (!next || next === view) return;

    document.cookie = `${ORDER_LIST_VIEW_COOKIE_NAME}=${next}; path=/; max-age=${VIEW_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_VIEW_CHANGED, { view: next });

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    params.delete("page");
    // The two views have disjoint sort domains (order view's default is "recent", store view's is
    // "arrival-asc") and only partially overlap in values — a `?sort=` picked in one view can name
    // a value the other doesn't offer, or silently mean something else. Drop it on every switch so
    // each view lands on its own default instead of carrying over a stale or mismatched sort.
    params.delete("sort");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div
      role="group"
      aria-label={t("view.groupLabel")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[var(--radius-pill)] p-0.5",
        "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
        className,
      )}
    >
      {VIEW_OPTIONS.map(({ value, icon: Icon }) => {
        const selected = view === value;
        const label = t(`view.${value}`);

        const optionButton = (
          <button
            type="button"
            aria-pressed={selected}
            aria-label={variant === "icon-only" ? label : undefined}
            data-view={value}
            onClick={handleClick}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-1.5",
              "rounded-[var(--radius-pill)] font-medium transition-colors",
              "[transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              "focus-visible:[outline-color:var(--focus-ring)]",
              variant === "icon-only"
                ? "h-10 w-10"
                : "h-8 px-3 [font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
              selected
                ? "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_12%,transparent)]"
                : "[color:var(--text-muted)] hover:[color:var(--text-primary)]",
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {variant === "label" && label}
          </button>
        );

        return (
          // `asDiv`: `optionButton` is always a native <button>, so the Tooltip wrapper must not
          // render its own <button> around it (invalid nested-button markup / hydration mismatch).
          <Tooltip key={value} content={label} side="bottom" asDiv>
            {optionButton}
          </Tooltip>
        );
      })}
    </div>
  );
}
