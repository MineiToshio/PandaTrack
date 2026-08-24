import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "../..");
const BASELINE_SCRIPT = path.join(REPO_ROOT, "scripts/e2e-db-baseline.ts");

/**
 * Runs the baseline script in a child `tsx` process, mirroring `dbCleanup.ts`: Playwright's test
 * transform cannot load the generated Prisma client's ESM `import.meta` usage.
 */
async function runBaseline(mode: "capture" | "verify" | "sweep-progression"): Promise<void> {
  try {
    const { stdout } = await execFileAsync("npx", ["tsx", BASELINE_SCRIPT, mode], { cwd: REPO_ROOT });
    const trimmed = stdout.trim();
    if (trimmed) console.log(trimmed);
  } catch (error) {
    // The child prints the violation report to stderr and exits non-zero. `execFile`'s own message
    // is only "Command failed", so rethrow with the report itself or the failure is unreadable.
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(stderr || (error instanceof Error ? error.message : String(error)));
  }
}

/** Freezes every row that exists before the suite runs. Call from `globalSetup`. */
export async function captureDataBaseline(): Promise<void> {
  await runBaseline("capture");
}

/**
 * Removes the progression rows the run itself wrote. Call from `globalTeardown`, BEFORE the verify.
 *
 * The baseline guard cannot cover these: it freezes rows that existed before the suite, and these
 * are rows the suite creates, own nothing, and are never revoked on their own (`BR-12-08`). Opening
 * `/progress` alone is enough to produce them. See `scripts/e2e-db-baseline.ts` for the full why.
 */
export async function sweepProgressionState(): Promise<void> {
  await runBaseline("sweep-progression");
}

/**
 * Fails the run if any frozen row was deleted or modified. Call from `globalTeardown`.
 *
 * See `scripts/e2e-db-baseline.ts` for why this exists: the E2E suite runs against the collector's
 * real dev data, and the cleanup channels that delete by slug or name prefix cascade through
 * `Store` to every order under it.
 */
export async function verifyDataBaseline(): Promise<void> {
  await runBaseline("verify");
}
