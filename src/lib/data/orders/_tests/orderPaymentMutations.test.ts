import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "../../../../../generated/prisma/client";
import { addOrderPayment } from "../orderPaymentMutations";

const ORDER_DATE = new Date("2020-01-01T00:00:00Z");
const PAYMENT_DATE = new Date("2020-06-01T00:00:00Z");

type TxOverrides = {
  totalCost?: number;
  currencyCode?: string;
  existingPayments?: Array<{ id: string; amount: number; paymentDate: Date }>;
};

function makeTx({ totalCost = 10000, currencyCode = "USD", existingPayments = [] }: TxOverrides = {}) {
  const createdPayment = { id: "payment-new" };
  const updatedPayments = [...existingPayments, { id: createdPayment.id, amount: 0, paymentDate: PAYMENT_DATE }];
  return {
    order: {
      findFirst: vi.fn().mockResolvedValue({ id: "order-1", totalCost, orderDate: ORDER_DATE, currencyCode }),
      // Success path refreshes the denormalized payment cache on the order.
      update: vi.fn().mockResolvedValue({ id: "order-1" }),
    },
    orderPayment: {
      findMany: vi.fn().mockResolvedValueOnce(existingPayments).mockResolvedValueOnce(updatedPayments),
      create: vi.fn().mockResolvedValue(createdPayment),
    },
  };
}

const params = { orderId: "order-1", userId: "user-1", amount: 1000, paymentDate: PAYMENT_DATE };

describe("addOrderPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the payment transaction at Serializable isolation", async () => {
    const tx = makeTx();
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));

    await addOrderPayment(params);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    );
  });

  it("refreshes the denormalized payment cache with the new paid amount and percentage", async () => {
    const tx = makeTx({ totalCost: 10000, existingPayments: [{ id: "p1", amount: 3000, paymentDate: ORDER_DATE }] });
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));

    await addOrderPayment(params);

    // updatedPayments sums to 3000 (the mocked new payment carries amount 0), 30% of 10000.
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { paidAmountMinor: 3000, paymentPercent: 30 },
    });
  });

  it("rejects a payment that exceeds the remaining balance without creating it", async () => {
    const tx = makeTx({ totalCost: 10000, existingPayments: [{ id: "p1", amount: 8000, paymentDate: ORDER_DATE }] });
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));

    const result = await addOrderPayment({ ...params, amount: 5000 });

    expect(result).toEqual({ ok: false, error: "EXCEEDS_BALANCE" });
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
  });

  it("rejects a fractional amount on a zero-decimal currency without creating it", async () => {
    // 43000.50 CLP would scale to 4300050 minor units — not a whole major amount for a currency
    // with no subunit, so the server guard must refuse it even though it fits the balance.
    const tx = makeTx({ totalCost: 5000000, currencyCode: "CLP" });
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));

    const result = await addOrderPayment({ ...params, amount: 4300050 });

    expect(result).toEqual({ ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" });
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
  });

  it("accepts a whole major amount on a zero-decimal currency", async () => {
    const tx = makeTx({ totalCost: 5000000, currencyCode: "CLP" });
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));

    const result = await addOrderPayment({ ...params, amount: 4300000 });

    expect(result).toMatchObject({ ok: true });
    expect(tx.orderPayment.create).toHaveBeenCalled();
  });

  it("retries once and succeeds when the first attempt hits a serialization failure (P2034)", async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    let calls = 0;
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => {
      calls += 1;
      if (calls === 1) {
        throw serializationError;
      }
      return cb(makeTx());
    });

    const result = await addOrderPayment(params);

    expect(calls).toBe(2);
    expect(result).toMatchObject({ ok: true });
  });

  it("gives up and rethrows after exhausting the serialization retries", async () => {
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
    const otherError = new Error("boom");
    prismaMock.$transaction.mockRejectedValue(otherError);

    await expect(addOrderPayment(params)).rejects.toBe(otherError);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
