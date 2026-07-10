import { describe, expect, it, vi, beforeEach } from "vitest";
import { ZodError } from "zod";

const { prismaMock, flagMock, validationMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
  flagMock: vi.fn(),
  validationMock: {
    parseCollectorPreferencesPatch: vi.fn(),
    validateCollectorPreferencesState: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/orders/orderMutations", () => ({ flagOrdersForFxReconciliation: flagMock }));
vi.mock("@/lib/user-settings/collectorPreferencesValidation", () => ({
  parseCollectorPreferencesPatch: validationMock.parseCollectorPreferencesPatch,
  validateCollectorPreferencesState: validationMock.validateCollectorPreferencesState,
}));

import { applyBaseCurrencyChange } from "../userSettings";

function makeFakeTx() {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        preferredCountryCode: null,
        baseCurrencyCode: "EUR",
        budgetAmount: null,
        budgetResetDayOfMonth: null,
        timezone: null,
        preferredProductTypes: [],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    userPreferredProductType: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
}

describe("applyBaseCurrencyChange", () => {
  let fakeTx: ReturnType<typeof makeFakeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx();
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(fakeTx));
    validationMock.parseCollectorPreferencesPatch.mockReturnValue({ ok: true, value: { baseCurrencyCode: "USD" } });
    validationMock.validateCollectorPreferencesState.mockReturnValue({ ok: true });
  });

  it("flags orders for FX reconciliation on the same transaction as the currency write", async () => {
    const result = await applyBaseCurrencyChange(
      "user-1",
      { baseCurrencyCode: "USD" },
      { previousBaseCurrencyCode: "EUR", nextBaseCurrencyCode: "USD" },
    );

    expect(result).toEqual({ ok: true });
    // The currency scalar was written and the flag was set within the same tx client, so both
    // commit or roll back together.
    expect(fakeTx.user.update).toHaveBeenCalledTimes(1);
    expect(flagMock).toHaveBeenCalledTimes(1);
    expect(flagMock).toHaveBeenCalledWith("user-1", "USD", fakeTx);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not flag orders when the base currency is unchanged", async () => {
    await applyBaseCurrencyChange(
      "user-1",
      { baseCurrencyCode: "USD" },
      { previousBaseCurrencyCode: "USD", nextBaseCurrencyCode: "USD" },
    );

    expect(flagMock).not.toHaveBeenCalled();
  });

  it("does not flag orders when the preference patch fails validation", async () => {
    validationMock.validateCollectorPreferencesState.mockReturnValue({ ok: false, error: new ZodError([]) });

    const result = await applyBaseCurrencyChange(
      "user-1",
      { baseCurrencyCode: "USD" },
      { previousBaseCurrencyCode: "EUR", nextBaseCurrencyCode: "USD" },
    );

    expect(result.ok).toBe(false);
    expect(flagMock).not.toHaveBeenCalled();
    expect(fakeTx.user.update).not.toHaveBeenCalled();
  });
});
