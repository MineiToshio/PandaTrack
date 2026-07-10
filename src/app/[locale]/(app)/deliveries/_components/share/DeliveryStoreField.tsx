"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { StoreCombobox, type StoreComboboxOption } from "@/components/modules/StoreCombobox";

export type DeliveryStoreOption = {
  storeId: string;
  storeName: string;
  /** Eligible-product count shown as trailing meta ("N productos sin entregar"). */
  eligibleCount: number;
};

type DeliveryStoreFieldProps = {
  id: string;
  stores: DeliveryStoreOption[];
  value: string | null;
  onChange: (next: string) => void;
  error?: boolean;
};

/**
 * Store field for the standalone delivery-create entry. Wraps the
 * canonical {@link StoreCombobox} with delivery-specific meta (pending-product
 * count). No "create store" escape hatch — an ineligible store is not fixable
 * here, and only stores with eligible products are listed.
 */
export default function DeliveryStoreField({ id, stores, value, onChange, error }: DeliveryStoreFieldProps) {
  const t = useTranslations("deliveries");

  const options = useMemo<StoreComboboxOption[]>(
    () =>
      stores.map((s) => ({
        id: s.storeId,
        name: s.storeName,
        meta: t("create.step1.eligibleCount", { count: s.eligibleCount }),
      })),
    [stores, t],
  );

  return (
    <StoreCombobox
      id={id}
      options={options}
      value={value}
      onChange={(next) => {
        if (next) onChange(next);
      }}
      placeholder={t("create.step1.storePlaceholder")}
      emptyLabel={t("create.step1.storeNoResults")}
      mobileTitle={t("create.step1.storeLabel")}
      mobileSearchPlaceholder={t("create.step1.storePlaceholder")}
      error={error}
      listAriaLabel={t("create.step1.storeListAriaLabel")}
    />
  );
}
