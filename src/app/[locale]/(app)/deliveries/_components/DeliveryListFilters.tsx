"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle, Plus, Truck } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import FilterTriggerButton from "@/components/core/FilterTriggerButton/FilterTriggerButton";
import SearchInput from "@/components/core/SearchInput";
import Select from "@/components/core/Select";
import FilterDrawer, { type FilterDrawerValues, type FilterSection } from "@/components/modules/FilterDrawer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { addDays, endOfMonth, startOfMonth, toIsoDateString } from "@/lib/localDate";
import {
  DEFAULT_DELIVERY_LIST_SORT,
  DELIVERY_LIST_SORT_VALUES,
  type DeliveryListSort,
} from "@/lib/deliveries/deliveryListSort";
import type { DeliveryStatus } from "../../../../../../generated/prisma/client";
import { buildDeliveryListFilterUrl, type DeliveryListActiveFilters } from "../_utils/deliveryListingParams";

type StoreOption = { id: string; name: string };

type DeliveryListFiltersProps = {
  locale: string;
  storeOptions: StoreOption[];
  initial: DeliveryListActiveFilters;
};

type DateRangeWithFlag = { from?: string; to?: string; flag?: boolean };

type DrawerState = {
  statuses: string[];
  /** Range + `flag` (Solo atrasadas) handled by the trailing switch — mutually exclusive. */
  arrivalRange: DateRangeWithFlag;
  stores: string[];
  product: string;
  shippedRange: { from?: string; to?: string };
  sort: DeliveryListSort;
};

const SEARCH_DEBOUNCE_MS = 300;

/** Forward-looking ETA presets per `delivery-list.md` §5 (mutually exclusive with manual range). */
function resolveArrivalPreset(value: string): { from?: string; to?: string } {
  const today = new Date();
  switch (value) {
    case "dueToday":
      return { from: toIsoDateString(today), to: toIsoDateString(today) };
    case "next7":
      return { from: toIsoDateString(today), to: toIsoDateString(addDays(today, 7)) };
    case "next14":
      return { from: toIsoDateString(today), to: toIsoDateString(addDays(today, 14)) };
    case "thisMonth":
      return { from: toIsoDateString(startOfMonth(today)), to: toIsoDateString(endOfMonth(today)) };
    default:
      return {};
  }
}

export default function DeliveryListFilters({ locale, storeOptions, initial }: DeliveryListFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("deliveries");
  const isMobile = useIsMobile();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextDebounce = useRef(false);

  const initialDrawer = useMemo<DrawerState>(
    () => ({
      statuses: [...initial.statuses],
      arrivalRange: {
        from: initial.arrivalFromIso,
        to: initial.arrivalToIso,
        flag: initial.overdueOnly,
      },
      stores: initial.storeId ? [initial.storeId] : [],
      product: initial.productQuery ?? "",
      shippedRange: { from: initial.shippedFromIso, to: initial.shippedToIso },
      sort: initial.sort,
    }),
    [initial],
  );

  // Render-time prop→state sync (canonical React 18+ pattern, parity with OrderListFilters).
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
    count += ((draft.statuses as string[] | undefined) ?? []).length;
    const arrival = (draft.arrivalRange ?? {}) as DateRangeWithFlag;
    if (arrival.flag) {
      count += 1;
    } else if (arrival.from || arrival.to) {
      count += 1;
    }
    count += ((draft.stores as string[] | undefined) ?? []).length;
    if (typeof draft.product === "string" && draft.product.trim()) count += 1;
    const shipped = (draft.shippedRange ?? {}) as { from?: string; to?: string };
    if (shipped.from || shipped.to) count += 1;
    return count;
  }, [draft]);

  const sortOptions = useMemo(
    () =>
      DELIVERY_LIST_SORT_VALUES.map((value) => ({
        value,
        label: t(`list.sort.${sortLabelKey(value)}`),
      })),
    [t],
  );

  const sections: FilterSection[] = useMemo(() => {
    const base: FilterSection[] = [
      {
        id: "statuses",
        type: "pills",
        label: t("list.filters.statusLabel"),
        options: [
          { value: "IN_TRANSIT", label: t("list.status.IN_TRANSIT"), icon: <Truck size={12} aria-hidden /> },
          { value: "DELIVERED", label: t("list.status.DELIVERED"), icon: <CheckCircle size={12} aria-hidden /> },
          { value: "CANCELLED", label: t("list.status.CANCELLED"), icon: <Ban size={12} aria-hidden /> },
        ],
      },
      {
        // ETA presets + manual range + "Solo atrasadas" switch in one fieldset; the switch
        // blanks the range on toggle (mutual exclusion enforced by the drawer + apply).
        id: "arrivalRange",
        type: "date-range",
        mode: "single",
        label: t("list.filters.arrivalLabel"),
        fromLabel: t("list.filters.dateFromLabel"),
        toLabel: t("list.filters.dateToLabel"),
        singleRangePlaceholder: t("list.filters.arrivalRangePlaceholder"),
        singleRangeClearLabel: t("list.filters.arrivalRangeClearLabel"),
        presets: [
          { value: "dueToday", label: t("list.datePresets.dueToday") },
          { value: "next7", label: t("list.datePresets.next7") },
          { value: "next14", label: t("list.datePresets.next14") },
          { value: "thisMonth", label: t("list.datePresets.thisMonth") },
        ],
        resolvePreset: resolveArrivalPreset,
        trailingSwitch: {
          label: t("list.filters.overdueLabel"),
          helper: t("list.filters.overdueHelper"),
        },
      },
      {
        id: "stores",
        type: "tag-autocomplete",
        label: t("list.filters.storeLabel"),
        placeholder: t("list.filters.storeSearchPlaceholder"),
        options: storeOptions.map((store) => ({ value: store.id, label: store.name })),
      },
      {
        id: "product",
        type: "text",
        label: t("list.filters.productLabel"),
        placeholder: t("list.filters.productPlaceholder"),
      },
      {
        id: "shippedRange",
        type: "date-range",
        label: t("list.filters.shippedLabel"),
        fromLabel: t("list.filters.dateFromLabel"),
        toLabel: t("list.filters.dateToLabel"),
      },
    ];
    // Sort lives in the toolbar `<Select>` on desktop; inject it in the drawer on mobile only.
    if (isMobile) {
      base.push({
        id: "sort",
        type: "pills",
        label: t("list.filters.sortSectionLabel"),
        multi: false,
        options: sortOptions.map((option) => ({ value: option.value, label: option.label })),
      });
    }
    return base;
  }, [t, storeOptions, sortOptions, isMobile]);

  const pushUrl = useCallback(
    (overrides: Partial<DeliveryListActiveFilters & { page: number }>) => {
      router.push(buildDeliveryListFilterUrl(pathname, initial, overrides));
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
    debounceTimer.current = setTimeout(() => submitSearch(value), SEARCH_DEBOUNCE_MS);
  };

  const handleSearchSubmit = (value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    skipNextDebounce.current = true;
    submitSearch(value);
  };

  const handleSortChange = (value: string) => {
    const next: DeliveryListSort = (DELIVERY_LIST_SORT_VALUES as readonly string[]).includes(value)
      ? (value as DeliveryListSort)
      : DEFAULT_DELIVERY_LIST_SORT;
    setDraft((prev) => ({ ...prev, sort: next }));
    pushUrl({ sort: next, page: 1 });
  };

  const handleApply = () => {
    const statuses = ((draft.statuses as string[] | undefined) ?? []).filter(
      (value): value is DeliveryStatus => value === "IN_TRANSIT" || value === "DELIVERED" || value === "CANCELLED",
    );
    const arrival = (draft.arrivalRange ?? {}) as DateRangeWithFlag;
    const overdueOnly = arrival.flag === true;
    const stores = (draft.stores as string[] | undefined) ?? [];
    const product = typeof draft.product === "string" ? draft.product.trim() : "";
    const shipped = (draft.shippedRange ?? {}) as { from?: string; to?: string };
    const sortValue = (draft.sort as DeliveryListSort | undefined) ?? DEFAULT_DELIVERY_LIST_SORT;

    posthog.capture(POSTHOG_EVENTS.DELIVERY.LIST_FILTERED, {
      query_present: Boolean(nameQuery.trim()),
      status_count: statuses.length,
      overdue_only: overdueOnly,
      arrival_from: Boolean(arrival.from),
      arrival_to: Boolean(arrival.to),
      store_count: stores.length,
      product_present: Boolean(product),
      shipped_from: Boolean(shipped.from),
      shipped_to: Boolean(shipped.to),
      sort: sortValue,
    });

    pushUrl({
      statuses,
      overdueOnly,
      // "Solo atrasadas" wins — clear the explicit range when the toggle is on.
      arrivalFromIso: overdueOnly ? undefined : arrival.from,
      arrivalToIso: overdueOnly ? undefined : arrival.to,
      storeId: stores[0],
      productQuery: product || undefined,
      shippedFromIso: shipped.from,
      shippedToIso: shipped.to,
      sort: sortValue,
      page: 1,
    });
    setDrawerOpen(false);
  };

  const handleClear = () => {
    setDraft({
      statuses: [],
      arrivalRange: {},
      stores: [],
      product: "",
      shippedRange: {},
      sort: DEFAULT_DELIVERY_LIST_SORT,
    });
  };

  const newDeliveryHref = `/${locale}${ROUTES.deliveriesNew}`;

  return (
    <>
      {/* Desktop toolbar */}
      <div className="hidden flex-col gap-3 lg:flex lg:flex-row lg:items-center">
        <div className="flex-1">
          <SearchInput
            value={nameQuery}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder={t("list.search.placeholder")}
            searchLabel={t("list.search.label")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterTriggerButton
            appliedCount={drawerAppliedCount}
            onClick={() => setDrawerOpen(true)}
            label={t("list.filters.openButton")}
            className="[color:var(--text-primary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,var(--surface-elevated))]"
          />
          <Select
            id="deliveries-sort"
            aria-label={t("list.sort.label")}
            value={initial.sort}
            onChange={handleSortChange}
            size="md"
            options={sortOptions}
            className="w-auto"
          />
          <Button
            as="a"
            href={newDeliveryHref}
            variant="primary"
            size="md"
            leadingIcon={<Plus size={16} aria-hidden />}
          >
            {t("list.newDelivery")}
          </Button>
        </div>
      </div>

      {/* Mobile sticky action row — below the topbar (h-14 = 56px) */}
      {/* Mobile sticky action row — the search wrapper takes `min-w-0 flex-1` so it absorbs all
          shrink (an input's intrinsic min-content otherwise keeps the row wider than the viewport
          — S9.1 overflow); the two buttons stay `shrink-0`. */}
      <div className="sticky top-14 z-30 -mx-4 flex items-center gap-2 px-4 py-2 [background:color-mix(in_oklab,var(--background)_92%,transparent)] supports-[backdrop-filter:blur(8px)]:backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={nameQuery}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder={t("list.search.placeholderShort")}
            searchLabel={t("list.search.label")}
          />
        </div>
        <FilterTriggerButton
          appliedCount={drawerAppliedCount}
          onClick={() => setDrawerOpen(true)}
          variant="icon-only"
          aria-label={t("list.filters.iconLabel")}
          className="shrink-0 [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,var(--surface-elevated))]"
        />
        <Button
          as="a"
          href={newDeliveryHref}
          variant="primary"
          size="md"
          leadingIcon={<Plus size={16} aria-hidden />}
          className="shrink-0"
        >
          {t("list.newDeliveryShort")}
        </Button>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={t("list.filters.dialogTitle")}
        sections={sections}
        values={draft}
        onChange={setDraft}
        onApply={handleApply}
        onClear={handleClear}
        applyLabel={t("list.filters.apply")}
        clearLabel={t("list.filters.reset")}
        closeLabel={t("list.filters.closeDialog")}
        applyCountLabel={(count) => t("list.filters.applyWithCount", { count })}
        resultsCount={drawerAppliedCount}
      />
    </>
  );
}

function sortLabelKey(value: DeliveryListSort): string {
  switch (value) {
    case "recent":
      return "newest";
    case "eta-asc":
      return "etaAsc";
    case "store-asc":
      return "storeAZ";
    case "oldest":
    default:
      return "oldest";
  }
}
