"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import AppliedFilterChip from "@/components/core/AppliedFilterChip";
import { POSTHOG_EVENTS } from "@/lib/constants";

type StoreViewFilterChipsProps = {
  /** Active `?sq=` search text. Nothing renders without it. */
  query: string | undefined;
};

/**
 * Applied-filter chip row for the Orders list "Por tienda" view, mirroring the "Por pedido" list's
 * `OrderListFilterChips`: what is narrowing the list is stated below the toolbar, and removing it
 * is one click on the chip's own X.
 *
 * It is a separate component rather than a branch of `OrderListFilterChips` because that one is
 * built on `OrderListActiveFilters` + `buildOrderListFilterUrl`, which rebuild the URL from the
 * ORDER view's filter shape alone (dropping `?view=store` along the way). This view has exactly one
 * filter and removes it the same params-preserving way its toolbar applies it.
 *
 * No "Limpiar filtros" link beside it: that link exists in the order view because several chips can
 * be up at once, and here the single chip's X already is the clear-all.
 */
export default function StoreViewFilterChips({ query }: StoreViewFilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("orderListing");

  if (!query) return null;

  const label = `"${query}"`;

  const handleRemove = () => {
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTER_CHIP_REMOVED, { chip: "search", view: "store" });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sq");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("storeView.search.label")}>
      <AppliedFilterChip label={label} removeAriaLabel={t("chips.remove", { label })} onRemove={handleRemove} />
    </div>
  );
}
