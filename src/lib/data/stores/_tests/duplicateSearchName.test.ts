import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeFindManyMock, storeCreateMock, transactionMock, txStoreUpdateMock } = vi.hoisted(() => {
  const txStoreUpdateMock = vi.fn();
  return {
    storeFindManyMock: vi.fn(),
    storeCreateMock: vi.fn(),
    txStoreUpdateMock,
    // Runs the transaction callback against a tx client with just the members the edit mutation
    // touches. Every child-collection reset resolves to a no-op so the write path completes.
    transactionMock: vi.fn(async (callback: (tx: unknown) => unknown) => {
      const noop = vi.fn().mockResolvedValue(undefined);
      const tx = {
        store: { update: txStoreUpdateMock },
        storePresence: { deleteMany: noop, createMany: noop },
        storeProductTypeAssignment: { deleteMany: noop, createMany: noop },
        storeImportCountry: { deleteMany: noop, createMany: noop },
        storeContactChannel: { deleteMany: noop, createMany: noop },
        storeAddress: { deleteMany: noop, createMany: noop },
      };
      return callback(tx);
    }),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: {
      findMany: storeFindManyMock,
      create: storeCreateMock,
    },
    $transaction: transactionMock,
  },
}));

import { findDuplicateCandidates, findDuplicateCandidatesInCountry } from "../storeQueries";
import { createStore } from "../storeMutations";
import { updateStoreEditableFields } from "../storeGovernanceMutations";
import type { EditableStore } from "../storeGovernanceQueries";

describe("findDuplicateCandidates SQL pre-filter on searchName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters on the normalized query term and reaches an accented store name via SQL", async () => {
    storeFindManyMock.mockResolvedValue([
      { id: "s1", name: "Pokémon Center", slug: "pokemon-center", countryCode: "JP", logoUrl: null },
    ]);

    const result = await findDuplicateCandidates("pokemon", 5);

    // The DB read is pre-filtered on the persisted, diacritic-stripped `searchName` column, so the
    // query "pokemon" matches the stored "Pokémon Center" (whose searchName is "pokemon center")
    // without the accent-sensitivity that a raw ILIKE on `name` would have.
    expect(storeFindManyMock).toHaveBeenCalledTimes(1);
    expect(storeFindManyMock.mock.calls[0]![0].where).toEqual({
      OR: [{ searchName: { contains: "pokemon" } }],
    });
    expect(result.map((candidate) => candidate.name)).toContain("Pokémon Center");
  });

  it("splits a multi-word query into distinct normalized OR terms", async () => {
    storeFindManyMock.mockResolvedValue([]);

    await findDuplicateCandidates("Pokémon  Center!", 5);

    expect(storeFindManyMock.mock.calls[0]![0].where).toEqual({
      OR: [{ searchName: { contains: "pokemon" } }, { searchName: { contains: "center" } }],
    });
  });

  it("does not hit the database when the query normalizes to nothing", async () => {
    const result = await findDuplicateCandidates("!!! ---", 5);

    expect(result).toEqual([]);
    expect(storeFindManyMock).not.toHaveBeenCalled();
  });

  it("combines the country filter with the normalized searchName OR terms", async () => {
    storeFindManyMock.mockResolvedValue([]);

    await findDuplicateCandidatesInCountry("Pokémon", "JP", 5);

    expect(storeFindManyMock.mock.calls[0]![0].where).toEqual({
      countryCode: "JP",
      OR: [{ searchName: { contains: "pokemon" } }],
    });
  });
});

describe("createStore persists normalized searchName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes searchName = normalizeStoreName(name) alongside the trimmed name", async () => {
    storeCreateMock.mockResolvedValue({ id: "s1", slug: "pokemon-center-abc123" });

    await createStore({
      name: "Pokémon Center",
      sellerType: "RETAILER",
      countryCode: "JP",
      presenceTypes: ["ONLINE"],
      productTypeKeys: ["figures"],
      createdByUserId: "u1",
      status: "PENDING",
    });

    const data = storeCreateMock.mock.calls[0]![0].data;
    expect(data.name).toBe("Pokémon Center");
    expect(data.searchName).toBe("pokemon center");
  });
});

describe("updateStoreEditableFields refreshes searchName on a name edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes searchName = normalizeStoreName(name) alongside the renamed store", async () => {
    txStoreUpdateMock.mockResolvedValue({ id: "s1", slug: "pokemon-center" });

    const existing: EditableStore = {
      id: "s1",
      slug: "pokemon-center",
      name: "Old Name",
      description: null,
      logoUrl: null,
      status: "APPROVED",
      sellerType: "RETAILER",
      countryCode: "JP",
      createdByUserId: "u1",
      hasStock: null,
      receivesOrders: null,
      isPrivate: false,
      isActive: true,
      presenceTypes: [],
      productTypeKeys: [],
      importCountryCodes: [],
      contactChannels: [],
      addresses: [],
    };

    await updateStoreEditableFields(existing, {
      name: "Pokémon Center",
      presenceTypes: [],
      productTypeKeys: [],
    });

    const data = txStoreUpdateMock.mock.calls[0]![0].data;
    expect(data.name).toBe("Pokémon Center");
    expect(data.searchName).toBe("pokemon center");
  });
});
