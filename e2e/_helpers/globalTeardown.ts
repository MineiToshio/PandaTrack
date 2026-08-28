import { sweepProgressionState, verifyDataBaseline } from "./dataGuard";

/**
 * Runs after the last spec and fails the whole run if the suite deleted or modified any row that
 * existed before it started.
 *
 * WHY this is a teardown and not an assertion inside a spec: the damage a cleanup channel can do is
 * not scoped to the spec that triggered it (deleting a `Store` cascades to every order under it),
 * and an `afterEach` cannot see rows a *later* spec removes. Checking the whole graph once, at the
 * end, is the only place that catches every path — including a spec that fails before its own
 * cleanup runs. See `scripts/e2e-db-baseline.ts`.
 *
 * This throws on violation, which Playwright reports as a run-level failure with a non-zero exit
 * code, so a damaged database can never be reported as a green suite.
 */
export default async function globalTeardown(): Promise<void> {
  // Before the verify, not after: the sweep deletes rows the run created, which the baseline never
  // froze, so the two never contend. Progression rows need their own pass because nothing owns them
  // (`point_ledger_entry` carries no foreign key, `medal_unlock` is never revoked) and because
  // merely opening `/progress` produces them. Without this the suite left ten irrevocable medal
  // unlocks on the collector's real account per pass.
  await sweepProgressionState();
  await verifyDataBaseline();
}
