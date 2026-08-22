import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "../../../../../generated/prisma/client";
import { addOrderPayment, deleteOrderPayment } from "../orderPaymentMutations";
import { makeCreateStorePaymentTx, makeFixtureOrder, runStorePaymentTx } from "./storePaymentFixtures";

const PAYMENT_DATE = new Date("2020-06-01T00:00:00Z");

const params = { orderId: "order-1", userId: "user-1", amount: 1000, paymentDate: PAYMENT_DATE };

/**
 * `addOrderPayment` reads the order once, outside any transaction, to shape the input it hands to
 * `createStorePayment` (store id, currency, whether it's a single-item order). That read has to be
 * mocked on the top-level `prisma` object; everything `createStorePayment` itself does happens
 * inside the `tx` handed to the transaction callback, built with the shared store-payment fixture.
 */
function setUpOrder(overrides: { currencyCode?: string; itemId?: string | null; itemIds?: string[] } = {}): void {
  const { currencyCode = "USD", itemId = null, itemIds } = overrides;
  const items = itemIds ? itemIds.map((id) => ({ id })) : itemId ? [{ id: itemId }] : [];
  prismaMock.order.findFirst.mockResolvedValue({
    storeId: "store-1",
    currencyCode,
    exchangeRate: null,
    exchangeRateBaseCode: null,
    items,
  });
}

describe("addOrderPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the underlying store payment at Serializable isolation", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 1000 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 1000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    await addOrderPayment(params);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    );
  });

  it("returns the fresh payment summary read back from the order's own allocation cache", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 3000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 3000 } },
      cacheAfterWriteByOrderId: { "order-1": 4000 },
      snapshotsByOrderId: {
        "order-1": {
          totalCost: 10000,
          allocatedAmountMinor: 4000,
        },
      },
      paymentRecordsByOrderId: {
        "order-1": [
          {
            id: "alloc-1",
            amountMinor: 4000,
            orderItemId: null,
            payment: {
              id: "payment-new",
              amount: 1000,
              paymentDate: PAYMENT_DATE,
              allocations: [{ orderId: "order-1", amountMinor: 4000, orderItemId: null }],
            },
          },
        ],
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment(params);

    expect(result).toMatchObject({ ok: true, paidAmount: 4000, remainingAmount: 6000, paymentPercentage: 40 });
  });

  it("rejects a payment that exceeds THIS ORDER's remaining balance without creating it", async () => {
    // The store ceiling is deliberately left wide open (it is checked first, and it used to be
    // collapsed into this same code, so this fixture proved nothing about the order ceiling until
    // the two refusals were told apart). The store is owed 100000; only the order's own 2000 of
    // remaining balance can refuse a payment of 5000.
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 8000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 100000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment({ ...params, amount: 5000 });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects a fractional amount on a zero-decimal currency without creating it", async () => {
    // 43000.50 CLP would scale to 4300050 minor units — not a whole major amount for a currency
    // with no subunit, so the server guard must refuse it even though it fits the balance.
    setUpOrder({ currencyCode: "CLP" });
    const order = makeFixtureOrder({ id: "order-1", currencyCode: "CLP", totalCost: 5000000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment({ ...params, amount: 4300050 });

    expect(result).toEqual({ ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("accepts a whole major amount on a zero-decimal currency", async () => {
    setUpOrder({ currencyCode: "CLP" });
    const order = makeFixtureOrder({ id: "order-1", currencyCode: "CLP", totalCost: 5000000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 4300000 },
      snapshotsByOrderId: { "order-1": { totalCost: 5000000, allocatedAmountMinor: 4300000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment({ ...params, amount: 4300000 });

    expect(result).toMatchObject({ ok: true });
    expect(tx.storePayment.create).toHaveBeenCalled();
  });

  it("declares the allocation against the order's single item", async () => {
    setUpOrder({ itemId: "item-1" });
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 10000,
      items: [{ id: "item-1", unitPrice: null, quantity: 1 }],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 1000 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 1000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    await addOrderPayment(params);

    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ orderId: "order-1", orderItemId: "item-1", amountMinor: 1000 })],
    });
  });

  /**
   * The breakdown write path. What the collector typed is what gets written, cent for cent, and
   * the part of the payment they left unattributed is derived here rather than sent: it becomes ONE
   * order-level line of the SAME payment, which is what keeps the order's books closing exactly
   * while the products only carry what was actually declared for them.
   */
  describe("with a product breakdown", () => {
    function setUpTwoProductOrder() {
      setUpOrder({ itemIds: ["item-a", "item-b"] });
      return makeCreateStorePaymentTx({
        orders: [
          makeFixtureOrder({
            id: "order-1",
            totalCost: 15000,
            allocatedAmountMinor: 0,
            items: [
              { id: "item-a", unitPrice: 4000, quantity: 1 },
              { id: "item-b", unitPrice: 6000, quantity: 1 },
            ],
          }),
        ],
        debtByCurrency: { USD: { committedMinor: 15000, paidMinor: 0 } },
        cacheAfterWriteByOrderId: { "order-1": 7500 },
        snapshotsByOrderId: { "order-1": { totalCost: 15000, allocatedAmountMinor: 7500 } },
      });
    }

    it("writes the leftover as an order-level line of the same payment", async () => {
      const tx = setUpTwoProductOrder();
      runStorePaymentTx(prismaMock, tx);

      const result = await addOrderPayment({
        ...params,
        amount: 7500,
        allocations: [
          { orderItemId: "item-a", amountMinor: 2000 },
          { orderItemId: "item-b", amountMinor: 3000 },
        ],
      });

      expect(result).toMatchObject({ ok: true });
      const [{ data }] = tx.paymentAllocation.createMany.mock.calls[0] as [{ data: Array<Record<string, unknown>> }];
      expect(data).toEqual([
        expect.objectContaining({ orderId: "order-1", orderItemId: "item-a", amountMinor: 2000 }),
        expect.objectContaining({ orderId: "order-1", orderItemId: "item-b", amountMinor: 3000 }),
        expect.objectContaining({ orderId: "order-1", orderItemId: null, amountMinor: 2500 }),
      ]);
      expect(data.reduce((sum, line) => sum + (line.amountMinor as number), 0)).toBe(7500);
    });

    it("writes no leftover line when the breakdown covers the whole payment", async () => {
      const tx = setUpTwoProductOrder();
      runStorePaymentTx(prismaMock, tx);

      const result = await addOrderPayment({
        ...params,
        amount: 7500,
        allocations: [
          { orderItemId: "item-a", amountMinor: 3000 },
          { orderItemId: "item-b", amountMinor: 4500 },
        ],
      });

      expect(result).toMatchObject({ ok: true });
      const [{ data }] = tx.paymentAllocation.createMany.mock.calls[0] as [{ data: Array<Record<string, unknown>> }];
      // A zero-amount third line would declare that nothing covers nothing, and the store mutation
      // refuses it outright.
      expect(data).toHaveLength(2);
      expect(data.every((line) => line.amountMinor !== 0)).toBe(true);
    });

    it("refuses a breakdown that outruns the payment without writing anything", async () => {
      const tx = setUpTwoProductOrder();
      runStorePaymentTx(prismaMock, tx);

      const result = await addOrderPayment({
        ...params,
        amount: 7500,
        allocations: [
          { orderItemId: "item-a", amountMinor: 4000 },
          { orderItemId: "item-b", amountMinor: 6000 },
        ],
      });

      expect(result).toMatchObject({ ok: false });
      expect(tx.storePayment.create).not.toHaveBeenCalled();
    });

    /**
     * The refusal names the PRODUCT, in both halves: its own code and the id of the line it is
     * about. It used to collapse into `EXCEEDS_BALANCE` with the id dropped, which cost nothing
     * while this door could only ever write one whole-order allocation; with a breakdown it would
     * tell the collector their payment exceeds the ORDER's balance when what it exceeds is one
     * product's price, and leave the form unable to point at which row.
     */
    it("refuses a line that outruns its own product's price, naming that product, without writing anything", async () => {
      const tx = setUpTwoProductOrder();
      runStorePaymentTx(prismaMock, tx);

      const result = await addOrderPayment({
        ...params,
        amount: 7500,
        allocations: [{ orderItemId: "item-a", amountMinor: 5000 }],
      });

      expect(result).toEqual({ ok: false, error: "EXCEEDS_ITEM_BASE", orderItemId: "item-a" });
      expect(tx.storePayment.create).not.toHaveBeenCalled();
    });

    it("still names the single product of a one-product order when no breakdown is sent", async () => {
      setUpOrder({ itemId: "item-1" });
      const tx = makeCreateStorePaymentTx({
        orders: [
          makeFixtureOrder({
            id: "order-1",
            totalCost: 10000,
            items: [{ id: "item-1", unitPrice: null, quantity: 1 }],
          }),
        ],
        debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
        cacheAfterWriteByOrderId: { "order-1": 1000 },
        snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 1000 } },
      });
      runStorePaymentTx(prismaMock, tx);

      await addOrderPayment({ ...params, allocations: [] });

      expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ orderItemId: "item-1", amountMinor: 1000 })],
      });
    });
  });

  it("retries once and succeeds when the first attempt hits a serialization failure (P2034)", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 1000 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 1000 } },
    });
    const serializationError = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    let calls = 0;
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => {
      calls += 1;
      if (calls === 1) throw serializationError;
      return cb(tx);
    });

    const result = await addOrderPayment(params);

    expect(calls).toBe(2);
    expect(result).toMatchObject({ ok: true });
  });

  it("gives up and rethrows after exhausting the serialization retries", async () => {
    setUpOrder();
    const serializationError = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    prismaMock.$transaction.mockRejectedValue(serializationError);

    await expect(addOrderPayment(params)).rejects.toBe(serializationError);
    // Initial attempt plus the bounded retries.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(4);
  });

  it("does not retry on a non-serialization error", async () => {
    setUpOrder();
    const otherError = new Error("boom");
    prismaMock.$transaction.mockRejectedValue(otherError);

    await expect(addOrderPayment(params)).rejects.toBe(otherError);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns ORDER_NOT_FOUND when the order does not belong to the user", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const result = await addOrderPayment(params);

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_FOUND" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  /**
   * #26 — the refusal keeps its own name.
   *
   * It used to be flattened into `EXCEEDS_BALANCE`, so the collector read "the amount exceeds the
   * remaining balance of THIS ORDER" when the ceiling that actually stopped them was what they still
   * owe the STORE across every order of it. Two different facts, two different next steps, and only
   * the order-scoped one is fixable by editing this payment.
   */
  it("propagates STORE_DEBT_EXCEEDED instead of collapsing it into EXCEEDS_BALANCE", async () => {
    setUpOrder();
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      // The store is owed 400 in this currency and the payment is 1000: the order's own balance
      // (10000) has room for it, so only the store ceiling can refuse it.
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 9600 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await addOrderPayment(params);

    expect(result).toEqual({ ok: false, error: "STORE_DEBT_EXCEEDED" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });
});

/**
 * D2 — the unit an order-scoped delete acts on is the pair (payment, order).
 *
 * This is the collector's ONLY correction path: allocations are immutable once written, so fixing a
 * payment means deleting it and recording it again. Under the old rule ("the payment has exactly one
 * allocation") a payment broken down across an order's products has three, so it would delete ONE of
 * them and leave the `StorePayment` plus its siblings orphaned, with the transfer still half
 * attached to the order the collector just detached it from.
 */
describe("deleteOrderPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * `paymentAllocation.findMany` is called twice with different questions: once for this order's
   * claim on the payment (scoped by `paymentId`), and once at the end by `listOrderPaymentRecords`
   * for the order's whole ledger. Dispatched on the shape of `where`, not on call order.
   */
  function makeDeleteTx(
    overrides: {
      /** This order's allocations on the targeted payment. */
      claim?: Array<{ id: string }>;
      /** How many allocations of that payment belong to some OTHER order. */
      otherOrdersClaiming?: number;
      order?: { totalCost: number } | null;
      cacheAfterDeleteByOrderId?: Record<string, number>;
      remainingPayments?: unknown[];
    } = {},
  ) {
    const {
      claim = [{ id: "alloc-1" }],
      otherOrdersClaiming = 0,
      order = { totalCost: 10000 },
      cacheAfterDeleteByOrderId = { "order-1": 0 },
      remainingPayments = [],
    } = overrides;
    return {
      paymentAllocation: {
        findMany: vi.fn().mockImplementation((args: { where: { paymentId?: string } }) => {
          return Promise.resolve(args.where.paymentId ? claim : remainingPayments);
        }),
        // Dispatched on the `where`, not stubbed flat: `{ orderId: { not } }` asks "does any OTHER
        // order claim this payment", while a query without it asks for the payment's total line
        // count. A flat stub would answer both with the same number and make this fixture agree
        // with any implementation, which is the shape of a decorative test.
        count: vi.fn().mockImplementation((args: { where: { orderId?: { not?: string } } }) => {
          if (args.where.orderId && typeof args.where.orderId === "object" && "not" in args.where.orderId) {
            return Promise.resolve(otherOrdersClaiming);
          }
          return Promise.resolve(claim.length + otherOrdersClaiming);
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: claim.length }),
        groupBy: vi.fn().mockResolvedValue(
          Object.entries(cacheAfterDeleteByOrderId).map(([orderId, sum]) => ({
            orderId,
            _sum: { amountMinor: sum },
          })),
        ),
      },
      order: {
        findFirst: vi.fn().mockResolvedValue(order),
        // `recalculateOrderAllocationCache`'s own write, scoped to `{ id, userId }` (defense in depth).
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      storePayment: {
        delete: vi.fn().mockResolvedValue({}),
      },
    };
  }

  it("returns NOT_FOUND when this order has no claim on that payment", async () => {
    const tx = makeDeleteTx({ claim: [] });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ paymentId: "payment-1", orderId: "order-1", userId: "user-1" });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the whole payment when it was born 1:1 for this order (sole claim, full amount)", async () => {
    const tx = makeDeleteTx({ claim: [{ id: "alloc-1" }], otherOrdersClaiming: 0 });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ paymentId: "payment-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: true });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(tx.paymentAllocation.deleteMany).not.toHaveBeenCalled();
  });

  /**
   * The case the old rule got wrong, and the reason D2 blocks everything downstream of it. Three
   * lines, one order: 65.00 split 32.50 / 32.50 across two products plus nothing left over. Counting
   * ALLOCATIONS says "not sole, keep the payment" and strands it.
   */
  it("deletes the whole payment when this order's claim is THREE lines and no other order claims it", async () => {
    const tx = makeDeleteTx({
      claim: [{ id: "alloc-1" }, { id: "alloc-2" }, { id: "alloc-3" }],
      otherOrdersClaiming: 0,
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ paymentId: "payment-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: true });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    // No sibling is left behind: the cascade on `PaymentAllocation.paymentId` takes all three.
    expect(tx.paymentAllocation.deleteMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ payments: [] });
  });

  it("deletes the whole payment when its only claim is partial (unclaimed remainder rides along)", async () => {
    // The claim is the payment's only one but covers just part of its amount. The UI has no other
    // door onto an allocation-less StorePayment from this screen, so it must still go.
    const tx = makeDeleteTx({ claim: [{ id: "alloc-1" }], otherOrdersClaiming: 0 });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ paymentId: "payment-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: true });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
  });

  it("removes only this order's lines when the payment is shared with another order", async () => {
    const tx = makeDeleteTx({
      claim: [{ id: "alloc-1" }, { id: "alloc-2" }, { id: "alloc-3" }],
      otherOrdersClaiming: 1,
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ paymentId: "payment-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: false });
    // All three lines of THIS order, in one statement, and scoped so the other order's keep theirs.
    expect(tx.paymentAllocation.deleteMany).toHaveBeenCalledWith({
      where: { paymentId: "payment-1", orderId: "order-1", userId: "user-1" },
    });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
  });

  it("treats a full-amount claim on an otherwise-shared payment as shared, not 1:1", async () => {
    const tx = makeDeleteTx({ claim: [{ id: "alloc-1" }], otherOrdersClaiming: 2 });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteOrderPayment({ paymentId: "payment-1", orderId: "order-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, deletedPayment: false });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
  });
});
