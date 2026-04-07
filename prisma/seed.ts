/**
 * Seed script for store catalogs and baseline taxonomy data.
 * Idempotent: safe to run multiple times (uses createMany with skipDuplicates).
 *
 * Seeds:
 * - Country catalog (ISO 3166-1 alpha-2 codes) for store country and import-country references.
 * - Store product types (collector-focused) for store assignment and filters.
 *
 * Labels for countries and product types are resolved via i18n (e.g. countries.{code}, storeProductTypes.{key}).
 * See docs/development/store-catalogs.md for stable identifiers and usage.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { COUNTRY_CODES } from "../src/lib/catalog/collectorCountries";
import { STORE_PRODUCT_TYPE_KEYS } from "../src/lib/catalog/storeProductTypes";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  allowExitOnIdle: true,
});
const adapter = new PrismaPg(pool);
const defaultPrisma = new PrismaClient({ adapter });

export { COUNTRY_CODES };
export { STORE_PRODUCT_TYPE_KEYS };

async function seedCountries(db: PrismaClient): Promise<void> {
  await db.country.createMany({
    data: COUNTRY_CODES.map((code) => ({ code })),
    skipDuplicates: true,
  });
}

async function seedStoreProductTypes(db: PrismaClient): Promise<void> {
  await db.storeProductType.createMany({
    data: STORE_PRODUCT_TYPE_KEYS.map((key) => ({ key, isActive: true })),
    skipDuplicates: true,
  });
}

export async function runSeed(db?: PrismaClient): Promise<void> {
  const client = db ?? defaultPrisma;
  await seedCountries(client);
  await seedStoreProductTypes(client);
}

async function main(): Promise<void> {
  await runSeed();
}

const seedModulePath = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1];
const invokedAsCliEntry = argvEntry !== undefined && path.resolve(argvEntry) === path.resolve(seedModulePath);

if (invokedAsCliEntry) {
  main()
    .then(async () => {
      await defaultPrisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await defaultPrisma.$disconnect();
      process.exit(1);
    });
}
