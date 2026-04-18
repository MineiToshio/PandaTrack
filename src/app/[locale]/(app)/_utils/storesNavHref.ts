import { ROUTES } from "@/lib/constants";

export type StoresNavPreferences = {
  preferredCountryCode: string | null;
  preferredProductTypeKeys: string[];
};

export type StoresNavCatalog = {
  activeCountryCodes: ReadonlySet<string>;
  activeProductTypeKeys: ReadonlySet<string>;
};

/**
 * Builds the stores listing navigation href with preference-derived query params.
 * Only includes params for dimensions the user has saved; drops catalog-invalid values.
 * Uses repeated `country` and `productType` keys matching parseListingSearchParams encoding.
 */
export function buildStoresNavHref(
  locale: string,
  prefs: StoresNavPreferences,
  catalog: StoresNavCatalog,
): string {
  const params = new URLSearchParams();

  if (prefs.preferredCountryCode && catalog.activeCountryCodes.has(prefs.preferredCountryCode)) {
    params.append("country", prefs.preferredCountryCode);
  }

  for (const key of prefs.preferredProductTypeKeys) {
    if (catalog.activeProductTypeKeys.has(key)) {
      params.append("productType", key);
    }
  }

  const basePath = `/${locale}${ROUTES.stores}`;
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
