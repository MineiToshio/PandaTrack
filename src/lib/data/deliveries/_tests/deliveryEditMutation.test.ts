import { describe, expect, it, vi, beforeEach } from "vitest";
import { DeliveryStatus, OrderItemDeliveryState } from "../../../../../generated/prisma/client";
import { editDelivery } from "../deliveryMutations";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

type SelectedItem = {
  id: string;
  orderId: string;
  deliveryState: OrderItemDeliveryState;
  order: { storeId: string; userId: string };
};

type TxOverrides = {
  delivery?: unknown;
  selectedItems?: SelectedItem[];
  addedUpdateCount?: number;
};

function makeTx(overrides: TxOverrides = {}) {
  return {
    delivery: {
      findFirst: vi.fn().mockResolvedValue(overrides.delivery ?? null),
      update: vi.fn().mockResolvedValue(undefined),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue(overrides.selectedItems ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.addedUpdateCount ?? 0 }),
    },
    deliveryOrderItem: {
      createMany: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
    order: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
  };
}

function useTx(tx: ReturnType<typeof makeTx>) {
  prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
}

const STORE_ID = "store-1";
const USER_ID = "user-1";

function deliveryFixture(currentItemIds: string[]) {
  return {
    id: "dlv-1",
    status: DeliveryStatus.IN_TRANSIT,
    storeId: STORE_ID,
    orderItems: currentItemIds.map((id) => ({ orderItem: { id, orderId: `ord-of-${id}` } })),
  };
}

function selectedItem(id: string, state: OrderItemDeliveryState): SelectedItem {
  return { id, orderId: `ord-of-${id}`, deliveryState: state, order: { storeId: STORE_ID, userId: USER_ID } };
}

const BASE_INPUT = {
  deliveryDate: new Date(2026, 4, 5),
  expectedArrivalFrom: null,
  expectedArrivalTo: null,
  cost: 840,
  currencyCode: "USD",
  exchangeRate: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("editDelivery", () => {
  it("rejects an empty product selection (minimum-one invariant)", async () => {
    const result = await editDelivery("dlv-1", USER_ID, { ...BASE_INPUT, productIds: [] });
    expect(result).toEqual({ ok: false, error: "NO_PRODUCTS_SELECTED" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects non IN_TRANSIT deliveries (BR-08-04 — reopen first)", async () => {
    const tx = makeTx({ delivery: { ...deliveryFixture(["item-1"]), status: DeliveryStatus.DELIVERED } });
    useTx(tx);
    const result = await editDelivery("dlv-1", USER_ID, { ...BASE_INPUT, productIds: ["item-1"] });
    expect(result).toEqual({ ok: false, error: "INVALID_STATUS" });
  });

  it("moves added products to IN_TRANSIT and removed products back to ARRIVED_AT_STORE", async () => {
    const tx = makeTx({
      delivery: deliveryFixture(["kept", "removed"]),
      selectedItems: [
        selectedItem("kept", OrderItemDeliveryState.IN_TRANSIT),
        selectedItem("added", OrderItemDeliveryState.ARRIVED_AT_STORE),
      ],
      addedUpdateCount: 1,
    });
    useTx(tx);

    const result = await editDelivery("dlv-1", USER_ID, { ...BASE_INPUT, productIds: ["kept", "added"] });

    expect(result).toEqual({ ok: true, productCount: 2, addedCount: 1, removedCount: 1 });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["added"] } }),
        data: { deliveryState: OrderItemDeliveryState.IN_TRANSIT },
      }),
    );
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["removed"] } }),
        data: { deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
      }),
    );
    expect(tx.deliveryOrderItem.createMany).toHaveBeenCalledWith({
      data: [{ deliveryId: "dlv-1", orderItemId: "added" }],
    });
    expect(tx.deliveryOrderItem.deleteMany).toHaveBeenCalledWith({
      where: { deliveryId: "dlv-1", orderItemId: { in: ["removed"] } },
    });
  });

  it("rejects products from another store atomically", async () => {
    const tx = makeTx({
      delivery: deliveryFixture(["kept"]),
      selectedItems: [
        {
          id: "kept",
          orderId: "ord-1",
          deliveryState: OrderItemDeliveryState.IN_TRANSIT,
          order: { storeId: "other-store", userId: USER_ID },
        },
      ],
    });
    useTx(tx);

    const result = await editDelivery("dlv-1", USER_ID, { ...BASE_INPUT, productIds: ["kept"] });

    expect(result).toEqual({ ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE" });
    expect(tx.delivery.update).not.toHaveBeenCalled();
  });

  it("rejects added products that are no longer eligible", async () => {
    const tx = makeTx({
      delivery: deliveryFixture(["kept"]),
      selectedItems: [
        selectedItem("kept", OrderItemDeliveryState.IN_TRANSIT),
        // Added product already delivered elsewhere — stale edit.
        selectedItem("stale", OrderItemDeliveryState.DELIVERED),
      ],
    });
    useTx(tx);

    const result = await editDelivery("dlv-1", USER_ID, { ...BASE_INPUT, productIds: ["kept", "stale"] });

    expect(result).toEqual({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });
    expect(tx.delivery.update).not.toHaveBeenCalled();
  });

  it("persists metadata (dates, cost, currency, FX cleared when null)", async () => {
    const tx = makeTx({
      delivery: deliveryFixture(["kept"]),
      selectedItems: [selectedItem("kept", OrderItemDeliveryState.IN_TRANSIT)],
    });
    useTx(tx);

    const arrivalFrom = new Date(2026, 4, 20);
    const arrivalTo = new Date(2026, 4, 24);
    const result = await editDelivery("dlv-1", USER_ID, {
      ...BASE_INPUT,
      expectedArrivalFrom: arrivalFrom,
      expectedArrivalTo: arrivalTo,
      productIds: ["kept"],
    });

    expect(result.ok).toBe(true);
    expect(tx.delivery.update).toHaveBeenCalledWith({
      where: { id: "dlv-1" },
      data: expect.objectContaining({
        deliveryDate: BASE_INPUT.deliveryDate,
        expectedArrivalFrom: arrivalFrom,
        expectedArrivalTo: arrivalTo,
        cost: 840,
        currencyCode: "USD",
        exchangeRate: null,
      }),
    });
  });
});
