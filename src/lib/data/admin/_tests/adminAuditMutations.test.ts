import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import * as adminAuditMutations from "../adminAuditMutations";
import * as adminAuditQueries from "../adminAuditQueries";
import { writeAuditEntry } from "../adminAuditMutations";

const CREATED_ROW = {
  id: "audit-1",
  actorId: "admin-1",
  action: "store.approve",
  targetType: "store",
  targetId: "store-1",
  reason: null,
  createdAt: new Date("2026-07-23T00:00:00Z"),
};

const VALID_INPUT = {
  actorId: "admin-1",
  action: "store.approve",
  targetType: "store",
  targetId: "store-1",
} as const;

describe("writeAuditEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.adminAuditLog.create.mockResolvedValue(CREATED_ROW);
  });

  it("creates a row with actor, action, target type and id, and an optional reason", async () => {
    const result = await writeAuditEntry({ ...VALID_INPUT, reason: "duplicate listing" });

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledTimes(1);
    const callArg = prismaMock.adminAuditLog.create.mock.calls[0][0];
    // The write persists only identifiers plus a non-sensitive reason: no reporter identity or
    // report free text is ever written (BR-01-04, AC-01-04).
    expect(Object.keys(callArg.data).sort()).toEqual(["action", "actorId", "reason", "targetId", "targetType"].sort());
    expect(callArg.data).toMatchObject({
      actorId: "admin-1",
      action: "store.approve",
      targetType: "store",
      targetId: "store-1",
      reason: "duplicate listing",
    });
    expect(result).toBe(CREATED_ROW);
  });

  it("normalizes a blank or omitted reason to null", async () => {
    await writeAuditEntry({ ...VALID_INPUT, reason: "   " });
    expect(prismaMock.adminAuditLog.create.mock.calls[0][0].data.reason).toBeNull();

    await writeAuditEntry({ ...VALID_INPUT });
    expect(prismaMock.adminAuditLog.create.mock.calls[1][0].data.reason).toBeNull();
  });

  it("rejects an unknown action key", async () => {
    await expect(
      // @ts-expect-error intentionally invalid action for the boundary test
      writeAuditEntry({ ...VALID_INPUT, action: "store.nuke" }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown target type", async () => {
    await expect(
      // @ts-expect-error intentionally invalid target type for the boundary test
      writeAuditEntry({ ...VALID_INPUT, targetType: "invoice" }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("writes through the provided transaction client instead of the singleton", async () => {
    const txCreate = vi.fn().mockResolvedValue(CREATED_ROW);
    const tx = { adminAuditLog: { create: txCreate } } as unknown as Parameters<typeof writeAuditEntry>[1];

    await writeAuditEntry(VALID_INPUT, tx);

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("exposes no update or delete path across the audit data module", () => {
    const exportedNames = [...Object.keys(adminAuditMutations), ...Object.keys(adminAuditQueries)];
    expect(exportedNames).not.toEqual(expect.arrayContaining([expect.stringMatching(/update|delete|remove/i)]));
    expect(exportedNames).toContain("writeAuditEntry");
  });
});
