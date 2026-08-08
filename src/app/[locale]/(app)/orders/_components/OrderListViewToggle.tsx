"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import ToggleChoiceGroup from "@/components/core/ToggleChoiceGroup";
import { ORDER_LIST_VIEW_COOKIE_NAME, POSTHOG_EVENTS } from "@/lib/constants";
import type { OrderListViewMode } from "../_utils/orderListingParams";

/** One year — matches the locale cookie's lifetime for a "remember my choice" preference. */
const VIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type OrderListViewToggleProps = {
  view: OrderListViewMode;
  className?: string;
};

/**
 * Segmented "Por pedido / Por tienda" switch for the Orders list. Writes the choice to a cookie
 * (read server-side by the page on the next load) and to the `?view=` param (so the current load's
 * URL is shareable/bookmarkable), then swaps the list body — the per-order filters/search do not
 * apply in store view; see `OrderListFilters`.
 */
export default function OrderListViewToggle({ view, className }: OrderListViewToggleProps) {
  const t = useTranslations("orderListing");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (next: string) => {
    if (next !== "store" && next !== "order") return;
    if (next === view) return;

    document.cookie = `${ORDER_LIST_VIEW_COOKIE_NAME}=${next}; path=/; max-age=${VIEW_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_VIEW_CHANGED, { view: next });

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div role="group" aria-label={t("view.groupLabel")} className={className}>
      <ToggleChoiceGroup
        mode="single"
        value={view}
        onChange={handleChange}
        appearance="chip"
        options={[
          { value: "order", label: t("view.order") },
          { value: "store", label: t("view.store") },
        ]}
      />
    </div>
  );
}
