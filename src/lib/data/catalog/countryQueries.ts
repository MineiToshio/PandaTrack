import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type CountryCodeRow = { code: string };

/**
 * Lists all known country codes in ascending order.
 * Used by forms that let users pick a country from the catalog.
 */
export async function listCountryCodes(): Promise<CountryCodeRow[]> {
  return prisma.country.findMany({
    select: { code: true },
    orderBy: { code: "asc" },
  });
}

/**
 * Request-deduped variant of `listCountryCodes` for the app shell catalog.
 * Several server components in the same route tree (layout + page) need the full
 * catalog; `cache()` collapses those reads into a single query per request.
 */
export const listCountryCodesCached = cache((): Promise<CountryCodeRow[]> => listCountryCodes());

/**
 * Returns the subset of the provided country codes that exist in the catalog.
 * Used to validate user-submitted country codes on server actions.
 */
export async function listExistingCountryCodes(codes: readonly string[]): Promise<CountryCodeRow[]> {
  if (codes.length === 0) {
    return [];
  }
  return prisma.country.findMany({
    where: { code: { in: [...codes] } },
    select: { code: true },
  });
}
