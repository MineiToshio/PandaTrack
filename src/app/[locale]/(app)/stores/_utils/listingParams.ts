import type { StorePresenceType } from "../../../../../../generated/prisma/client";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";

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
  includeClosed: boolean;
  page: number;
  /** Desktop page-size selector value — one of `PAGE_SIZE_OPTIONS`. */
  perPage: number;
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
  const includeClosed = raw.includeClosed === "true";
  const page = parsePositiveInteger(raw.page);
  const perPage = parsePageSize(raw.perPage);
  return {
    nameQuery,
    productTypeKeys,
    countryCodes,
    importCountryCodes,
    presenceTypes,
    receivesOrders,
    hasStock,
    includeClosed,
    page,
    perPage,
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

/** Clamps `?perPage=` to the allow-listed `PAGE_SIZE_OPTIONS`; anything else falls back to the default. */
function parsePageSize(value: string | string[] | undefined): number {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (!firstValue) return DEFAULT_PAGE_SIZE;
  const parsedValue = Number.parseInt(firstValue, 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsedValue) ? parsedValue : DEFAULT_PAGE_SIZE;
}
