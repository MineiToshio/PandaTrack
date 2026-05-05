import { useTranslations } from "next-intl";
import type { PublicStoreListingItem } from "@/queries/store";
import StoreCard from "./share/StoreCard";

export type StoreListingContentProps = {
  locale: string;
  stores: PublicStoreListingItem[];
  /** Map of store slug → total viewer order count. Only populated for authenticated viewers. */
  viewerOrderCountsBySlug?: Record<string, number>;
};

/**
 * Grid of public stores rendered with the redesigned `StoreCard` (S6).
 * Empty state is rendered by the parent `StoresPage` when `stores.length === 0`.
 */
export default function StoreListingContent({ locale, stores, viewerOrderCountsBySlug }: StoreListingContentProps) {
  const tListing = useTranslations("storeListing");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");

  return (
    <ul className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3" role="list">
      {stores.map((store) => (
        <li key={store.slug}>
          <StoreCard
            store={store}
            locale={locale}
            labels={{
              importCountriesLabel: tListing("s6.importCountriesLabel"),
              noImportCountries: tListing("s6.noImportCountries"),
              countryName: (code) => tCountries(code),
              productTypeLabel: (key) => tProductTypes(key),
              ratingCount: (count) => tListing("ratingCount", { count }),
              ratingFallback: tListing("s6.card.ratingFallback"),
              ariaLabel: (name) => tListing("s6.card.ariaLabel", { name }),
              ordersForViewerLabel: tListing("s6.card.ordersForViewerLabel"),
            }}
            viewerOrderCount={viewerOrderCountsBySlug?.[store.slug]}
          />
        </li>
      ))}
    </ul>
  );
}
