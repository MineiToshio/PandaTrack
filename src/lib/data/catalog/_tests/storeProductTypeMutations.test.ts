import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    storeProductTypeRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    storeProductType: {
      create: vi.fn(),
    },
  };
  return {
    txMock,
    prismaMock: {
      // Runs the callback with the transaction client so the mutation + audit write share one tx.
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const writeAuditEntryMock = vi.fn();
vi.mock("@/lib/data/admin/adminAuditMutations", () => ({
  writeAuditEntry: (...args: unknown[]) => writeAuditEntryMock(...args),
}));

// A minimal stand-in for Prisma's known-request error so the duplicate-key branch is exercised
// without importing the generated client into the unit test.
vi.mock("../../../../../generated/prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, options: { code: string }) {
      super(message);
      this.code = options.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

import { Prisma } from "../../../../../generated/prisma/client";
import {
  approveStoreProductTypeRequest,
  rejectStoreProductTypeRequest,
  slugifyStoreProductTypeKey,
  StoreProductTypeApprovalError,
} from "../storeProductTypeMutations";

const ACTOR = "admin-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slugifyStoreProductTypeKey", () => {
  it("normalizes accents and spaces into a snake_case ascii key", () => {
    expect(slugifyStoreProductTypeKey("Álbumes de figuritas")).toBe("albumes_de_figuritas");
    expect(slugifyStoreProductTypeKey("Cómics  &  Manga")).toBe("comics_manga");
    expect(slugifyStoreProductTypeKey("  Trading Cards  ")).toBe("trading_cards");
    expect(slugifyStoreProductTypeKey("Videojuegos")).toBe("videojuegos");
  });
});

describe("approveStoreProductTypeRequest", () => {
  it("authors the catalog row, flips the request, and audits in one transaction", async () => {
    txMock.storeProductTypeRequest.findUnique.mockResolvedValue({
      id: "req-1",
      status: "PENDING",
      suggestedKey: null,
    });
    txMock.storeProductType.create.mockResolvedValue({ key: "vinyl_toys" });
    txMock.storeProductTypeRequest.update.mockResolvedValue({ id: "req-1" });

    const result = await approveStoreProductTypeRequest({
      requestId: "req-1",
      actorId: ACTOR,
      nameEs: "Vinyl toys",
      nameEn: "Vinyl toys",
    });

    expect(result).toEqual({ requestId: "req-1", key: "vinyl_toys" });
    expect(txMock.storeProductType.create).toHaveBeenCalledWith({
      data: { key: "vinyl_toys", nameEs: "Vinyl toys", nameEn: "Vinyl toys", isActive: true },
    });
    expect(txMock.storeProductTypeRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { status: "APPROVED", suggestedKey: "vinyl_toys" },
    });
    expect(writeAuditEntryMock).toHaveBeenCalledTimes(1);
    const [auditInput, auditTx] = writeAuditEntryMock.mock.calls[0];
    expect(auditInput).toMatchObject({
      actorId: ACTOR,
      action: "productType.approve",
      targetType: "productType",
      targetId: "req-1",
    });
    expect(auditTx).toBe(txMock);
  });

  it("prefers the request suggestedKey over the derived es-name slug", async () => {
    txMock.storeProductTypeRequest.findUnique.mockResolvedValue({
      id: "req-2",
      status: "PENDING",
      suggestedKey: "custom_key",
    });
    txMock.storeProductType.create.mockResolvedValue({ key: "custom_key" });
    txMock.storeProductTypeRequest.update.mockResolvedValue({ id: "req-2" });

    const result = await approveStoreProductTypeRequest({
      requestId: "req-2",
      actorId: ACTOR,
      nameEs: "Ignored name",
      nameEn: "Ignored name",
    });

    expect(result.key).toBe("custom_key");
  });

  it("translates a primary-key collision into a duplicateKey error and writes no audit", async () => {
    txMock.storeProductTypeRequest.findUnique.mockResolvedValue({
      id: "req-3",
      status: "PENDING",
      suggestedKey: null,
    });
    txMock.storeProductType.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }),
    );

    await expect(
      approveStoreProductTypeRequest({ requestId: "req-3", actorId: ACTOR, nameEs: "Manga", nameEn: "Manga" }),
    ).rejects.toMatchObject({ code: "duplicateKey" });

    expect(txMock.storeProductTypeRequest.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });

  it("rejects a missing request with notFound", async () => {
    txMock.storeProductTypeRequest.findUnique.mockResolvedValue(null);

    await expect(
      approveStoreProductTypeRequest({ requestId: "gone", actorId: ACTOR, nameEs: "X", nameEn: "X" }),
    ).rejects.toMatchObject({ code: "notFound" });
    expect(txMock.storeProductType.create).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });

  it("rejects a non-pending request with invalidTransition", async () => {
    txMock.storeProductTypeRequest.findUnique.mockResolvedValue({
      id: "req-4",
      status: "APPROVED",
      suggestedKey: null,
    });

    await expect(
      approveStoreProductTypeRequest({ requestId: "req-4", actorId: ACTOR, nameEs: "X", nameEn: "X" }),
    ).rejects.toMatchObject({ code: "invalidTransition" });
    expect(txMock.storeProductType.create).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });

  it("exposes a typed error class for callers to branch on", () => {
    const error = new StoreProductTypeApprovalError("duplicateKey");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("duplicateKey");
  });
});

describe("rejectStoreProductTypeRequest", () => {
  it("flips the request to REJECTED and audits without any catalog write", async () => {
    txMock.storeProductTypeRequest.findUnique.mockResolvedValue({ id: "req-5", status: "PENDING" });
    txMock.storeProductTypeRequest.update.mockResolvedValue({ id: "req-5" });

    const result = await rejectStoreProductTypeRequest({ requestId: "req-5", actorId: ACTOR });

    expect(result).toEqual({ requestId: "req-5" });
    expect(txMock.storeProductType.create).not.toHaveBeenCalled();
    expect(txMock.storeProductTypeRequest.update).toHaveBeenCalledWith({
      where: { id: "req-5" },
      data: { status: "REJECTED" },
    });
    expect(writeAuditEntryMock).toHaveBeenCalledTimes(1);
    expect(writeAuditEntryMock.mock.calls[0][0]).toMatchObject({
      action: "productType.reject",
      targetType: "productType",
      targetId: "req-5",
    });
  });

  it("rejects a non-pending request with invalidTransition and writes nothing", async () => {
    txMock.storeProductTypeRequest.findUnique.mockResolvedValue({ id: "req-6", status: "REJECTED" });

    await expect(rejectStoreProductTypeRequest({ requestId: "req-6", actorId: ACTOR })).rejects.toMatchObject({
      code: "invalidTransition",
    });
    expect(txMock.storeProductTypeRequest.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });
});
