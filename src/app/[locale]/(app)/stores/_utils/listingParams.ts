import type { StorePresenceType } from "../../../../../../generated/prisma/client";

/**
 * Normalizes searchParams from the store listing page into filter values.
 * Supports single or multiple values per key (e.g. productType=manga&productType=comics).
 */
export function parseListingSearchParams(raw: Record<string, string | string[] | undefined>): {
  nameQuery: string | undefined;
  productTypeKeys: string[];
  countryCodes: string[];
  importCountryCodes: string[];
  presenceTypes: StorePresenceType[];
  receivesOrders: boolean;
  hasStock: boolean;
  page: number;
} {
  const nameQuery = typeof raw.q === "string" ? raw.q.trim() || undefined : undefined;
  const productTypeKeys = [...arrayFromParam(raw.productType), ...arrayFromParam(raw.category)].filter(Boolean);
  const countryCodes = arrayFromParam(raw.country).filter(Boolean);
  const importCountryCodes = arrayFromParam(raw.importCountry).filter(Boolean);
  const presenceTypes = arrayFromParam(raw.presence).filter(
    (p): p is StorePresenceType => p === "ONLINE" || p === "PHYSICAL",
  );
  const receivesOrders = raw.receivesOrders === "true";
  const hasStock = raw.hasStock === "true";
  const page = parsePositiveInteger(raw.page);
  return {
    nameQuery,
    productTypeKeys,
    countryCodes,
    importCountryCodes,
    presenceTypes,
    receivesOrders,
    hasStock,
    page,
  };
}

function arrayFromParam(p: string | string[] | undefined): string[] {
  if (p == null) return [];
  return Array.isArray(p) ? p : [p];
}

function parsePositiveInteger(value: string | string[] | undefined): number {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (!firstValue) {
    return 1;
  }

  const parsedValue = Number.parseInt(firstValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return parsedValue;
}
