import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import { createStorePayment, deleteStorePayment } from "../storePaymentMutations";
import { makeCreateStorePaymentTx, makeFixtureOrder, runStorePaymentTx } from "./storePaymentFixtures";

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
    // the cache refresh itself is sorted ascending by id, asserted below via `order.update`.
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
    expect(tx.order.update).toHaveBeenNthCalledWith(1, {
      where: { id: "order-1" },
      data: { allocatedAmountMinor: 300 },
    });
    expect(tx.order.update).toHaveBeenNthCalledWith(2, {
      where: { id: "order-2" },
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
    expect(tx.order.update).not.toHaveBeenCalled();
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
        update: vi.fn().mockResolvedValue({}),
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
    expect(tx.order.update).toHaveBeenCalledTimes(2);
  });

  it("deletes an unallocated (a cuenta) payment without touching any order", async () => {
    const tx = makeDeleteTx({ payment: { id: "payment-1", allocations: [] } });
    runStorePaymentTx(prismaMock, tx);

    const result = await deleteStorePayment("payment-1", "user-1");

    expect(result).toEqual({ ok: true, affectedOrderIds: [] });
    expect(tx.storePayment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(tx.paymentAllocation.groupBy).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
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
