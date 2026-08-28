/**
 * DB cleanup backstop invoked by `e2e/_helpers/dbCleanup.ts` as a child `tsx` process: Playwright's
 * test transform cannot load the generated Prisma client's ESM `import.meta` usage, so cleanup runs
 * here instead, under the same `tsx` runtime `scripts/seed-dev-data.ts` already uses successfully.
 *
 * Usage: `npx tsx scripts/e2e-db-cleanup.ts '<JSON CleanupRequest>'`
 */
import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { BASELINE_PATH, type Baseline } from "./e2e-db-baseline";

interface CleanupRequest {
  orderIds?: string[];
  storeSlugs?: string[];
  /** Namespaced fixture prefix (e.g. `E2E Payments Store 17…`), for specs whose slug may be unknown. */
  storeNamePrefix?: string;
  deliveryIds?: string[];
  pushEndpointPrefix?: string;
  /** Account whose still-default `progression_settings` row this run created and should drop. */
  progressionSettingsUserEmail?: string;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Ids frozen by `scripts/e2e-db-baseline.ts` before the suite started: every row that already
 * existed. Empty when no baseline file is present (a direct manual invocation), which leaves the
 * pre-guard behavior untouched — `globalTeardown` still catches anything this pass lets through.
 */
function loadProtectedIds(model: "store" | "order" | "delivery"): ReadonlySet<string> {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as Baseline;
  return new Set(Object.keys(baseline[model] ?? {}));
}

/**
 * Fail-closed check run immediately before each delete. The teardown guard reports the damage after
 * the fact; this one refuses to do it in the first place, so the offending spec fails at the exact
 * call that would have destroyed real data instead of the whole run failing later with no culprit.
 */
function assertNotProtected(model: "store" | "order" | "delivery", ids: readonly string[]): void {
  const protectedIds = loadProtectedIds(model);
  const offending = ids.filter((id) => protectedIds.has(id));
  if (offending.length === 0) return;

  throw new Error(
    `[e2e cleanup] refused to delete ${offending.length} pre-existing ${model} row(s): ` +
      `${offending.slice(0, 5).join(", ")}${offending.length > 5 ? ", ..." : ""}. ` +
      `These existed before the suite started, so the run did not create them. ` +
      `Narrow the spec's fixture scope instead of widening this guard.`,
  );
}

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
    assertNotProtected("delivery", request.deliveryIds);
    await prisma.delivery.deleteMany({ where: { id: { in: request.deliveryIds } } });
  }
  if (request.orderIds?.length) {
    assertNotProtected("order", request.orderIds);
    await prisma.order.deleteMany({ where: { id: { in: request.orderIds } } });
  }
  if (request.storeSlugs?.length) {
    // Resolved to ids first so the guard can see what the slug filter actually matches: deleting a
    // `Store` cascades to every order, item, payment and delivery under it.
    const targets = await prisma.store.findMany({
      where: { slug: { in: request.storeSlugs } },
      select: { id: true },
    });
    assertNotProtected(
      "store",
      targets.map((store) => store.id),
    );
    await prisma.store.deleteMany({ where: { slug: { in: request.storeSlugs } } });
  }
  if (request.storeNamePrefix) {
    // Deliberately NOT scoped by `userId` (neither is the `storeSlugs` channel above): this script
    // runs against the single-owner dev database, and the prefix carries a full millisecond
    // timestamp, so what it matches is only ever a store this run created. Add the ownership filter
    // before pointing it at any database with more than one collector in it. Until then the
    // baseline guard is what makes a mistyped prefix fail loudly instead of cascading through the
    // collector's real history.
    const targets = await prisma.store.findMany({
      where: { name: { startsWith: request.storeNamePrefix } },
      select: { id: true },
    });
    assertNotProtected(
      "store",
      targets.map((store) => store.id),
    );
    await prisma.store.deleteMany({ where: { name: { startsWith: request.storeNamePrefix } } });
  }
  if (request.pushEndpointPrefix) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: request.pushEndpointPrefix } } });
  }
  if (request.progressionSettingsUserEmail) {
    // The progression switch is the only writer of this table, and one row survives the switch being
    // flipped back: without this the visibility spec would leave a permanent trace on the collector's
    // account. The delete is filtered by BOTH defaults, not only by the account, because the row is
    // also where a hidden layer and an already-celebrated rank live: a run that legitimately left
    // either of those behind (or a collector who set them outside the suite) must keep them. The
    // filter matching nothing is the correct outcome then, not a failure.
    //
    // The baseline guard cannot cover this one: `progression_settings` is keyed by `userId` and has
    // no `id` column for `scripts/e2e-db-baseline.ts` to freeze, and the row is the row the spec is
    // supposed to write. The defaults filter is the protection instead.
    const owner = await prisma.user.findUnique({
      where: { email: request.progressionSettingsUserEmail },
      select: { id: true },
    });
    if (owner) {
      await prisma.progressionSettings.deleteMany({
        where: { userId: owner.id, hideProgression: false, lastCelebratedRankIndex: 0 },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
