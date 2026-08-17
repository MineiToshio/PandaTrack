/**
 * ADR 0022 coverage for the collector-preferences patch.
 *
 * `parseAndApplyCollectorPreferencesPatch` catches the `ZodError` its transaction body can throw and
 * relays it as `{ ok: false }`. A relayed refusal is an ordinary return, and an ordinary return from
 * a transaction COMMITS everything written so far — so the catalog-membership check that produces
 * that error has to run before the patch's first write, in both call shapes:
 *
 *  - without `tx` (what the settings actions do today), where the transaction is this module's own;
 *  - with a caller-supplied `tx`, where the refusal is returned inside somebody else's transaction.
 *
 * The static guard (`src/test/transaction-refusal-guard.test.ts`) cannot see this site: the write is
 * two hops away (`parseAndApply` → `applyCollectorPreferencesPatch` → `…Within`), and its helper
 * vocabulary only spans one. These assertions are the coverage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../../generated/prisma/client";

const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => transactionMock(callback),
  },
}));

import { parseAndApplyCollectorPreferencesPatch } from "@/lib/data/user-settings/userSettingsMutations";

const CURRENT_USER_ROW = {
  preferredCountryCode: "PE",
  baseCurrencyCode: "USD",
  budgetAmount: null,
  budgetResetDayOfMonth: null,
  timezone: "America/Lima",
  preferredProductTypes: [{ productTypeKey: "manga" }],
};

/** Minimal stand-in for the transaction client, recording every write the patch attempts. */
function createTxSpy(existingProductTypeKeys: string[]) {
  const writes: string[] = [];
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(CURRENT_USER_ROW),
      update: vi.fn(async () => {
        writes.push("user.update");
        return CURRENT_USER_ROW;
      }),
    },
    userPreferredProductType: {
      deleteMany: vi.fn(async () => {
        writes.push("userPreferredProductType.deleteMany");
        return { count: 0 };
      }),
      createMany: vi.fn(async () => {
        writes.push("userPreferredProductType.createMany");
        return { count: 0 };
      }),
    },
    storeProductType: {
      findMany: vi.fn().mockResolvedValue(existingProductTypeKeys.map((key) => ({ key }))),
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, writes };
}

// Both a scalar field and the product-type list: the scalar is what used to be committed by the
// refusal, so a patch touching only the list would not exercise the bug at all.
const PATCH_WITH_UNKNOWN_KEY = {
  timezone: "Europe/Madrid",
  preferredProductTypeKeys: ["manga", "typo_key"],
};

describe("parseAndApplyCollectorPreferencesPatch refusal ordering (ADR 0022)", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  it("refuses an unknown product-type key without writing, on the shape the settings actions use", async () => {
    const { tx, writes } = createTxSpy(["manga"]);
    transactionMock.mockImplementation((callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await parseAndApplyCollectorPreferencesPatch("user-1", PATCH_WITH_UNKNOWN_KEY);

    expect(result.ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it("refuses without writing when the refusal would be returned inside a caller-owned transaction", async () => {
    const { tx, writes } = createTxSpy(["manga"]);

    const result = await parseAndApplyCollectorPreferencesPatch("user-1", PATCH_WITH_UNKNOWN_KEY, tx);

    expect(result.ok).toBe(false);
    // The caller owns the transaction, so this module must not open one of its own.
    expect(transactionMock).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("still applies the patch when every submitted key exists in the catalog", async () => {
    const { tx, writes } = createTxSpy(["manga", "figures"]);
    transactionMock.mockImplementation((callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await parseAndApplyCollectorPreferencesPatch("user-1", {
      timezone: "Europe/Madrid",
      preferredProductTypeKeys: ["manga", "figures"],
    });

    expect(result.ok).toBe(true);
    expect(writes).toEqual([
      "user.update",
      "userPreferredProductType.deleteMany",
      "userPreferredProductType.createMany",
    ]);
  });
});
