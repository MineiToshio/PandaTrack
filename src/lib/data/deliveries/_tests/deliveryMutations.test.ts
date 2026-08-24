import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Prisma } from "../../../../../generated/prisma/client";
import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../../generated/prisma/client";
import {
  createDelivery,
  markDeliveryDelivered,
  persistDerivedOrderStatuses,
  reopenDelivery,
} from "../deliveryMutations";

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

type MockOrderRow = {
  id: string;
  status: OrderStatus;
  items: Array<{ id: string; deliveryState: OrderItemDeliveryState }>;
};

type MockTx = {
  order: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function makeTx(findManyResult: MockOrderRow[]): Prisma.TransactionClient {
  const tx: MockTx = {
    order: {
      findMany: vi.fn().mockResolvedValue(findManyResult),
      updateMany: vi.fn().mockResolvedValue({ count: findManyResult.length }),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

describe("persistDerivedOrderStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when orderIds is empty", async () => {
    const tx = makeTx([]);
    await persistDerivedOrderStatuses(tx, "user-1", []);
    expect((tx as unknown as MockTx).order.findMany).not.toHaveBeenCalled();
  });

  it("does nothing when no matching order is found", async () => {
    const tx = makeTx([]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
    expect((tx as unknown as MockTx).order.updateMany).not.toHaveBeenCalled();
  });

  it("does not update a CANCELLED order", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.CANCELLED,
        items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
    expect((tx as unknown as MockTx).order.updateMany).not.toHaveBeenCalled();
  });

  it("updates status when derived status differs from current", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.OPEN,
        items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
    expect((tx as unknown as MockTx).order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] } },
      data: { status: OrderStatus.IN_TRANSIT },
    });
  });

  it("does not update when derived status matches current", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.IN_TRANSIT,
        items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
    expect((tx as unknown as MockTx).order.updateMany).not.toHaveBeenCalled();
  });

  it("derives COMPLETED when all items are DELIVERED", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.OPEN,
        items: [
          { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
          { id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED },
        ],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
    expect((tx as unknown as MockTx).order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] } },
      data: { status: OrderStatus.COMPLETED },
    });
  });

  it("treats ARRIVED_AT_STORE as 'open' for order-status derivation", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.IN_TRANSIT,
        items: [
          { id: "item-1", deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
          { id: "item-2", deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
        ],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
    expect((tx as unknown as MockTx).order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] } },
      data: { status: OrderStatus.OPEN },
    });
  });

  it("derives PARTIALLY_IN_TRANSIT from mixed IN_TRANSIT and ARRIVED_AT_STORE items", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.OPEN,
        items: [
          { id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT },
          { id: "item-2", deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
        ],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
    expect((tx as unknown as MockTx).order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] } },
      data: { status: OrderStatus.PARTIALLY_IN_TRANSIT },
    });
  });

  it("reads all orders in a single batched query, deduplicating orderIds", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.IN_TRANSIT,
        items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1", "order-1", "order-1"]);
    expect((tx as unknown as MockTx).order.findMany).toHaveBeenCalledTimes(1);
    expect((tx as unknown as MockTx).order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["order-1"] }, userId: "user-1" } }),
    );
  });

  it("groups orders with the same target status into a single updateMany (constant write count)", async () => {
    const tx = makeTx([
      {
        id: "order-1",
        status: OrderStatus.OPEN,
        items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
      },
      {
        id: "order-2",
        status: OrderStatus.OPEN,
        items: [{ id: "item-2", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
      },
      {
        id: "order-3",
        status: OrderStatus.OPEN,
        items: [{ id: "item-3", deliveryState: OrderItemDeliveryState.DELIVERED }],
      },
    ]);
    await persistDerivedOrderStatuses(tx, "user-1", ["order-1", "order-2", "order-3"]);
    const updateMany = (tx as unknown as MockTx).order.updateMany;
    // Two IN_TRANSIT orders collapse into one write; the COMPLETED order is a second write.
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1", "order-2"] } },
      data: { status: OrderStatus.IN_TRANSIT },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-3"] } },
      data: { status: OrderStatus.COMPLETED },
    });
  });

  // FR-08-46 / WO-08: the money transaction needs to know exactly which orders THIS call closed,
  // so it can run the order-close consumption and settlement only for those.
  describe("closedOrderIds (FR-08-46)", () => {
    it("returns [] for an empty orderIds input", async () => {
      const tx = makeTx([]);
      const result = await persistDerivedOrderStatuses(tx, "user-1", []);
      expect(result).toEqual({ closedOrderIds: [], credited: 0 });
    });

    it("includes an order that flips to COMPLETED in this call", async () => {
      const tx = makeTx([
        {
          id: "order-1",
          status: OrderStatus.OPEN,
          items: [
            { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
            { id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED },
          ],
        },
      ]);
      const result = await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
      expect(result).toEqual({ closedOrderIds: ["order-1"], credited: 0 });
    });

    it("excludes an order that was already COMPLETED before this call", async () => {
      const tx = makeTx([
        {
          id: "order-1",
          status: OrderStatus.COMPLETED,
          items: [
            { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
            { id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED },
          ],
        },
      ]);
      const result = await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
      // Derived status equals current status, so the loop's own `continue` already skips the write;
      // this asserts the closed-set agrees and does not separately re-count it as "just closed".
      expect(result).toEqual({ closedOrderIds: [], credited: 0 });
      expect((tx as unknown as MockTx).order.updateMany).not.toHaveBeenCalled();
    });

    it("excludes an order that transitions into a non-COMPLETED status", async () => {
      const tx = makeTx([
        {
          id: "order-1",
          status: OrderStatus.OPEN,
          items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
        },
      ]);
      const result = await persistDerivedOrderStatuses(tx, "user-1", ["order-1"]);
      expect(result).toEqual({ closedOrderIds: [], credited: 0 });
    });

    it("mixes a closing order with a non-closing one in the same call", async () => {
      const tx = makeTx([
        {
          id: "order-1",
          status: OrderStatus.OPEN,
          items: [
            { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
            { id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED },
          ],
        },
        {
          id: "order-2",
          status: OrderStatus.OPEN,
          items: [{ id: "item-3", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
        },
      ]);
      const result = await persistDerivedOrderStatuses(tx, "user-1", ["order-1", "order-2"]);
      expect(result).toEqual({ closedOrderIds: ["order-1"], credited: 0 });
    });
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
      user: {
        findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: null }),
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "item-1",
            orderId: "order-1",
            deliveryState: OrderItemDeliveryState.NONE,
            order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
          },
          {
            id: "item-2",
            orderId: "order-1",
            deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE,
            order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
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
        findMany: vi.fn().mockResolvedValue([
          {
            id: "order-1",
            status: OrderStatus.OPEN,
            items: [
              { id: "item-1", deliveryState: OrderItemDeliveryState.IN_TRANSIT },
              { id: "item-2", deliveryState: OrderItemDeliveryState.IN_TRANSIT },
            ],
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      // Only consulted by `buildClosedOrderSnapshots` when an order actually closed to COMPLETED
      // in this call; empty by default since none of the base fixtures close an order.
      storeAccountAdjustmentLine: {
        groupBy: vi.fn().mockResolvedValue([]),
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

    expect(result).toEqual({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 2,
        orderCount: 1,
        closedOrders: [],
        progression: { pointsDelta: 0, rankUp: null, medalsUnlocked: [] },
      });
    expect(tx.delivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        humanReadableId: "DLV-20260430-01",
        storeId: "store-1",
        userId: "user-1",
        status: DeliveryStatus.IN_TRANSIT,
        cost: 0,
        currencyCode: "USD",
        exchangeRateBaseCode: null,
      }),
      select: { id: true },
    });
  });

  it("drops a submitted rate when the delivery is created in the base currency itself", async () => {
    const tx = makeCreateTx({
      user: {
        findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: "PEN" }),
      } as unknown as Prisma.TransactionClient["user"],
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
      callback(tx),
    );

    await createDelivery("user-1", { ...input, currencyCode: "PEN", exchangeRate: 1.1 });

    expect(tx.delivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ currencyCode: "PEN", exchangeRate: null, exchangeRateBaseCode: null }),
      select: { id: true },
    });
  });

  it("records no rate base for a foreign-currency delivery created with no rate, so it reads as FX-pending", async () => {
    const tx = makeCreateTx({
      user: {
        findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: "PEN" }),
      } as unknown as Prisma.TransactionClient["user"],
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
      callback(tx),
    );

    await createDelivery("user-1", input);

    expect(tx.delivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ currencyCode: "USD", exchangeRate: null, exchangeRateBaseCode: null }),
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
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] } },
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
            order: { storeId: "store-2", userId: "user-1", status: OrderStatus.OPEN },
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
            order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
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
            order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
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

  // Quick arrival ("ya me llegó") reuses this same transaction body with `receivedDate` set.
  describe("with receivedDate (quick arrival)", () => {
    const receivedDate = new Date("2026-05-02T00:00:00.000Z");
    const quickInput = { ...input, receivedDate };

    it("creates the delivery already DELIVERED and stores the received date", async () => {
      const tx = makeCreateTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      const result = await createDelivery("user-1", quickInput);

      expect(result).toEqual({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 2,
        orderCount: 1,
        closedOrders: [],
        progression: { pointsDelta: 0, rankUp: null, medalsUnlocked: [] },
      });
      expect(tx.delivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: DeliveryStatus.DELIVERED,
          receivedDate,
        }),
        select: { id: true },
      });
    });

    it("moves the products straight to DELIVERED, skipping IN_TRANSIT", async () => {
      const tx = makeCreateTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      await createDelivery("user-1", quickInput);

      expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["item-1", "item-2"] },
          userId: "user-1",
          deliveryState: { in: [OrderItemDeliveryState.NONE, OrderItemDeliveryState.ARRIVED_AT_STORE] },
        },
        data: { deliveryState: OrderItemDeliveryState.DELIVERED },
      });
    });

    it("re-derives the source order to COMPLETED when every product is delivered", async () => {
      const tx = makeCreateTx({
        order: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "order-1",
              status: OrderStatus.OPEN,
              items: [
                { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
                { id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED },
              ],
              // Also read by `buildClosedOrderSnapshots`'s own findMany, which reuses this mock.
              storeId: "store-1",
              currencyCode: "USD",
              totalCost: 5000,
              allocatedAmountMinor: 2000,
              orderDate: new Date("2026-04-01T00:00:00.000Z"),
              humanReadableId: "ORD-0001",
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        } as unknown as Prisma.TransactionClient["order"],
      });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      const result = await createDelivery("user-1", quickInput);

      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["order-1"] } },
        data: { status: OrderStatus.COMPLETED },
      });
      // FR-08-46/WO-08: the money transaction needs this snapshot to compute its settlement from,
      // with no money read or written here.
      expect(result.ok && result.closedOrders).toEqual([
        {
          orderId: "order-1",
          storeId: "store-1",
          currencyCode: "USD",
          totalCost: 5000,
          allocatedAmountMinor: 2000,
          adjustmentLineTotalMinor: 0,
          orderDate: new Date("2026-04-01T00:00:00.000Z"),
          humanReadableId: "ORD-0001",
        },
      ]);
    });

    it("re-derives the source order to PARTIALLY_DELIVERED when only some products arrived", async () => {
      const tx = makeCreateTx({
        order: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "order-1",
              status: OrderStatus.OPEN,
              items: [
                { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
                { id: "item-2", deliveryState: OrderItemDeliveryState.NONE },
              ],
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        } as unknown as Prisma.TransactionClient["order"],
      });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      await createDelivery("user-1", { ...quickInput, productIds: ["item-1", "item-2"] });

      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["order-1"] } },
        data: { status: OrderStatus.PARTIALLY_DELIVERED },
      });
    });

    it("keeps the wizard path untouched: no receivedDate means IN_TRANSIT", async () => {
      const tx = makeCreateTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      await createDelivery("user-1", input);

      expect(tx.delivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: DeliveryStatus.IN_TRANSIT, receivedDate: null }),
        select: { id: true },
      });
    });
  });

  /**
   * The heart of the store-scoped arrival: one physical box, one `Delivery` row, whatever number
   * of orders its contents came from (`FR-08-02`, `BR-08-12`). One row per order would mean N
   * `DLV-*` identifiers and N shipping-cost questions for a cost that belongs to the box.
   */
  describe("across several orders of the same store", () => {
    function makeCrossOrderTx(): Prisma.TransactionClient {
      return makeCreateTx({
        orderItem: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "item-1",
              orderId: "order-1",
              deliveryState: OrderItemDeliveryState.NONE,
              order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
            },
            {
              id: "item-2",
              orderId: "order-2",
              deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE,
              order: { storeId: "store-1", userId: "user-1", status: OrderStatus.PARTIALLY_DELIVERED },
            },
            {
              id: "item-3",
              orderId: "order-2",
              deliveryState: OrderItemDeliveryState.NONE,
              order: { storeId: "store-1", userId: "user-1", status: OrderStatus.PARTIALLY_DELIVERED },
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        } as unknown as Prisma.TransactionClient["orderItem"],
        deliveryOrderItem: {
          createMany: vi.fn().mockResolvedValue({ count: 3 }),
        } as unknown as Prisma.TransactionClient["deliveryOrderItem"],
        order: {
          // Post-update states: order-1 is now fully delivered, order-2 still has a product out.
          findMany: vi.fn().mockResolvedValue([
            {
              id: "order-1",
              status: OrderStatus.OPEN,
              items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED }],
              // Also read by `buildClosedOrderSnapshots`'s own findMany, which reuses this mock.
              storeId: "store-1",
              currencyCode: "USD",
              totalCost: 3000,
              allocatedAmountMinor: 1000,
              orderDate: new Date("2026-04-15T00:00:00.000Z"),
              humanReadableId: "ORD-0001",
            },
            {
              id: "order-2",
              status: OrderStatus.OPEN,
              items: [
                { id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED },
                { id: "item-3", deliveryState: OrderItemDeliveryState.DELIVERED },
                { id: "item-4", deliveryState: OrderItemDeliveryState.NONE },
              ],
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        } as unknown as Prisma.TransactionClient["order"],
      });
    }

    const crossOrderInput = {
      ...input,
      receivedDate: new Date("2026-05-02T00:00:00.000Z"),
      productIds: ["item-1", "item-2", "item-3"],
    };

    it("writes exactly one Delivery, one DeliveryOrderItem per product, and re-derives every order", async () => {
      const tx = makeCrossOrderTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      const result = await createDelivery("user-1", crossOrderInput);

      // One row, and the caller is told the selection spanned two orders.
      expect(tx.delivery.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 3,
        orderCount: 2,
        // Only order-1 closed to COMPLETED; order-2 stays PARTIALLY_DELIVERED and contributes no
        // snapshot line (FR-08-46: the money transaction only ever touches an order THIS call closed).
        closedOrders: [
          {
            orderId: "order-1",
            storeId: "store-1",
            currencyCode: "USD",
            totalCost: 3000,
            allocatedAmountMinor: 1000,
            adjustmentLineTotalMinor: 0,
            orderDate: new Date("2026-04-15T00:00:00.000Z"),
            humanReadableId: "ORD-0001",
          },
        ],
        progression: { pointsDelta: 0, rankUp: null, medalsUnlocked: [] },
      });

      // One association per product, all pointing at that single delivery.
      expect(tx.deliveryOrderItem.createMany).toHaveBeenCalledTimes(1);
      expect(tx.deliveryOrderItem.createMany).toHaveBeenCalledWith({
        data: [
          { deliveryId: "delivery-1", orderItemId: "item-1" },
          { deliveryId: "delivery-1", orderItemId: "item-2" },
          { deliveryId: "delivery-1", orderItemId: "item-3" },
        ],
      });

      // Both source orders re-derived in the same transaction, each to its own new status.
      expect(tx.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["order-1", "order-2"] }, userId: "user-1" } }),
      );
      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["order-1"] } },
        data: { status: OrderStatus.COMPLETED },
      });
      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["order-2"] } },
        data: { status: OrderStatus.PARTIALLY_DELIVERED },
      });
    });

    it("moves every selected product to DELIVERED in a single compare-and-swap", async () => {
      const tx = makeCrossOrderTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      await createDelivery("user-1", crossOrderInput);

      expect(tx.orderItem.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["item-1", "item-2", "item-3"] },
          userId: "user-1",
          deliveryState: { in: [OrderItemDeliveryState.NONE, OrderItemDeliveryState.ARRIVED_AT_STORE] },
        },
        data: { deliveryState: OrderItemDeliveryState.DELIVERED },
      });
    });

    // WO-08 spec §1.7: 38 pairs in the collector's own history tie on `orderDate`, so the batch
    // settlement order needs a deterministic tiebreak.
    it("sorts closedOrders by orderDate ASC then humanReadableId ASC when two orders tie on orderDate", async () => {
      const tx = makeCreateTx({
        orderItem: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "item-1",
              orderId: "order-1",
              deliveryState: OrderItemDeliveryState.NONE,
              order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
            },
            {
              id: "item-2",
              orderId: "order-2",
              deliveryState: OrderItemDeliveryState.NONE,
              order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        } as unknown as Prisma.TransactionClient["orderItem"],
        deliveryOrderItem: {
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        } as unknown as Prisma.TransactionClient["deliveryOrderItem"],
        order: {
          // Listed with the higher humanReadableId first, on purpose: the sort, not fixture order,
          // must be what puts ORD-0001 ahead of ORD-0002 below.
          findMany: vi.fn().mockResolvedValue([
            {
              id: "order-2",
              status: OrderStatus.OPEN,
              items: [{ id: "item-2", deliveryState: OrderItemDeliveryState.DELIVERED }],
              storeId: "store-1",
              currencyCode: "USD",
              totalCost: 2000,
              allocatedAmountMinor: 0,
              orderDate: new Date("2026-05-01T00:00:00.000Z"),
              humanReadableId: "ORD-0002",
            },
            {
              id: "order-1",
              status: OrderStatus.OPEN,
              items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED }],
              storeId: "store-1",
              currencyCode: "USD",
              totalCost: 1000,
              allocatedAmountMinor: 0,
              orderDate: new Date("2026-05-01T00:00:00.000Z"),
              humanReadableId: "ORD-0001",
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        } as unknown as Prisma.TransactionClient["order"],
      });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      const result = await createDelivery("user-1", {
        ...input,
        receivedDate: new Date("2026-05-02T00:00:00.000Z"),
        productIds: ["item-1", "item-2"],
      });

      expect(result.ok && result.closedOrders.map((order) => order.humanReadableId)).toEqual(["ORD-0001", "ORD-0002"]);
    });
  });

  /**
   * A cancelled order is outside the delivery lifecycle (`persistDerivedOrderStatuses` refuses to
   * re-derive it), so its products can never join a delivery. The check lives here rather than in
   * one caller: a store-scoped selection spans N orders, and the create wizard's product picker
   * does not filter cancelled orders either.
   */
  describe("cancelled source order", () => {
    function makeCancelledTx(): Prisma.TransactionClient {
      return makeCreateTx({
        orderItem: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "item-1",
              orderId: "order-1",
              deliveryState: OrderItemDeliveryState.NONE,
              order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
            },
            {
              id: "item-2",
              orderId: "order-2",
              deliveryState: OrderItemDeliveryState.NONE,
              order: { storeId: "store-1", userId: "user-1", status: OrderStatus.CANCELLED },
            },
          ]),
          updateMany: vi.fn(),
        } as unknown as Prisma.TransactionClient["orderItem"],
      });
    }

    it("refuses the whole selection when any product belongs to a cancelled order", async () => {
      const tx = makeCancelledTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      const result = await createDelivery("user-1", { ...input, productIds: ["item-1", "item-2"] });

      expect(result).toEqual({ ok: false, error: "ORDER_CANCELLED" });
    });

    it("decides the refusal before the first write, so a returned refusal cannot commit anything", async () => {
      const tx = makeCancelledTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      await createDelivery("user-1", { ...input, productIds: ["item-1", "item-2"] });

      // A `return` from a $transaction callback commits (ADR 0022): nothing may have been written.
      expect(generateDeliveryHumanReadableIdMock).not.toHaveBeenCalled();
      expect(tx.delivery.create).not.toHaveBeenCalled();
      expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
      expect(tx.deliveryOrderItem.createMany).not.toHaveBeenCalled();
      expect(tx.order.updateMany).not.toHaveBeenCalled();
    });

    it("lets a selection through when every source order is still standing", async () => {
      const tx = makeCreateTx();
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      const result = await createDelivery("user-1", input);

      expect(result).toEqual({
        ok: true,
        deliveryId: "delivery-1",
        productCount: 2,
        orderCount: 1,
        closedOrders: [],
        progression: { pointsDelta: 0, rankUp: null, medalsUnlocked: [] },
      });
    });
  });
});

describe("markDeliveryDelivered (FR-08-46 producer snapshot)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeMarkDeliveredTx(overrides: { orderRows?: unknown[] } = {}) {
    return {
      delivery: {
        findFirst: vi.fn().mockResolvedValue({
          id: "dlv-1",
          status: DeliveryStatus.IN_TRANSIT,
          orderItems: [{ orderItem: { id: "item-1", orderId: "order-1" } }],
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      orderItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      order: {
        findMany: vi.fn().mockResolvedValue(
          overrides.orderRows ?? [
            {
              id: "order-1",
              status: OrderStatus.OPEN,
              items: [{ id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED }],
              storeId: "store-1",
              currencyCode: "USD",
              totalCost: 4000,
              allocatedAmountMinor: 1500,
              orderDate: new Date("2026-05-10T00:00:00.000Z"),
              humanReadableId: "ORD-0009",
            },
          ],
        ),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      storeAccountAdjustmentLine: { groupBy: vi.fn().mockResolvedValue([]) },
    };
  }

  // Round-4 correction: `markDeliveryDelivered` is a producer of the closed-order trigger set too
  // (the formal "Marcar como llegada" flow), not only `createDelivery`.
  it("returns the closed-order snapshot when this call completes the order", async () => {
    const tx = makeMarkDeliveredTx();
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const result = await markDeliveryDelivered("dlv-1", "user-1", new Date("2026-05-10T00:00:00.000Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.closedOrders).toEqual([
      {
        orderId: "order-1",
        storeId: "store-1",
        currencyCode: "USD",
        totalCost: 4000,
        allocatedAmountMinor: 1500,
        adjustmentLineTotalMinor: 0,
        orderDate: new Date("2026-05-10T00:00:00.000Z"),
        humanReadableId: "ORD-0009",
      },
    ]);
  });

  it("returns an empty closed-order snapshot when the order stays open after this call", async () => {
    const tx = makeMarkDeliveredTx({
      orderRows: [
        {
          id: "order-1",
          status: OrderStatus.OPEN,
          items: [
            { id: "item-1", deliveryState: OrderItemDeliveryState.DELIVERED },
            { id: "item-2", deliveryState: OrderItemDeliveryState.NONE },
          ],
        },
      ],
    });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const result = await markDeliveryDelivered("dlv-1", "user-1", new Date());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.closedOrders).toEqual([]);
  });
});

describe("reopenDelivery (settlement reversal, FR-08-43 / ADR 0032 §9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function settlementPaymentFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: "pay-settlement-1",
      storeId: "store-1",
      userId: "user-1",
      amount: 5000,
      paymentDate: new Date("2026-05-10T00:00:00.000Z"),
      currencyCode: "USD",
      exchangeRate: null,
      exchangeRateBaseCode: null,
      note: null,
      migratedFromOrderId: null,
      settledByDeliveryId: "dlv-1",
      createdAt: new Date("2026-05-10T00:00:00.000Z"),
      updatedAt: new Date("2026-05-10T00:00:00.000Z"),
      allocations: [
        {
          id: "alloc-settlement-1",
          paymentId: "pay-settlement-1",
          orderId: "order-1",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 5000,
          settlesTarget: false,
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
        },
      ],
      ...overrides,
    };
  }

  /** Row shape `paymentAllocation.findMany` returns for the surviving-consumption read. */
  function survivingConsumedRowFixture(overrides: Record<string, unknown> = {}) {
    return {
      amountMinor: 1200,
      payment: { currencyCode: "USD" },
      ...overrides,
    };
  }

  function makeReopenTx(
    overrides: {
      settledPayments?: unknown[];
      deliveryStatus?: DeliveryStatus;
      survivingConsumedRows?: unknown[];
    } = {},
  ) {
    return {
      delivery: {
        findFirst: vi.fn().mockResolvedValue({
          id: "dlv-1",
          status: overrides.deliveryStatus ?? DeliveryStatus.DELIVERED,
          orderItems: [{ orderItem: { id: "item-1", orderId: "order-1" } }],
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      orderItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      deliveryOrderItem: { count: vi.fn().mockResolvedValue(0) },
      storePayment: {
        findMany: vi.fn().mockResolvedValue(overrides.settledPayments ?? []),
        deleteMany: vi.fn().mockResolvedValue({ count: overrides.settledPayments?.length ?? 0 }),
      },
      paymentAllocation: {
        groupBy: vi.fn().mockResolvedValue([{ orderId: "order-1", _sum: { amountMinor: 0 } }]),
        // The surviving-consumption read (FR-08-46 provenance, WO-08 UX Notes "known gap"
        // closure): rows this delivery's own close-time consumption stamped, on payments this
        // reopen never deletes. `deleteMany` is mocked too so a test can pin that reopen never
        // calls it for this table at all (mutation-testing evidence: a future change that tried to
        // delete these rows would flip that assertion).
        findMany: vi.fn().mockResolvedValue(overrides.survivingConsumedRows ?? []),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
  }

  it("queries StorePayment scoped to this delivery's settledByDeliveryId, never by store", async () => {
    const tx = makeReopenTx({ settledPayments: [settlementPaymentFixture()] });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await reopenDelivery("dlv-1", "user-1");

    // Mutation-testing evidence: widening this `where` to `{ storeId: "store-1", userId }` (every
    // payment of the store, dropping `settledByDeliveryId`) would still pass a same-shape assertion
    // on call count, but fails THIS one, which pins the exact scoping clause.
    expect(tx.storePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { settledByDeliveryId: "dlv-1", userId: "user-1" } }),
    );
  });

  it("deletes only the settlement payment(s) this delivery produced, never widening to the store's other payments", async () => {
    const tx = makeReopenTx({ settledPayments: [settlementPaymentFixture()] });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await reopenDelivery("dlv-1", "user-1");

    // Mutation-testing evidence: if the delete were widened to also remove an unrelated payment
    // (e.g. the order-close consumption's own earlier StorePayment, "pay-consumption-1", which
    // carries no `settledByDeliveryId`), this exact `id: { in: [...] }` assertion fails, because it
    // pins the delete to precisely the ids `findMany` returned, nothing more.
    expect(tx.storePayment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["pay-settlement-1"] } } });
  });

  it("recalculates the allocation cache for every order the reverted allocations touched", async () => {
    const tx = makeReopenTx({ settledPayments: [settlementPaymentFixture()] });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await reopenDelivery("dlv-1", "user-1");

    expect(tx.paymentAllocation.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orderId: { in: ["order-1"] } }) }),
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", userId: "user-1" },
      data: { allocatedAmountMinor: 0 },
    });
  });

  it("returns the verbatim reverted snapshot and its total, with surviving consumption 0 when close never consumed anything (settlement only)", async () => {
    const payment = settlementPaymentFixture();
    const tx = makeReopenTx({ settledPayments: [payment] });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const result = await reopenDelivery("dlv-1", "user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.revertedSettlements).toEqual({
      totalAmountMinor: 5000,
      payments: [payment],
      survivingConsumedMinor: 0,
      survivingConsumedAllocations: [],
    });
  });

  /**
   * The consumption-survival case (WO-08 Technical Notes, ADR 0033 §4): an order-close consumption
   * writes its allocation onto some OTHER, earlier StorePayment that carries no `settledByDeliveryId`
   * at all. That payment can never appear in `findMany`'s result (the query is scoped to
   * `settledByDeliveryId: deliveryId`), so it is never in the delete's `id: { in: [...] }` list and
   * never touched, even though it allocates to the exact same order this reopen is affecting.
   */
  it("leaves an unrelated (non-settlement) payment's allocation to the same order untouched", async () => {
    const unrelatedConsumptionPayment = {
      id: "pay-consumption-1",
      settledByDeliveryId: null,
      allocations: [{ orderId: "order-1", orderItemId: null, amountMinor: 3000 }],
    };
    // `findMany` is scoped by `settledByDeliveryId: "dlv-1"` in production code, so a correct
    // implementation never returns `unrelatedConsumptionPayment` here in the first place; asserting
    // the delete only ever touches "pay-settlement-1" is what pins that scoping, not this mock.
    const tx = makeReopenTx({ settledPayments: [settlementPaymentFixture()] });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await reopenDelivery("dlv-1", "user-1");

    const deleteCall = (tx.storePayment.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(deleteCall.where.id.in).not.toContain(unrelatedConsumptionPayment.id);
    expect(deleteCall.where.id.in).toEqual(["pay-settlement-1"]);
  });

  // Regression: a reopen with no settlement payments must behave exactly as it did before this
  // slice (WO-04's original reopenDelivery), just with the additive empty revertedSettlements field.
  it("reports an empty reversal and touches no payment when this delivery never produced a settlement", async () => {
    const tx = makeReopenTx({ settledPayments: [] });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const result = await reopenDelivery("dlv-1", "user-1");

    expect(result).toEqual({
      ok: true,
      productCount: 1,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 0,
        survivingConsumedAllocations: [],
      },
    });
    expect(tx.storePayment.deleteMany).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.groupBy).not.toHaveBeenCalled();
    expect(tx.delivery.update).toHaveBeenCalledWith({
      where: { id: "dlv-1" },
      data: { status: DeliveryStatus.IN_TRANSIT, receivedDate: null },
    });
  });

  /**
   * The reopen-toast gap closure itself (WO-08 UX Notes "known gap"): a close that ran BOTH the
   * settlement write and the unconditional FR-08-46 consumption leaves two independent figures for
   * the reopen to report. This asserts the consumption-only half: reverted is 0 (there is no
   * settlement `StorePayment` for this delivery to delete), surviving is > 0 (the earlier payment's
   * allocation this delivery's own close stamped).
   */
  it("with consumption only (checkbox unchecked on close): reverted 0, surviving > 0", async () => {
    const tx = makeReopenTx({
      settledPayments: [],
      survivingConsumedRows: [survivingConsumedRowFixture({ amountMinor: 1200, payment: { currencyCode: "USD" } })],
    });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const result = await reopenDelivery("dlv-1", "user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.revertedSettlements.totalAmountMinor).toBe(0);
    expect(result.revertedSettlements.payments).toEqual([]);
    expect(result.revertedSettlements.survivingConsumedMinor).toBe(1200);
    expect(result.revertedSettlements.survivingConsumedAllocations).toEqual([
      { amountMinor: 1200, currencyCode: "USD" },
    ]);
  });

  /**
   * The combined case: both a settlement StorePayment (deleted, reverted) AND a surviving
   * consumption allocation (untouched) exist for the same delivery's close.
   */
  it("with both settlement and consumption: reverted > 0 AND surviving > 0, summed independently", async () => {
    const tx = makeReopenTx({
      settledPayments: [settlementPaymentFixture()],
      survivingConsumedRows: [
        survivingConsumedRowFixture({ amountMinor: 800, payment: { currencyCode: "USD" } }),
        survivingConsumedRowFixture({ amountMinor: 400, payment: { currencyCode: "USD" } }),
      ],
    });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const result = await reopenDelivery("dlv-1", "user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.revertedSettlements.totalAmountMinor).toBe(5000);
    expect(result.revertedSettlements.survivingConsumedMinor).toBe(1200);
  });

  /**
   * Mutation-testing evidence for the "reopen must never delete or modify a surviving consumption
   * allocation" rule (WO-08 Technical Notes, ADR 0033 §4): `paymentAllocation.deleteMany` must never
   * be called at all by `reopenDelivery`. If a future change tried to widen the settlement-reversal
   * delete to also remove these rows (directly, via a new `paymentAllocation.deleteMany` call, since
   * `storePayment.deleteMany`'s cascade cannot reach them: they live on an unrelated, earlier,
   * un-deleted `StorePayment`), this assertion fails.
   */
  it("never calls paymentAllocation.deleteMany: surviving consumption rows are read-only to reopen", async () => {
    const tx = makeReopenTx({
      settledPayments: [settlementPaymentFixture()],
      survivingConsumedRows: [survivingConsumedRowFixture()],
    });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await reopenDelivery("dlv-1", "user-1");

    expect(tx.paymentAllocation.deleteMany).not.toHaveBeenCalled();
  });

  it("queries the surviving-consumption read scoped to this delivery's consumedByDeliveryId and userId", async () => {
    const tx = makeReopenTx({ survivingConsumedRows: [survivingConsumedRowFixture()] });
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await reopenDelivery("dlv-1", "user-1");

    expect(tx.paymentAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { consumedByDeliveryId: "dlv-1", userId: "user-1" } }),
    );
  });
});
