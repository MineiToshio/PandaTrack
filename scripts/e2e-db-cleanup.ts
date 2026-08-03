/**
 * DB cleanup backstop invoked by `e2e/_helpers/dbCleanup.ts` as a child `tsx` process: Playwright's
 * test transform cannot load the generated Prisma client's ESM `import.meta` usage, so cleanup runs
 * here instead, under the same `tsx` runtime `scripts/seed-dev-data.ts` already uses successfully.
 *
 * Usage: `npx tsx scripts/e2e-db-cleanup.ts '<JSON CleanupRequest>'`
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

interface CleanupRequest {
  orderIds?: string[];
  storeSlugs?: string[];
  deliveryIds?: string[];
  pushEndpointPrefix?: string;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function parseRequest(): CleanupRequest {
  const raw = process.argv[2];
  if (!raw) {
    throw new Error("Usage: tsx scripts/e2e-db-cleanup.ts '<JSON CleanupRequest>'");
  }
  return JSON.parse(raw) as CleanupRequest;
}

async function main(): Promise<void> {
  const request = parseRequest();

  // Deliveries first: a `Delivery` has no direct FK to `Order` (it links via `DeliveryOrderItem`),
  // so deleting the order first would not cascade to it.
  if (request.deliveryIds?.length) {
    await prisma.delivery.deleteMany({ where: { id: { in: request.deliveryIds } } });
  }
  if (request.orderIds?.length) {
    await prisma.order.deleteMany({ where: { id: { in: request.orderIds } } });
  }
  if (request.storeSlugs?.length) {
    await prisma.store.deleteMany({ where: { slug: { in: request.storeSlugs } } });
  }
  if (request.pushEndpointPrefix) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: request.pushEndpointPrefix } } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
