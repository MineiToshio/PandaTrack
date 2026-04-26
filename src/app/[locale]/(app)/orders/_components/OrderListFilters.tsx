"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Filter, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import type { OrderStatus } from "../../../../../../generated/prisma/client";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import DatePickerInput from "@/components/core/DatePickerInput";
import { useFocusScope } from "@/lib/a11y/useFocusScope";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import { buildOrderListFilterUrl, DEFAULT_ACTIVE_STATUSES, type OrderListActiveFilters } from "../_utils/orderListingParams";

const ALL_STATUSES: OrderStatus[] = [
  "OPEN",
  "PARTIALLY_IN_TRANSIT",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

const FILTER_CHIP_CLASSNAME =
  "border-border/70 bg-background text-text-body hover:border-primary/60 hover:bg-primary/10 focus-visible:ring-ring inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:outline-none";
const FILTER_CHIP_SELECTED_CLASSNAME =
  "border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground";

type StoreOption = { id: string; name: string };
type ProductTypeOption = { key: string };

type DraftFilters = {
  nameQuery: string;
  storeId: string;
  productTypeKeys: string[];
  statuses: OrderStatus[];
  dateFrom: Date | null;
  dateTo: Date | null;
};

type OrderListFiltersProps = {
  locale: string;
  totalCount: number;
  showingFrom: number;
  showingTo: number;
  storeOptions: StoreOption[];
  productTypeOptions: ProductTypeOption[];
  initial: {
    nameQuery: string;
    storeId: string;
    productTypeKeys: string[];
    statuses: OrderStatus[];
    appliedDefaultStatuses: boolean;
    dateFromIso: string | undefined;
    dateToIso: string | undefined;
  };
};

export default function OrderListFilters({
  locale,
  totalCount,
  showingFrom,
  showingTo,
  storeOptions,
  productTypeOptions,
  initial,
}: OrderListFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("orderListing");
  const tStatus = useTranslations("orderListing.status");
  const tProductTypes = useTranslations("storeProductTypes");

  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const nameFieldId = useId();
  const storeFieldId = useId();
  const dateFromId = useId();
  const dateToId = useId();

  const [draft, setDraft] = useState<DraftFilters>({
    nameQuery: initial.nameQuery,
    storeId: initial.storeId,
    productTypeKeys: initial.productTypeKeys,
    statuses: initial.statuses,
    dateFrom: initial.dateFromIso ? new Date(initial.dateFromIso) : null,
    dateTo: initial.dateToIso ? new Date(initial.dateToIso) : null,
  });

  const sortedProductTypeOptions = useMemo(
    () =>
      productTypeOptions
        .map((option) => ({ key: option.key, label: tProductTypes(option.key) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [productTypeOptions, tProductTypes, locale],
  );

  const close = useCallback(() => setIsOpen(false), []);

  useFocusScope({ active: isOpen, rootRef: drawerRef, onClose: close, returnFocusRef: triggerRef });

  const open = () => {
    setDraft({
      nameQuery: initial.nameQuery,
      storeId: initial.storeId,
      productTypeKeys: initial.productTypeKeys,
      statuses: initial.statuses,
      dateFrom: initial.dateFromIso ? new Date(initial.dateFromIso) : null,
      dateTo: initial.dateToIso ? new Date(initial.dateToIso) : null,
    });
    setIsOpen(true);
  };

  const buildUrl = (filters: DraftFilters) => {
    const nextFilters: OrderListActiveFilters = {
      nameQuery: filters.nameQuery,
      productTypeKeys: filters.productTypeKeys,
      storeId: filters.storeId || undefined,
      statuses: filters.statuses,
      appliedDefaultStatuses: false,
      dateFromIso: filters.dateFrom ? filters.dateFrom.toISOString().slice(0, 10) : undefined,
      dateToIso: filters.dateTo ? filters.dateTo.toISOString().slice(0, 10) : undefined,
    };

    return buildOrderListFilterUrl(pathname, nextFilters);
  };

  const apply = () => {
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTERED, {
      query_present: !!draft.nameQuery.trim(),
      store_present: !!draft.storeId,
      product_type_count: draft.productTypeKeys.length,
      status_count: draft.statuses.length,
      date_from: !!draft.dateFrom,
      date_to: !!draft.dateTo,
    });
    router.push(buildUrl(draft));
    close();
  };

  const reset = () => {
    posthog.capture(POSTHOG_EVENTS.ORDER.LIST_FILTERS_RESET);
    router.push(
      buildOrderListFilterUrl(pathname, {
        nameQuery: undefined,
        productTypeKeys: [],
        storeId: undefined,
        statuses: DEFAULT_ACTIVE_STATUSES,
        appliedDefaultStatuses: false,
        dateFromIso: undefined,
        dateToIso: undefined,
      }),
    );
    close();
  };

  const toggleProductType = (key: string) => {
    setDraft((previous) => ({
      ...previous,
      productTypeKeys: previous.productTypeKeys.includes(key)
        ? previous.productTypeKeys.filter((k) => k !== key)
        : [...previous.productTypeKeys, key],
    }));
  };

  const toggleStatus = (status: OrderStatus) => {
    setDraft((previous) => ({
      ...previous,
      statuses: previous.statuses.includes(status)
        ? previous.statuses.filter((s) => s !== status)
        : [...previous.statuses, status],
    }));
  };

  const summary =
    totalCount === 0
      ? t("summary.summaryEmpty")
      : t("summary.showing", { total: totalCount, start: showingFrom, end: showingTo });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Typography size="sm" className="text-text-muted">
          {summary}
        </Typography>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            ref={triggerRef}
            type="button"
            onClick={open}
            className={cn(buttonVariants({ variant: "secondary" }), "min-h-11 rounded-xl px-4")}
          >
            <Filter className="mr-2 size-4" aria-hidden />
            {t("filters.openButton")}
          </button>
          <Link
            href={`/${locale}${ROUTES.ordersNew}`}
            className={cn(buttonVariants({ variant: "primary" }), "min-h-11 rounded-xl px-5")}
          >
            {t("hero.newOrder")}
          </Link>
        </div>
      </div>

      {isOpen && (
        <div ref={drawerRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            className="bg-background/70 absolute inset-0 backdrop-blur-sm"
            onClick={close}
            aria-hidden
            tabIndex={-1}
          />
          <aside className="border-border bg-background absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l shadow-xl">
            <div className="border-border flex items-center justify-between gap-2 border-b p-4 sm:p-6">
              <Typography id={titleId} as="span" size="md" className="text-text-title font-semibold">
                {t("filters.dialogTitle")}
              </Typography>
              <button
                type="button"
                onClick={close}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                aria-label={t("filters.closeDialog")}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-4 pt-5 pb-24 sm:p-6 sm:pt-7 sm:pb-28">
              <div className="space-y-2">
                <Label htmlFor={nameFieldId} size="xs" color="title" className="font-semibold">
                  {t("filters.nameLabel")}
                </Label>
                <Input
                  id={nameFieldId}
                  type="search"
                  value={draft.nameQuery}
                  onChange={(event) => setDraft((p) => ({ ...p, nameQuery: event.target.value }))}
                  placeholder={t("filters.namePlaceholder")}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={storeFieldId} size="xs" color="title" className="font-semibold">
                  {t("filters.storeLabel")}
                </Label>
                <select
                  id={storeFieldId}
                  value={draft.storeId}
                  onChange={(event) => setDraft((p) => ({ ...p, storeId: event.target.value }))}
                  className="border-border bg-background focus-visible:ring-ring h-11 w-full rounded-xl border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="">{t("filters.storePlaceholder")}</option>
                  {storeOptions.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-text-title text-sm font-semibold">{t("filters.statusLabel")}</legend>
                <div className="flex flex-wrap gap-2">
                  {ALL_STATUSES.map((status) => {
                    const selected = draft.statuses.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => toggleStatus(status)}
                        className={cn(FILTER_CHIP_CLASSNAME, selected && FILTER_CHIP_SELECTED_CLASSNAME)}
                      >
                        {tStatus(status)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-text-title text-sm font-semibold">{t("filters.productTypeLabel")}</legend>
                <div className="flex flex-wrap gap-2">
                  {sortedProductTypeOptions.map((option) => {
                    const selected = draft.productTypeKeys.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleProductType(option.key)}
                        className={cn(FILTER_CHIP_CLASSNAME, selected && FILTER_CHIP_SELECTED_CLASSNAME)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={dateFromId} size="xs" color="title" className="font-semibold">
                    {t("filters.dateFromLabel")}
                  </Label>
                  <DatePickerInput
                    id={dateFromId}
                    value={draft.dateFrom}
                    onChange={(value) => setDraft((p) => ({ ...p, dateFrom: value }))}
                    placeholder={t("filters.dateFromLabel")}
                    locale={locale}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={dateToId} size="xs" color="title" className="font-semibold">
                    {t("filters.dateToLabel")}
                  </Label>
                  <DatePickerInput
                    id={dateToId}
                    value={draft.dateTo}
                    onChange={(value) => setDraft((p) => ({ ...p, dateTo: value }))}
                    placeholder={t("filters.dateToLabel")}
                    locale={locale}
                  />
                </div>
              </div>
            </div>

            <div className="border-border bg-background/95 sticky bottom-0 z-10 flex flex-wrap gap-2 border-t p-4 backdrop-blur sm:p-6">
              <button
                type="button"
                onClick={apply}
                className={cn(buttonVariants({ variant: "primary" }), "min-h-11 rounded-xl px-5")}
              >
                {t("filters.apply")}
              </button>
              <button
                type="button"
                onClick={reset}
                className={cn(buttonVariants({ variant: "ghost" }), "min-h-11 rounded-xl px-5")}
              >
                {t("filters.reset")}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
