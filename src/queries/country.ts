import type { PrismaClient } from "../../generated/prisma/client";

export type CountryCodeRow = { code: string };

/**
 * Lists all known country codes in ascending order.
 * Used by forms that let users pick a country from the catalog.
 */
export async function listCountryCodes(db: PrismaClient): Promise<CountryCodeRow[]> {
  return db.country.findMany({
    select: { code: true },
    orderBy: { code: "asc" },
  });
}

/**
 * Returns the subset of the provided country codes that exist in the catalog.
 * Used to validate user-submitted country codes on server actions.
 */
export async function listExistingCountryCodes(db: PrismaClient, codes: readonly string[]): Promise<CountryCodeRow[]> {
  if (codes.length === 0) {
    return [];
  }
  return db.country.findMany({
    where: { code: { in: [...codes] } },
    select: { code: true },
  });
}
