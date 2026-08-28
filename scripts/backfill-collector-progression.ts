/**
 * One-off replay of the existing collector history into the points ledger.
 *
 * Everything the app credits today is credited at the moment the collector does it, so a history
 * that predates the progression feature (the Notion import, and every order recorded before it
 * shipped) has never been credited at all. This script rebuilds those entries from the rows that
 * survived: one pass per collector, every entry stamped `BACKFILL`, every entry dated on the real
 * historical civil day of the fact it replays, and every medal the replayed history unlocks marked
 * as already seen so a migrated archive does not announce itself as dozens of notifications on the
 * next sign-in.
 *
 * All the logic lives in `src/lib/data/progression/progressionBackfill.ts`, which is what the unit
 * tests drive. This file is the operator wrapper: argument parsing, the transaction, the census.
 *
 * Idempotent: the ledger's own `(userId, ruleKey, entityId)` unique key means a second run inserts
 * nothing. That is reported as "already applied", not as an error. If a migrated payment is missing
 * a payment date, a store, or an order allocation, the run aborts before writing anything at all
 * rather than crediting some collectors and not others.
 *
 * DRY RUN IS THE DEFAULT. Without `--apply` the whole pass runs inside a transaction that is then
 * rolled back, so the census below shows exactly what would have been written and the database is
 * left untouched.
 *
 * Usage: npx tsx scripts/backfill-collector-progression.ts [--apply]
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  ProgressionBackfillSourceIncompleteError,
  runProgressionBackfill,
  type ProgressionBackfillResult,
} from "../src/lib/data/progression/progressionBackfill";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * The dev database carries years of history and the pass recomputes every collector inside the same
 * interactive transaction, so the default 5s budget is nowhere near enough. Generous on purpose: a
 * timeout mid-pass rolls the whole thing back, which is safe but wastes the rehearsal.
 */
const TRANSACTION_TIMEOUT_MS = 15 * 60 * 1000;
const TRANSACTION_MAX_WAIT_MS = 60 * 1000;

/** How many offending ids to print when the source data cannot support a replay. */
const MAX_REPORTED_PAYMENT_IDS = 20;

type TableCensus = {
  ledgerEntries: number;
  medalUnlocks: number;
  progressRows: number;
};

type BackfillOutcome = {
  census: ProgressionBackfillResult;
  after: TableCensus;
};

/**
 * Carries the census out of a dry run.
 *
 * A `return` from an interactive transaction COMMITS, so the only way to run the real pass and keep
 * the database untouched is to throw after collecting the numbers and catch the throw outside.
 */
class DryRunRollback extends Error {
  constructor(readonly outcome: BackfillOutcome) {
    super("DRY_RUN_ROLLBACK");
    this.name = "DryRunRollback";
  }
}

async function readTableCensus(db: Pick<PrismaClient, "pointLedgerEntry" | "medalUnlock" | "userProgress">) {
  const [ledgerEntries, medalUnlocks, progressRows] = await Promise.all([
    db.pointLedgerEntry.count(),
    db.medalUnlock.count(),
    db.userProgress.count(),
  ]);
  return { ledgerEntries, medalUnlocks, progressRows } satisfies TableCensus;
}

function printCensus(label: string, census: TableCensus): void {
  console.log(
    `${label}: point_ledger_entry ${census.ledgerEntries}, medal_unlock ${census.medalUnlocks}, ` +
      `user_progress ${census.progressRows}`,
  );
}

function printUserRows(result: ProgressionBackfillResult): void {
  if (result.users.length === 0) {
    console.log("No collector has any order, so there is nothing to replay.");
    return;
  }

  console.log("");
  console.log("Per collector (points, rank, medals):");
  for (const user of result.users) {
    const medals = user.medalsUnlocked.length > 0 ? user.medalsUnlocked.join(", ") : "none";
    const applied = user.alreadyApplied ? " [already applied]" : "";
    console.log(
      `  ${user.userId}: entries +${user.entriesWritten}, points ${user.pointsBefore} -> ${user.pointsAfter}, ` +
        `rank ${user.rankIndexBefore} -> ${user.rankIndexAfter}, medals unlocked: ${medals}${applied}`,
    );
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  console.log(apply ? "Mode: APPLY. Changes will be committed." : "Mode: DRY RUN. Nothing will be committed.");
  if (!apply) {
    console.log("Re-run with --apply to persist.");
  }

  const before = await readTableCensus(prisma);
  printCensus("Before", before);

  let outcome: BackfillOutcome;
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const census = await runProgressionBackfill(tx);
        const after = await readTableCensus(tx);
        const result: BackfillOutcome = { census, after };

        if (!apply) {
          throw new DryRunRollback(result);
        }
        return result;
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
  } catch (error) {
    if (error instanceof DryRunRollback) {
      outcome = error.outcome;
    } else if (error instanceof ProgressionBackfillSourceIncompleteError) {
      console.error("");
      console.error(
        `BACKFILL_SOURCE_INCOMPLETE: ${error.incompletePaymentIds.length} migrated payments are missing a ` +
          "payment date, a store, or an order allocation. Nothing was written.",
      );
      console.error(
        `Payment ids: ${error.incompletePaymentIds.slice(0, MAX_REPORTED_PAYMENT_IDS).join(", ")}` +
          (error.incompletePaymentIds.length > MAX_REPORTED_PAYMENT_IDS ? ", ..." : ""),
      );
      throw error;
    } else {
      throw error;
    }
  }

  printCensus(apply ? "After" : "After (rolled back)", outcome.after);
  printUserRows(outcome.census);

  console.log("");
  console.log(
    `Collectors processed: ${outcome.census.usersProcessed}, entries written: ${outcome.census.totalEntriesWritten}, ` +
      `medals unlocked: ${outcome.census.totalMedalsUnlocked}`,
  );
  if (outcome.census.alreadyApplied) {
    console.log("Every collector was already backfilled, so this run changed nothing (BACKFILL_ALREADY_APPLIED).");
  }
  console.log(apply ? "Committed." : "Rolled back. This was a dry run.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
