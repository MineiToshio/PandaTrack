import type { StorePresenceType } from "../../../../../../generated/prisma/client";

/**
 * Normalizes searchParams from the store listing page into filter values.
 * Supports single or multiple values per key (e.g. category=manga&category=comics).
 */
export function parseListingSearchParams(raw: Record<string, string | string[] | undefined>): {
  nameQuery: string | undefined;
  categoryKeys: string[];
  countryCodes: string[];
  importCountryCodes: string[];
  presenceTypes: StorePresenceType[];
  receivesOrders: boolean;
  hasStock: boolean;
} {
  const nameQuery = typeof raw.q === "string" ? raw.q.trim() || undefined : undefined;
  const categoryKeys = arrayFromParam(raw.category).filter(Boolean);
  const countryCodes = arrayFromParam(raw.country).filter(Boolean);
  const importCountryCodes = arrayFromParam(raw.importCountry).filter(Boolean);
  const presenceTypes = arrayFromParam(raw.presence).filter(
    (p): p is StorePresenceType => p === "ONLINE" || p === "PHYSICAL",
  );
  const receivesOrders = raw.receivesOrders === "true";
  const hasStock = raw.hasStock === "true";
  return { nameQuery, categoryKeys, countryCodes, importCountryCodes, presenceTypes, receivesOrders, hasStock };
}

function arrayFromParam(p: string | string[] | undefined): string[] {
  if (p == null) return [];
  return Array.isArray(p) ? p : [p];
}
