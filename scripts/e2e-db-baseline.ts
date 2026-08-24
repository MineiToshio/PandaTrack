/**
 * Data guard for the E2E suite: proves a run never deleted or mutated a row it did not create.
 *
 * WHY: the dev database is not a fixture database. It holds the collector's real imported history
 * (Notion + WhatsApp), and several cleanup channels in `scripts/e2e-db-cleanup.ts` delete by slug
 * or by name prefix rather than by an id the run captured — and deleting a `Store` cascades to
 * every order, item, payment and delivery under it. A single mismatched fixture name would take
 * real records with it, silently, and the suite would still report green. This guard turns that
 * class of accident from invisible into a hard failure.
 *
 * How it works: `capture` snapshots the id (and `updatedAt`, where the model has one) of every row
 * in the collector's data graph before the suite runs. `verify` re-reads the same graph afterwards
 * and fails if any snapshotted row disappeared or changed. Rows the run *created* are absent from
 * the snapshot, so creating and deleting fixtures stays free — only pre-existing rows are frozen.
 *
 * Runs as a child `tsx` process for the same reason `scripts/e2e-db-cleanup.ts` does: Playwright's
 * test transform cannot load the generated Prisma client's ESM `import.meta` usage.
 *
 * Usage (from repo root):
 *   npx tsx scripts/e2e-db-baseline.ts capture
 *   npx tsx scripts/e2e-db-baseline.ts verify
 *   npx tsx scripts/e2e-db-baseline.ts sweep-progression
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

/** Repo-root file, gitignored. Written by `capture`, read by `verify` and by the cleanup script. */
export const BASELINE_PATH = path.join(__dirname, "..", ".e2e-data-baseline.json");

/**
 * The collector's data graph. Every model here is one a spec could reach through the UI or through
 * a cleanup channel. `updatedAt: false` marks a model that has no such column, so it is checked for
 * deletion only.
 */
const PROTECTED_MODELS = [
  { model: "store", updatedAt: true },
  { model: "order", updatedAt: true },
  { model: "orderItem", updatedAt: true },
  { model: "orderPayment", updatedAt: true },
  { model: "storePayment", updatedAt: true },
  { model: "paymentAllocation", updatedAt: false },
  { model: "delivery", updatedAt: true },
] as const;

type ModelName = (typeof PROTECTED_MODELS)[number]["model"];

/** `{ [model]: { [id]: updatedAt ISO string | "" } }` — `""` for models with no `updatedAt`. */
export type Baseline = Record<string, Record<string, string>>;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function readModel(model: ModelName, hasUpdatedAt: boolean): Promise<Record<string, string>> {
  const select = hasUpdatedAt ? { id: true, updatedAt: true } : { id: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Array<{ id: string; updatedAt?: Date }> = await (prisma as any)[model].findMany({ select });

  const snapshot: Record<string, string> = {};
  for (const row of rows) {
    snapshot[row.id] = row.updatedAt ? row.updatedAt.toISOString() : "";
  }
  return snapshot;
}

async function readGraph(): Promise<Baseline> {
  const baseline: Baseline = {};
  for (const { model, updatedAt } of PROTECTED_MODELS) {
    baseline[model] = await readModel(model, updatedAt);
  }
  return baseline;
}

async function capture(): Promise<void> {
  const baseline = await readGraph();
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline), "utf8");

  const total = Object.values(baseline).reduce((sum, rows) => sum + Object.keys(rows).length, 0);
  console.log(`[e2e guard] baseline captured: ${total} pre-existing rows frozen.`);
}

interface Violation {
  model: string;
  id: string;
  kind: "deleted" | "mutated";
}

/** Cap on how many offending ids a failure message lists, so a mass deletion stays readable. */
const MAX_REPORTED_PER_MODEL = 10;

async function verify(): Promise<void> {
  if (!fs.existsSync(BASELINE_PATH)) {
    // Fail closed: a missing baseline means `capture` never ran, so this run has no proof either
    // way. Passing silently here would defeat the whole guard the first time setup breaks.
    throw new Error(`[e2e guard] no baseline at ${BASELINE_PATH}. globalSetup must run 'capture' before the suite.`);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as Baseline;
  const current = await readGraph();
  const violations: Violation[] = [];

  for (const { model } of PROTECTED_MODELS) {
    const before = baseline[model] ?? {};
    const after = current[model] ?? {};

    for (const [id, updatedAt] of Object.entries(before)) {
      const now = after[id];
      if (now === undefined) {
        violations.push({ model, id, kind: "deleted" });
      } else if (updatedAt !== "" && now !== updatedAt) {
        violations.push({ model, id, kind: "mutated" });
      }
    }
  }

  if (violations.length === 0) {
    console.log("[e2e guard] clean: no pre-existing row was deleted or modified.");
    return;
  }

  const byModel = new Map<string, Violation[]>();
  for (const violation of violations) {
    const bucket = byModel.get(violation.model) ?? [];
    bucket.push(violation);
    byModel.set(violation.model, bucket);
  }

  const lines = ["[e2e guard] THE SUITE TOUCHED ROWS IT DID NOT CREATE.", ""];
  for (const [model, list] of byModel) {
    const deleted = list.filter((v) => v.kind === "deleted");
    const mutated = list.filter((v) => v.kind === "mutated");
    lines.push(`  ${model}: ${deleted.length} deleted, ${mutated.length} modified`);
    for (const violation of list.slice(0, MAX_REPORTED_PER_MODEL)) {
      lines.push(`    - ${violation.kind}: ${violation.id}`);
    }
    if (list.length > MAX_REPORTED_PER_MODEL) {
      lines.push(`    ... and ${list.length - MAX_REPORTED_PER_MODEL} more`);
    }
  }
  lines.push(
    "",
    "  These rows existed before the run. This is real collector data, not fixtures.",
    "  Restore them from the Neon branch's point-in-time history before continuing.",
  );

  throw new Error(lines.join("\n"));
}

/**
 * Removes the progression rows the run itself produced.
 *
 * WHY this is not covered by `verify` above, and why it needs its own pass: the guard freezes rows
 * that EXISTED before the suite, and progression rows are ones the suite CREATES. That asymmetry is
 * ordinarily harmless, since a created fixture is deleted by whichever spec made it. Progression is
 * the exception, for two reasons that compound:
 *
 *   - Nothing owns these rows. `point_ledger_entry.entityId` carries no foreign key by design
 *     (`ADR 0035`), so deleting the fixture order a spec created leaves its ledger entries behind,
 *     and `MedalUnlock` is never revoked at all (`BR-12-08`), by anything, ever.
 *   - Merely READING triggers them. Opening `/progress` schedules a recompute (`FR-12-11`), and a
 *     recompute evaluates every medal condition against the collector's whole real history. A spec
 *     that only navigates to the section therefore unlocks every medal that history already
 *     satisfies, permanently, without creating a single fixture row.
 *
 * Measured, not theoretical: a single pass of the suite left ten `medal_unlock` rows and a
 * `user_progress` row on the owner's real account, and no cleanup channel could take them back.
 *
 * The instant the run began is the baseline file's own mtime, which `capture` writes at exactly
 * that moment, so nothing has to be threaded from setup to teardown.
 *
 * Conservative on purpose: `user_progress` is dropped only while it still carries its initial
 * shape, the same reasoning `scripts/e2e-db-cleanup.ts` applies to `progression_settings`. A row
 * holding real derived progression is left alone and reported, because leaving a visible trace is
 * strictly better than destroying state the collector earned.
 */
async function sweepProgression(): Promise<void> {
  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(`[e2e guard] no baseline at ${BASELINE_PATH}. globalSetup must run 'capture' before the suite.`);
  }
  const runStartedAt = fs.statSync(BASELINE_PATH).mtime;

  const entries = await prisma.pointLedgerEntry.deleteMany({ where: { createdAt: { gte: runStartedAt } } });
  const unlocks = await prisma.medalUnlock.deleteMany({
    where: { unlockedAt: { gte: runStartedAt }, source: "LIVE" },
  });
  const progress = await prisma.userProgress.deleteMany({
    where: { lastRecomputedAt: { gte: runStartedAt }, maturedPoints: 0, rankIndex: 1, highestRankIndex: 1 },
  });
  const kept = await prisma.userProgress.count({ where: { lastRecomputedAt: { gte: runStartedAt } } });

  const swept = entries.count + unlocks.count + progress.count;
  if (swept === 0 && kept === 0) {
    console.log("[e2e guard] progression: the run wrote nothing to sweep.");
    return;
  }
  console.log(
    `[e2e guard] progression swept: ${entries.count} ledger entries, ${unlocks.count} medal unlocks, ` +
      `${progress.count} progress rows.`,
  );
  if (kept > 0) {
    console.log(
      `[e2e guard] progression: ${kept} user_progress row(s) carry real derived progression and were LEFT IN PLACE. ` +
        "Review them before the next run.",
    );
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "capture") return capture();
  if (mode === "verify") return verify();
  if (mode === "sweep-progression") return sweepProgression();
  throw new Error("Usage: tsx scripts/e2e-db-baseline.ts <capture|verify|sweep-progression>");
}

// Only when invoked directly. `scripts/e2e-db-cleanup.ts` imports `BASELINE_PATH` and `Baseline`
// from here, and without this guard that import would run `main()` with the cleanup's own argv.
if (require.main === module) {
  main()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
