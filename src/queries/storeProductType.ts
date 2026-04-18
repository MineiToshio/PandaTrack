import type { PrismaClient } from "../../generated/prisma/client";

export type StoreProductTypeKeyRow = { key: string };

/**
 * Lists active store product type keys in ascending order.
 * Used by forms that let users pick one or more product types from the catalog.
 */
export async function listActiveStoreProductTypeKeys(db: PrismaClient): Promise<StoreProductTypeKeyRow[]> {
  return db.storeProductType.findMany({
    where: { isActive: true },
    select: { key: true },
    orderBy: { key: "asc" },
  });
}

/**
 * Returns the subset of the provided store product type keys that exist in the catalog
 * (regardless of `isActive`). Used to validate user-submitted product type keys on server actions.
 */
export async function listExistingStoreProductTypeKeys(
  db: PrismaClient,
  keys: readonly string[],
): Promise<StoreProductTypeKeyRow[]> {
  if (keys.length === 0) {
    return [];
  }
  return db.storeProductType.findMany({
    where: { key: { in: [...keys] } },
    select: { key: true },
  });
}
