"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { StoreCombobox, type StoreComboboxOption } from "@/components/modules/StoreCombobox";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { isCollectorCountryCode, PRIMARY_CURRENCY_BY_COUNTRY } from "@/lib/catalog/collectorCountries";
import { RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";

export type OrderStoreOption = {
  id: string;
  name: string;
  logoUrl?: string | null;
  countryCode: string;
};

type OrderStoreFieldProps = {
  id: string;
  stores: OrderStoreOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  error?: boolean;
};

function storeMeta(store: OrderStoreOption): string | undefined {
  const upper = store.countryCode.toUpperCase();
  if (!isCollectorCountryCode(upper)) return undefined;
  const cur = PRIMARY_CURRENCY_BY_COUNTRY[upper];
  return cur ? `${upper} · ${cur}` : upper;
}

/**
 * Store field for order creation: the canonical {@link StoreCombobox} with
 * country/currency meta and the "create store" escape hatch.
 */
export default function OrderStoreField({ id, stores, value, onChange, error }: OrderStoreFieldProps) {
  const t = useTranslations("orders.form");
  const tPicker = useTranslations("orders.picker");
  const locale = useLocale();

  const createHref = `/${locale}${ROUTES.storesNew}?${AUTH_RETURN_TO_PARAM}=${RETURN_TO_ORDER_CREATE}`;

  const options = useMemo<StoreComboboxOption[]>(
    () =>
      stores.map((s) => ({
        id: s.id,
        name: s.name,
        logoUrl: s.logoUrl,
        meta: storeMeta(s),
        searchText: `${s.name} ${s.countryCode}`,
      })),
    [stores],
  );

  return (
    <StoreCombobox
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t("storePlaceholder")}
      emptyLabel={tPicker("storeEmpty")}
      mobileTitle={tPicker("storeTitle")}
      mobileSearchPlaceholder={tPicker("storeSearch")}
      error={error}
      clearable
      clearLabel={t("storeClearLabel")}
      createAction={{
        label: tPicker("storeCreate"),
        href: createHref,
        notFoundQuestion: t("storeNotFoundQuestion"),
      }}
    />
  );
}
