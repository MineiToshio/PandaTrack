import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeContactChannelFindManyMock, storeContactChannelCreateMock, createStoreMock, findIntakeStoreRelationMock } =
  vi.hoisted(() => ({
    storeContactChannelFindManyMock: vi.fn(),
    storeContactChannelCreateMock: vi.fn(),
    createStoreMock: vi.fn(),
    findIntakeStoreRelationMock: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storeContactChannel: { findMany: storeContactChannelFindManyMock, create: storeContactChannelCreateMock },
  },
}));

vi.mock("../storeMutations", () => ({
  createStore: createStoreMock,
}));

vi.mock("../storeMatchingQueries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../storeMatchingQueries")>()),
  findIntakeStoreRelation: findIntakeStoreRelationMock,
}));

import {
  createStoreFromIntake,
  MAX_LEARNED_PHONE_CHANNELS_PER_STORE,
  recordConfirmedStoreMatch,
} from "../storeMatchingMutations";

describe("createStoreFromIntake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createStoreMock.mockResolvedValue({ id: "store-1", slug: "pop-dealer" });
  });

  it("creates a PERSON, private store with no product catalog, the only default safe to be wrong about", async () => {
    await createStoreFromIntake({
      name: "Pop Dealer",
      phone: "987654321",
      countryCode: "PE",
      createdByUserId: "user-1",
      status: "PENDING",
      approvedByUserId: null,
    });

    expect(createStoreMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pop Dealer",
        sellerType: "PERSON",
        countryCode: "PE",
        status: "PENDING",
        createdByUserId: "user-1",
        approvedByUserId: null,
        isPrivate: true,
        presenceTypes: ["ONLINE"],
        productTypeKeys: [],
      }),
    );
  });

  it("attaches the normalized phone as a PHONE contact channel when a trustworthy phone was extracted", async () => {
    await createStoreFromIntake({
      name: "Pop Dealer",
      phone: "+51 987 654 321",
      countryCode: "PE",
      createdByUserId: "user-1",
      status: "PENDING",
      approvedByUserId: null,
    });

    const input = createStoreMock.mock.calls[0]![0];
    expect(input.contactChannels).toEqual([{ type: "PHONE", value: "51987654321", label: null, isPublic: false }]);
  });

  it("stores that phone as non-public, since a number read off a screenshot was never published", async () => {
    // The seller did not publish this number in a catalog; the app inferred it from a private
    // conversation. Written public it would only stay hidden by the accident of `PERSON` stores not
    // rendering their channels, and would surface the moment anything about the store changed.
    await createStoreFromIntake({
      name: "Pop Dealer",
      phone: "+51 987 654 321",
      countryCode: "PE",
      createdByUserId: "user-1",
      status: "PENDING",
      approvedByUserId: null,
    });

    const [channel] = createStoreMock.mock.calls[0]![0].contactChannels ?? [];
    expect(channel?.isPublic).toBe(false);
  });

  it("omits the contact channel when no phone was extracted", async () => {
    await createStoreFromIntake({
      name: "Pop Dealer",
      phone: null,
      countryCode: "PE",
      createdByUserId: "user-1",
      status: "PENDING",
      approvedByUserId: null,
    });

    expect(createStoreMock.mock.calls[0]![0].contactChannels).toEqual([]);
  });

  it("omits the contact channel when the phone is too short to trust", async () => {
    await createStoreFromIntake({
      name: "Pop Dealer",
      phone: "12345",
      countryCode: "PE",
      createdByUserId: "user-1",
      status: "PENDING",
      approvedByUserId: null,
    });

    expect(createStoreMock.mock.calls[0]![0].contactChannels).toEqual([]);
  });
});

describe("recordConfirmedStoreMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findIntakeStoreRelationMock.mockResolvedValue("creator");
    storeContactChannelFindManyMock.mockResolvedValue([]);
  });

  it("does nothing when the phone does not normalize to a trustworthy number", async () => {
    await expect(recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "123" })).resolves.toBe(
      "no-phone",
    );

    expect(findIntakeStoreRelationMock).not.toHaveBeenCalled();
    expect(storeContactChannelFindManyMock).not.toHaveBeenCalled();
    expect(storeContactChannelCreateMock).not.toHaveBeenCalled();
  });

  it("refuses to write anything to a store the caller neither created nor bought from", async () => {
    findIntakeStoreRelationMock.mockResolvedValue("none");

    await expect(
      recordConfirmedStoreMatch({ userId: "attacker", storeId: "someone-elses-store", phone: "+51 987 654 321" }),
    ).resolves.toBe("not-related");

    expect(findIntakeStoreRelationMock).toHaveBeenCalledWith("attacker", "someone-elses-store");
    expect(storeContactChannelFindManyMock).not.toHaveBeenCalled();
    expect(storeContactChannelCreateMock).not.toHaveBeenCalled();
  });

  it("adds a private PHONE channel to the confirmed store when the caller created it", async () => {
    await expect(
      recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "+51 987 654 321" }),
    ).resolves.toBe("recorded");

    expect(storeContactChannelCreateMock).toHaveBeenCalledWith({
      data: { storeId: "store-1", type: "PHONE", value: "51987654321", isPrimary: true, isPublic: false },
    });
  });

  it("learns from a caller who has ordered from the store before", async () => {
    findIntakeStoreRelationMock.mockResolvedValue("buyer");

    await expect(
      recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "+51 987 654 321" }),
    ).resolves.toBe("recorded");

    expect(storeContactChannelCreateMock).toHaveBeenCalled();
  });

  it("never marks a contribution primary when the caller is not the store's creator", async () => {
    findIntakeStoreRelationMock.mockResolvedValue("buyer");

    await recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "987654321" });

    expect(storeContactChannelCreateMock.mock.calls[0]![0].data.isPrimary).toBe(false);
  });

  it("does not make the creator's contribution primary when the store already has a phone channel", async () => {
    storeContactChannelFindManyMock.mockResolvedValue([{ value: "111222333", isPublic: true }]);

    await recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "987654321" });

    expect(storeContactChannelCreateMock.mock.calls[0]![0].data.isPrimary).toBe(false);
  });

  it("is a no-op when the store already carries an equivalent channel", async () => {
    storeContactChannelFindManyMock.mockResolvedValue([{ value: "987654321", isPublic: false }]);

    await expect(
      recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "+51 987 654 321" }),
    ).resolves.toBe("already-known");

    expect(storeContactChannelCreateMock).not.toHaveBeenCalled();
  });

  it("stops learning once the store holds the maximum number of inferred phone channels", async () => {
    storeContactChannelFindManyMock.mockResolvedValue(
      Array.from({ length: MAX_LEARNED_PHONE_CHANNELS_PER_STORE }, (_, index) => ({
        value: `9876543${index}0`,
        isPublic: false,
      })),
    );

    await expect(recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "111222333" })).resolves.toBe(
      "limit-reached",
    );

    expect(storeContactChannelCreateMock).not.toHaveBeenCalled();
  });

  it("counts only inferred channels against the cap, so a store's own public numbers never block learning", async () => {
    storeContactChannelFindManyMock.mockResolvedValue(
      Array.from({ length: MAX_LEARNED_PHONE_CHANNELS_PER_STORE + 3 }, (_, index) => ({
        value: `9876543${index}0`,
        isPublic: true,
      })),
    );

    await expect(recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-1", phone: "111222333" })).resolves.toBe(
      "recorded",
    );
  });

  it("never touches a store other than the one it was asked to confirm", async () => {
    await recordConfirmedStoreMatch({ userId: "user-1", storeId: "store-2", phone: "987654321" });

    expect(storeContactChannelFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ storeId: "store-2" }) }),
    );
    expect(storeContactChannelCreateMock.mock.calls[0]![0].data.storeId).toBe("store-2");
  });
});
