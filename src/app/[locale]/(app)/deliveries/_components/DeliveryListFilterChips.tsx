"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import AppliedFilterChip from "@/components/core/AppliedFilterChip";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  buildDeliveryListFilterUrl,
  hasOnlyDefaultDeliveryFilters,
  type DeliveryListActiveFilters,
} from "../_utils/deliveryListingParams";

type DeliveryListFilterChipsProps = {
  basePath: string;
  locale: string;
  filters: DeliveryListActiveFilters;
  storesById: Record<string, string>;
};

export default function DeliveryListFilterChips({
  basePath,
  locale,
  filters,
  storesById,
}: DeliveryListFilterChipsProps) {
  const router = useRouter();
  const t = useTranslations("deliveries");

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (filters.nameQuery) {
    chips.push({
      key: "name",
      label: `"${filters.nameQuery}"`,
      onRemove: () => pushOverride({ nameQuery: undefined }, "name"),
    });
  }
  filters.statuses.forEach((status) =>
    chips.push({
      key: `status-${status}`,
      label: t(`list.status.${status}`),
      onRemove: () => pushOverride({ statuses: filters.statuses.filter((s) => s !== status) }, "status"),
    }),
  );
  if (filters.overdueOnly) {
    chips.push({
      key: "overdue",
      label: t("list.chips.overdueOnly"),
      onRemove: () => pushOverride({ overdueOnly: false }, "overdue"),
    });
  } else if (filters.arrivalFromIso && filters.arrivalToIso) {
    chips.push({
      key: "arrivalRange",
      label: t("list.chips.arrivalRange", {
        from: formatDate(filters.arrivalFromIso),
        to: formatDate(filters.arrivalToIso),
      }),
      onRemove: () => pushOverride({ arrivalFromIso: undefined, arrivalToIso: undefined }, "arrivalRange"),
    });
  } else if (filters.arrivalFromIso) {
    chips.push({
      key: "arrivalFrom",
      label: t("list.chips.arrivalFrom", { date: formatDate(filters.arrivalFromIso) }),
      onRemove: () => pushOverride({ arrivalFromIso: undefined }, "arrivalFrom"),
    });
  } else if (filters.arrivalToIso) {
    chips.push({
      key: "arrivalTo",
      label: t("list.chips.arrivalTo", { date: formatDate(filters.arrivalToIso) }),
      onRemove: () => pushOverride({ arrivalToIso: undefined }, "arrivalTo"),
    });
  }
  if (filters.storeId) {
    chips.push({
      key: "store",
      label: t("list.chips.store", { name: storesById[filters.storeId] ?? filters.storeId }),
      onRemove: () => pushOverride({ storeId: undefined }, "store"),
    });
  }
  if (filters.productQuery) {
    chips.push({
      key: "product",
      label: t("list.chips.product", { name: filters.productQuery }),
      onRemove: () => pushOverride({ productQuery: undefined }, "product"),
    });
  }
  if (filters.shippedFromIso) {
    chips.push({
      key: "shippedFrom",
      label: t("list.chips.shippedFrom", { date: formatDate(filters.shippedFromIso) }),
      onRemove: () => pushOverride({ shippedFromIso: undefined }, "shippedFrom"),
    });
  }
  if (filters.shippedToIso) {
    chips.push({
      key: "shippedTo",
      label: t("list.chips.shippedTo", { date: formatDate(filters.shippedToIso) }),
      onRemove: () => pushOverride({ shippedToIso: undefined }, "shippedTo"),
    });
  }
  // Sort is controlled by the toolbar `<Select>` (or mobile drawer); never surfaced as a chip.

  function pushOverride(override: Partial<DeliveryListActiveFilters & { page: number }>, chipName: string) {
    posthog.capture(POSTHOG_EVENTS.DELIVERY.LIST_FILTER_CHIP_REMOVED, { chip: chipName });
    router.push(buildDeliveryListFilterUrl(basePath, filters, { ...override, page: 1 }));
  }

  const hasResettableFilters = !hasOnlyDefaultDeliveryFilters(filters);

  const handleClearAll = () => {
    posthog.capture(POSTHOG_EVENTS.DELIVERY.LIST_FILTERS_RESET);
    // Explicit empty `status=` — a bare URL would canonicalize back to the default chip.
    router.push(`${basePath}?status=`);
  };

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("list.filters.dialogTitle")}>
      {chips.map((chip) => (
        <AppliedFilterChip
          key={chip.key}
          label={chip.label}
          removeAriaLabel={t("list.chips.remove", { label: chip.label })}
          onRemove={chip.onRemove}
        />
      ))}
      {hasResettableFilters && (
        <button
          type="button"
          onClick={handleClearAll}
          className="inline-flex items-center gap-1 px-2 text-[12px] [color:var(--text-muted)] hover:[color:var(--text-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
        >
          {t("list.filters.clearAll")}
        </button>
      )}
    </div>
  );
}
