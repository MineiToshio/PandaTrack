/**
 * Sort values for the public stores listing.
 *
 * Kept free of Prisma imports so the client filter component can consume the union too. The
 * matching `orderBy` lives in `storeQueries.resolveStoreListOrderBy`.
 */
export const STORE_LIST_SORT_VALUES = ["topRated", "alphabetical", "alphabetical-desc", "newest"] as const;

export type StoreListSort = (typeof STORE_LIST_SORT_VALUES)[number];

export const DEFAULT_STORE_LIST_SORT: StoreListSort = "topRated";

export function parseStoreListSort(raw: string | string[] | undefined): StoreListSort {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (STORE_LIST_SORT_VALUES as readonly string[]).includes(value ?? "")
    ? (value as StoreListSort)
    : DEFAULT_STORE_LIST_SORT;
}
