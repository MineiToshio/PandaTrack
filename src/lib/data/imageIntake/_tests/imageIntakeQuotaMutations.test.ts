import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, writeAuditEntryMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
  writeAuditEntryMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/admin/adminAuditMutations", () => ({ writeAuditEntry: writeAuditEntryMock }));

import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "@/lib/data/admin/adminAuditVocabulary";
import { ImageIntakeQuotaOverrideError, setImageIntakeQuotaOverride } from "../imageIntakeQuotaMutations";

function makeTx(target: { aiMonthlyPhotoLimit: number | null } | null) {
  const tx = {
    user: {
      findUnique: vi.fn(async () => target),
      update: vi.fn(async () => ({})),
    },
  };
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
  return tx;
}

const input = { actorId: "admin-1", targetUserId: "user-1", limit: 50, reason: "Beta tester" };

beforeEach(() => {
  vi.clearAllMocks();
  writeAuditEntryMock.mockResolvedValue({});
});

describe("setImageIntakeQuotaOverride", () => {
  it("writes the new allowance and reports what it replaced", async () => {
    const tx = makeTx({ aiMonthlyPhotoLimit: null });

    const result = await setImageIntakeQuotaOverride(input);

    expect(result).toEqual({ targetUserId: "user-1", previousLimit: null, limit: 50 });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { aiMonthlyPhotoLimit: 50 },
    });
  });

  it("clears the override with a null limit, handing the account back to the default", async () => {
    const tx = makeTx({ aiMonthlyPhotoLimit: 50 });

    const result = await setImageIntakeQuotaOverride({ ...input, limit: null });

    expect(result).toEqual({ targetUserId: "user-1", previousLimit: 50, limit: null });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { aiMonthlyPhotoLimit: null },
    });
  });

  it("writes the audit row inside the same transaction as the change", async () => {
    const tx = makeTx({ aiMonthlyPhotoLimit: null });

    await setImageIntakeQuotaOverride(input);

    expect(writeAuditEntryMock).toHaveBeenCalledWith(
      {
        actorId: "admin-1",
        action: AUDIT_ACTIONS.IMAGE_INTAKE_QUOTA_OVERRIDE,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: "user-1",
        reason: "Beta tester",
      },
      tx,
    );
  });

  it("refuses an account that does not exist, without writing anything", async () => {
    const tx = makeTx(null);

    await expect(setImageIntakeQuotaOverride(input)).rejects.toBeInstanceOf(ImageIntakeQuotaOverrideError);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });

  it("rejects a blank reason: a silent change to someone else's allowance must always say why", async () => {
    makeTx({ aiMonthlyPhotoLimit: null });

    await expect(setImageIntakeQuotaOverride({ ...input, reason: "   " })).rejects.toThrow();
  });

  it("rejects a negative or absurd limit", async () => {
    makeTx({ aiMonthlyPhotoLimit: null });

    await expect(setImageIntakeQuotaOverride({ ...input, limit: -1 })).rejects.toThrow();
    await expect(setImageIntakeQuotaOverride({ ...input, limit: 10_000 })).rejects.toThrow();
  });
});
