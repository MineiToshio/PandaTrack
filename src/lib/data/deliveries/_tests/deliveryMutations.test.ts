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
    await persistDerivedOrderStatuses(tx, []);
    expect((tx as unknown as MockTx).order.findMany).not.toHaveBeenCalled();
  });

  it("does nothing when no matching order is found", async () => {
    const tx = makeTx([]);
    await persistDerivedOrderStatuses(tx, ["order-1"]);
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
    await persistDerivedOrderStatuses(tx, ["order-1"]);
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
    await persistDerivedOrderStatuses(tx, ["order-1"]);
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
    await persistDerivedOrderStatuses(tx, ["order-1"]);
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
    await persistDerivedOrderStatuses(tx, ["order-1"]);
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
    await persistDerivedOrderStatuses(tx, ["order-1"]);
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
    await persistDerivedOrderStatuses(tx, ["order-1"]);
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
    await persistDerivedOrderStatuses(tx, ["order-1", "order-1", "order-1"]);
    expect((tx as unknown as MockTx).order.findMany).toHaveBeenCalledTimes(1);
    expect((tx as unknown as MockTx).order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["order-1"] } } }),
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
    await persistDerivedOrderStatuses(tx, ["order-1", "order-2", "order-3"]);
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
        exchangeRateBaseCode: null,
      }),
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

      expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 2, orderCount: 1 });
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
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        } as unknown as Prisma.TransactionClient["order"],
      });
      prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(tx),
      );

      await createDelivery("user-1", quickInput);

      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["order-1"] } },
        data: { status: OrderStatus.COMPLETED },
      });
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
      expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 3, orderCount: 2 });

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
        expect.objectContaining({ where: { id: { in: ["order-1", "order-2"] } } }),
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

      expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 2, orderCount: 1 });
    });
  });
});
