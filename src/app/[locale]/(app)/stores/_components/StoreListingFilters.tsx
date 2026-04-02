"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Filter, Globe, Search, X } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import { useFocusScope } from "@/lib/a11y/useFocusScope";
import { ROUTES } from "@/lib/constants";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import posthog from "posthog-js";
import Typography from "@/components/core/Typography";
import StoreMultiTagAutocomplete from "./share/StoreMultiTagAutocomplete";

const PRESENCE_TYPES = ["ONLINE", "PHYSICAL"] as const;
const FILTER_CHIP_CLASSNAME =
  "border-border/70 bg-background text-text-body hover:border-primary/60 hover:bg-primary/10 focus-visible:ring-ring inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:outline-none";
const FILTER_CHIP_SELECTED_CLASSNAME =
  "border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground";

type StoreListingFiltersProps = {
  locale: string;
  createStoreLabel: string;
  productTypeOptions: { key: string }[];
  countryOptions: { code: string }[];
  initialNameQuery: string;
  initialProductTypeKeys: string[];
  initialCountryCodes: string[];
  initialImportCountryCodes: string[];
  initialPresenceTypes: string[];
  initialReceivesOrders: boolean;
  initialHasStock: boolean;
  totalStores: number;
  showingFrom: number;
  showingTo: number;
};

type ListingFilters = {
  nameQuery: string;
  productTypeKeys: string[];
  countryCodes: string[];
  importCountryCodes: string[];
  presenceTypes: string[];
  receivesOrders: boolean;
  hasStock: boolean;
};

function cloneListingFilters(filters: ListingFilters): ListingFilters {
  return {
    ...filters,
    productTypeKeys: [...filters.productTypeKeys],
    countryCodes: [...filters.countryCodes],
    importCountryCodes: [...filters.importCountryCodes],
    presenceTypes: [...filters.presenceTypes],
  };
}

export default function StoreListingFilters({
  locale,
  createStoreLabel,
  productTypeOptions,
  countryOptions,
  initialNameQuery,
  initialProductTypeKeys,
  initialCountryCodes,
  initialImportCountryCodes,
  initialPresenceTypes,
  initialReceivesOrders,
  initialHasStock,
  totalStores,
  showingFrom,
  showingTo,
}: StoreListingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("storeListing");
  const tProductTypes = useTranslations("storeProductTypes");
  const tCountries = useTranslations("countries");
  const tCreate = useTranslations("stores.create");
  const filtersPanelTitleId = useId();
  const nameQueryFieldId = useId();
  const filterOpenButtonRef = useRef<HTMLButtonElement>(null);
  const filtersDrawerRootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ListingFilters>({
    nameQuery: initialNameQuery,
    productTypeKeys: initialProductTypeKeys,
    countryCodes: initialCountryCodes,
    importCountryCodes: initialImportCountryCodes,
    presenceTypes: initialPresenceTypes,
    receivesOrders: initialReceivesOrders,
    hasStock: initialHasStock,
  });

  const activeFilters = useMemo(
    () => ({
      nameQuery: initialNameQuery,
      productTypeKeys: initialProductTypeKeys,
      countryCodes: initialCountryCodes,
      importCountryCodes: initialImportCountryCodes,
      presenceTypes: initialPresenceTypes,
      receivesOrders: initialReceivesOrders,
      hasStock: initialHasStock,
    }),
    [
      initialNameQuery,
      initialProductTypeKeys,
      initialCountryCodes,
      initialImportCountryCodes,
      initialPresenceTypes,
      initialReceivesOrders,
      initialHasStock,
    ],
  );

  const hasActiveFilters =
    !!activeFilters.nameQuery ||
    activeFilters.productTypeKeys.length > 0 ||
    activeFilters.countryCodes.length > 0 ||
    activeFilters.importCountryCodes.length > 0 ||
    activeFilters.presenceTypes.length > 0 ||
    activeFilters.receivesOrders ||
    activeFilters.hasStock;

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  useFocusScope({
    active: isOpen,
    rootRef: filtersDrawerRootRef,
    onClose: closeDrawer,
    returnFocusRef: filterOpenButtonRef,
  });

  const openDrawer = () => {
    setDraftFilters(cloneListingFilters(activeFilters));
    setIsOpen(true);
  };

  const productTypeAutocompleteOptions = useMemo(
    () => productTypeOptions.map((productType) => ({ value: productType.key, label: tProductTypes(productType.key) })),
    [productTypeOptions, tProductTypes],
  );
  const countryAutocompleteOptions = useMemo(
    () => countryOptions.map((country) => ({ value: country.code, label: tCountries(country.code) })),
    [countryOptions, tCountries],
  );

  const buildUrlWithFilters = (filters: ListingFilters, page: number = 1) => {
    const params = new URLSearchParams();
    if (filters.nameQuery.trim()) params.set("q", filters.nameQuery.trim());
    filters.productTypeKeys.forEach((value) => params.append("productType", value));
    filters.countryCodes.forEach((value) => params.append("country", value));
    filters.importCountryCodes.forEach((value) => params.append("importCountry", value));
    filters.presenceTypes.forEach((value) => params.append("presence", value));
    if (filters.receivesOrders) params.set("receivesOrders", "true");
    if (filters.hasStock) params.set("hasStock", "true");
    if (page > 1) params.set("page", String(page));
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const applyFilters = () => {
    posthog.capture(POSTHOG_EVENTS.STORE.SEARCHED, {
      query_present: !!draftFilters.nameQuery.trim(),
      product_type_count: draftFilters.productTypeKeys.length,
      country_count: draftFilters.countryCodes.length,
      import_country_count: draftFilters.importCountryCodes.length,
      presence_count: draftFilters.presenceTypes.length,
      receives_orders: draftFilters.receivesOrders,
      has_stock: draftFilters.hasStock,
    });
    const nextUrl = buildUrlWithFilters(draftFilters, 1);
    router.push(nextUrl);
    closeDrawer();
  };

  const clearAndApplyFilters = () => {
    const clearedFilters: ListingFilters = {
      nameQuery: "",
      productTypeKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    };
    setDraftFilters(clearedFilters);
    router.push(pathname);
    closeDrawer();
  };

  const removeActiveFilterChip = (
    type: "query" | "productType" | "country" | "importCountry" | "presence" | "orders" | "stock",
    value?: string,
  ) => {
    const nextFilters: ListingFilters = cloneListingFilters(activeFilters);

    if (type === "query") nextFilters.nameQuery = "";
    if (type === "orders") nextFilters.receivesOrders = false;
    if (type === "stock") nextFilters.hasStock = false;
    if (type === "productType" && value)
      nextFilters.productTypeKeys = nextFilters.productTypeKeys.filter((item) => item !== value);
    if (type === "country" && value)
      nextFilters.countryCodes = nextFilters.countryCodes.filter((item) => item !== value);
    if (type === "importCountry" && value) {
      nextFilters.importCountryCodes = nextFilters.importCountryCodes.filter((item) => item !== value);
    }
    if (type === "presence" && value)
      nextFilters.presenceTypes = nextFilters.presenceTypes.filter((item) => item !== value);

    router.push(buildUrlWithFilters(nextFilters, 1));
  };

  const toggleDraftPresenceFilter = (value: string) => {
    const values = draftFilters.presenceTypes;
    const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
    setDraftFilters((previous) => ({
      ...previous,
      presenceTypes: nextValues,
    }));
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <Typography size="sm" className="text-text-muted">
            {totalStores === 0
              ? t("pagination.summaryEmpty")
              : t("pagination.summary", {
                  total: totalStores,
                  start: showingFrom,
                  end: showingTo,
                })}
          </Typography>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-start">
          <button
            ref={filterOpenButtonRef}
            type="button"
            onClick={openDrawer}
            className={cn(buttonVariants({ variant: "secondary" }), "min-h-11 rounded-xl px-4")}
          >
            <Filter className="mr-2 size-4" aria-hidden />
            {t("searchButton")}
          </button>
          <Link
            href={`/${locale}${ROUTES.storesNew}`}
            className={cn(
              buttonVariants({ variant: "primary" }),
              "min-h-11 shrink-0 rounded-xl px-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5",
            )}
          >
            {createStoreLabel}
          </Link>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="border-border/70 bg-background/70 rounded-2xl border p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {!!activeFilters.nameQuery && (
              <button
                type="button"
                onClick={() => removeActiveFilterChip("query")}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <Search className="mr-1 size-3.5" aria-hidden />
                <span>{activeFilters.nameQuery}</span>
                <X className="ml-1 size-3.5" aria-hidden />
              </button>
            )}
            {activeFilters.productTypeKeys.map((value) => (
              <button
                key={`active-product-type-${value}`}
                type="button"
                onClick={() => removeActiveFilterChip("productType", value)}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <span>{tProductTypes(value)}</span>
                <X className="ml-1 size-3.5" aria-hidden />
              </button>
            ))}
            {activeFilters.countryCodes.map((value) => (
              <button
                key={`active-country-${value}`}
                type="button"
                onClick={() => removeActiveFilterChip("country", value)}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <span>{tCountries(value)}</span>
                <X className="ml-1 size-3.5" aria-hidden />
              </button>
            ))}
            {activeFilters.importCountryCodes.map((value) => (
              <button
                key={`active-import-country-${value}`}
                type="button"
                onClick={() => removeActiveFilterChip("importCountry", value)}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <Globe className="mr-1 size-3.5" aria-hidden />
                <span>{tCountries(value)}</span>
                <X className="ml-1 size-3.5" aria-hidden />
              </button>
            ))}
            {activeFilters.presenceTypes.map((value) => (
              <button
                key={`active-presence-${value}`}
                type="button"
                onClick={() => removeActiveFilterChip("presence", value)}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <span>{t(`presence.${value}`)}</span>
                <X className="ml-1 size-3.5" aria-hidden />
              </button>
            ))}
            {activeFilters.receivesOrders && (
              <button
                type="button"
                onClick={() => removeActiveFilterChip("orders")}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <span>{tCreate("receivesOrdersLabel")}</span>
                <X className="ml-1 size-3.5" aria-hidden />
              </button>
            )}
            {activeFilters.hasStock && (
              <button
                type="button"
                onClick={() => removeActiveFilterChip("stock")}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <span>{tCreate("hasStockLabel")}</span>
                <X className="ml-1 size-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          ref={filtersDrawerRootRef}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby={filtersPanelTitleId}
        >
          <button
            type="button"
            className="bg-background/70 absolute inset-0 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden
            tabIndex={-1}
          />
          <aside className="border-border bg-background absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l shadow-xl">
            <div className="border-border flex items-center justify-between gap-2 border-b p-4 sm:p-6">
              <Typography id={filtersPanelTitleId} as="span" size="md" className="text-text-title font-semibold">
                {t("filtersDialogTitle")}
              </Typography>
              <button
                type="button"
                onClick={closeDrawer}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                aria-label={t("closeFiltersPanel")}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-4 pt-5 pb-24 sm:p-6 sm:pt-7 sm:pb-28">
              <div className="space-y-3">
                <Label
                  htmlFor={nameQueryFieldId}
                  size="xs"
                  color="title"
                  spacing="tight"
                  className="mb-1 font-semibold"
                >
                  {t("searchPlaceholder")}
                </Label>
                <Input
                  id={nameQueryFieldId}
                  type="search"
                  value={draftFilters.nameQuery}
                  onChange={(event) => setDraftFilters((previous) => ({ ...previous, nameQuery: event.target.value }))}
                  placeholder={t("searchPlaceholder")}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-3">
                <Typography as="span" size="xs" className="text-text-title mb-1 block font-semibold">
                  {t("filters.productType")}
                </Typography>
                <StoreMultiTagAutocomplete
                  id="stores-filter-product-type"
                  options={productTypeAutocompleteOptions}
                  selectedValues={draftFilters.productTypeKeys}
                  onChange={(values) => setDraftFilters((previous) => ({ ...previous, productTypeKeys: values }))}
                  placeholder={t("filters.productType")}
                  removeItemAriaLabel={(itemLabel) => `${t("clearFilters")} ${itemLabel}`}
                  className="mt-1"
                />
              </div>

              <div className="space-y-3">
                <Typography as="span" size="xs" className="text-text-title mb-1 block font-semibold">
                  {t("filters.country")}
                </Typography>
                <StoreMultiTagAutocomplete
                  id="stores-filter-country"
                  options={countryAutocompleteOptions}
                  selectedValues={draftFilters.countryCodes}
                  onChange={(values) => setDraftFilters((previous) => ({ ...previous, countryCodes: values }))}
                  placeholder={t("filters.country")}
                  removeItemAriaLabel={(itemLabel) => `${t("clearFilters")} ${itemLabel}`}
                  className="mt-1"
                />
              </div>

              <div className="space-y-3">
                <Typography as="span" size="xs" className="text-text-title mb-1 block font-semibold">
                  {t("filters.importCountry")}
                </Typography>
                <StoreMultiTagAutocomplete
                  id="stores-filter-import-country"
                  options={countryAutocompleteOptions}
                  selectedValues={draftFilters.importCountryCodes}
                  onChange={(values) => setDraftFilters((previous) => ({ ...previous, importCountryCodes: values }))}
                  placeholder={t("filters.importCountry")}
                  removeItemAriaLabel={(itemLabel) => `${t("clearFilters")} ${itemLabel}`}
                  className="mt-1"
                />
              </div>

              <fieldset className="space-y-3">
                <legend className="text-text-title text-sm font-semibold">{t("filters.presence")}</legend>
                <div className="flex flex-wrap gap-2">
                  {PRESENCE_TYPES.map((presenceType) => {
                    const isSelected = draftFilters.presenceTypes.includes(presenceType);
                    return (
                      <button
                        key={presenceType}
                        type="button"
                        onClick={() => toggleDraftPresenceFilter(presenceType)}
                        className={cn(FILTER_CHIP_CLASSNAME, isSelected && FILTER_CHIP_SELECTED_CLASSNAME)}
                      >
                        {t(`presence.${presenceType}`)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    setDraftFilters((previous) => ({ ...previous, receivesOrders: !previous.receivesOrders }))
                  }
                  className={cn(FILTER_CHIP_CLASSNAME, draftFilters.receivesOrders && FILTER_CHIP_SELECTED_CLASSNAME)}
                >
                  {tCreate("receivesOrdersLabel")}
                </button>
                <button
                  type="button"
                  onClick={() => setDraftFilters((previous) => ({ ...previous, hasStock: !previous.hasStock }))}
                  className={cn(FILTER_CHIP_CLASSNAME, draftFilters.hasStock && FILTER_CHIP_SELECTED_CLASSNAME)}
                >
                  {tCreate("hasStockLabel")}
                </button>
              </div>
            </div>

            <div className="border-border bg-background/95 sticky bottom-0 z-10 border-t p-4 backdrop-blur sm:p-6">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyFilters}
                  className={cn(buttonVariants({ variant: "primary" }), "min-h-11 rounded-xl px-5")}
                >
                  {t("searchButton")}
                </button>
                <button
                  type="button"
                  onClick={clearAndApplyFilters}
                  className={cn(buttonVariants({ variant: "ghost" }), "min-h-11 rounded-xl px-5")}
                >
                  {t("clearFilters")}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
