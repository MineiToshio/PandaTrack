import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "../..");
const QUERY_SCRIPT = path.join(REPO_ROOT, "scripts/e2e-db-query.ts");

export interface StorePaymentAllocationSnapshot {
  id: string;
  orderId: string;
  amountMinor: number;
  consumedByDeliveryId: string | null;
}

export interface StorePaymentSnapshot {
  id: string;
  storeId: string;
  amount: number;
  currencyCode: string;
  settledByDeliveryId: string | null;
  migratedFromOrderId: string | null;
  allocations: StorePaymentAllocationSnapshot[];
}

export interface StoreAccountAdjustmentLineSnapshot {
  orderId: string;
  amountMinor: number;
}

export interface StoreAccountAdjustmentSnapshot {
  id: string;
  storeId: string;
  currencyCode: string;
  reason: string;
  lines: StoreAccountAdjustmentLineSnapshot[];
}

export interface DeliverySnapshot {
  id: string;
  storeId: string;
  status: string;
}

export interface StoreQuerySnapshot {
  stores: { id: string; name: string; slug: string }[];
  storePayments: StorePaymentSnapshot[];
  adjustments: StoreAccountAdjustmentSnapshot[];
  deliveries: DeliverySnapshot[];
}

/**
 * Read-only DB snapshot for a spec's own fixture store(s), by the same run-unique name prefix
 * `deleteStoresByNamePrefix` cleans up (see `dbCleanup.ts`). Runs in a child `tsx` process for the
 * same reason cleanup does: Playwright's test transform cannot load the generated Prisma client's
 * ESM `import.meta` usage. Used to assert on rows the UI never surfaces directly, such as
 * `StorePayment.settledByDeliveryId` or `PaymentAllocation.consumedByDeliveryId`
 * (`ADR 0032`/`ADR 0034`, `FRD-08 · WO-08`).
 */
export async function getStoreSnapshotByNamePrefix(prefix: string): Promise<StoreQuerySnapshot> {
  const { stdout } = await execFileAsync("npx", ["tsx", QUERY_SCRIPT, JSON.stringify({ storeNamePrefix: prefix })], {
    cwd: REPO_ROOT,
  });
  return JSON.parse(stdout) as StoreQuerySnapshot;
}
