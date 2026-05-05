"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe, Plus, SlidersHorizontal, Store, X } from "lucide-react";
import posthog from "posthog-js";
import { useCallback, useMemo, useState, useTransition } from "react";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import SearchInput from "@/components/core/SearchInput";
import Select from "@/components/core/Select";
import FilterDrawer, { type FilterDrawerValues, type FilterSection } from "@/components/modules/FilterDrawer";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import CollectorCountryFlagEmoji from "./share/CollectorCountryFlagEmoji";

type StoreListingFiltersProps = {
  locale: string;
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
};

type ListingFilterValues = {
  productTypeKeys: string[];
  countryCodes: string[];
  importCountryCodes: string[];
  presenceTypes: string[];
  flags: string[];
};

const FLAGS_RECEIVES_ORDERS = "receivesOrders";
const FLAGS_HAS_STOCK = "hasStock";

function buildSearchParams(input: { nameQuery: string; values: ListingFilterValues; page?: number; sortBy?: string }) {
  const params = new URLSearchParams();
  if (input.nameQuery.trim()) params.set("q", input.nameQuery.trim());
  input.values.productTypeKeys.forEach((value) => params.append("productType", value));
  input.values.countryCodes.forEach((value) => params.append("country", value));
  input.values.importCountryCodes.forEach((value) => params.append("importCountry", value));
  input.values.presenceTypes.forEach((value) => params.append("presence", value));
  if (input.values.flags.includes(FLAGS_RECEIVES_ORDERS)) params.set("receivesOrders", "true");
  if (input.values.flags.includes(FLAGS_HAS_STOCK)) params.set("hasStock", "true");
  if (input.sortBy && input.sortBy !== "topRated") params.set("sortBy", input.sortBy);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  return params;
}

/**
 * Toolbar + FilterDrawer for the redesigned stores listing (S6).
 * Keeps URL state in sync (`q`, `productType`, `country`, `importCountry`, `presence`,
 * `receivesOrders`, `hasStock`, `sortBy`).
 */
export default function StoreListingFilters({
  locale,
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
}: StoreListingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tListing = useTranslations("storeListing");
  const tStores = useTranslations("stores");
  const tProductTypes = useTranslations("storeProductTypes");
  const tCountries = useTranslations("countries");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState(initialNameQuery);
  const [sortBy, setSortBy] = useState<string>("topRated");
  const [isSearchPending, startSearchTransition] = useTransition();

  const sortOptions = useMemo(
    () => [
      { value: "topRated", label: tListing("s6.sort.topRated") },
      { value: "alphabetical", label: tListing("s6.sort.alphabetical") },
      { value: "newest", label: tListing("s6.sort.newest") },
    ],
    [tListing],
  );

  const initialFlags = useMemo<string[]>(() => {
    const flags: string[] = [];
    if (initialReceivesOrders) flags.push(FLAGS_RECEIVES_ORDERS);
    if (initialHasStock) flags.push(FLAGS_HAS_STOCK);
    return flags;
  }, [initialReceivesOrders, initialHasStock]);

  const [draftValues, setDraftValues] = useState<FilterDrawerValues>({
    productTypeKeys: initialProductTypeKeys,
    countryCodes: initialCountryCodes,
    importCountryCodes: initialImportCountryCodes,
    presenceTypes: initialPresenceTypes,
    flags: initialFlags,
  });

  const productTypeOptionsMemo = useMemo(
    () =>
      productTypeOptions.map((p) => {
        const Icon = getStoreProductTypeIcon(p.key);
        return {
          value: p.key,
          label: tProductTypes(p.key),
          icon: <Icon size={14} aria-hidden />,
        };
      }),
    [productTypeOptions, tProductTypes],
  );

  const countryOptionsMemo = useMemo(
    () =>
      countryOptions.map((c) => ({
        value: c.code,
        label: tCountries(c.code),
        leadingDecoration: <CollectorCountryFlagEmoji countryCode={c.code} />,
      })),
    [countryOptions, tCountries],
  );

  const sections: FilterSection[] = useMemo(
    () => [
      {
        id: "productTypeKeys",
        type: "pills",
        label: tStores("redesign.filter.categories"),
        options: productTypeOptionsMemo,
      },
      {
        id: "presenceTypes",
        type: "pills",
        label: tStores("redesign.filter.presence"),
        options: [
          {
            value: "PHYSICAL",
            label: tStores("redesign.filter.presencePhysical"),
            icon: <Store size={12} aria-hidden />,
          },
          { value: "ONLINE", label: tStores("redesign.filter.presenceOnline"), icon: <Globe size={12} aria-hidden /> },
        ],
      },
      {
        id: "countryCodes",
        type: "tag-autocomplete",
        label: tStores("redesign.filter.country"),
        options: countryOptionsMemo,
        placeholder: tStores("redesign.filter.countrySearchPlaceholder"),
      },
      {
        id: "importCountryCodes",
        type: "tag-autocomplete",
        label: tStores("redesign.filter.importCountry"),
        options: countryOptionsMemo,
        placeholder: tStores("redesign.filter.importCountrySearchPlaceholder"),
      },
      {
        id: "flags",
        type: "switches",
        label: tStores("redesign.filter.other"),
        options: [
          { value: FLAGS_RECEIVES_ORDERS, label: tStores("redesign.filter.receivesOrders") },
          { value: FLAGS_HAS_STOCK, label: tStores("redesign.filter.hasStock") },
        ],
      },
    ],
    [tStores, productTypeOptionsMemo, countryOptionsMemo],
  );

  const valuesAsState = (values: FilterDrawerValues): ListingFilterValues => ({
    productTypeKeys: Array.isArray(values.productTypeKeys) ? (values.productTypeKeys as string[]) : [],
    countryCodes: Array.isArray(values.countryCodes) ? (values.countryCodes as string[]) : [],
    importCountryCodes: Array.isArray(values.importCountryCodes) ? (values.importCountryCodes as string[]) : [],
    presenceTypes: Array.isArray(values.presenceTypes) ? (values.presenceTypes as string[]) : [],
    flags: Array.isArray(values.flags) ? (values.flags as string[]) : [],
  });

  const handleSearchSubmit = (query: string) => {
    const stateValues = valuesAsState(draftValues);
    const params = buildSearchParams({ nameQuery: query, values: stateValues, sortBy });
    const queryString = params.toString();
    startSearchTransition(() => {
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    });
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    const stateValues = valuesAsState(draftValues);
    const params = buildSearchParams({ nameQuery, values: stateValues, sortBy: value });
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleApply = useCallback(() => {
    const stateValues = valuesAsState(draftValues);
    posthog.capture(POSTHOG_EVENTS.STORE.SEARCHED, {
      query_present: Boolean(nameQuery.trim()),
      product_type_count: stateValues.productTypeKeys.length,
      country_count: stateValues.countryCodes.length,
      import_country_count: stateValues.importCountryCodes.length,
      presence_count: stateValues.presenceTypes.length,
      receives_orders: stateValues.flags.includes(FLAGS_RECEIVES_ORDERS),
      has_stock: stateValues.flags.includes(FLAGS_HAS_STOCK),
    });
    const params = buildSearchParams({ nameQuery, values: stateValues, sortBy });
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
    setDrawerOpen(false);
  }, [draftValues, nameQuery, sortBy, pathname, router]);

  const handleClear = useCallback(() => {
    setDraftValues({
      productTypeKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      flags: [],
    });
  }, []);

  const pushFiltered = useCallback(
    (values: ListingFilterValues, query: string) => {
      const params = buildSearchParams({ nameQuery: query, values, sortBy });
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router, sortBy],
  );

  const removeFilter = useCallback(
    (
      action:
        | { kind: "query" }
        | { kind: "productType"; value: string }
        | { kind: "country"; value: string }
        | { kind: "importCountry"; value: string }
        | { kind: "presence"; value: string }
        | { kind: "flag"; value: string },
    ) => {
      const current: ListingFilterValues = {
        productTypeKeys: initialProductTypeKeys,
        countryCodes: initialCountryCodes,
        importCountryCodes: initialImportCountryCodes,
        presenceTypes: initialPresenceTypes,
        flags: initialFlags,
      };
      let nextQuery = nameQuery;
      let nextValues: ListingFilterValues = current;
      switch (action.kind) {
        case "query":
          nextQuery = "";
          setNameQuery("");
          break;
        case "productType":
          nextValues = { ...current, productTypeKeys: current.productTypeKeys.filter((v) => v !== action.value) };
          break;
        case "country":
          nextValues = { ...current, countryCodes: current.countryCodes.filter((v) => v !== action.value) };
          break;
        case "importCountry":
          nextValues = {
            ...current,
            importCountryCodes: current.importCountryCodes.filter((v) => v !== action.value),
          };
          break;
        case "presence":
          nextValues = { ...current, presenceTypes: current.presenceTypes.filter((v) => v !== action.value) };
          break;
        case "flag":
          nextValues = { ...current, flags: current.flags.filter((v) => v !== action.value) };
          break;
      }
      setDraftValues(nextValues);
      pushFiltered(nextValues, nextQuery);
    },
    [
      initialProductTypeKeys,
      initialCountryCodes,
      initialImportCountryCodes,
      initialPresenceTypes,
      initialFlags,
      nameQuery,
      pushFiltered,
    ],
  );

  const handleClearAll = useCallback(() => {
    setNameQuery("");
    setDraftValues({
      productTypeKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      flags: [],
    });
    pushFiltered({ productTypeKeys: [], countryCodes: [], importCountryCodes: [], presenceTypes: [], flags: [] }, "");
  }, [pushFiltered]);

  type ActiveChip = { key: string; label: string; onRemove: () => void };

  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (initialNameQuery.trim()) {
      chips.push({
        key: "query",
        label: `"${initialNameQuery.trim()}"`,
        onRemove: () => removeFilter({ kind: "query" }),
      });
    }
    initialProductTypeKeys.forEach((key) => {
      chips.push({
        key: `productType-${key}`,
        label: tProductTypes(key),
        onRemove: () => removeFilter({ kind: "productType", value: key }),
      });
    });
    initialPresenceTypes.forEach((value) => {
      chips.push({
        key: `presence-${value}`,
        label:
          value === "PHYSICAL"
            ? tStores("redesign.filter.presencePhysical")
            : tStores("redesign.filter.presenceOnline"),
        onRemove: () => removeFilter({ kind: "presence", value }),
      });
    });
    initialCountryCodes.forEach((code) => {
      chips.push({
        key: `country-${code}`,
        label: tCountries(code),
        onRemove: () => removeFilter({ kind: "country", value: code }),
      });
    });
    initialImportCountryCodes.forEach((code) => {
      chips.push({
        key: `importCountry-${code}`,
        label: `${tStores("redesign.filter.importCountry")}: ${tCountries(code)}`,
        onRemove: () => removeFilter({ kind: "importCountry", value: code }),
      });
    });
    initialFlags.forEach((flag) => {
      chips.push({
        key: `flag-${flag}`,
        label:
          flag === FLAGS_RECEIVES_ORDERS
            ? tStores("redesign.filter.receivesOrders")
            : tStores("redesign.filter.hasStock"),
        onRemove: () => removeFilter({ kind: "flag", value: flag }),
      });
    });
    return chips;
  }, [
    initialNameQuery,
    initialProductTypeKeys,
    initialPresenceTypes,
    initialCountryCodes,
    initialImportCountryCodes,
    initialFlags,
    tProductTypes,
    tCountries,
    tStores,
    removeFilter,
  ]);

  const newStoreHref = `/${locale}${ROUTES.stores}/new`;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow as="p">{tListing("s6.hero.eyebrow")}</Eyebrow>
          <h1 className="mt-1 [font-size:var(--text-display)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {tListing("s6.hero.title")}
          </h1>
          <p className="mt-1 [font-size:var(--text-body)] [color:var(--text-secondary)]">
            {tListing("s6.hero.subtitle")}
          </p>
        </div>
        <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
          {tListing("s6.count", { count: totalStores })}
        </span>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex-1">
          <SearchInput
            value={nameQuery}
            onChange={setNameQuery}
            onSubmit={handleSearchSubmit}
            isLoading={isSearchPending}
            placeholder={tListing("s6.toolbar.searchPlaceholder")}
            searchLabel={tListing("s6.toolbar.searchPlaceholder")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
            onClick={() => setDrawerOpen(true)}
            className="[background:var(--surface-elevated)]"
          >
            {tListing("s6.toolbar.filter")}
          </Button>
          <Select
            id="store-sort"
            aria-label={tListing("s6.toolbar.sortLabel")}
            value={sortBy}
            onChange={handleSortChange}
            size="md"
            options={sortOptions}
            className="w-auto"
          />
          <Button
            as="a"
            href={newStoreHref}
            variant="primary"
            size="md"
            leadingIcon={<Plus size={16} aria-hidden="true" />}
          >
            {tListing("s6.toolbar.new")}
          </Button>
        </div>
      </div>
      {activeChips.length > 0 && (
        <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`${tStores("redesign.filter.clear")} ${chip.label}`}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_28%,transparent)] hover:[background:color-mix(in_oklch,var(--accent)_18%,transparent)] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]"
            >
              <span className="whitespace-nowrap">{chip.label}</span>
              <X size={12} aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 px-2 text-[12px] [color:var(--text-muted)] hover:[color:var(--text-primary)] hover:underline focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]"
          >
            {tStores("redesign.filter.clear")}
          </button>
        </div>
      )}
      <FilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={tStores("redesign.filter.title")}
        sections={sections}
        values={draftValues}
        onChange={setDraftValues}
        onApply={handleApply}
        onClear={handleClear}
        applyLabel={tStores("redesign.filter.apply")}
        clearLabel={tStores("redesign.filter.clear")}
        applyCountLabel={(count) => tStores("redesign.filter.applyWithCount", { count })}
      />
    </section>
  );
}
