import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    storeReport: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    // The post-write supersede sweep re-reads the store and its open change requests.
    storeChangeRequest: {
      findMany: vi.fn(),
      update: vi.fn(),
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

import {
  approveStore,
  dismissStoreReport,
  removeStore,
  resolveStoreReport,
  StoreModerationError,
} from "../storeModerationMutations";

type StoreRow = {
  id: string;
  slug: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt: Date | null;
  approvedByUserId: string | null;
};

function mockCurrentStore(row: Partial<StoreRow> & Pick<StoreRow, "status">) {
  const full: StoreRow = {
    id: "store-1",
    slug: "store-one",
    approvedAt: null,
    approvedByUserId: null,
    ...row,
  };
  // The same `findUnique` mock serves the moderation read and the editable read the sweep performs,
  // so the row carries both the moderation fields and the editable shape (with empty relations).
  txMock.store.findUnique.mockResolvedValue({
    ...full,
    name: "Store One",
    description: null,
    logoUrl: null,
    sellerType: "RETAILER",
    countryCode: "PE",
    createdByUserId: "user-1",
    hasStock: null,
    receivesOrders: null,
    isPrivate: false,
    isActive: true,
    presences: [],
    productTypeAssignments: [],
    importCountries: [],
    contactChannels: [],
    addresses: [],
  });
  txMock.store.update.mockImplementation(async ({ data }: { data: { status: StoreRow["status"] } }) => ({
    id: full.id,
    slug: full.slug,
    status: data.status,
  }));
  // No open change requests, so the sweep is a no-op for these transitions.
  txMock.storeChangeRequest.findMany.mockResolvedValue([]);
}

const ACTOR = "admin-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveStore", () => {
  it("moves a PENDING store to APPROVED, stamps the approver, and audits inside the transaction", async () => {
    mockCurrentStore({ status: "PENDING" });

    const result = await approveStore({ storeId: "store-1", actorId: ACTOR });

    expect(result).toMatchObject({ status: "APPROVED", previousStatus: "PENDING" });
    const updateArg = txMock.store.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe("APPROVED");
    expect(updateArg.data.approvedByUser).toEqual({ connect: { id: ACTOR } });
    expect(updateArg.data.approvedAt).toBeInstanceOf(Date);

    expect(writeAuditEntryMock).toHaveBeenCalledTimes(1);
    const [auditInput, tx] = writeAuditEntryMock.mock.calls[0];
    expect(auditInput).toMatchObject({
      actorId: ACTOR,
      action: "store.approve",
      targetType: "store",
      targetId: "store-1",
    });
    // The audit write receives the transaction client so it is atomic with the store update.
    expect(tx).toBe(txMock);
  });

  it("rejects an invalid transition without writing anything", async () => {
    mockCurrentStore({ status: "APPROVED" });

    await expect(approveStore({ storeId: "store-1", actorId: ACTOR })).rejects.toMatchObject({
      code: "invalidTransition",
    });
    expect(txMock.store.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });

  it("throws storeNotFound when the store does not exist", async () => {
    txMock.store.findUnique.mockResolvedValue(null);

    await expect(approveStore({ storeId: "missing", actorId: ACTOR })).rejects.toBeInstanceOf(StoreModerationError);
    await expect(approveStore({ storeId: "missing", actorId: ACTOR })).rejects.toMatchObject({ code: "storeNotFound" });
    expect(txMock.store.update).not.toHaveBeenCalled();
  });
});

describe("removeStore", () => {
  it.each(["PENDING", "APPROVED"] as const)(
    "removes a %s store to REJECTED with the removalReason and a store.remove audit entry",
    async (status) => {
      mockCurrentStore({ status });

      const result = await removeStore({
        storeId: "store-1",
        actorId: ACTOR,
        removalReason: "ABUSE",
      });

      expect(result).toMatchObject({ status: "REJECTED", previousStatus: status });
      const updateArg = txMock.store.update.mock.calls[0][0];
      expect(updateArg.data).toMatchObject({ status: "REJECTED", removalReason: "ABUSE" });
      expect(writeAuditEntryMock.mock.calls[0][0]).toMatchObject({ action: "store.remove" });
    },
  );

  it("rejects removing an already-REJECTED store", async () => {
    mockCurrentStore({ status: "REJECTED" });

    await expect(removeStore({ storeId: "store-1", actorId: ACTOR, removalReason: "DUPLICATE" })).rejects.toMatchObject(
      { code: "invalidTransition" },
    );
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });

  it("passes the optional internal note through to the audit reason only", async () => {
    mockCurrentStore({ status: "APPROVED" });

    await removeStore({ storeId: "store-1", actorId: ACTOR, removalReason: "FALSE_INFO", note: "confirmed scam" });

    expect(writeAuditEntryMock.mock.calls[0][0]).toMatchObject({ reason: "confirmed scam" });
  });
});

type ReportRow = { id: string; status: "OPEN" | "REVIEWED" | "DISMISSED"; storeId?: string };

function mockCurrentReport(row: ReportRow, openReportsRemaining = 0) {
  txMock.storeReport.findUnique.mockResolvedValue({ storeId: "store-1", ...row });
  txMock.storeReport.update.mockImplementation(async ({ data }: { data: { status: ReportRow["status"] } }) => ({
    id: row.id,
    status: data.status,
  }));
  txMock.storeReport.count.mockResolvedValue(openReportsRemaining);
}

describe("resolveStoreReport", () => {
  it("moves an OPEN report to REVIEWED and audits report.resolve inside the transaction", async () => {
    mockCurrentReport({ id: "report-1", status: "OPEN" });

    const result = await resolveStoreReport({ reportId: "report-1", actorId: ACTOR });

    expect(result).toMatchObject({ status: "REVIEWED", previousStatus: "OPEN" });
    expect(txMock.storeReport.update.mock.calls[0][0].data).toEqual({ status: "REVIEWED" });

    expect(writeAuditEntryMock).toHaveBeenCalledTimes(1);
    const [auditInput, tx] = writeAuditEntryMock.mock.calls[0];
    expect(auditInput).toMatchObject({
      actorId: ACTOR,
      action: "report.resolve",
      targetType: "report",
      targetId: "report-1",
    });
    // The audit write receives the transaction client so it is atomic with the report update.
    expect(tx).toBe(txMock);
  });

  it("throws reportNotFound when the report does not exist", async () => {
    txMock.storeReport.findUnique.mockResolvedValue(null);

    await expect(resolveStoreReport({ reportId: "missing", actorId: ACTOR })).rejects.toBeInstanceOf(
      StoreModerationError,
    );
    await expect(resolveStoreReport({ reportId: "missing", actorId: ACTOR })).rejects.toMatchObject({
      code: "reportNotFound",
    });
    expect(txMock.storeReport.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });

  it("reports zero open reports remaining and writes no store row when it was the last one", async () => {
    mockCurrentReport({ id: "report-1", status: "OPEN" }, 0);

    const result = await resolveStoreReport({ reportId: "report-1", actorId: ACTOR });

    // The derived public notice clears because the count reached zero, not because anything was
    // written onto the store: the notice has no writer.
    expect(result).toMatchObject({ storeId: "store-1", openReportsRemaining: 0 });
    expect(txMock.store.update).not.toHaveBeenCalled();
  });

  it("reports the reports still open when others remain, so the notice stays up", async () => {
    mockCurrentReport({ id: "report-1", status: "OPEN" }, 2);

    const result = await resolveStoreReport({ reportId: "report-1", actorId: ACTOR });

    expect(result.openReportsRemaining).toBe(2);
  });

  it("rejects resolving a report that is not OPEN without writing anything", async () => {
    mockCurrentReport({ id: "report-1", status: "REVIEWED" });

    await expect(resolveStoreReport({ reportId: "report-1", actorId: ACTOR })).rejects.toMatchObject({
      code: "invalidTransition",
    });
    expect(txMock.storeReport.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });
});

describe("dismissStoreReport", () => {
  it("moves an OPEN report to DISMISSED and audits report.dismiss inside the transaction", async () => {
    mockCurrentReport({ id: "report-2", status: "OPEN" });

    const result = await dismissStoreReport({ reportId: "report-2", actorId: ACTOR });

    expect(result).toMatchObject({ status: "DISMISSED", previousStatus: "OPEN", openReportsRemaining: 0 });
    expect(txMock.storeReport.update.mock.calls[0][0].data).toEqual({ status: "DISMISSED" });
    expect(writeAuditEntryMock.mock.calls[0][0]).toMatchObject({
      action: "report.dismiss",
      targetType: "report",
      targetId: "report-2",
    });
  });

  it("rejects dismissing an already-DISMISSED report", async () => {
    mockCurrentReport({ id: "report-2", status: "DISMISSED" });

    await expect(dismissStoreReport({ reportId: "report-2", actorId: ACTOR })).rejects.toMatchObject({
      code: "invalidTransition",
    });
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });
});
