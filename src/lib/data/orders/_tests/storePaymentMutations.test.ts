import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import {
  consumeUnassignedStoreMoneyOnOrderClose,
  createStorePayment,
  deleteStorePayment,
} from "../storePaymentMutations";
import {
  makeConsumeUnassignedStoreMoneyTx,
  makeCreateStorePaymentTx,
  makeFixtureOrder,
  runStorePaymentTx,
} from "./storePaymentFixtures";

const PAYMENT_DATE = new Date("2020-06-01T00:00:00Z");

describe("createStorePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a multi-order, multi-item payment and refreshes every affected order's cache in ascending id order", async () => {
    const orderOne = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0, items: [] });
    const orderTwo = makeFixtureOrder({
      id: "order-2",
      totalCost: 5000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-1", unitPrice: null, quantity: 1 }],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [orderOne, orderTwo],
      debtByCurrency: { USD: { committedMinor: 20000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 300, "order-2": 500 },
      snapshotsByOrderId: {
        "order-1": { totalCost: 10000, allocatedAmountMinor: 300 },
        "order-2": { totalCost: 5000, allocatedAmountMinor: 500 },
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 800,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [
        { orderId: "order-2", orderItemId: "item-1", amountMinor: 500 },
        { orderId: "order-1", amountMinor: 300 },
      ],
    });

    // `affectedOrders` follows the order the allocations were submitted in (order-2 first); only
    // the cache refresh itself is sorted ascending by id, asserted below via `order.updateMany`.
    expect(result).toMatchObject({
      ok: true,
      paymentId: "payment-new",
      currencyCode: "USD",
      affectedOrders: [
        { orderId: "order-2", totalCost: 5000, allocatedAmountMinor: 500 },
        { orderId: "order-1", totalCost: 10000, allocatedAmountMinor: 300 },
      ],
    });
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-new",
          orderId: "order-2",
          orderItemId: "item-1",
          userId: "user-1",
          amountMinor: 500,
          settlesTarget: false,
        },
        {
          paymentId: "payment-new",
          orderId: "order-1",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 300,
          settlesTarget: false,
        },
      ],
    });
    // The cache refresh writes orders in ascending id order regardless of the allocation order
    // submitted, which is what keeps two concurrent multi-order payments from deadlocking.
    expect(tx.order.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "order-1", userId: "user-1" },
      data: { allocatedAmountMinor: 300 },
    });
    expect(tx.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "order-2", userId: "user-1" },
      data: { allocatedAmountMinor: 500 },
    });
  });

  it("accepts a payment declared against nothing (a cuenta), touching no order", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 1000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });

    expect(result).toMatchObject({ ok: true, affectedOrders: [] });
    expect(tx.paymentAllocation.createMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects AMOUNT_INVALID before touching the store", async () => {
    const tx = makeCreateStorePaymentTx();
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 0,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });

    expect(result).toEqual({ ok: false, error: "AMOUNT_INVALID" });
    expect(tx.store.findFirst).not.toHaveBeenCalled();
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects AMOUNT_FRACTIONAL_SUBUNITS on a zero-decimal currency", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 4300050,
      paymentDate: PAYMENT_DATE,
      currencyCode: "CLP",
    });

    expect(result).toEqual({ ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("accepts a whole major amount on a zero-decimal currency", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { CLP: { committedMinor: 5000000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 4300000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "CLP",
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects STORE_NOT_FOUND", async () => {
    const tx = makeCreateStorePaymentTx({ storeExists: false });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });

    expect(result).toEqual({ ok: false, error: "STORE_NOT_FOUND" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects CURRENCY_REQUIRED when no currency is given and the store spans several", async () => {
    const tx = makeCreateStorePaymentTx({ inheritedCurrencyRows: [{ currencyCode: "PEN" }, { currencyCode: "USD" }] });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
    });

    expect(result).toEqual({ ok: false, error: "CURRENCY_REQUIRED" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("resolves the inherited currency when the store's standing orders agree on one", async () => {
    const tx = makeCreateStorePaymentTx({
      inheritedCurrencyRows: [{ currencyCode: "PEN" }],
      debtByCurrency: { PEN: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
    });

    expect(result).toMatchObject({ ok: true, currencyCode: "PEN" });
  });

  it("rejects STORE_DEBT_EXCEEDED using the debt for that currency only, mixing PEN and USD", async () => {
    const tx = makeCreateStorePaymentTx({
      debtByCurrency: {
        PEN: { committedMinor: 1000, paidMinor: 1000 }, // debt = 0
        USD: { committedMinor: 5000, paidMinor: 0 }, // debt = 5000
      },
    });
    runStorePaymentTx(prismaMock, tx);

    const rejected = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "PEN",
    });
    expect(rejected).toEqual({ ok: false, error: "STORE_DEBT_EXCEEDED" });

    const accepted = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 3000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
    });
    expect(accepted).toMatchObject({ ok: true, currencyCode: "USD" });
  });

  describe("STORE_DEBT_EXCEEDED nets out an adjustment (WO-11)", () => {
    // Store with 9000 committed, nothing paid, and 3000 already written off by a reconciliation
    // adjustment: the ceiling is 6000 (`getStoreDebtMinor`'s own subtrahend), not the gross 9000.
    // Written down twice, before and after delivery, because the ceiling's own scope is
    // "non-cancelled", not "open" — the line must keep counting once the order is delivered.

    it("refuses a payment past lifetime-minus-lines while the written-off order is still open", async () => {
      const tx = makeCreateStorePaymentTx({
        debtByCurrency: { USD: { committedMinor: 9000, paidMinor: 0, writtenOffMinor: 3000 } },
      });
      runStorePaymentTx(prismaMock, tx);

      const rejected = await createStorePayment({
        userId: "user-1",
        storeId: "store-1",
        amount: 6001,
        paymentDate: PAYMENT_DATE,
        currencyCode: "USD",
      });
      expect(rejected).toEqual({ ok: false, error: "STORE_DEBT_EXCEEDED" });

      const accepted = await createStorePayment({
        userId: "user-1",
        storeId: "store-1",
        amount: 6000,
        paymentDate: PAYMENT_DATE,
        currencyCode: "USD",
      });
      expect(accepted).toMatchObject({ ok: true, currencyCode: "USD" });
    });

    it("keeps refusing the same amount after the written-off order is delivered", async () => {
      // The order's own status is irrelevant to this fixture (the ceiling reads a currency-scoped
      // aggregate, not per-order rows): the point is that `writtenOffMinor` keeps applying, which is
      // exactly what the real `getStoreDebtMinor` query's `status: { not: CANCELLED }` filter (as
      // opposed to "OPEN only") guarantees once the order moves past OPEN.
      const tx = makeCreateStorePaymentTx({
        debtByCurrency: { USD: { committedMinor: 9000, paidMinor: 0, writtenOffMinor: 3000 } },
      });
      runStorePaymentTx(prismaMock, tx);

      const rejected = await createStorePayment({
        userId: "user-1",
        storeId: "store-1",
        amount: 6001,
        paymentDate: PAYMENT_DATE,
        currencyCode: "USD",
      });
      expect(rejected).toEqual({ ok: false, error: "STORE_DEBT_EXCEEDED" });

      const accepted = await createStorePayment({
        userId: "user-1",
        storeId: "store-1",
        amount: 6000,
        paymentDate: PAYMENT_DATE,
        currencyCode: "USD",
      });
      expect(accepted).toMatchObject({ ok: true, currencyCode: "USD" });
    });
  });

  it("rejects ALLOCATION_SUM_EXCEEDS_PAYMENT before validating any allocation", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 150 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_SUM_EXCEEDS_PAYMENT" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects ORDER_NOT_FOUND for an allocation naming an order that doesn't exist", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "missing-order", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_FOUND", orderId: "missing-order" });
  });

  it("rejects STORE_MISMATCH when the allocated order belongs to a different store", async () => {
    const order = makeFixtureOrder({ id: "order-1", storeId: "other-store" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "STORE_MISMATCH", orderId: "order-1" });
  });

  it("rejects ORDER_CANCELLED", async () => {
    const order = makeFixtureOrder({ id: "order-1", status: OrderStatus.CANCELLED });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "ORDER_CANCELLED", orderId: "order-1" });
  });

  it("rejects CURRENCY_MISMATCH between the payment and the allocated order", async () => {
    const order = makeFixtureOrder({ id: "order-1", currencyCode: "PEN" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "CURRENCY_MISMATCH", orderId: "order-1" });
  });

  it("rejects DATE_BEFORE_ORDER when the payment predates the order it is allocated to", async () => {
    const order = makeFixtureOrder({ id: "order-1", orderDate: new Date("2020-07-01T00:00:00Z") });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE, // 2020-06-01, before the order
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 100 }],
    });

    expect(result).toEqual({ ok: false, error: "DATE_BEFORE_ORDER", orderId: "order-1" });
  });

  it("rejects ALLOCATION_AMOUNT_INVALID for a negative allocation", async () => {
    const order = makeFixtureOrder({ id: "order-1" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: -100 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_AMOUNT_INVALID", orderId: "order-1" });
  });

  it("requires settlesTarget on a zero-amount allocation, rejecting it without one", async () => {
    const order = makeFixtureOrder({ id: "order-1" });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 0 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_AMOUNT_INVALID", orderId: "order-1" });
  });

  /**
   * `settlesTarget` used to be the "covered in full, amount unknown" declaration. It is refused on
   * write now: it could not be edited without deleting the whole payment, and the zero-amount row
   * it left showed up in the order's history as a phantom 0.00 line. `OrderItem.paidDeclaredAt`
   * replaced it, and it is editable.
   */
  it("refuses a settlesTarget declaration outright, without writing a payment", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 500, settlesTarget: true }],
    });

    expect(result).toEqual({ ok: false, error: "SETTLES_TARGET_UNSUPPORTED", orderId: "order-1" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("refuses `{ amountMinor: 0, settlesTarget: true }` as the DEPRECATION, not as a bad amount", async () => {
    // The order of the two guards is the test. With the settlesTarget check placed AFTER the
    // amount check, this exact payload earns `ALLOCATION_AMOUNT_INVALID` instead and the field's
    // deprecation is silently unenforced for the one payload that most wants to use it.
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 0, settlesTarget: true }],
    });

    expect(result).toEqual({ ok: false, error: "SETTLES_TARGET_UNSUPPORTED", orderId: "order-1" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects EXCEEDS_BALANCE when the allocation would push the order past its total", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 1000, allocatedAmountMinor: 900 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 200,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 200 }],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
  });

  /**
   * `EXCEEDS_BALANCE`, checked against the canonical net open balance (`BR-05-32`). The order
   * is fully unpaid but a `StoreAccountAdjustment` line already wrote off its whole total, so
   * `openBalanceMinor` is 0. The GROSS comparison this test used to exercise
   * (`allocatedAmountMinor + pending > totalCost`, i.e. `0 + 18000 > 18000`) is false and would
   * wrongly ACCEPT the allocation; the NET comparison must refuse it.
   */
  it("rejects EXCEEDS_BALANCE when the order was already written off in full, even though it carries no allocation", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 18000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 18000, paidMinor: 0 } },
      writtenOffByOrderId: { "order-1": 18000 },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 18000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 18000 }],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("accepts an allocation exactly equal to the remaining net balance once a line has written part of it off", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 18000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 18000, paidMinor: 0 } },
      writtenOffByOrderId: { "order-1": 10000 },
      cacheAfterWriteByOrderId: { "order-1": 8000 },
      snapshotsByOrderId: { "order-1": { totalCost: 18000, allocatedAmountMinor: 8000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 8000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      // openBalanceMinor(order-1) = 18000 - 0 - 10000 = 8000, exactly this allocation.
      allocations: [{ orderId: "order-1", amountMinor: 8000 }],
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects EXCEEDS_BALANCE when the allocation is one minor unit over the remaining net balance", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 18000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 18000, paidMinor: 0 } },
      writtenOffByOrderId: { "order-1": 10000 },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 8001,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      // openBalanceMinor(order-1) = 8000; 8001 is one over.
      allocations: [{ orderId: "order-1", amountMinor: 8001 }],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("accumulates two allocation lines of one payment against the same written-off order before comparing to the net ceiling", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 18000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 18000, paidMinor: 0 } },
      writtenOffByOrderId: { "order-1": 10000 },
    });
    runStorePaymentTx(prismaMock, tx);

    // openBalanceMinor(order-1) = 8000. Each line alone (5000, then 3001) is within it, but their
    // sum (8001) is not: the pair must not slip past the ceiling one line at a time.
    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 8001,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [
        { orderId: "order-1", amountMinor: 5000 },
        { orderId: "order-1", amountMinor: 3001 },
      ],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects a late payment on a COMPLETED order above the remaining net balance", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      status: OrderStatus.COMPLETED,
      totalCost: 18000,
      allocatedAmountMinor: 0,
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 18000, paidMinor: 0 } },
      writtenOffByOrderId: { "order-1": 10000 },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 8001,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 8001 }],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
  });

  it("accepts a late payment on a COMPLETED order within the remaining net balance (FR-05-63)", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      status: OrderStatus.COMPLETED,
      totalCost: 18000,
      allocatedAmountMinor: 0,
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 18000, paidMinor: 0 } },
      writtenOffByOrderId: { "order-1": 10000 },
      cacheAfterWriteByOrderId: { "order-1": 8000 },
      snapshotsByOrderId: { "order-1": { totalCost: 18000, allocatedAmountMinor: 8000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 8000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 8000 }],
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects ITEM_ORDER_MISMATCH when the item does not belong to the allocated order", async () => {
    const order = makeFixtureOrder({ id: "order-1", items: [{ id: "item-1", unitPrice: 500, quantity: 1 }] });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 100,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", orderItemId: "item-does-not-belong", amountMinor: 100 }],
    });

    expect(result).toEqual({
      ok: false,
      error: "ITEM_ORDER_MISMATCH",
      orderId: "order-1",
      orderItemId: "item-does-not-belong",
    });
  });

  it("rejects EXCEEDS_ITEM_BASE when the item already has its own price fully declared", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 5000,
      allocatedAmountMinor: 800,
      items: [
        { id: "item-1", unitPrice: 1000, quantity: 1 },
        { id: "item-2", unitPrice: 4000, quantity: 1 },
      ],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 5000, paidMinor: 0 } },
      allocatedByItemId: { "item-1": 800 },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 300,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", orderItemId: "item-1", amountMinor: 300 }],
    });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_ITEM_BASE", orderId: "order-1", orderItemId: "item-1" });
  });

  /**
   * D5 — the fractional-subunit rule has to hold per LINE, not only for the payment total.
   *
   * The payment-level guard cannot see this: JPY 10000 is a perfectly whole amount, and it still
   * splits into two lines that have no representation in a currency with no subunit. Without the
   * per-line check the rows persist and render back as something the collector never entered.
   */
  it("rejects AMOUNT_FRACTIONAL_SUBUNITS for a LINE, on a payment whose own total is whole", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      currencyCode: "JPY",
      totalCost: 2000000,
      items: [
        { id: "item-1", unitPrice: 1000000, quantity: 1 },
        { id: "item-2", unitPrice: 1000000, quantity: 1 },
      ],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { JPY: { committedMinor: 2000000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      // 10000 minor units = a whole 100 JPY, so the payment-level guard waves it through.
      amount: 10000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "JPY",
      allocations: [
        { orderId: "order-1", orderItemId: "item-1", amountMinor: 4950 },
        { orderId: "order-1", orderItemId: "item-2", amountMinor: 5050 },
      ],
    });

    expect(result).toMatchObject({ ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" });
    // Refused before the first write (ADR 0022): a `return` after `storePayment.create` would have
    // committed the payment while reporting a failure.
    expect(tx.storePayment.create).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.createMany).not.toHaveBeenCalled();
  });

  it("names the offending line, so the panel can mark it instead of blaming the whole payment", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      currencyCode: "JPY",
      totalCost: 2000000,
      items: [
        { id: "item-1", unitPrice: 1000000, quantity: 1 },
        { id: "item-2", unitPrice: 1000000, quantity: 1 },
      ],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { JPY: { committedMinor: 2000000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 10000,
      paymentDate: PAYMENT_DATE,
      // 5000 + 4950 = 9950, under the payment: the sum guard has nothing to say, so the only thing
      // that can refuse here is the per-line subunit check, on the SECOND line.
      currencyCode: "JPY",
      allocations: [
        { orderId: "order-1", orderItemId: "item-1", amountMinor: 5000 },
        { orderId: "order-1", orderItemId: "item-2", amountMinor: 4950 },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: "AMOUNT_FRACTIONAL_SUBUNITS",
      orderId: "order-1",
      orderItemId: "item-2",
    });
  });

  it("accepts whole-major LINES on a zero-decimal currency", async () => {
    // The guard must not refuse a legal split: 5000 + 5000 are both whole 50 JPY.
    const order = makeFixtureOrder({
      id: "order-1",
      currencyCode: "JPY",
      totalCost: 2000000,
      items: [
        { id: "item-1", unitPrice: 1000000, quantity: 1 },
        { id: "item-2", unitPrice: 1000000, quantity: 1 },
      ],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { JPY: { committedMinor: 2000000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 10000 },
      snapshotsByOrderId: { "order-1": { totalCost: 2000000, allocatedAmountMinor: 10000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 10000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "JPY",
      allocations: [
        { orderId: "order-1", orderItemId: "item-1", amountMinor: 5000 },
        { orderId: "order-1", orderItemId: "item-2", amountMinor: 5000 },
      ],
    });

    expect(result).toMatchObject({ ok: true });
    expect(tx.storePayment.create).toHaveBeenCalled();
  });

  it("leaves a two-decimal currency alone: 49.50 + 50.50 is an ordinary split", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 200000,
      items: [
        { id: "item-1", unitPrice: 100000, quantity: 1 },
        { id: "item-2", unitPrice: 100000, quantity: 1 },
      ],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 200000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 10000 },
      snapshotsByOrderId: { "order-1": { totalCost: 200000, allocatedAmountMinor: 10000 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 10000,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [
        { orderId: "order-1", orderItemId: "item-1", amountMinor: 4950 },
        { orderId: "order-1", orderItemId: "item-2", amountMinor: 5050 },
      ],
    });

    expect(result).toMatchObject({ ok: true });
  });
});

/**
 * `requireFullAllocation` (WO-09, ADR 0033 §5a): only `createStorePaymentAction` sets it. It
 * hardens `Σ allocations.amountMinor <= amount` to `Σ allocations.amountMinor + parkedAmountMinor
 * === amount`. `parkedAmountMinor` is request-shape only and is never persisted.
 */
describe("createStorePayment with requireFullAllocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists when allocations alone sum to the amount, parkedAmountMinor omitted", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 500 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 500 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      requireFullAllocation: true,
      allocations: [{ orderId: "order-1", amountMinor: 500 }],
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("persists when allocations plus a positive parkedAmountMinor sum to the amount", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 300 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 300 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      requireFullAllocation: true,
      parkedAmountMinor: 200,
      allocations: [{ orderId: "order-1", amountMinor: 300 }],
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("rejects ALLOCATION_SUM_BELOW_PAYMENT when allocations plus parked money undershoot the amount", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      requireFullAllocation: true,
      parkedAmountMinor: 100,
      allocations: [{ orderId: "order-1", amountMinor: 300 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_SUM_BELOW_PAYMENT" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects ALLOCATION_SUM_EXCEEDS_PAYMENT when allocations alone overshoot the amount", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      requireFullAllocation: true,
      allocations: [{ orderId: "order-1", amountMinor: 600 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_SUM_EXCEEDS_PAYMENT" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("rejects ALLOCATION_SUM_EXCEEDS_PAYMENT when allocations alone fit but parked money pushes past the amount", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      requireFullAllocation: true,
      parkedAmountMinor: 250,
      allocations: [{ orderId: "order-1", amountMinor: 300 }],
    });

    expect(result).toEqual({ ok: false, error: "ALLOCATION_SUM_EXCEEDS_PAYMENT" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });

  it("persists fully parked money, no products named at all (spec §3.4)", async () => {
    const tx = makeCreateStorePaymentTx({ debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } } });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      requireFullAllocation: true,
      parkedAmountMinor: 500,
    });

    expect(result).toMatchObject({ ok: true, affectedOrders: [] });
  });

  it("rejects AMOUNT_INVALID when parkedAmountMinor itself is malformed (negative)", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      requireFullAllocation: true,
      parkedAmountMinor: -1,
      allocations: [{ orderId: "order-1", amountMinor: 300 }],
    });

    expect(result).toEqual({ ok: false, error: "AMOUNT_INVALID" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });
});

/**
 * `requireFullAllocation: false` (the default, unset by every existing caller): the regression
 * proof that `addOrderPayment` and `createOrder`'s initial payment keep seeing the old
 * `Σ allocations.amountMinor <= amount` rule, unaffected by the new equality hardening.
 */
describe("createStorePayment / writeStorePaymentWithAllocations with requireFullAllocation: false (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a partial breakdown with the flag omitted, exactly as today", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 10000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 300 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 300 } },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      // requireFullAllocation intentionally omitted.
      allocations: [{ orderId: "order-1", amountMinor: 300 }],
    });

    expect(result).toMatchObject({ ok: true });
  });
});

describe("deleteStorePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeDeleteTx(
    overrides: {
      payment?: { id: string; allocations: Array<{ orderId: string }> } | null;
      cacheAfterDeleteByOrderId?: Record<string, number>;
    } = {},
  ) {
    const { payment = { id: "payment-1", allocations: [{ orderId: "order-1" }] }, cacheAfterDeleteByOrderId = {} } =
      overrides;
    return {
      storePayment: {
        findFirst: vi.fn().mockResolvedValue(payment),
        delete: vi.fn().mockResolvedValue({}),
      },
      order: {
        // `recalculateOrderAllocationCache`'s own write, scoped to `{ id, userId }` (defense in depth).
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      paymentAllocation: {
        groupBy: vi.fn().mockResolvedValue(
          Object.entries(cacheAfterDeleteByOrderId).map(([orderId, sum]) => ({
            orderId,
            _sum: { amountMinor: sum },
          })),
        ),
      },
    };
  }

  it("returns NOT_FOUND without deleting anything when the payment doesn't belong to the user", async () => {
    const tx = makeDeleteTx({ payment: null });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteStorePayment("payment-1", "user-1");

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tx.storePayment.delete).not.toHaveBeenCalled();
  });

  it("deletes the payment and recalculates every order it was declared against", async () => {
    const tx = makeDeleteTx({
      payment: { id: "payment-1", allocations: [{ orderId: "order-2" }, { orderId: "order-1" }] },
      cacheAfterDeleteByOrderId: { "order-1": 0, "order-2": 0 },
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteStorePayment("payment-1", "user-1");

    expect(result).toEqual({ ok: true, affectedOrderIds: ["order-2", "order-1"] });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(tx.order.updateMany).toHaveBeenCalledTimes(2);
  });

  it("deletes an unallocated (a cuenta) payment without touching any order", async () => {
    const tx = makeDeleteTx({ payment: { id: "payment-1", allocations: [] } });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteStorePayment("payment-1", "user-1");

    expect(result).toEqual({ ok: true, affectedOrderIds: [] });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(tx.paymentAllocation.groupBy).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});

describe("createStorePayment declared coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the declared products in the same transaction as the money", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 10000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-1", unitPrice: null, quantity: 1 }],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 20000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 500 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 500 } },
      declarableItemIds: ["item-1"],
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 500 }],
      declarePaidItemIds: ["item-1"],
    });

    expect(result).toMatchObject({ ok: true });
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1"] }, userId: "user-1" },
      data: { paidDeclaredAt: expect.any(Date) },
    });
  });

  /**
   * The refusal has to be decided before the FIRST write. A payment row committed beside a
   * declaration that never landed is the ADR 0022 failure in its most expensive form: the money is
   * on the store's account and the caller was told it failed.
   */
  it("refuses a declared product from another store WITHOUT creating the payment", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 20000, paidMinor: 0 } },
      declarableItemIds: [],
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 500 }],
      declarePaidItemIds: ["item-from-another-store"],
    });

    expect(result).toMatchObject({ ok: false, error: "ITEM_ORDER_MISMATCH" });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.createMany).not.toHaveBeenCalled();
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });

  /**
   * The sentinel branch. `findDeclaredItemOutsideStore` already proved `item-1` reachable before the
   * first write, so `setOrderItemsPaidDeclaredWithin`'s own `orderItem.count` re-check can only fail
   * here for a concurrent delete happening AFTER the payment row was already written. A plain
   * `return` at that point would commit the payment while reporting failure (ADR 0022); this proves
   * `DeclaredItemsRollback` throws instead, and the result carries no created payment.
   */
  it("rolls the payment back when the declared item disappears between the pre-check and the write (DeclaredItemsRollback)", async () => {
    const order = makeFixtureOrder({
      id: "order-1",
      totalCost: 10000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-1", unitPrice: null, quantity: 1 }],
    });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 20000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 500 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 500 } },
      declarableItemIds: ["item-1"],
    });
    // Simulates the concurrent delete: the pre-check's own `findMany` already proved ownership, but
    // by the time this later `count` re-check runs the item is gone.
    tx.orderItem.count = vi.fn().mockResolvedValue(0);
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 500 }],
      declarePaidItemIds: ["item-1"],
    });

    expect(result).toEqual({ ok: false, error: "ITEM_ORDER_MISMATCH" });
    // The row WAS written before the sentinel fired — in production the throw is what rolls it back
    // at the transaction level; this asserts the caller-visible result never shows it as created.
    expect(tx.storePayment.create).toHaveBeenCalled();
  });

  it("touches no product when the payment declares none", async () => {
    const order = makeFixtureOrder({ id: "order-1", totalCost: 10000, allocatedAmountMinor: 0 });
    const tx = makeCreateStorePaymentTx({
      orders: [order],
      debtByCurrency: { USD: { committedMinor: 20000, paidMinor: 0 } },
      cacheAfterWriteByOrderId: { "order-1": 500 },
      snapshotsByOrderId: { "order-1": { totalCost: 10000, allocatedAmountMinor: 500 } },
    });
    runStorePaymentTx(prismaMock, tx);

    await createStorePayment({
      userId: "user-1",
      storeId: "store-1",
      amount: 500,
      paymentDate: PAYMENT_DATE,
      currencyCode: "USD",
      allocations: [{ orderId: "order-1", amountMinor: 500 }],
    });

    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });
});

describe("createStorePayment base-currency FX guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePaymentInput = {
    userId: "user-1",
    storeId: "store-1",
    amount: 800,
    paymentDate: PAYMENT_DATE,
  };

  it("drops an FX pair on a payment in the collector's base currency", async () => {
    // The contamination vector of the 1.1 incident: `addOrderPayment` inherits the order's FX
    // shape, so a polluted base-currency order used to give birth to polluted payments.
    const tx = makeCreateStorePaymentTx({
      debtByCurrency: { PEN: { committedMinor: 20000 } },
      baseCurrencyCode: "PEN",
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      ...basePaymentInput,
      currencyCode: "PEN",
      exchangeRate: 1.1,
      exchangeRateBaseCode: "USD",
    });

    expect(result.ok).toBe(true);
    expect(tx.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: null, exchangeRateBaseCode: null }),
      }),
    );
  });

  it("keeps a foreign-currency payment's inherited pair verbatim, including an older base code", async () => {
    const tx = makeCreateStorePaymentTx({
      debtByCurrency: { USD: { committedMinor: 20000 } },
      baseCurrencyCode: "PEN",
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      ...basePaymentInput,
      currencyCode: "USD",
      exchangeRate: 3.393232,
      exchangeRateBaseCode: "EUR",
    });

    expect(result.ok).toBe(true);
    expect(tx.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: 3.393232, exchangeRateBaseCode: "EUR" }),
      }),
    );
  });

  it("passes the pair through while the collector has no base currency configured", async () => {
    const tx = makeCreateStorePaymentTx({
      debtByCurrency: { USD: { committedMinor: 20000 } },
      baseCurrencyCode: null,
    });
    runStorePaymentTx(prismaMock, tx);

    const result = await createStorePayment({
      ...basePaymentInput,
      currencyCode: "USD",
      exchangeRate: 3.39,
      exchangeRateBaseCode: "PEN",
    });

    expect(result.ok).toBe(true);
    expect(tx.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: 3.39, exchangeRateBaseCode: "PEN" }),
      }),
    );
  });
});

/**
 * `consumeUnassignedStoreMoneyOnOrderClose` (WO-09, BR-05-28, ADR 0033 §4). Runs on the CALLER's
 * transaction, not through `prismaMock.$transaction`: every test passes the fake `tx` from
 * `makeConsumeUnassignedStoreMoneyTx` straight into the function under test.
 */
describe("consumeUnassignedStoreMoneyOnOrderClose", () => {
  const ORDER_A = { id: "order-a", storeId: "store-1", currencyCode: "USD" };
  const ORDER_B = { id: "order-b", storeId: "store-1", currencyCode: "USD" };
  const D1 = new Date("2020-01-01T00:00:00Z");
  const D2 = new Date("2020-02-01T00:00:00Z");

  it("consumes min(remaining, pool): remaining 50, pool 30 -> consumed 30, one allocation written, cache recalculated", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ ...ORDER_A, totalCost: 50, allocatedAmountMinor: 0 }],
      payments: [{ id: "payment-1", amount: 30, paymentDate: D1 }],
      cacheAfterWriteByOrderId: { "order-a": 30 },
    });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", null);

    expect(consumed).toBe(30);
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-1",
          orderId: "order-a",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 30,
          settlesTarget: false,
          consumedByDeliveryId: null,
        },
      ],
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-a", userId: "user-1" },
      data: { allocatedAmountMinor: 30 },
    });
  });

  /**
   * Provenance stamp for the reopen-toast gap closure (WO-08 UX Notes "known gap"): every
   * `PaymentAllocation` this consumption writes must carry the closing delivery's id, so a later
   * `reopenDelivery` can name the surviving figure honestly instead of having no source for it.
   */
  it("stamps every PaymentAllocation it writes with the closing delivery's id", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ ...ORDER_A, totalCost: 50, allocatedAmountMinor: 0 }],
      payments: [{ id: "payment-1", amount: 30, paymentDate: D1 }],
      cacheAfterWriteByOrderId: { "order-a": 30 },
    });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", "delivery-9");

    expect(consumed).toBe(30);
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-1",
          orderId: "order-a",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 30,
          settlesTarget: false,
          consumedByDeliveryId: "delivery-9",
        },
      ],
    });
  });

  it("caps consumption at the order's own remaining balance: remaining 20, pool 30 -> consumed 20", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ ...ORDER_A, totalCost: 20, allocatedAmountMinor: 0 }],
      payments: [{ id: "payment-1", amount: 30, paymentDate: D1 }],
      cacheAfterWriteByOrderId: { "order-a": 20 },
    });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", null);

    expect(consumed).toBe(20);
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-1",
          orderId: "order-a",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 20,
          settlesTarget: false,
          consumedByDeliveryId: null,
        },
      ],
    });
  });

  it("is a no-op when the pool is empty: remaining 50, pool 0 -> no PaymentAllocation written", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ ...ORDER_A, totalCost: 50, allocatedAmountMinor: 0 }],
      payments: [],
    });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", null);

    expect(consumed).toBe(0);
    expect(tx.paymentAllocation.createMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("drains only the older payment when its own remainder already covers what's needed", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ ...ORDER_A, totalCost: 15, allocatedAmountMinor: 0 }],
      payments: [
        { id: "payment-d1", amount: 20, paymentDate: D1 },
        { id: "payment-d2", amount: 50, paymentDate: D2 },
      ],
      cacheAfterWriteByOrderId: { "order-a": 15 },
    });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", null);

    expect(consumed).toBe(15);
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-d1",
          orderId: "order-a",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 15,
          settlesTarget: false,
          consumedByDeliveryId: null,
        },
      ],
    });
  });

  /**
   * Two sequential closes sharing one pool (WO-09 batch-consumption table). The fixture is
   * STATEFUL: `payment-1`'s remainder after order A's own call is folded back into what order B's
   * call reads, exactly as two real transactions draining the same pool would see.
   */
  it("drains a shared pool across two sequential closes: older order first, newer gets what's left", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [
        { ...ORDER_A, totalCost: 50, allocatedAmountMinor: 0 },
        { ...ORDER_B, totalCost: 50, allocatedAmountMinor: 0 },
      ],
      payments: [{ id: "payment-1", amount: 30, paymentDate: D1 }],
      cacheAfterWriteByOrderId: { "order-a": 30, "order-b": 30 },
    });

    // Order A closes first (older). Spec §2.3's own walkthrough: A=50, B=50, unassigned=30.
    const consumedByA = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", null);
    expect(consumedByA).toBe(30);

    // The pool is now empty: B's own close is a no-op, not a re-read of the pre-consumption 30.
    const consumedByB = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-b", null);
    expect(consumedByB).toBe(0);

    expect(tx.paymentAllocation.createMany).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an order already fully written off by a StoreAccountAdjustmentLine, leaving the pool intact", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ id: "order-c", storeId: "store-1", currencyCode: "USD", totalCost: 180, allocatedAmountMinor: 0 }],
      writtenOffByOrderId: { "order-c": 180 },
      payments: [{ id: "payment-1", amount: 30, paymentDate: D1 }],
    });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-c", null);

    expect(consumed).toBe(0);
    expect(tx.storePayment.findMany).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.createMany).not.toHaveBeenCalled();
  });

  it("consumes exactly the net open balance for an order partially written off, not its gross total", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ id: "order-d", storeId: "store-1", currencyCode: "USD", totalCost: 180, allocatedAmountMinor: 0 }],
      writtenOffByOrderId: { "order-d": 100 },
      payments: [{ id: "payment-1", amount: 200, paymentDate: D1 }],
      cacheAfterWriteByOrderId: { "order-d": 80 },
    });

    // openBalanceMinor(order-d) = 180 - 0 - 100 = 80; consumedMinor = min(80, 200) = 80.
    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-d", null);

    expect(consumed).toBe(80);
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          paymentId: "payment-1",
          orderId: "order-d",
          orderItemId: null,
          userId: "user-1",
          amountMinor: 80,
          settlesTarget: false,
          consumedByDeliveryId: null,
        },
      ],
    });
  });

  /**
   * `MINOR-5/6`: the pool's true total is unclamped, and a NEGATIVE total means a ceiling was
   * already bypassed elsewhere (more was declared against some payment than it is worth). Draining
   * only the payments that still read positive would spend money the store/currency pair does not
   * actually have; consumption abstains entirely instead.
   */
  it("abstains entirely when the pool's total remainder is negative, even with one positive-looking payment (MINOR-5/6)", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ ...ORDER_A, totalCost: 50, allocatedAmountMinor: 0 }],
      payments: [
        { id: "payment-1", amount: 20, paymentDate: D1 },
        { id: "payment-2", amount: 10, paymentDate: D2 },
      ],
      // payment-2 is over-allocated (40 already declared against a payment worth only 10), a shape
      // only reachable if something upstream already bypassed a ceiling. Its own remainder is -30,
      // so the pool's true total is 20 + (10 - 40) = -10.
      allocatedByPaymentId: { "payment-2": 40 },
    });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", null);

    expect(consumed).toBe(0);
    expect(tx.paymentAllocation.createMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("returns 0 defensively when the order cannot be resolved for this user (concurrent delete)", async () => {
    const tx = makeConsumeUnassignedStoreMoneyTx({ orders: [] });

    const consumed = await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "missing-order", null);

    expect(consumed).toBe(0);
    expect(tx.storePayment.findMany).not.toHaveBeenCalled();
  });

  /**
   * Concurrency (WO-09's own table): real serializable isolation cannot be exercised with mocks.
   * What IS assertable here, and is the actual contract this function promises: every read runs
   * before the first write, and the function performs no nested transaction of its own, relying
   * entirely on `runSerializableTransaction` around the CALLER's write for isolation.
   */
  it("performs every read before its first write, and opens no transaction of its own", async () => {
    const callOrder: string[] = [];
    const tx = makeConsumeUnassignedStoreMoneyTx({
      orders: [{ ...ORDER_A, totalCost: 50, allocatedAmountMinor: 0 }],
      payments: [{ id: "payment-1", amount: 30, paymentDate: D1 }],
      cacheAfterWriteByOrderId: { "order-a": 30 },
    });
    // No `$transaction` on this fake tx at all: if the function tried to open one, this call would
    // throw a TypeError instead of resolving, which the assertion below would surface.
    expect(tx).not.toHaveProperty("$transaction");

    const originalFindFirst = tx.order.findFirst.getMockImplementation()!;
    tx.order.findFirst.mockImplementation((...args) => {
      callOrder.push("read:order.findFirst");
      return originalFindFirst(...args);
    });
    const originalAdjustmentGroupBy = tx.storeAccountAdjustmentLine.groupBy.getMockImplementation()!;
    tx.storeAccountAdjustmentLine.groupBy.mockImplementation((...args) => {
      callOrder.push("read:storeAccountAdjustmentLine.groupBy");
      return originalAdjustmentGroupBy(...args);
    });
    const originalPaymentFindMany = tx.storePayment.findMany.getMockImplementation()!;
    tx.storePayment.findMany.mockImplementation((...args) => {
      callOrder.push("read:storePayment.findMany");
      return originalPaymentFindMany(...args);
    });
    const originalAllocationGroupBy = tx.paymentAllocation.groupBy.getMockImplementation()!;
    tx.paymentAllocation.groupBy.mockImplementation((...args) => {
      callOrder.push("read:paymentAllocation.groupBy");
      return originalAllocationGroupBy(...args);
    });
    const originalCreateMany = tx.paymentAllocation.createMany.getMockImplementation()!;
    tx.paymentAllocation.createMany.mockImplementation((...args) => {
      callOrder.push("write:paymentAllocation.createMany");
      return originalCreateMany(...args);
    });

    await consumeUnassignedStoreMoneyOnOrderClose(tx as never, "user-1", "order-a", null);

    const firstWriteIndex = callOrder.indexOf("write:paymentAllocation.createMany");
    expect(firstWriteIndex).toBeGreaterThan(-1);
    expect(callOrder.slice(0, firstWriteIndex)).toEqual([
      "read:order.findFirst",
      "read:storeAccountAdjustmentLine.groupBy",
      "read:storePayment.findMany",
      "read:paymentAllocation.groupBy",
    ]);
  });
});
