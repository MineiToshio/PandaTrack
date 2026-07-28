import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    storeChangeRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    storePresence: { deleteMany: vi.fn(), createMany: vi.fn() },
    storeProductTypeAssignment: { deleteMany: vi.fn(), createMany: vi.fn() },
    storeImportCountry: { deleteMany: vi.fn(), createMany: vi.fn() },
    storeContactChannel: { deleteMany: vi.fn(), createMany: vi.fn() },
    storeAddress: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  return {
    txMock,
    prismaMock: {
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
  applyStoreChangeRequest,
  rebaseChangeRequestDiff,
  rejectStoreChangeRequest,
  StoreChangeRequestError,
  supersedeStaleChangeRequests,
  updateStoreEditableFields,
} from "../storeGovernanceMutations";
import type { EditableStore, EditableStoreDiff } from "../storeGovernanceQueries";

const STORE_ID = "store-1";
const ADMIN = "admin-1";

const BASE_STORE: EditableStore = {
  id: STORE_ID,
  slug: "store-one",
  name: "Store One",
  description: "Original description",
  logoUrl: null,
  status: "APPROVED",
  sellerType: "RETAILER",
  countryCode: "PE",
  createdByUserId: "user-1",
  hasStock: true,
  receivesOrders: true,
  isPrivate: false,
  isActive: true,
  presenceTypes: ["ONLINE"],
  productTypeKeys: ["figures"],
  importCountryCodes: ["JP"],
  contactChannels: [],
  addresses: [],
};

/** Raw prisma row shape consumed by `mapStoreToEditableStore` inside `getEditableStoreForRebase`. */
function rawStoreRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: STORE_ID,
    slug: "store-one",
    name: "Store One",
    description: "Original description",
    logoUrl: null,
    status: "APPROVED",
    sellerType: "RETAILER",
    countryCode: "PE",
    createdByUserId: "user-1",
    hasStock: true,
    receivesOrders: true,
    isPrivate: false,
    isActive: true,
    presences: [{ presenceType: "ONLINE" }],
    productTypeAssignments: [{ productTypeKey: "figures" }],
    importCountries: [{ countryCode: "JP" }],
    contactChannels: [],
    addresses: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  txMock.store.update.mockResolvedValue({ id: STORE_ID, slug: "store-one" });
  txMock.storePresence.deleteMany.mockResolvedValue({});
  txMock.storeProductTypeAssignment.deleteMany.mockResolvedValue({});
  txMock.storeImportCountry.deleteMany.mockResolvedValue({});
  txMock.storeContactChannel.deleteMany.mockResolvedValue({});
  txMock.storeAddress.deleteMany.mockResolvedValue({});
  txMock.storePresence.createMany.mockResolvedValue({});
  txMock.storeProductTypeAssignment.createMany.mockResolvedValue({});
  txMock.storeImportCountry.createMany.mockResolvedValue({});
  txMock.storeContactChannel.createMany.mockResolvedValue({});
  txMock.storeAddress.createMany.mockResolvedValue({});
});

describe("rebaseChangeRequestDiff", () => {
  it("drops already-applied fields and keeps the surviving ones, including relation arrays", () => {
    const storedDiff: EditableStoreDiff = {
      name: "Store One", // already equals current -> already applied
      description: "Updated description", // surviving scalar
      productTypeKeys: ["figures", "manga"], // surviving relation array
      importCountries: ["JP"], // already equals current -> already applied
    };

    const { effectiveDiff, alreadyAppliedKeys, mergedInput } = rebaseChangeRequestDiff(BASE_STORE, storedDiff);

    expect(Object.keys(effectiveDiff).sort()).toEqual(["description", "productTypeKeys"]);
    expect(effectiveDiff.description).toBe("Updated description");
    expect(effectiveDiff.productTypeKeys).toEqual(["figures", "manga"]);
    expect(alreadyAppliedKeys.sort()).toEqual(["importCountries", "name"]);
    // The merged input carries the surviving proposal while preserving untouched current values.
    expect(mergedInput.description).toBe("Updated description");
    expect(mergedInput.name).toBe("Store One");
  });

  it("returns an empty effective diff when every proposed value already matches the store", () => {
    const storedDiff: EditableStoreDiff = { name: "Store One", description: "Original description" };

    const { effectiveDiff, alreadyAppliedKeys } = rebaseChangeRequestDiff(BASE_STORE, storedDiff);

    expect(Object.keys(effectiveDiff)).toHaveLength(0);
    expect(alreadyAppliedKeys.sort()).toEqual(["description", "name"]);
  });

  it("cannot mutate sellerType or country: they are absent from the editable input and diff", () => {
    // A tampered diff that appears to carry immutable structural fields.
    const tamperedDiff = {
      name: "Renamed",
      sellerType: "PROXY",
      countryCode: "US",
    } as unknown as EditableStoreDiff;

    const { effectiveDiff } = rebaseChangeRequestDiff(BASE_STORE, tamperedDiff);

    expect(Object.keys(effectiveDiff)).toEqual(["name"]);
    expect(JSON.stringify(effectiveDiff)).not.toContain("sellerType");
    expect(JSON.stringify(effectiveDiff)).not.toContain("countryCode");
  });
});

describe("supersedeStaleChangeRequests", () => {
  it("supersedes only the requests whose rebased diff is now empty", async () => {
    txMock.store.findUnique.mockResolvedValue(rawStoreRow());
    txMock.storeChangeRequest.findMany.mockResolvedValue([
      { id: "cr-empty", changes: { name: "Store One" } as EditableStoreDiff }, // matches current
      { id: "cr-survive", changes: { name: "Totally New" } as EditableStoreDiff }, // still differs
    ]);
    txMock.storeChangeRequest.update.mockResolvedValue({});

    const count = await supersedeStaleChangeRequests(txMock as never, STORE_ID);

    expect(count).toBe(1);
    expect(txMock.storeChangeRequest.update).toHaveBeenCalledTimes(1);
    const updateArg = txMock.storeChangeRequest.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "cr-empty" });
    expect(updateArg.data.status).toBe("SUPERSEDED");
    expect(updateArg.data.reviewedByUserId).toBeNull();
    expect(updateArg.data.reviewedAt).toBeInstanceOf(Date);
  });

  it("returns 0 and writes nothing when the store no longer exists", async () => {
    txMock.store.findUnique.mockResolvedValue(null);

    const count = await supersedeStaleChangeRequests(txMock as never, STORE_ID);

    expect(count).toBe(0);
    expect(txMock.storeChangeRequest.update).not.toHaveBeenCalled();
  });
});

describe("applyStoreChangeRequest", () => {
  it("applies the surviving diff, stamps APPROVED, sweeps siblings, and audits inside the transaction", async () => {
    txMock.storeChangeRequest.findUnique.mockResolvedValue({
      id: "cr-1",
      storeId: STORE_ID,
      status: "PENDING",
      changes: { description: "Updated description" } as EditableStoreDiff,
    });
    txMock.store.findUnique.mockResolvedValue(rawStoreRow());
    txMock.storeChangeRequest.findMany.mockResolvedValue([]); // no other open requests
    txMock.storeChangeRequest.update.mockResolvedValue({});

    const result = await applyStoreChangeRequest(BASE_STORE, "cr-1", ADMIN);

    expect(result).toEqual({ outcome: "applied", slug: "store-one", appliedFieldCount: 1, supersededCount: 0 });
    // The store scalar write ran and never touches sellerType / country.
    const storeUpdateData = txMock.store.update.mock.calls[0][0].data;
    expect(storeUpdateData.description).toBe("Updated description");
    expect(storeUpdateData).not.toHaveProperty("sellerType");
    expect(storeUpdateData).not.toHaveProperty("countryCode");
    // The request is approved with the reviewer stamp.
    const crUpdateData = txMock.storeChangeRequest.update.mock.calls[0][0].data;
    expect(crUpdateData).toMatchObject({ status: "APPROVED", reviewedByUserId: ADMIN });
    expect(crUpdateData.reviewedAt).toBeInstanceOf(Date);
    // The apply audit is written with the transaction client.
    expect(writeAuditEntryMock).toHaveBeenCalledTimes(1);
    const [auditInput, tx] = writeAuditEntryMock.mock.calls[0];
    expect(auditInput).toMatchObject({
      actorId: ADMIN,
      action: "changeRequest.apply",
      targetType: "changeRequest",
      targetId: "cr-1",
    });
    expect(tx).toBe(txMock);
  });

  it("supersedes instead of applying when the rebased diff is empty, writing no store edit and no audit", async () => {
    txMock.storeChangeRequest.findUnique.mockResolvedValue({
      id: "cr-2",
      storeId: STORE_ID,
      status: "PENDING",
      changes: { name: "Store One" } as EditableStoreDiff, // already matches current
    });
    txMock.store.findUnique.mockResolvedValue(rawStoreRow());
    txMock.storeChangeRequest.update.mockResolvedValue({});

    const result = await applyStoreChangeRequest(BASE_STORE, "cr-2", ADMIN);

    expect(result).toEqual({ outcome: "superseded", slug: "store-one" });
    expect(txMock.store.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
    const crUpdateData = txMock.storeChangeRequest.update.mock.calls[0][0].data;
    expect(crUpdateData).toMatchObject({ status: "SUPERSEDED", reviewedByUserId: null });
  });

  it("throws changeRequestNotFound when the request is missing or belongs to another store", async () => {
    txMock.storeChangeRequest.findUnique.mockResolvedValue(null);
    await expect(applyStoreChangeRequest(BASE_STORE, "missing", ADMIN)).rejects.toMatchObject({
      code: "changeRequestNotFound",
    });

    txMock.storeChangeRequest.findUnique.mockResolvedValue({
      id: "cr-x",
      storeId: "other-store",
      status: "PENDING",
      changes: {},
    });
    await expect(applyStoreChangeRequest(BASE_STORE, "cr-x", ADMIN)).rejects.toBeInstanceOf(StoreChangeRequestError);

    expect(writeAuditEntryMock).not.toHaveBeenCalled();
    expect(txMock.store.update).not.toHaveBeenCalled();
  });

  it("throws invalidTransition for a request that is not PENDING", async () => {
    txMock.storeChangeRequest.findUnique.mockResolvedValue({
      id: "cr-3",
      storeId: STORE_ID,
      status: "APPROVED",
      changes: {},
    });

    await expect(applyStoreChangeRequest(BASE_STORE, "cr-3", ADMIN)).rejects.toMatchObject({
      code: "invalidTransition",
    });
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
    expect(txMock.store.update).not.toHaveBeenCalled();
  });
});

describe("updateStoreEditableFields (direct-edit write path)", () => {
  it("runs the shared supersede sweep after a direct edit, superseding a now-empty request", async () => {
    // The sweep re-reads the store as it stands after the edit.
    txMock.store.findUnique.mockResolvedValue(rawStoreRow({ name: "Edited Name" }));
    txMock.storeChangeRequest.findMany.mockResolvedValue([
      { id: "cr-empty", changes: { name: "Edited Name" } as EditableStoreDiff },
    ]);
    txMock.storeChangeRequest.update.mockResolvedValue({});

    await updateStoreEditableFields(BASE_STORE, {
      name: "Edited Name",
      presenceTypes: ["ONLINE"],
      productTypeKeys: ["figures"],
      importCountries: ["JP"],
    });

    expect(txMock.store.update).toHaveBeenCalledTimes(1);
    expect(txMock.storeChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cr-empty" },
        data: expect.objectContaining({ status: "SUPERSEDED", reviewedByUserId: null }),
      }),
    );
  });
});

describe("rejectStoreChangeRequest", () => {
  it("closes a PENDING request as REJECTED with the reviewer stamp and a changeRequest.reject audit", async () => {
    txMock.storeChangeRequest.findUnique.mockResolvedValue({ id: "cr-4", storeId: STORE_ID, status: "PENDING" });
    txMock.storeChangeRequest.update.mockResolvedValue({});

    const result = await rejectStoreChangeRequest(BASE_STORE, "cr-4", ADMIN);

    expect(result).toEqual({ id: "cr-4", slug: "store-one" });
    const crUpdateData = txMock.storeChangeRequest.update.mock.calls[0][0].data;
    expect(crUpdateData).toMatchObject({ status: "REJECTED", reviewedByUserId: ADMIN });
    expect(writeAuditEntryMock).toHaveBeenCalledTimes(1);
    const [auditInput, tx] = writeAuditEntryMock.mock.calls[0];
    expect(auditInput).toMatchObject({ action: "changeRequest.reject", targetType: "changeRequest", targetId: "cr-4" });
    expect(tx).toBe(txMock);
  });

  it("rejects an already-reviewed request without writing anything", async () => {
    txMock.storeChangeRequest.findUnique.mockResolvedValue({ id: "cr-5", storeId: STORE_ID, status: "REJECTED" });

    await expect(rejectStoreChangeRequest(BASE_STORE, "cr-5", ADMIN)).rejects.toMatchObject({
      code: "invalidTransition",
    });
    expect(txMock.storeChangeRequest.update).not.toHaveBeenCalled();
    expect(writeAuditEntryMock).not.toHaveBeenCalled();
  });
});
