"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Filter, Globe, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ROUTES } from "@/lib/constants";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import posthog from "posthog-js";
import Typography from "@/components/core/Typography";
import StoreMultiTagAutocomplete from "./StoreMultiTagAutocomplete";

const PRESENCE_TYPES = ["ONLINE", "PHYSICAL"] as const;
const FILTER_CHIP_CLASSNAME =
  "border-border/70 bg-background text-text-body hover:border-primary/60 hover:bg-primary/10 focus-visible:ring-ring inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:outline-none";
const FILTER_CHIP_SELECTED_CLASSNAME =
  "border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground";

type StoreListingFiltersProps = {
  locale: string;
  createStoreLabel: string;
  categoryOptions: { key: string }[];
  countryOptions: { code: string }[];
  initialNameQuery: string;
  initialCategoryKeys: string[];
  initialCountryCodes: string[];
  initialImportCountryCodes: string[];
  initialPresenceTypes: string[];
  initialReceivesOrders: boolean;
  initialHasStock: boolean;
};

type ListingFilters = {
  nameQuery: string;
  categoryKeys: string[];
  countryCodes: string[];
  importCountryCodes: string[];
  presenceTypes: string[];
  receivesOrders: boolean;
  hasStock: boolean;
};

function cloneListingFilters(filters: ListingFilters): ListingFilters {
  return {
    ...filters,
    categoryKeys: [...filters.categoryKeys],
    countryCodes: [...filters.countryCodes],
    importCountryCodes: [...filters.importCountryCodes],
    presenceTypes: [...filters.presenceTypes],
  };
}

export default function StoreListingFilters({
  locale,
  createStoreLabel,
  categoryOptions,
  countryOptions,
  initialNameQuery,
  initialCategoryKeys,
  initialCountryCodes,
  initialImportCountryCodes,
  initialPresenceTypes,
  initialReceivesOrders,
  initialHasStock,
}: StoreListingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("storeListing");
  const tCategories = useTranslations("storeCategories");
  const tCountries = useTranslations("countries");
  const tCreate = useTranslations("stores.create");
  const [isOpen, setIsOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ListingFilters>({
    nameQuery: initialNameQuery,
    categoryKeys: initialCategoryKeys,
    countryCodes: initialCountryCodes,
    importCountryCodes: initialImportCountryCodes,
    presenceTypes: initialPresenceTypes,
    receivesOrders: initialReceivesOrders,
    hasStock: initialHasStock,
  });

  const activeFilters = useMemo(
    () => ({
      nameQuery: initialNameQuery,
      categoryKeys: initialCategoryKeys,
      countryCodes: initialCountryCodes,
      importCountryCodes: initialImportCountryCodes,
      presenceTypes: initialPresenceTypes,
      receivesOrders: initialReceivesOrders,
      hasStock: initialHasStock,
    }),
    [
      initialNameQuery,
      initialCategoryKeys,
      initialCountryCodes,
      initialImportCountryCodes,
      initialPresenceTypes,
      initialReceivesOrders,
      initialHasStock,
    ],
  );

  const hasActiveFilters =
    !!activeFilters.nameQuery ||
    activeFilters.categoryKeys.length > 0 ||
    activeFilters.countryCodes.length > 0 ||
    activeFilters.importCountryCodes.length > 0 ||
    activeFilters.presenceTypes.length > 0 ||
    activeFilters.receivesOrders ||
    activeFilters.hasStock;

  const openDrawer = () => {
    setDraftFilters(cloneListingFilters(activeFilters));
    setIsOpen(true);
  };

  const categoryAutocompleteOptions = useMemo(
    () => categoryOptions.map((category) => ({ value: category.key, label: tCategories(category.key) })),
    [categoryOptions, tCategories],
  );
  const countryAutocompleteOptions = useMemo(
    () => countryOptions.map((country) => ({ value: country.code, label: tCountries(country.code) })),
    [countryOptions, tCountries],
  );

  const buildUrlWithFilters = (filters: ListingFilters) => {
    const params = new URLSearchParams();
    if (filters.nameQuery.trim()) params.set("q", filters.nameQuery.trim());
    filters.categoryKeys.forEach((value) => params.append("category", value));
    filters.countryCodes.forEach((value) => params.append("country", value));
    filters.importCountryCodes.forEach((value) => params.append("importCountry", value));
    filters.presenceTypes.forEach((value) => params.append("presence", value));
    if (filters.receivesOrders) params.set("receivesOrders", "true");
    if (filters.hasStock) params.set("hasStock", "true");
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const applyFilters = () => {
    posthog.capture(POSTHOG_EVENTS.STORE.SEARCHED, {
      query_present: !!draftFilters.nameQuery.trim(),
      category_count: draftFilters.categoryKeys.length,
      country_count: draftFilters.countryCodes.length,
      import_country_count: draftFilters.importCountryCodes.length,
      presence_count: draftFilters.presenceTypes.length,
      receives_orders: draftFilters.receivesOrders,
      has_stock: draftFilters.hasStock,
    });
    const nextUrl = buildUrlWithFilters(draftFilters);
    router.push(nextUrl);
    setIsOpen(false);
  };

  const clearAndApplyFilters = () => {
    const clearedFilters: ListingFilters = {
      nameQuery: "",
      categoryKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    };
    setDraftFilters(clearedFilters);
    router.push(pathname);
    setIsOpen(false);
  };

  const removeActiveFilterChip = (
    type: "query" | "category" | "country" | "importCountry" | "presence" | "orders" | "stock",
    value?: string,
  ) => {
    const nextFilters: ListingFilters = cloneListingFilters(activeFilters);

    if (type === "query") nextFilters.nameQuery = "";
    if (type === "orders") nextFilters.receivesOrders = false;
    if (type === "stock") nextFilters.hasStock = false;
    if (type === "category" && value)
      nextFilters.categoryKeys = nextFilters.categoryKeys.filter((item) => item !== value);
    if (type === "country" && value)
      nextFilters.countryCodes = nextFilters.countryCodes.filter((item) => item !== value);
    if (type === "importCountry" && value) {
      nextFilters.importCountryCodes = nextFilters.importCountryCodes.filter((item) => item !== value);
    }
    if (type === "presence" && value)
      nextFilters.presenceTypes = nextFilters.presenceTypes.filter((item) => item !== value);

    router.push(buildUrlWithFilters(nextFilters));
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
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
            {activeFilters.categoryKeys.map((value) => (
              <button
                key={`active-category-${value}`}
                type="button"
                onClick={() => removeActiveFilterChip("category", value)}
                className={cn(FILTER_CHIP_CLASSNAME, FILTER_CHIP_SELECTED_CLASSNAME, "min-h-9 px-3 py-1.5")}
              >
                <span>{tCategories(value)}</span>
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
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("searchButton")}>
          <button
            type="button"
            className="bg-background/70 absolute inset-0 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <aside className="border-border bg-background absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l shadow-xl">
            <div className="border-border flex items-center justify-between gap-2 border-b p-4 sm:p-6">
              <Typography as="span" size="md" className="text-text-title font-semibold">
                {t("searchButton")}
              </Typography>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-4 pt-5 pb-24 sm:p-6 sm:pt-7 sm:pb-28">
              <div className="space-y-3">
                <Typography as="span" size="xs" className="text-text-title mb-1 block font-semibold">
                  {t("searchPlaceholder")}
                </Typography>
                <input
                  type="search"
                  value={draftFilters.nameQuery}
                  onChange={(event) => setDraftFilters((previous) => ({ ...previous, nameQuery: event.target.value }))}
                  placeholder={t("searchPlaceholder")}
                  className="border-border bg-background placeholder:text-text-muted focus:ring-ring h-11 w-full rounded-xl border px-3 text-sm focus:ring-2 focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                <Typography as="span" size="xs" className="text-text-title mb-1 block font-semibold">
                  {t("filters.category")}
                </Typography>
                <StoreMultiTagAutocomplete
                  id="stores-filter-category"
                  options={categoryAutocompleteOptions}
                  selectedValues={draftFilters.categoryKeys}
                  onChange={(values) => setDraftFilters((previous) => ({ ...previous, categoryKeys: values }))}
                  placeholder={t("filters.category")}
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
