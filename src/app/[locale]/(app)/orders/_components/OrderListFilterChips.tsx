"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn, COLLECTOR_CARD_SURFACE_CLASSNAME } from "@/lib/styles";
import {
  buildOrderListFilterUrl,
  DEFAULT_ACTIVE_STATUSES,
  hasOnlyDefaultActiveFilters,
  isDefaultActiveStatusSet,
  type OrderListActiveFilters,
} from "../_utils/orderListingParams";

const FILTER_CHIP_CLASSNAME =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-9 items-center gap-1 rounded-xl border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

type OrderListFilterChipsProps = {
  locale: string;
  basePath: string;
  filters: OrderListActiveFilters;
  storesById: Record<string, string>;
};

export default function OrderListFilterChips({
  locale,
  basePath,
  filters,
  storesById,
}: OrderListFilterChipsProps) {
  const t = useTranslations("orderListing");
  const tProductTypes = useTranslations("storeProductTypes");
  const tStatus = useTranslations("orderListing.status");
  const router = useRouter();

  const groupedDefault =
    filters.appliedDefaultStatuses || (filters.statuses.length === 4 && isDefaultActiveStatusSet(filters.statuses));

  const hasIndividualStatusChips = !groupedDefault && filters.statuses.length > 0;

  const hasAnyChip =
    !!filters.nameQuery ||
    filters.productTypeKeys.length > 0 ||
    !!filters.storeId ||
    groupedDefault ||
    hasIndividualStatusChips ||
    !!filters.dateFromIso ||
    !!filters.dateToIso;

  const hasResettableFilters =
    !hasOnlyDefaultActiveFilters({
      ...filters,
      appliedDefaultStatuses: false,
    });

  const resetHref = buildOrderListFilterUrl(basePath, {
    nameQuery: undefined,
    productTypeKeys: [],
    storeId: undefined,
    statuses: DEFAULT_ACTIVE_STATUSES,
    appliedDefaultStatuses: false,
    dateFromIso: undefined,
    dateToIso: undefined,
  });

  if (!hasAnyChip) return null;

  const removeAndPush = (overrides: Partial<OrderListActiveFilters & { page: number }>, chipLabel: string) => {
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTER_CHIP_REMOVED, { chip: chipLabel });
    router.push(buildOrderListFilterUrl(basePath, filters, { ...overrides, page: 1 }));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

  const handleReset = () => {
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTERS_RESET);
  };

  return (
    <div className={cn(COLLECTOR_CARD_SURFACE_CLASSNAME, "flex flex-wrap items-center gap-2 p-3 sm:p-4")}>
      {filters.nameQuery && (
        <button
          type="button"
          onClick={() => removeAndPush({ nameQuery: undefined }, "name")}
          className={FILTER_CHIP_CLASSNAME}
        >
          <span>{filters.nameQuery}</span>
          <X className="size-3.5" aria-hidden />
        </button>
      )}

      {filters.storeId && (
        <button
          type="button"
          onClick={() => removeAndPush({ storeId: undefined }, "store")}
          className={FILTER_CHIP_CLASSNAME}
        >
          <span>{t("chips.store", { name: storesById[filters.storeId] ?? filters.storeId })}</span>
          <X className="size-3.5" aria-hidden />
        </button>
      )}

      {filters.productTypeKeys.map((key) => (
        <button
          key={`pt-${key}`}
          type="button"
          onClick={() =>
            removeAndPush({ productTypeKeys: filters.productTypeKeys.filter((k) => k !== key) }, "productType")
          }
          className={FILTER_CHIP_CLASSNAME}
        >
          <span>{tProductTypes(key)}</span>
          <X className="size-3.5" aria-hidden />
        </button>
      ))}

      {filters.dateFromIso && (
        <button
          type="button"
          onClick={() => removeAndPush({ dateFromIso: undefined }, "dateFrom")}
          className={FILTER_CHIP_CLASSNAME}
        >
          <span>{t("chips.from", { date: formatDate(filters.dateFromIso) })}</span>
          <X className="size-3.5" aria-hidden />
        </button>
      )}

      {filters.dateToIso && (
        <button
          type="button"
          onClick={() => removeAndPush({ dateToIso: undefined }, "dateTo")}
          className={FILTER_CHIP_CLASSNAME}
        >
          <span>{t("chips.to", { date: formatDate(filters.dateToIso) })}</span>
          <X className="size-3.5" aria-hidden />
        </button>
      )}

      {groupedDefault && (
        <button
          type="button"
          onClick={() => removeAndPush({ statuses: [], appliedDefaultStatuses: false }, "soloActivas")}
          className={FILTER_CHIP_CLASSNAME}
        >
          <span>{t("chips.soloActivas")}</span>
          <X className="size-3.5" aria-hidden />
        </button>
      )}

      {hasIndividualStatusChips &&
        filters.statuses.map((status) => (
          <button
            key={`status-${status}`}
            type="button"
            onClick={() =>
              removeAndPush(
                { statuses: filters.statuses.filter((s) => s !== status), appliedDefaultStatuses: false },
                "status",
              )
            }
            className={FILTER_CHIP_CLASSNAME}
          >
            <span>{tStatus(status)}</span>
            <X className="size-3.5" aria-hidden />
          </button>
        ))}

      {hasResettableFilters && (
        <Link
          href={resetHref}
          onClick={handleReset}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto min-h-9 rounded-xl px-3")}
        >
          {t("filters.reset")}
        </Link>
      )}
    </div>
  );
}
