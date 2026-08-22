/**
 * Read-only DB snapshot backstop invoked by `e2e/_helpers/dbQuery.ts` as a child `tsx` process,
 * mirroring `scripts/e2e-db-cleanup.ts`'s own reasoning: Playwright's test transform cannot load
 * the generated Prisma client's ESM `import.meta` usage, so this runs under the same `tsx` runtime
 * instead. Used by specs that need to assert on rows the UI does not surface directly (e.g.
 * `StorePayment.settledByDeliveryId`, `PaymentAllocation.consumedByDeliveryId`), never to mutate
 * anything.
 *
 * Usage: `npx tsx scripts/e2e-db-query.ts '<JSON QueryRequest>'`, prints one JSON `QueryResult` line
 * to stdout.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

interface QueryRequest {
  /** Namespaced fixture prefix (e.g. `E2E Reconciliation Store 17…`), same convention as cleanup. */
  storeNamePrefix: string;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function parseRequest(): QueryRequest {
  const raw = process.argv[2];
  if (!raw) {
    throw new Error("Usage: tsx scripts/e2e-db-query.ts '<JSON QueryRequest>'");
  }
  return JSON.parse(raw) as QueryRequest;
}

async function main(): Promise<void> {
  const request = parseRequest();

  const stores = await prisma.store.findMany({
    where: { name: { startsWith: request.storeNamePrefix } },
    select: { id: true, name: true, slug: true },
  });
  const storeIds = stores.map((store) => store.id);

  const storePayments = storeIds.length
    ? await prisma.storePayment.findMany({
        where: { storeId: { in: storeIds } },
        select: {
          id: true,
          storeId: true,
          amount: true,
          currencyCode: true,
          settledByDeliveryId: true,
          migratedFromOrderId: true,
          allocations: {
            select: { id: true, orderId: true, amountMinor: true, consumedByDeliveryId: true },
          },
        },
      })
    : [];

  const adjustments = storeIds.length
    ? await prisma.storeAccountAdjustment.findMany({
        where: { storeId: { in: storeIds } },
        select: {
          id: true,
          storeId: true,
          currencyCode: true,
          reason: true,
          lines: { select: { orderId: true, amountMinor: true } },
        },
      })
    : [];

  const deliveries = storeIds.length
    ? await prisma.delivery.findMany({
        where: { storeId: { in: storeIds } },
        select: { id: true, storeId: true, status: true },
      })
    : [];

  console.log(JSON.stringify({ stores, storePayments, adjustments, deliveries }));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
