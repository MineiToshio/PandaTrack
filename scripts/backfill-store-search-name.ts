/**
 * One-off backfill for `Store.searchName`, run once after the
 * `add-store-search-name` migration is deployed.
 *
 * The column defaults to "" for existing rows. Duplicate detection reads it with a SQL
 * `contains` pre-filter, so every store needs its normalized name populated. Normalization
 * lives in JS (`normalizeStoreName`: lowercase + NFD diacritic strip + punctuation-to-space +
 * whitespace collapse) and is not exactly reproducible in plain SQL (`unaccent`/`lower` do not
 * strip punctuation or collapse whitespace the same way), so we backfill in TypeScript with the
 * exact same function the write paths use. This guarantees the persisted value matches what the
 * scorer expects for existing and new rows alike.
 *
 * Idempotent: re-running recomputes and writes the same value. Safe to run again after the
 * command completes.
 *
 * Usage: npx tsx scripts/backfill-store-search-name.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { normalizeStoreName } from "../src/lib/store/duplicateMatch";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const stores = await prisma.store.findMany({ select: { id: true, name: true, searchName: true } });

  let updated = 0;
  for (const store of stores) {
    const nextSearchName = normalizeStoreName(store.name);
    if (nextSearchName === store.searchName) {
      continue;
    }
    await prisma.store.update({
      where: { id: store.id },
      data: { searchName: nextSearchName },
    });
    updated += 1;
  }

  console.log(`Backfilled searchName for ${updated} of ${stores.length} stores.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
