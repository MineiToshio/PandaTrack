import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  storeContactChannelFindManyMock,
  storeFindManyMock,
  storeFindUniqueMock,
  orderFindManyMock,
  orderFindFirstMock,
} = vi.hoisted(() => ({
  storeContactChannelFindManyMock: vi.fn(),
  storeFindManyMock: vi.fn(),
  storeFindUniqueMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storeContactChannel: { findMany: storeContactChannelFindManyMock },
    store: { findMany: storeFindManyMock, findUnique: storeFindUniqueMock },
    order: { findMany: orderFindManyMock, findFirst: orderFindFirstMock },
  },
}));

import {
  findIntakeStoreRelation,
  findStoreMatchesForIntake,
  normalizePhoneDigits,
  phoneDigitsMatch,
} from "../storeMatchingQueries";

describe("normalizePhoneDigits", () => {
  it("strips everything but digits", () => {
    expect(normalizePhoneDigits("+51 987-654-321")).toBe("51987654321");
    expect(normalizePhoneDigits("(51) 987.654.321")).toBe("51987654321");
  });
});

describe("phoneDigitsMatch", () => {
  it("matches equal digit strings", () => {
    expect(phoneDigitsMatch("987654321", "987654321")).toBe(true);
  });

  it("tolerates an optional international prefix on either side", () => {
    expect(phoneDigitsMatch("51987654321", "987654321")).toBe(true);
    expect(phoneDigitsMatch("987654321", "0051987654321")).toBe(true);
  });

  it("rejects a different number even when one is a substring elsewhere", () => {
    expect(phoneDigitsMatch("987654321", "123987654322")).toBe(false);
  });

  it("rejects strings shorter than the minimum trusted length", () => {
    expect(phoneDigitsMatch("123456", "123456")).toBe(false);
  });
});

describe("findStoreMatchesForIntake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeContactChannelFindManyMock.mockResolvedValue([]);
    storeFindManyMock.mockResolvedValue([]);
    orderFindManyMock.mockResolvedValue([]);
  });

  it("returns unknown when neither name nor phone is provided", async () => {
    const result = await findStoreMatchesForIntake("user-1", { name: null, phone: null });
    expect(result).toEqual({ kind: "unknown" });
    expect(storeContactChannelFindManyMock).not.toHaveBeenCalled();
    expect(storeFindManyMock).not.toHaveBeenCalled();
  });

  it("returns certain on a single phone match, scoped to orderable stores", async () => {
    storeContactChannelFindManyMock.mockResolvedValue([
      { storeId: "store-1", value: "+51 987 654 321", store: { name: "Pop Dealer" } },
    ]);

    const result = await findStoreMatchesForIntake("user-1", { name: null, phone: "987654321" });

    expect(result).toEqual({ kind: "certain", storeId: "store-1", name: "Pop Dealer", matchedBy: "phone" });
    const where = storeContactChannelFindManyMock.mock.calls[0]![0].where;
    expect(where.type).toEqual({ in: ["PHONE", "WHATSAPP"] });
    expect(where.store).toMatchObject({ visibility: "PUBLIC", isActive: true });
  });

  it("returns certain on a single exact-normalized name match, reusing resolveStore semantics", async () => {
    storeFindManyMock.mockResolvedValue([{ id: "store-2", name: "Pop Dealer" }]);

    const result = await findStoreMatchesForIntake("user-1", { name: "  POP   dealer  ", phone: null });

    expect(result).toEqual({ kind: "certain", storeId: "store-2", name: "Pop Dealer", matchedBy: "name" });
    expect(storeFindManyMock.mock.calls[0]![0].where).toMatchObject({ searchName: "pop dealer" });
  });

  it("deduplicates a store matched by both phone and name into a single certain result", async () => {
    storeContactChannelFindManyMock.mockResolvedValue([
      { storeId: "store-1", value: "987654321", store: { name: "Pop Dealer" } },
    ]);
    storeFindManyMock.mockResolvedValue([{ id: "store-1", name: "Pop Dealer" }]);

    const result = await findStoreMatchesForIntake("user-1", { name: "Pop Dealer", phone: "987654321" });

    expect(result).toEqual({ kind: "certain", storeId: "store-1", name: "Pop Dealer", matchedBy: "phone" });
  });

  it("returns unknown when neither signal matches any store", async () => {
    const result = await findStoreMatchesForIntake("user-1", { name: "Nowhere Store", phone: "987654321" });
    expect(result).toEqual({ kind: "unknown" });
  });

  it("returns ambiguous, ordered with the phone-matched candidate first", async () => {
    storeContactChannelFindManyMock.mockResolvedValue([
      { storeId: "store-phone", value: "987654321", store: { name: "Z Store" } },
    ]);
    storeFindManyMock.mockResolvedValue([{ id: "store-name", name: "A Store" }]);
    orderFindManyMock.mockResolvedValue([]);

    const result = await findStoreMatchesForIntake("user-1", { name: "A Store", phone: "987654321" });

    expect(result).toEqual({
      kind: "ambiguous",
      candidates: [
        { storeId: "store-phone", name: "Z Store" },
        { storeId: "store-name", name: "A Store" },
      ],
    });
  });

  it("orders ambiguous candidates with equal phone-match status by prior-order history, then alphabetically", async () => {
    storeFindManyMock.mockResolvedValue([
      { id: "store-b", name: "B Store" },
      { id: "store-a", name: "A Store" },
    ]);
    orderFindManyMock.mockResolvedValue([{ storeId: "store-b" }]);

    const result = await findStoreMatchesForIntake("user-1", { name: "generic store", phone: null });

    expect(result).toEqual({
      kind: "ambiguous",
      candidates: [
        { storeId: "store-b", name: "B Store" },
        { storeId: "store-a", name: "A Store" },
      ],
    });
    expect(orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", storeId: { in: ["store-b", "store-a"] } } }),
    );
  });

  it("never trusts a phone shorter than the minimum digit count", async () => {
    const result = await findStoreMatchesForIntake("user-1", { name: null, phone: "12345" });
    expect(result).toEqual({ kind: "unknown" });
    expect(storeContactChannelFindManyMock).not.toHaveBeenCalled();
  });
});

describe("findIntakeStoreRelation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeFindUniqueMock.mockResolvedValue(null);
    orderFindFirstMock.mockResolvedValue(null);
  });

  it("reports creator when the caller created the store", async () => {
    storeFindUniqueMock.mockResolvedValue({ createdByUserId: "user-1" });

    await expect(findIntakeStoreRelation("user-1", "store-1")).resolves.toBe("creator");
  });

  it("reports buyer when the caller has ordered from the store before", async () => {
    storeFindUniqueMock.mockResolvedValue({ createdByUserId: "someone-else" });
    orderFindFirstMock.mockResolvedValue({ id: "order-1" });

    await expect(findIntakeStoreRelation("user-1", "store-1")).resolves.toBe("buyer");
    expect(orderFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", storeId: "store-1" } }),
    );
  });

  it("reports none for a store the caller neither created nor bought from", async () => {
    storeFindUniqueMock.mockResolvedValue({ createdByUserId: "someone-else" });

    await expect(findIntakeStoreRelation("user-1", "store-1")).resolves.toBe("none");
  });

  it("reports none for a store id that does not exist, even with a stray order row", async () => {
    orderFindFirstMock.mockResolvedValue({ id: "order-1" });

    await expect(findIntakeStoreRelation("user-1", "made-up")).resolves.toBe("none");
  });
});
