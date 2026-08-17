import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock, computeOrderEligibilityMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findFirst: vi.fn() },
  },
  computeOrderEligibilityMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/orders/orderLifecycle", () => ({
  computeOrderEligibility: computeOrderEligibilityMock,
}));

import { getOrderDetail } from "../orderQueries";

type ItemFixture = { deliveryStatuses?: Array<"IN_TRANSIT" | "DELIVERED">; own?: "NONE" | "ARRIVED_AT_STORE" };

function makeRow(items: ItemFixture[]) {
  return {
    id: "order-1",
    humanReadableId: "PT-0001",
    storeId: "store-1",
    store: { id: "store-1", name: "Store", slug: "store", status: "APPROVED", removalReason: null, logoUrl: null },
    orderDate: new Date("2026-01-01"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "USD",
    exchangeRate: null,
    exchangeRateBaseCode: null,
    totalCost: 1000,
    note: null,
    status: "OPEN",
    cancellationReason: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    items: items.map((item, index) => ({
      id: `item-${index}`,
      name: `Item ${index}`,
      quantity: 1,
      unitPrice: 1000,
      productTypeKey: null,
      position: index,
      deliveryState: item.own ?? "NONE",
      deliveryItems: (item.deliveryStatuses ?? []).map((status) => ({ delivery: { status } })),
    })),
    paymentAllocations: [],
    history: [],
  };
}

describe("getOrderDetail eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computeOrderEligibilityMock.mockReturnValue({ canDelete: true, canCancel: true, blockReason: undefined });
  });

  it("delegates the cancel/delete rule to computeOrderEligibility with the derived item states", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeRow([{ own: "NONE" }, { deliveryStatuses: ["DELIVERED"] }]));

    await getOrderDetail("order-1", "user-1");

    expect(computeOrderEligibilityMock).toHaveBeenCalledTimes(1);
    expect(computeOrderEligibilityMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: "item-0", deliveryState: "open" }),
      expect.objectContaining({ id: "item-1", deliveryState: "delivered" }),
    ]);
  });

  it("surfaces the rule's verdict verbatim instead of recomputing it locally", async () => {
    // A verdict the inline predicate could never produce for these items: every item is "open",
    // so a local re-implementation would answer `canDelete: true`. Only a real delegation to
    // the rule module can return this.
    computeOrderEligibilityMock.mockReturnValue({
      canDelete: false,
      canCancel: false,
      blockReason: "ITEMS_LINKED_TO_DELIVERY",
    });
    prismaMock.order.findFirst.mockResolvedValue(makeRow([{ own: "NONE" }, { own: "NONE" }]));

    const detail = await getOrderDetail("order-1", "user-1");

    expect(detail?.eligibility).toEqual({
      canDelete: false,
      canCancel: false,
      blockReason: "ITEMS_LINKED_TO_DELIVERY",
    });
  });

  it("derives the hasNonCancelledDeliveryLinks flag from the rule's block reason", async () => {
    computeOrderEligibilityMock.mockReturnValue({
      canDelete: false,
      canCancel: false,
      blockReason: "ITEMS_LINKED_TO_DELIVERY",
    });
    prismaMock.order.findFirst.mockResolvedValue(makeRow([{ own: "NONE" }]));

    const detail = await getOrderDetail("order-1", "user-1");

    expect(detail?.flags.hasNonCancelledDeliveryLinks).toBe(true);
  });
});
