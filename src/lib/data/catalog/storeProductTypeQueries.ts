import { cache } from "react";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { STORE_PRODUCT_TYPE_KEYS } from "@/lib/catalog/storeProductTypes";
import type { StoreProductTypeAuthoredName } from "@/lib/catalog/resolveStoreProductTypeName";

export type StoreProductTypeKeyRow = { key: string };

export type StoreProductTypeNameRow = StoreProductTypeAuthoredName & { key: string };

/**
 * Lists active store product type keys in ascending order.
 * Used by forms that let users pick one or more product types from the catalog.
 */
export async function listActiveStoreProductTypeKeys(): Promise<StoreProductTypeKeyRow[]> {
  return prisma.storeProductType.findMany({
    where: { isActive: true },
    select: { key: true },
    orderBy: { key: "asc" },
  });
}

/**
 * Request-deduped variant of `listActiveStoreProductTypeKeys` for the app shell catalog.
 * Several server components in the same route tree (layout + page) need the full
 * catalog; `cache()` collapses those reads into a single query per request.
 */
export const listActiveStoreProductTypeKeysCached = cache((): Promise<StoreProductTypeKeyRow[]> =>
  listActiveStoreProductTypeKeys(),
);

/**
 * Lists the active, admin-authored catalog types (those outside the seed union) with their localized
 * DB names. Seeded keys are intentionally excluded: their names stay sourced from the
 * `storeProductTypes` i18n namespace, so the name resolver falls back to i18n for them and never
 * renders a stale backfilled value. Feeds the app-shell authored-name map.
 */
export async function listAuthoredStoreProductTypeNames(): Promise<StoreProductTypeNameRow[]> {
  return prisma.storeProductType.findMany({
    where: { isActive: true, key: { notIn: [...STORE_PRODUCT_TYPE_KEYS] } },
    select: { key: true, nameEs: true, nameEn: true },
    orderBy: { key: "asc" },
  });
}

/** Request-deduped variant of `listAuthoredStoreProductTypeNames` for the app shell. */
export const listAuthoredStoreProductTypeNamesCached = cache((): Promise<StoreProductTypeNameRow[]> =>
  listAuthoredStoreProductTypeNames(),
);

/**
 * Returns the subset of the provided store product type keys that exist in the catalog
 * (regardless of `isActive`). Used to validate user-submitted product type keys on server actions.
 */
export async function listExistingStoreProductTypeKeys(
  keys: readonly string[],
  client: Prisma.TransactionClient = prisma,
): Promise<StoreProductTypeKeyRow[]> {
  if (keys.length === 0) {
    return [];
  }
  return client.storeProductType.findMany({
    where: { key: { in: [...keys] } },
    select: { key: true },
  });
}
