"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Ban, CheckCircle, CircleDot, Clock, PackageCheck, Plus, Truck, XCircle } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import FilterTriggerButton from "@/components/core/FilterTriggerButton/FilterTriggerButton";
import SearchInput from "@/components/core/SearchInput";
import Select from "@/components/core/Select";
import FilterDrawer, { type FilterDrawerValues, type FilterSection } from "@/components/modules/FilterDrawer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { ORDER_LIST_SORT_VALUES, type OrderListPaymentState, type OrderListSort } from "@/lib/orders/orderListSort";
import type { OrderStatus } from "../../../../../../generated/prisma/client";
import {
  buildOrderListFilterUrl,
  DEFAULT_ORDER_LIST_SORT,
  isDefaultActiveStatusSet,
  type OrderListActiveFilters,
} from "../_utils/orderListingParams";
import { addDays, endOfMonth, startOfMonth, toIsoDateString } from "@/lib/localDate";

type StoreOption = { id: string; name: string };

type OrderListFiltersProps = {
  locale: string;
  storeOptions: StoreOption[];
  initial: OrderListActiveFilters;
};

const FX_PENDING_FLAG = "fxPending";

type DateRangeWithFlag = { from?: string; to?: string; flag?: boolean };

type DrawerState = {
  statuses: string[];
  paymentStates: string[];
  stores: string[];
  dateRange: { from?: string; to?: string };
  /** Composite value: range + `flag` (Por recibir / overdue) handled by the trailing switch. */
  deliveryRange: DateRangeWithFlag;
  sort: OrderListSort;
  fxFlags: string[];
};

/**
 * Date presets sourced from market research (see agent notes 2026-05-13):
 * order date → backward-looking ranges; delivery → forward-looking + overdue shortcut.
 */
function resolveDeliveryPreset(value: string): { from?: string; to?: string } {
  const today = new Date();
  switch (value) {
    case "next7":
      return { from: toIsoDateString(today), to: toIsoDateString(addDays(today, 7)) };
    case "next14":
      return { from: toIsoDateString(today), to: toIsoDateString(addDays(today, 14)) };
    case "next30":
      return { from: toIsoDateString(today), to: toIsoDateString(addDays(today, 30)) };
    case "thisMonth":
      return { from: toIsoDateString(startOfMonth(today)), to: toIsoDateString(endOfMonth(today)) };
    case "nextMonth": {
      const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { from: toIsoDateString(nm), to: toIsoDateString(endOfMonth(nm)) };
    }
    default:
      return {};
  }
}

/**
 * Drawer status pills are individual `OrderStatus` values — no synthetic "Activas" pill.
 * The default-active filter is preselected by checking the 4 active statuses; the chip
 * row collapses them visually back to "Solo activas" via `isDefaultActiveStatusSet`.
 */
function statusValuesFromFilters(filters: OrderListActiveFilters): string[] {
  return [...filters.statuses];
}

function classifyStatuses(values: string[]): { statuses: OrderStatus[]; appliedDefaultStatuses: boolean } {
  const statuses = values as OrderStatus[];
  return { statuses, appliedDefaultStatuses: isDefaultActiveStatusSet(statuses) };
}

export default function OrderListFilters({ locale, storeOptions, initial }: OrderListFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("orderListing");
  const isMobile = useIsMobile();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextDebounce = useRef(false);

  const initialDrawer = useMemo<DrawerState>(
    () => ({
      statuses: statusValuesFromFilters(initial),
      paymentStates: initial.paymentStates,
      stores: initial.storeId ? [initial.storeId] : [],
      dateRange: { from: initial.dateFromIso, to: initial.dateToIso },
      deliveryRange: {
        from: initial.deliveryFromIso,
        to: initial.deliveryToIso,
        flag: initial.deliveryOverdueOnly,
      },
      sort: initial.sort,
      fxFlags: initial.fxPendingOnly ? [FX_PENDING_FLAG] : [],
    }),
    [initial],
  );

  // Render-time prop→state sync: when the URL (initial) changes, reset both the
  // committed search input value and the drawer draft. Comparing fingerprints in
  // render is the canonical React 18+ pattern that avoids setState-in-effect.
  const initialFingerprint = JSON.stringify(initialDrawer);
  const [syncedFingerprint, setSyncedFingerprint] = useState(initialFingerprint);
  const [nameQuery, setNameQuery] = useState(initial.nameQuery ?? "");
  const [syncedNameQuery, setSyncedNameQuery] = useState(initial.nameQuery ?? "");
  const [draft, setDraft] = useState<FilterDrawerValues>(initialDrawer);

  if (initialFingerprint !== syncedFingerprint) {
    setSyncedFingerprint(initialFingerprint);
    setDraft(initialDrawer);
  }
  if ((initial.nameQuery ?? "") !== syncedNameQuery) {
    setSyncedNameQuery(initial.nameQuery ?? "");
    setNameQuery(initial.nameQuery ?? "");
  }

  const drawerAppliedCount = useMemo(() => {
    let count = 0;
    const statuses = (draft.statuses as string[] | undefined) ?? [];
    // Badge mirrors the drawer state — each checked pill counts individually.
    // "Solo activas" is a visual chip collapse, not a count collapse.
    count += statuses.length;
    count += (draft.paymentStates as string[] | undefined)?.length ?? 0;
    count += (draft.stores as string[] | undefined)?.length ?? 0;
    const range = (draft.dateRange ?? {}) as { from?: string; to?: string };
    if (range.from || range.to) count += 1;
    const deliveryRange = (draft.deliveryRange ?? {}) as DateRangeWithFlag;
    if (deliveryRange.flag) {
      count += 1;
    } else if (deliveryRange.from || deliveryRange.to) {
      count += 1;
    }
    if ((draft.fxFlags as string[] | undefined)?.includes(FX_PENDING_FLAG)) count += 1;
    return count;
  }, [draft]);

  const sortOptions = useMemo(
    () =>
      ORDER_LIST_SORT_VALUES.map((value) => ({
        value,
        label: t(`sort.${sortLabelKey(value)}`),
      })),
    [t],
  );

  const sections: FilterSection[] = useMemo(() => {
    const base: FilterSection[] = [
      {
        id: "statuses",
        type: "pills",
        label: t("filters.statusLabel"),
        options: [
          { value: "OPEN", label: t("status.OPEN"), icon: <Clock size={12} aria-hidden /> },
          {
            value: "PARTIALLY_IN_TRANSIT",
            label: t("status.PARTIALLY_IN_TRANSIT"),
            icon: <Truck size={12} aria-hidden />,
          },
          { value: "IN_TRANSIT", label: t("status.IN_TRANSIT"), icon: <Truck size={12} aria-hidden /> },
          {
            value: "PARTIALLY_DELIVERED",
            label: t("status.PARTIALLY_DELIVERED"),
            icon: <Truck size={12} aria-hidden />,
          },
          { value: "COMPLETED", label: t("status.COMPLETED"), icon: <PackageCheck size={12} aria-hidden /> },
          { value: "CANCELLED", label: t("status.CANCELLED"), icon: <Ban size={12} aria-hidden /> },
        ],
      },
      {
        id: "paymentStates",
        type: "pills",
        label: t("filters.paymentLabel"),
        options: [
          { value: "paid", label: t("payment.paid"), icon: <CheckCircle size={12} aria-hidden /> },
          { value: "partial", label: t("payment.partial"), icon: <CircleDot size={12} aria-hidden /> },
          { value: "unpaid", label: t("payment.unpaid"), icon: <XCircle size={12} aria-hidden /> },
          { value: "overdue", label: t("payment.overdue"), icon: <AlertTriangle size={12} aria-hidden /> },
        ],
      },
      {
        id: "stores",
        type: "tag-autocomplete",
        label: t("filters.storeLabel"),
        placeholder: t("filters.storeSearchPlaceholder"),
        options: storeOptions.map((store) => ({ value: store.id, label: store.name })),
      },
      {
        // Order-date section: no presets per design feedback — collectors filter by exact
        // dates when looking back, not by rolling windows.
        id: "dateRange",
        type: "date-range",
        label: t("filters.dateLabel"),
        fromLabel: t("filters.dateFromLabel"),
        toLabel: t("filters.dateToLabel"),
      },
      {
        // Delivery-date section: single range picker (two-month calendar with presets) +
        // the "Por recibir" overdue switch as a trailing toggle in the same fieldset
        // (mutually exclusive with the explicit range, enforced at apply time).
        id: "deliveryRange",
        type: "date-range",
        mode: "single",
        label: t("filters.deliveryDateLabel"),
        fromLabel: t("filters.dateFromLabel"),
        toLabel: t("filters.dateToLabel"),
        singleRangePlaceholder: t("filters.deliveryRangePlaceholder"),
        singleRangeClearLabel: t("filters.deliveryRangeClearLabel"),
        presets: [
          { value: "next7", label: t("datePresets.deliveryNext7") },
          { value: "next14", label: t("datePresets.deliveryNext14") },
          { value: "next30", label: t("datePresets.deliveryNext30") },
          { value: "thisMonth", label: t("datePresets.deliveryThisMonth") },
          { value: "nextMonth", label: t("datePresets.deliveryNextMonth") },
        ],
        resolvePreset: resolveDeliveryPreset,
        trailingSwitch: {
          label: t("filters.deliveryOverdueLabel"),
          helper: t("filters.deliveryOverdueHelper"),
        },
      },
    ];
    // Sort is exposed via the toolbar `<Select>` on desktop, so only inject it on mobile.
    if (isMobile) {
      base.push({
        id: "sort",
        type: "pills",
        label: t("filters.sortSectionLabel"),
        multi: false,
        options: sortOptions.map((option) => ({ value: option.value, label: option.label })),
      });
    }
    base.push({
      id: "fxFlags",
      type: "switches",
      label: t("filters.fxLabel"),
      options: [{ value: FX_PENDING_FLAG, label: t("filters.fxPendingLabel"), helper: t("filters.fxPendingHelper") }],
    });
    return base;
  }, [t, storeOptions, sortOptions, isMobile]);

  const pushUrl = useCallback(
    (overrides: Partial<OrderListActiveFilters & { page: number }>) => {
      router.push(buildOrderListFilterUrl(pathname, initial, overrides));
    },
    [router, pathname, initial],
  );

  const submitSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      pushUrl({ nameQuery: trimmed === "" ? undefined : trimmed, page: 1 });
    },
    [pushUrl],
  );

  const handleSearchChange = (value: string) => {
    setNameQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return;
    }
    debounceTimer.current = setTimeout(() => submitSearch(value), 300);
  };

  const handleSearchSubmit = (value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    skipNextDebounce.current = true;
    submitSearch(value);
  };

  const handleSortChange = (value: string) => {
    const next: OrderListSort = (ORDER_LIST_SORT_VALUES as readonly string[]).includes(value)
      ? (value as OrderListSort)
      : DEFAULT_ORDER_LIST_SORT;
    setDraft((prev) => ({ ...prev, sort: next }));
    pushUrl({ sort: next, page: 1 });
  };

  const handleApply = () => {
    const statusesRaw = (draft.statuses as string[] | undefined) ?? [];
    const { statuses, appliedDefaultStatuses } = classifyStatuses(statusesRaw);
    const stores = (draft.stores as string[] | undefined) ?? [];
    const paymentStates = ((draft.paymentStates as string[] | undefined) ?? []).filter(
      (value): value is OrderListPaymentState =>
        value === "paid" || value === "partial" || value === "unpaid" || value === "overdue",
    );
    const range = (draft.dateRange ?? {}) as { from?: string; to?: string };
    const deliveryRange = (draft.deliveryRange ?? {}) as DateRangeWithFlag;
    const deliveryOverdueOnly = deliveryRange.flag === true;
    const sortValue = (draft.sort as OrderListSort | undefined) ?? DEFAULT_ORDER_LIST_SORT;
    const fxFlags = (draft.fxFlags as string[] | undefined) ?? [];

    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTERED, {
      query_present: Boolean(nameQuery.trim()),
      status_count: statuses.length,
      payment_count: paymentStates.length,
      store_count: stores.length,
      date_from: Boolean(range.from),
      date_to: Boolean(range.to),
      delivery_from: Boolean(deliveryRange.from),
      delivery_to: Boolean(deliveryRange.to),
      delivery_overdue: deliveryOverdueOnly,
      fx_pending: fxFlags.includes(FX_PENDING_FLAG),
      sort: sortValue,
    });

    pushUrl({
      statuses,
      appliedDefaultStatuses,
      paymentStates,
      storeId: stores[0],
      dateFromIso: range.from,
      dateToIso: range.to,
      // "Por recibir" wins — clear the explicit range when the toggle is on.
      deliveryFromIso: deliveryOverdueOnly ? undefined : deliveryRange.from,
      deliveryToIso: deliveryOverdueOnly ? undefined : deliveryRange.to,
      deliveryOverdueOnly,
      sort: sortValue,
      fxPendingOnly: fxFlags.includes(FX_PENDING_FLAG),
      page: 1,
    });
    setDrawerOpen(false);
  };

  const handleClear = () => {
    // Reset the drawer draft to empty — applying lands on the bare URL with no filter.
    // The default-active state is now scoped to the sidebar/burger entry-point only.
    setDraft({
      statuses: [],
      paymentStates: [],
      stores: [],
      dateRange: {},
      deliveryRange: {},
      sort: DEFAULT_ORDER_LIST_SORT,
      fxFlags: [],
    });
  };

  const newOrderHref = `/${locale}${ROUTES.ordersNew}`;

  return (
    <>
      {/* Desktop toolbar */}
      <div className="hidden flex-col gap-3 lg:flex lg:flex-row lg:items-center">
        <div className="flex-1">
          <SearchInput
            value={nameQuery}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder={t("search.placeholder")}
            searchLabel={t("search.label")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Order: filter → sort → new (matches demo `.orders-toolbar`) */}
          <FilterTriggerButton
            appliedCount={drawerAppliedCount}
            onClick={() => setDrawerOpen(true)}
            label={t("filters.openButton")}
            className="[color:var(--text-primary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,var(--surface-elevated))]"
          />
          <Select
            id="orders-sort"
            aria-label={t("sort.label")}
            value={initial.sort}
            onChange={handleSortChange}
            size="md"
            options={sortOptions}
            className="w-auto"
          />
          <Button as="a" href={newOrderHref} variant="primary" size="md" leadingIcon={<Plus size={16} aria-hidden />}>
            {t("hero.newOrder")}
          </Button>
        </div>
      </div>

      {/* Mobile sticky action row — below the topbar (h-14 = 56px). The search wrapper takes
          `min-w-0 flex-1` so it absorbs all shrink (an input's intrinsic min-content otherwise
          keeps the row wider than the viewport — S9.1 overflow); the two buttons stay `shrink-0`. */}
      <div className="sticky top-14 z-30 -mx-4 flex items-center gap-2 px-4 py-2 [background:color-mix(in_oklab,var(--background)_92%,transparent)] supports-[backdrop-filter:blur(8px)]:backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={nameQuery}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder={t("search.placeholder")}
            searchLabel={t("search.label")}
          />
        </div>
        <FilterTriggerButton
          appliedCount={drawerAppliedCount}
          onClick={() => setDrawerOpen(true)}
          variant="icon-only"
          aria-label={t("filters.iconLabel")}
          // Match the bordered look of the Search input + Nuevo button so all three controls
          // share the same visual height + container affordance in the mobile action row.
          className="shrink-0 [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,var(--surface-elevated))]"
        />
        <Button
          as="a"
          href={newOrderHref}
          variant="primary"
          size="md"
          leadingIcon={<Plus size={16} aria-hidden />}
          className="shrink-0"
        >
          {t("hero.newOrderShort")}
        </Button>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={t("filters.dialogTitle")}
        sections={sections}
        values={draft}
        onChange={setDraft}
        onApply={handleApply}
        onClear={handleClear}
        applyLabel={t("filters.apply")}
        clearLabel={t("filters.reset")}
        closeLabel={t("filters.closeDialog")}
        applyCountLabel={(count) => t("filters.applyWithCount", { count })}
        resultsCount={drawerAppliedCount}
      />
    </>
  );
}

function sortLabelKey(value: OrderListSort): string {
  switch (value) {
    case "oldest":
      return "oldest";
    case "store-asc":
      return "storeAZ";
    case "payment-asc":
      return "paymentAsc";
    case "total-desc":
      return "totalDesc";
    case "recent":
    default:
      return "newest";
  }
}
