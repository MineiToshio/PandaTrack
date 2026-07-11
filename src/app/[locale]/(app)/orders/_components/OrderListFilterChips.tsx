"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import AppliedFilterChip from "@/components/core/AppliedFilterChip";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  buildOrderListFilterUrl,
  hasOnlyDefaultActiveFilters,
  isDefaultActiveStatusSet,
  type OrderListActiveFilters,
} from "../_utils/orderListingParams";

type OrderListFilterChipsProps = {
  basePath: string;
  locale: string;
  filters: OrderListActiveFilters;
  storesById: Record<string, string>;
};

export default function OrderListFilterChips({ basePath, locale, filters, storesById }: OrderListFilterChipsProps) {
  const router = useRouter();
  const t = useTranslations("orderListing");

  const groupedDefault = filters.appliedDefaultStatuses || isDefaultActiveStatusSet(filters.statuses);
  const hasIndividualStatusChips = !groupedDefault && filters.statuses.length > 0;
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
  if (groupedDefault) {
    chips.push({
      key: "active",
      label: t("chips.soloActivas"),
      onRemove: () => pushOverride({ statuses: [], appliedDefaultStatuses: false }, "active"),
    });
  } else if (hasIndividualStatusChips) {
    filters.statuses.forEach((status) =>
      chips.push({
        key: `status-${status}`,
        label: t(`status.${status}`),
        onRemove: () =>
          pushOverride(
            { statuses: filters.statuses.filter((s) => s !== status), appliedDefaultStatuses: false },
            "status",
          ),
      }),
    );
  }
  filters.paymentStates.forEach((state) =>
    chips.push({
      key: `payment-${state}`,
      label: t(`payment.${state}`),
      onRemove: () => pushOverride({ paymentStates: filters.paymentStates.filter((s) => s !== state) }, "payment"),
    }),
  );
  if (filters.storeId) {
    chips.push({
      key: "store",
      label: t("chips.store", { name: storesById[filters.storeId] ?? filters.storeId }),
      onRemove: () => pushOverride({ storeId: undefined }, "store"),
    });
  }
  filters.productTypeKeys.forEach((key) =>
    chips.push({
      key: `pt-${key}`,
      label: key,
      onRemove: () =>
        pushOverride({ productTypeKeys: filters.productTypeKeys.filter((k) => k !== key) }, "productType"),
    }),
  );
  if (filters.dateFromIso) {
    chips.push({
      key: "dateFrom",
      label: t("chips.from", { date: formatDate(filters.dateFromIso) }),
      onRemove: () => pushOverride({ dateFromIso: undefined }, "dateFrom"),
    });
  }
  if (filters.dateToIso) {
    chips.push({
      key: "dateTo",
      label: t("chips.to", { date: formatDate(filters.dateToIso) }),
      onRemove: () => pushOverride({ dateToIso: undefined }, "dateTo"),
    });
  }
  if (filters.fxPendingOnly) {
    chips.push({
      key: "fxPending",
      label: t("chips.fxPending"),
      onRemove: () => pushOverride({ fxPendingOnly: false }, "fxPending"),
    });
  }
  // Stricter than "Por recibir" — the delivery window has fully closed, not just started.
  // No drawer toggle surfaces this yet; it's reachable only via the dashboard's "Atrasados" link.
  if (filters.deliveryLateOnly) {
    chips.push({
      key: "deliveryLate",
      label: t("chips.deliveryLate"),
      onRemove: () => pushOverride({ deliveryLateOnly: false }, "deliveryLate"),
    });
  }
  // Delivery filter — "Por recibir" toggle and date range are mutually exclusive at the
  // drawer apply step, so only one of them is ever active at a time.
  if (filters.deliveryOverdueOnly) {
    chips.push({
      key: "deliveryOverdue",
      label: t("chips.deliveryOverdue"),
      onRemove: () => pushOverride({ deliveryOverdueOnly: false }, "deliveryOverdue"),
    });
  } else if (filters.deliveryFromIso && filters.deliveryToIso) {
    chips.push({
      key: "deliveryRange",
      label: t("chips.deliveryRange", {
        from: formatDate(filters.deliveryFromIso),
        to: formatDate(filters.deliveryToIso),
      }),
      onRemove: () => pushOverride({ deliveryFromIso: undefined, deliveryToIso: undefined }, "deliveryRange"),
    });
  } else if (filters.deliveryFromIso) {
    chips.push({
      key: "deliveryFrom",
      label: t("chips.deliveryFrom", { date: formatDate(filters.deliveryFromIso) }),
      onRemove: () => pushOverride({ deliveryFromIso: undefined }, "deliveryFrom"),
    });
  } else if (filters.deliveryToIso) {
    chips.push({
      key: "deliveryTo",
      label: t("chips.deliveryTo", { date: formatDate(filters.deliveryToIso) }),
      onRemove: () => pushOverride({ deliveryToIso: undefined }, "deliveryTo"),
    });
  }
  // Sort is controlled by the toolbar `<Select>` (or mobile drawer); never surfaced as a chip.

  function pushOverride(override: Partial<OrderListActiveFilters & { page: number }>, chipName: string) {
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTER_CHIP_REMOVED, { chip: chipName });
    router.push(buildOrderListFilterUrl(basePath, filters, { ...override, page: 1 }));
  }

  const hasResettableFilters = !hasOnlyDefaultActiveFilters({ ...filters, appliedDefaultStatuses: false });

  const handleClearAll = () => {
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTERS_RESET);
    // Bare URL → no filter at all. "Solo activas" is only re-applied via sidebar/burger nav.
    router.push(basePath);
  };

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("filters.dialogTitle")}>
      {chips.map((chip) => (
        <AppliedFilterChip
          key={chip.key}
          label={chip.label}
          removeAriaLabel={t("chips.remove", { label: chip.label })}
          onRemove={chip.onRemove}
        />
      ))}
      {hasResettableFilters && (
        <button
          type="button"
          onClick={handleClearAll}
          className="inline-flex items-center gap-1 px-2 text-[12px] [color:var(--text-muted)] hover:[color:var(--text-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
        >
          {t("filters.clearAll")}
        </button>
      )}
    </div>
  );
}
