/**
 * One-off data repair for `Store.visibility`.
 *
 * `createStore` never accepts or writes `visibility` — every app-created store keeps the schema
 * default (`PUBLIC`) forever, and the app's only real privacy control is `isPrivate` (excluded
 * from the public listing/search via `isPrivate: false` in `buildPublicStoreListingWhere`).
 * `getOrderableStores`, `findCandidatesByPhone`/`findCandidatesByName`, and `getStoreBySlug`'s
 * public-detail path all filter on `visibility: "PUBLIC"` instead, so a store stuck on
 * `visibility: "PRIVATE"` becomes impossible to order against or auto-match — not just hidden
 * from public listing — even for its own creator, contradicting FR-04-33 ("private person stores
 * retain all collector functionality for their creator").
 *
 * A one-off local migration script (`scripts/local/migrate-pedidos/`) wrote `visibility: "PRIVATE"`
 * directly, bypassing `createStore`, for every migrated `PERSON`-type store. This backfill reverts
 * that field back to the schema default so those stores become orderable again, while leaving
 * `isPrivate` untouched — they stay correctly hidden from `/stores` and public search.
 *
 * Scoped narrowly to `visibility: "PRIVATE"` AND `isPrivate: true` so it only touches rows in
 * exactly the state the migration script produced.
 *
 * Idempotent: re-running finds nothing left to update. Safe to run again.
 *
 * Usage: npx tsx scripts/backfill-store-visibility.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const result = await prisma.store.updateMany({
    where: { visibility: "PRIVATE", isPrivate: true },
    data: { visibility: "PUBLIC" },
  });

  console.log(`Backfilled visibility to PUBLIC for ${result.count} stores.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
