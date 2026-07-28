/**
 * Collector-focused store product type keys seeded in the database (`store_product_type` table).
 * Keep in sync with `prisma/seed.ts` usage and user-settings validation.
 */

export const STORE_PRODUCT_TYPE_KEYS = [
  "albums",
  "art_books",
  "books",
  "book_accessories",
  "comics",
  "figures",
  "funkos",
  "funko_accessories",
  "home_video",
  "light_novels",
  "magazines",
  "manga",
  "merchandise",
  "music",
  "signatures",
  "trading_cards",
  "video_games",
] as const;

export type StoreProductTypeKey = (typeof STORE_PRODUCT_TYPE_KEYS)[number];

export function isStoreProductTypeKey(value: string): value is StoreProductTypeKey {
  return (STORE_PRODUCT_TYPE_KEYS as readonly string[]).includes(value);
}
