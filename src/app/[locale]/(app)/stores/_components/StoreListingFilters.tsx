"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe, Plus, Store, Truck, User } from "lucide-react";
import posthog from "posthog-js";
import { useCallback, useMemo, useState } from "react";
import AppliedFilterChip from "@/components/core/AppliedFilterChip";
import Button from "@/components/core/Button/Button";
import FilterTriggerButton from "@/components/core/FilterTriggerButton/FilterTriggerButton";
import SearchInput from "@/components/core/SearchInput";
import Select from "@/components/core/Select";
import FilterDrawer, { type FilterDrawerValues, type FilterSection } from "@/components/modules/FilterDrawer";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { DEFAULT_PAGE_SIZE, POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { useStoreProductTypeName } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import CollectorCountryFlagEmoji from "./share/CollectorCountryFlagEmoji";
import { useStoreListingNavigation } from "./StoreListingPendingContext";
import {
  DEFAULT_STORE_LIST_SORT,
  STORE_LIST_SORT_VALUES,
  parseStoreListSort,
  type StoreListSort,
} from "@/lib/stores/storeListSort";

type StoreListingFiltersProps = {
  locale: string;
  productTypeOptions: { key: string }[];
  countryOptions: { code: string }[];
  initialNameQuery: string;
  initialProductTypeKeys: string[];
  initialCountryCodes: string[];
  initialImportCountryCodes: string[];
  initialPresenceTypes: string[];
  initialSellerTypes: string[];
  initialReceivesOrders: boolean;
  initialHasStock: boolean;
  initialIncludeClosed: boolean;
  initialOnlyOwnPrivate: boolean;
  initialSort: StoreListSort;
  /** Page size in effect, preserved across every navigation this toolbar triggers. */
  initialPerPage?: number;
};

type ListingFilterValues = {
  productTypeKeys: string[];
  countryCodes: string[];
  importCountryCodes: string[];
  presenceTypes: string[];
  sellerTypes: string[];
  flags: string[];
};

const FLAGS_RECEIVES_ORDERS = "receivesOrders";
const FLAGS_HAS_STOCK = "hasStock";
const FLAGS_INCLUDE_CLOSED = "includeClosed";
const FLAGS_ONLY_OWN_PRIVATE = "onlyOwnPrivate";

function buildSearchParams(input: {
  nameQuery: string;
  values: ListingFilterValues;
  page?: number;
  sortBy?: string;
  perPage?: number;
}) {
  const params = new URLSearchParams();
  if (input.nameQuery.trim()) params.set("q", input.nameQuery.trim());
  input.values.productTypeKeys.forEach((value) => params.append("productType", value));
  input.values.countryCodes.forEach((value) => params.append("country", value));
  input.values.importCountryCodes.forEach((value) => params.append("importCountry", value));
  input.values.presenceTypes.forEach((value) => params.append("presence", value));
  input.values.sellerTypes.forEach((value) => params.append("sellerType", value));
  if (input.values.flags.includes(FLAGS_RECEIVES_ORDERS)) params.set("receivesOrders", "true");
  if (input.values.flags.includes(FLAGS_HAS_STOCK)) params.set("hasStock", "true");
  if (input.values.flags.includes(FLAGS_INCLUDE_CLOSED)) params.set("includeClosed", "true");
  if (input.values.flags.includes(FLAGS_ONLY_OWN_PRIVATE)) params.set("onlyOwnPrivate", "true");
  if (input.sortBy && input.sortBy !== DEFAULT_STORE_LIST_SORT) params.set("sort", input.sortBy);
  // Carried through every toolbar navigation; it used to be dropped, silently resetting a chosen
  // page size back to the default on search, filter apply and sort.
  if (input.perPage && input.perPage !== DEFAULT_PAGE_SIZE) params.set("perPage", String(input.perPage));
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
  initialSellerTypes,
  initialReceivesOrders,
  initialHasStock,
  initialIncludeClosed,
  initialOnlyOwnPrivate,
  initialSort,
  initialPerPage,
}: StoreListingFiltersProps) {
  const pathname = usePathname();
  const { navigate, isPending } = useStoreListingNavigation();
  const tListing = useTranslations("storeListing");
  const tStores = useTranslations("stores");
  const productTypeName = useStoreProductTypeName();
  const tCountries = useTranslations("countries");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState(initialNameQuery);
  // Seeded from the URL, not from a constant: the control used to reset to "Mejor calificadas" on
  // every navigation while the results stayed sorted by whatever the URL said.
  const [sortBy, setSortBy] = useState<StoreListSort>(initialSort);
  const sortOptions = useMemo(
    () => STORE_LIST_SORT_VALUES.map((value) => ({ value, label: tListing(`s6.sort.${value}`) })),
    [tListing],
  );

  const initialFlags = useMemo<string[]>(() => {
    const flags: string[] = [];
    if (initialReceivesOrders) flags.push(FLAGS_RECEIVES_ORDERS);
    if (initialHasStock) flags.push(FLAGS_HAS_STOCK);
    if (initialIncludeClosed) flags.push(FLAGS_INCLUDE_CLOSED);
    if (initialOnlyOwnPrivate) flags.push(FLAGS_ONLY_OWN_PRIVATE);
    return flags;
  }, [initialReceivesOrders, initialHasStock, initialIncludeClosed, initialOnlyOwnPrivate]);

  const sellerTypeLabel = useCallback(
    (value: string) => {
      if (value === "RETAILER") return tStores("create.sellerTypeRetailer");
      if (value === "PERSON") return tStores("create.sellerTypePerson");
      return tStores("create.sellerTypeProxy");
    },
    [tStores],
  );

  const flagLabel = useCallback(
    (flag: string) => {
      if (flag === FLAGS_RECEIVES_ORDERS) return tStores("redesign.filter.receivesOrders");
      if (flag === FLAGS_HAS_STOCK) return tStores("redesign.filter.hasStock");
      if (flag === FLAGS_ONLY_OWN_PRIVATE) return tStores("redesign.filter.onlyOwnPrivate");
      return tStores("redesign.filter.showClosed");
    },
    [tStores],
  );

  const [draftValues, setDraftValues] = useState<FilterDrawerValues>({
    productTypeKeys: initialProductTypeKeys,
    countryCodes: initialCountryCodes,
    importCountryCodes: initialImportCountryCodes,
    presenceTypes: initialPresenceTypes,
    sellerTypes: initialSellerTypes,
    flags: initialFlags,
  });

  const productTypeOptionsMemo = useMemo(
    () =>
      productTypeOptions.map((p) => {
        const Icon = getStoreProductTypeIcon(p.key);
        return {
          value: p.key,
          label: productTypeName(p.key),
          icon: <Icon size={14} aria-hidden />,
        };
      }),
    [productTypeOptions, productTypeName],
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
        id: "sellerTypes",
        type: "pills",
        label: tStores("redesign.filter.sellerType"),
        options: [
          {
            value: "RETAILER",
            label: tStores("create.sellerTypeRetailer"),
            icon: <Store size={12} aria-hidden />,
          },
          { value: "PERSON", label: tStores("create.sellerTypePerson"), icon: <User size={12} aria-hidden /> },
          { value: "PROXY", label: tStores("create.sellerTypeProxy"), icon: <Truck size={12} aria-hidden /> },
        ],
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
          { value: FLAGS_INCLUDE_CLOSED, label: tStores("redesign.filter.showClosed") },
          { value: FLAGS_ONLY_OWN_PRIVATE, label: tStores("redesign.filter.onlyOwnPrivate") },
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
    sellerTypes: Array.isArray(values.sellerTypes) ? (values.sellerTypes as string[]) : [],
    flags: Array.isArray(values.flags) ? (values.flags as string[]) : [],
  });

  const handleSearchSubmit = (query: string) => {
    const stateValues = valuesAsState(draftValues);
    const params = buildSearchParams({ nameQuery: query, values: stateValues, sortBy, perPage: initialPerPage });
    const queryString = params.toString();
    navigate(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleSortChange = (value: string) => {
    setSortBy(parseStoreListSort(value));
    const stateValues = valuesAsState(draftValues);
    const params = buildSearchParams({ nameQuery, values: stateValues, sortBy: value, perPage: initialPerPage });
    const queryString = params.toString();
    navigate(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleApply = useCallback(() => {
    const stateValues = valuesAsState(draftValues);
    posthog.capture(POSTHOG_EVENTS.STORE.SEARCHED, {
      query_present: Boolean(nameQuery.trim()),
      product_type_count: stateValues.productTypeKeys.length,
      country_count: stateValues.countryCodes.length,
      import_country_count: stateValues.importCountryCodes.length,
      presence_count: stateValues.presenceTypes.length,
      seller_type_count: stateValues.sellerTypes.length,
      receives_orders: stateValues.flags.includes(FLAGS_RECEIVES_ORDERS),
      has_stock: stateValues.flags.includes(FLAGS_HAS_STOCK),
      include_closed: stateValues.flags.includes(FLAGS_INCLUDE_CLOSED),
      only_own_private: stateValues.flags.includes(FLAGS_ONLY_OWN_PRIVATE),
    });
    const params = buildSearchParams({ nameQuery, values: stateValues, sortBy, perPage: initialPerPage });
    const queryString = params.toString();
    navigate(queryString ? `${pathname}?${queryString}` : pathname);
    setDrawerOpen(false);
  }, [draftValues, nameQuery, sortBy, pathname, navigate, initialPerPage]);

  const handleClear = useCallback(() => {
    setDraftValues({
      productTypeKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      sellerTypes: [],
      flags: [],
    });
  }, []);

  const pushFiltered = useCallback(
    (values: ListingFilterValues, query: string) => {
      const params = buildSearchParams({ nameQuery: query, values, sortBy, perPage: initialPerPage });
      const queryString = params.toString();
      navigate(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, navigate, sortBy, initialPerPage],
  );

  const removeFilter = useCallback(
    (
      action:
        | { kind: "query" }
        | { kind: "productType"; value: string }
        | { kind: "country"; value: string }
        | { kind: "importCountry"; value: string }
        | { kind: "presence"; value: string }
        | { kind: "sellerType"; value: string }
        | { kind: "flag"; value: string },
    ) => {
      const current: ListingFilterValues = {
        productTypeKeys: initialProductTypeKeys,
        countryCodes: initialCountryCodes,
        importCountryCodes: initialImportCountryCodes,
        presenceTypes: initialPresenceTypes,
        sellerTypes: initialSellerTypes,
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
        case "sellerType":
          nextValues = { ...current, sellerTypes: current.sellerTypes.filter((v) => v !== action.value) };
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
      initialSellerTypes,
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
      sellerTypes: [],
      flags: [],
    });
    pushFiltered(
      { productTypeKeys: [], countryCodes: [], importCountryCodes: [], presenceTypes: [], sellerTypes: [], flags: [] },
      "",
    );
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
        label: productTypeName(key),
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
    initialSellerTypes.forEach((value) => {
      chips.push({
        key: `sellerType-${value}`,
        label: sellerTypeLabel(value),
        onRemove: () => removeFilter({ kind: "sellerType", value }),
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
        label: flagLabel(flag),
        onRemove: () => removeFilter({ kind: "flag", value: flag }),
      });
    });
    return chips;
  }, [
    initialNameQuery,
    initialProductTypeKeys,
    initialPresenceTypes,
    initialSellerTypes,
    initialCountryCodes,
    initialImportCountryCodes,
    initialFlags,
    productTypeName,
    tCountries,
    tStores,
    sellerTypeLabel,
    flagLabel,
    removeFilter,
  ]);

  // Drawer-only applied count — excludes search query chip (rule: search doesn't increment badge)
  const drawerAppliedCount = useMemo(
    () =>
      initialProductTypeKeys.length +
      initialPresenceTypes.length +
      initialSellerTypes.length +
      initialCountryCodes.length +
      initialImportCountryCodes.length +
      initialFlags.length,
    [
      initialProductTypeKeys,
      initialPresenceTypes,
      initialSellerTypes,
      initialCountryCodes,
      initialImportCountryCodes,
      initialFlags,
    ],
  );

  const newStoreHref = `/${locale}${ROUTES.stores}/new`;

  return (
    <section>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={nameQuery}
            onChange={setNameQuery}
            onSubmit={handleSearchSubmit}
            isLoading={isPending}
            placeholder={tListing("s6.toolbar.searchPlaceholder")}
            searchLabel={tListing("s6.toolbar.searchPlaceholder")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Toolbar order matches orders/deliveries: search → sort → filter → create. */}
          <Select
            id="store-sort"
            aria-label={tListing("s6.toolbar.sortLabel")}
            value={sortBy}
            onChange={handleSortChange}
            size="md"
            options={sortOptions}
            className="w-max"
          />
          <FilterTriggerButton
            appliedCount={drawerAppliedCount}
            onClick={() => setDrawerOpen(true)}
            label={tListing("s6.toolbar.filter")}
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
        <div className="-mx-1 mt-5 flex flex-wrap items-center gap-2 px-1">
          {activeChips.map((chip) => (
            <AppliedFilterChip
              key={chip.key}
              label={chip.label}
              removeAriaLabel={`${tStores("redesign.filter.clear")} ${chip.label}`}
              onRemove={chip.onRemove}
            />
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
