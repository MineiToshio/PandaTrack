import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "../..");
const CLEANUP_SCRIPT = path.join(REPO_ROOT, "scripts/e2e-db-cleanup.ts");

interface CleanupRequest {
  orderIds?: readonly string[];
  storeSlugs?: readonly string[];
  storeNamePrefix?: string;
  deliveryIds?: readonly string[];
  pushEndpointPrefix?: string;
  progressionSettingsUserEmail?: string;
  resetProgressionAccountEmail?: string;
}

/**
 * Runs cleanup in a child `tsx` process instead of importing the generated Prisma client
 * directly: Playwright's test transform cannot load that client's ESM `import.meta` usage, while
 * `tsx` (the same runtime `scripts/seed-dev-data.ts` uses) handles it natively. See
 * `scripts/e2e-db-cleanup.ts`.
 */
async function runCleanup(request: CleanupRequest): Promise<void> {
  await execFileAsync("npx", ["tsx", CLEANUP_SCRIPT, JSON.stringify(request)], { cwd: REPO_ROOT });
}

/**
 * Direct-DB backstop for specs that create orders through the UI. Call from `test.afterEach` so
 * leftovers are removed even when the test fails or is interrupted before its own UI-driven
 * cleanup step runs. Deleting an id already removed through the UI is a safe no-op.
 */
export async function deleteOrdersById(ids: readonly string[]): Promise<void> {
  const candidates = ids.filter(Boolean);
  if (candidates.length === 0) return;
  await runCleanup({ orderIds: candidates });
}

/**
 * Direct-DB backstop for specs that create stores through the UI (cascades to their orders and
 * deliveries per schema). Call from `test.afterEach`; safe no-op for slugs already deleted.
 */
export async function deleteStoresBySlug(slugs: readonly string[]): Promise<void> {
  const candidates = slugs.filter(Boolean);
  if (candidates.length === 0) return;
  await runCleanup({ storeSlugs: candidates });
}

/**
 * Direct-DB backstop for a store whose slug the spec may never have learned: the slug is only
 * readable once the create wizard's redirect lands, so a failure before that would otherwise leave
 * a public store behind in the collector's own data. Give it a run-unique fixture name prefix
 * (name + timestamp) so it can never match anything but this run's own store. Cascades exactly like
 * {@link deleteStoresBySlug}. Call from `test.afterAll`.
 */
export async function deleteStoresByNamePrefix(prefix: string): Promise<void> {
  if (!prefix) return;
  await runCleanup({ storeNamePrefix: prefix });
}

/**
 * Direct-DB backstop for specs that create deliveries through the UI. A `Delivery` has no direct
 * FK to `Order` (it links via `DeliveryOrderItem`), so deleting the seed order does not cascade to
 * it — it must be deleted explicitly or it survives as an orphan. Call from `test.afterEach`.
 */
export async function deleteDeliveriesById(ids: readonly string[]): Promise<void> {
  const candidates = ids.filter(Boolean);
  if (candidates.length === 0) return;
  await runCleanup({ deliveryIds: candidates });
}

/**
 * Direct-DB backstop for specs that opt into push notifications with a fake subscription (the
 * server action persists a real `PushSubscription` row even though the endpoint is stubbed). Call
 * from `test.afterEach` with the endpoint prefix used by the fake subscription.
 */
export async function deletePushSubscriptionsByEndpointPrefix(prefix: string): Promise<void> {
  if (!prefix) return;
  await runCleanup({ pushEndpointPrefix: prefix });
}

/**
 * Direct-DB backstop for the spec that flips `"Ocultar mi progresión"`: the toggle writes a
 * `progression_settings` row that outlives the switch being flipped back, so restoring the switch is
 * not enough to leave the account as it was found. Call from `test.afterAll` with the account the
 * run signed in as. Removes the row only while it still carries both defaults, so a row holding real
 * state (a layer left hidden, a rank already celebrated) is never destroyed.
 */
export async function deleteDefaultProgressionSettings(userEmail: string): Promise<void> {
  if (!userEmail) return;
  await runCleanup({ progressionSettingsUserEmail: userEmail });
}

/**
 * Full reset of the DEDICATED progression E2E account: every order, delivery, store payment and
 * progression row (ledger, medal unlocks, the rank watermark, the hide toggle) it owns. Call from
 * `test.beforeAll` so each run starts as repeatable as a virgin sign-up, and again from
 * `test.afterAll` so the account carries nothing into the NEXT run's data-baseline capture either.
 *
 * Refuses (see `scripts/e2e-db-cleanup.ts`) if `userEmail` resolves to `E2E_USER_EMAIL` or
 * `E2E_ADMIN_EMAIL`: this channel deletes everything an account owns, which is only ever safe for
 * the throwaway progression account it exists for.
 */
export async function resetProgressionAccountState(userEmail: string): Promise<void> {
  if (!userEmail) return;
  await runCleanup({ resetProgressionAccountEmail: userEmail });
}
