import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A contact channel carries a privacy bit the rest of the app treats as load-bearing: a `PHONE` row
 * image intake read out of somebody's private chat, or one `recordConfirmedStoreMatch` learned, is a
 * matching hint the app inferred, not a number the seller published. These tests pin the two writes
 * that decide whether that distinction survives, because both used to lose it silently.
 */

const { storeCreateMock, transactionMock, txChannelDeleteManyMock, txChannelCreateManyMock } = vi.hoisted(() => {
  const txChannelDeleteManyMock = vi.fn().mockResolvedValue(undefined);
  const txChannelCreateManyMock = vi.fn().mockResolvedValue(undefined);
  return {
    storeCreateMock: vi.fn(),
    txChannelDeleteManyMock,
    txChannelCreateManyMock,
    transactionMock: vi.fn(async (callback: (tx: unknown) => unknown) => {
      const noop = vi.fn().mockResolvedValue(undefined);
      const tx = {
        store: {
          update: vi.fn().mockResolvedValue({ id: "store-1", slug: "store-one" }),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        storeChangeRequest: { findMany: vi.fn().mockResolvedValue([]), update: noop },
        storePresence: { deleteMany: noop, createMany: noop },
        storeProductTypeAssignment: { deleteMany: noop, createMany: noop },
        storeImportCountry: { deleteMany: noop, createMany: noop },
        storeContactChannel: { deleteMany: txChannelDeleteManyMock, createMany: txChannelCreateManyMock },
        storeAddress: { deleteMany: noop, createMany: noop },
      };
      return callback(tx);
    }),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { create: storeCreateMock },
    $transaction: transactionMock,
  },
}));

import { createStore } from "../storeMutations";
import { updateStoreEditableFields } from "../storeGovernanceMutations";
import type { EditableStore } from "../storeGovernanceQueries";

const RETAILER_STORE: EditableStore = {
  id: "store-1",
  slug: "store-one",
  name: "Pop Dealer Store",
  description: null,
  logoUrl: null,
  status: "PENDING",
  sellerType: "RETAILER",
  countryCode: "PE",
  createdByUserId: "user-1",
  hasStock: null,
  receivesOrders: null,
  isPrivate: false,
  isActive: true,
  presenceTypes: ["ONLINE"],
  productTypeKeys: ["figures"],
  importCountryCodes: [],
  contactChannels: [],
  addresses: [],
};

describe("createStore contact-channel privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeCreateMock.mockResolvedValue({ id: "store-1", slug: "store-one" });
  });

  function createdChannels() {
    return storeCreateMock.mock.calls[0]![0].data.contactChannels.create as Array<Record<string, unknown>>;
  }

  it("publishes a hand-authored channel, which is what every manual form submits", async () => {
    await createStore({
      name: "Pop Dealer Store",
      sellerType: "RETAILER",
      countryCode: "PE",
      presenceTypes: ["ONLINE"],
      productTypeKeys: ["figures"],
      createdByUserId: "user-1",
      status: "PENDING",
      contactChannels: [{ type: "WHATSAPP", value: "https://wa.me/51987654321", label: null }],
    });

    expect(createdChannels()[0]!.isPublic).toBe(true);
  });

  it("keeps an inferred channel out of publication when the caller says so", async () => {
    await createStore({
      name: "Kyle Mendoza",
      sellerType: "PERSON",
      countryCode: "PE",
      presenceTypes: ["ONLINE"],
      productTypeKeys: [],
      createdByUserId: "user-1",
      status: "PENDING",
      contactChannels: [{ type: "PHONE", value: "51987654321", label: null, isPublic: false }],
    });

    expect(createdChannels()[0]!.isPublic).toBe(false);
  });
});

describe("updateStoreEditableFields leaves non-public channels alone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rewrites only the published channels, so an inferred phone survives an edit", async () => {
    // Two bugs met here. The blanket delete destroyed the phone the matcher had learned, so the
    // next intake from that seller matched nothing and created a duplicate; and because the edit
    // form had loaded that same phone as an ordinary row, the recreate wrote it back as public.
    await updateStoreEditableFields(RETAILER_STORE, {
      name: "Pop Dealer Store",
      presenceTypes: ["ONLINE"],
      productTypeKeys: ["figures"],
      contactChannels: [{ type: "WHATSAPP", value: "https://wa.me/51987654321", label: null }],
      addresses: [],
    });

    expect(txChannelDeleteManyMock).toHaveBeenCalledWith({ where: { storeId: "store-1", isPublic: true } });

    // The rows the form did submit are still rewritten normally, so narrowing the delete costs the
    // edit path nothing.
    expect(txChannelCreateManyMock).toHaveBeenCalledWith({
      data: [
        { storeId: "store-1", type: "WHATSAPP", value: "https://wa.me/51987654321", label: null, isPrimary: false },
      ],
    });
  });
});
