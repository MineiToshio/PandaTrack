/**
 * Seed script for store catalogs and baseline taxonomy data.
 * Idempotent: safe to run multiple times (uses createMany with skipDuplicates).
 *
 * Seeds:
 * - Country catalog (ISO 3166-1 alpha-2 codes) for store country and import-country references.
 * - Store categories (collector-focused) for store assignment and filters.
 *
 * Labels for countries and categories are resolved via i18n (e.g. countries.{code}, storeCategories.{key}).
 * See docs/development/store-catalogs.md for stable identifiers and usage.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  allowExitOnIdle: true,
});
const adapter = new PrismaPg(pool);
const defaultPrisma = new PrismaClient({ adapter });

/**
 * ISO 3166-1 alpha-2 country codes. Stable; display labels come from i18n (countries.{code}).
 * Initial set: app locales (es, en) and collector-relevant markets. Expand the array when more
 * countries are needed; see docs/development/store-catalogs.md.
 */
export const COUNTRY_CODES = [
  "AR", // Argentina
  "BR", // Brazil
  "CA", // Canada
  "CL", // Chile
  "CN", // China
  "CO", // Colombia
  "DE", // Germany
  "ES", // Spain
  "FR", // France
  "GB", // United Kingdom
  "IT", // Italy
  "JP", // Japan
  "KR", // South Korea
  "MX", // Mexico
  "PE", // Peru
  "PT", // Portugal
  "US", // United States
] as const;

/** Collector-focused store category keys. Stable; display labels come from i18n (storeCategories.{key}). */
export const STORE_CATEGORY_KEYS = [
  "albums",
  "art_books",
  "books",
  "book_accessories", // care, separators, sleeves, etc. for books/manga/light novels
  "comics",
  "figures",
  "funkos",
  "funko_accessories", // pedestals, display steps, protectors, cases
  "home_video", // DVD, Blu-ray: anime, movies, series (physical)
  "light_novels",
  "manga",
  "merchandise",
  "music", // CDs, vinyl, physical music
  "signatures",
  "trading_cards",
  "video_games",
] as const;

async function seedCountries(db: PrismaClient): Promise<void> {
  await db.country.createMany({
    data: COUNTRY_CODES.map((code) => ({ code })),
    skipDuplicates: true,
  });
}

async function seedStoreCategories(db: PrismaClient): Promise<void> {
  await db.storeCategory.createMany({
    data: STORE_CATEGORY_KEYS.map((key) => ({ key, isActive: true })),
    skipDuplicates: true,
  });
}

export async function runSeed(db?: PrismaClient): Promise<void> {
  const client = db ?? defaultPrisma;
  await seedCountries(client);
  await seedStoreCategories(client);
}

async function main(): Promise<void> {
  await runSeed();
}

main()
  .then(async () => {
    await defaultPrisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await defaultPrisma.$disconnect();
    process.exit(1);
  });
