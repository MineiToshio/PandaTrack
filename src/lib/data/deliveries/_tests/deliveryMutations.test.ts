import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Prisma } from "../../../../../generated/prisma/client";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../../generated/prisma/client";
import { createDelivery, persistDerivedOrderStatuses } from "../deliveryMutations";

const { prismaMock, generateDeliveryHumanReadableIdMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
  generateDeliveryHumanReadableIdMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/deliveries/deliveryIdentifier", () => ({
  generateDeliveryHumanReadableId: generateDeliveryHumanReadableIdMock,
}));

type MockOrderFindFirst = {
  status: OrderStatus;
  items: Array<{ id: string; deliveryState: OrderItemDeliveryState }>;
} | null;

type MockTx = {
  order: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function makeTx(findFirstResult: MockOrderFindFirst): Prisma.TransactionClient {
  const tx: MockTx = {
    order: {
      findFirst: vi.fn().mockResolvedValue(findFirstResult),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

describe("persistDerivedOrderStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when orderIds is empty", async () => {
    const tx = makeTx(null);
    await persistDerivedOrderStatuses(tx, []);
    expect((tx as unknown as MockTx).order.findFirst).not.toHaveBeenCalled();
  });

  it("does nothing when order is not found", async () => {
    const tx = makeTx(null);
    await persistDerivedOrderStatuses(tx, ["order-1"]);
    expect((tx as unknown as MockTx).order.update).not.toHaveBeenCalled();
  });

  it("does not update a CANCELLED order", async () => {
    const tx = makeTx({
      status: OrderStatus.CANCELLED,
      items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
    });
    await persistDerivedOrderStatuses(tx, ["order-1"]);
    expect((tx as unknown as MockTx).order.update).not.toHaveBeenCalled();
  });

  it("updates status when derived status differs from current", async () => {
    const tx = makeTx({
      status: OrderStatus.OPEN,
      items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
    });
    await persistDerivedOrderStatuses(tx, ["order-1"]);
    expect((tx as unknown as MockTx).order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.IN_TRANSIT },
    });
  });

  it("does not update when derived status matches current", async () => {
    const tx = makeTx({
      status: OrderStatus.IN_TRANSIT,
      items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
    });
    await persistDerivedOrderStatuses(tx, ["order-1"]);
    expect((tx as unknown as MockTx).order.update).not.toHaveBeenCalled();
  });

  it("derives COMPLETED when all items are DELIVERED", async () => {
    const tx = makeTx({
      status: OrderStatus.OPEN,
      items: [
        { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
        { id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED },
      ],
    });
    await persistDerivedOrderStatuses(tx, ["order-1"]);
    expect((tx as unknown as MockTx).order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.COMPLETED },
    });
  });

  it("treats ARRIVED_AT_STORE as 'open' for order-status derivation", async () => {
    const tx = makeTx({
      status: OrderStatus.IN_TRANSIT,
      items: [
        { id: "item-1", deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
        { id: "item-2", deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
      ],
    });
    await persistDerivedOrderStatuses(tx, ["order-1"]);
    expect((tx as unknown as MockTx).order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.OPEN },
    });
  });

  it("derives PARTIALLY_IN_TRANSIT from mixed IN_TRANSIT and ARRIVED_AT_STORE items", async () => {
    const tx = makeTx({
      status: OrderStatus.OPEN,
      items: [
        { id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT },
        { id: "item-2", deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
      ],
    });
    await persistDerivedOrderStatuses(tx, ["order-1"]);
    expect((tx as unknown as MockTx).order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.PARTIALLY_IN_TRANSIT },
    });
  });

  it("deduplicates orderIds before processing", async () => {
    const tx = makeTx({
      status: OrderStatus.IN_TRANSIT,
      items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
    });
    await persistDerivedOrderStatuses(tx, ["order-1", "order-1", "order-1"]);
    expect((tx as unknown as MockTx).order.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe("createDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateDeliveryHumanReadableIdMock.mockResolvedValue("DLV-20260430-01");
  });

  function makeCreateTx(overrides?: Partial<Prisma.TransactionClient>): Prisma.TransactionClient {
    const tx = {
      store: {
        findFirst: vi.fn().mockResolvedValue({ id: "store-1" }),
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "item-1",
            orderId: "order-1",
            deliveryState: OrderItemDeliveryState.NONE,
            order: { storeId: "store-1", userId: "user-1" },
          },
          {
            id: "item-2",
            orderId: "order-1",
            deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE,
            order: { storeId: "store-1", userId: "user-1" },
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      delivery: {
        create: vi.fn().mockResolvedValue({ id: "delivery-1" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      deliveryOrderItem: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      order: {
        findFirst: vi.fn().mockResolvedValue({
          status: OrderStatus.OPEN,
          items: [
            { id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT },
            { id: "item-2", deliveryState: OrderItemDeliveryState.IN_TRANSIT },
          ],
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      ...overrides,
    };
    return tx as unknown as Prisma.TransactionClient;
  }

  const input = {
    storeId: "store-1",
    deliveryDate: new Date("2026-04-30T00:00:00.000Z"),
    expectedArrivalFrom: null,
    expectedArrivalTo: null,
    cost: 0,
    currencyCode: "USD",
    exchangeRate: null,
    productIds: ["item-1", "item-2"],
  };

  it("creates a delivery, links products, updates item state, and re-derives order status", async () => {
    const tx = makeCreateTx();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
      callback(tx),
    );

    const result = await createDelivery("user-1", input);

    expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 2, orderCount: 1 });
    expect(tx.delivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        humanReadableId: "DLV-20260430-01",
        storeId: "store-1",
        userId: "user-1",
        status: DeliveryStatus.IN_TRANSIT,
        cost: 0,
        currencyCode: "USD",
      }),
      select: { id: true },
    });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["item-1", "item-2"] },
        userId: "user-1",
        deliveryState: { in: [OrderItemDeliveryState.NONE, OrderItemDeliveryState.ARRIVED_AT_STORE] },
      },
      data: { deliveryState: OrderItemDeliveryState.IN_TRANSIT },
    });
    expect(tx.deliveryOrderItem.createMany).toHaveBeenCalledWith({
      data: [
        { deliveryId: "delivery-1", orderItemId: "item-1" },
        { deliveryId: "delivery-1", orderItemId: "item-2" },
      ],
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.IN_TRANSIT },
    });
  });

  it("rejects products from another store", async () => {
    const tx = makeCreateTx({
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "item-1",
            orderId: "order-1",
            deliveryState: OrderItemDeliveryState.NONE,
            order: { storeId: "store-2", userId: "user-1" },
          },
        ]),
        updateMany: vi.fn(),
      } as unknown as Prisma.TransactionClient["orderItem"],
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
      callback(tx),
    );

    const result = await createDelivery("user-1", { ...input, productIds: ["item-1"] });

    expect(result).toEqual({ ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE" });
    expect(tx.delivery.create).not.toHaveBeenCalled();
  });

  it("rejects stale ineligible products", async () => {
    const tx = makeCreateTx({
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "item-1",
            orderId: "order-1",
            deliveryState: OrderItemDeliveryState.IN_TRANSIT,
            order: { storeId: "store-1", userId: "user-1" },
          },
        ]),
        updateMany: vi.fn(),
      } as unknown as Prisma.TransactionClient["orderItem"],
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
      callback(tx),
    );

    const result = await createDelivery("user-1", { ...input, productIds: ["item-1"] });

    expect(result).toEqual({ ok: false, error: "PRODUCT_NOT_ELIGIBLE", ineligibleProductIds: ["item-1"] });
    expect(tx.delivery.create).not.toHaveBeenCalled();
  });

  it("reports the missing ids when a selected product no longer exists", async () => {
    const tx = makeCreateTx({
      orderItem: {
        // "item-1" exists and is eligible; "item-2" is gone (filtered out by the query).
        findMany: vi.fn().mockResolvedValue([
          {
            id: "item-1",
            orderId: "order-1",
            deliveryState: OrderItemDeliveryState.NONE,
            order: { storeId: "store-1", userId: "user-1" },
          },
        ]),
        updateMany: vi.fn(),
      } as unknown as Prisma.TransactionClient["orderItem"],
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
      callback(tx),
    );

    const result = await createDelivery("user-1", { ...input, productIds: ["item-1", "item-2"] });

    expect(result).toEqual({ ok: false, error: "PRODUCT_NOT_ELIGIBLE", ineligibleProductIds: ["item-2"] });
    expect(tx.delivery.create).not.toHaveBeenCalled();
  });
});
