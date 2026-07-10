import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isWholeMajorAmount, isZeroDecimalCurrency } from "@/lib/currency";
import { calculatePaymentSummary, type PaymentSummary } from "@/lib/orders/paymentSummary";

// Adding a payment reads the current balance and then writes; under concurrent submissions a
// plain transaction can double-count against a stale balance. Serializable isolation makes the
// read-then-write conflict detectable; the DB aborts the loser with a serialization failure
// (P2034), which we retry a bounded number of times before surfacing the error.
const SERIALIZATION_FAILURE_CODE = "P2034";
const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === SERIALIZATION_FAILURE_CODE;
}

type PaymentRecord = {
  id: string;
  amount: number;
  paymentDate: Date;
};

type PaymentMutationSuccess = PaymentSummary & {
  payments: PaymentRecord[];
};

type AddPaymentParams = {
  orderId: string;
  userId: string;
  amount: number;
  paymentDate: Date;
};

type DeletePaymentParams = {
  paymentId: string;
  orderId: string;
  userId: string;
};

type AddPaymentResult =
  | ({ ok: true; paymentId: string } & PaymentMutationSuccess)
  | {
      ok: false;
      error: "ORDER_NOT_FOUND" | "EXCEEDS_BALANCE" | "DATE_BEFORE_ORDER" | "AMOUNT_FRACTIONAL_SUBUNITS";
    };

type DeletePaymentResult = ({ ok: true } & PaymentMutationSuccess) | { ok: false; error: "NOT_FOUND" };

export async function addOrderPayment({
  orderId,
  userId,
  amount,
  paymentDate,
}: AddPaymentParams): Promise<AddPaymentResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: orderId, userId },
            select: { id: true, totalCost: true, orderDate: true, currencyCode: true },
          });

          if (!order) {
            return { ok: false, error: "ORDER_NOT_FOUND" };
          }

          // Server-side defense: a zero-decimal currency (CLP/JPY/KRW) has no subunit, so a
          // payment must resolve to a whole major amount. The client parser already rejects
          // fractional input, but guard here too so a crafted request can't persist a
          // fractional ×100 amount that would never render back correctly.
          if (isZeroDecimalCurrency(order.currencyCode) && !isWholeMajorAmount(amount)) {
            return { ok: false, error: "AMOUNT_FRACTIONAL_SUBUNITS" };
          }

          if (paymentDate < order.orderDate) {
            return { ok: false, error: "DATE_BEFORE_ORDER" };
          }

          const existingPayments = await tx.orderPayment.findMany({
            where: { orderId, userId },
            select: { id: true, amount: true, paymentDate: true },
            orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
          });

          const { remainingAmount } = calculatePaymentSummary(order.totalCost, existingPayments);

          if (amount > remainingAmount) {
            return { ok: false, error: "EXCEEDS_BALANCE" };
          }

          const payment = await tx.orderPayment.create({
            data: { orderId, userId, amount, paymentDate },
            select: { id: true },
          });

          const updatedPayments = await tx.orderPayment.findMany({
            where: { orderId, userId },
            select: { id: true, amount: true, paymentDate: true },
            orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
          });

          const summary = calculatePaymentSummary(order.totalCost, updatedPayments);

          return { ok: true, paymentId: payment.id, ...summary, payments: updatedPayments };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_RETRIES) {
        continue;
      }
      throw error;
    }
  }
}

export async function deleteOrderPayment({
  paymentId,
  orderId,
  userId,
}: DeletePaymentParams): Promise<DeletePaymentResult> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.orderPayment.findFirst({
      where: { id: paymentId, userId },
      select: {
        id: true,
        amount: true,
        order: { select: { totalCost: true, currencyCode: true } },
      },
    });

    if (!payment) {
      return { ok: false as const, error: "NOT_FOUND" as const };
    }

    await tx.orderPayment.delete({ where: { id: paymentId } });

    const updatedPayments = await tx.orderPayment.findMany({
      where: { orderId, userId },
      select: { id: true, amount: true, paymentDate: true },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });

    const summary = calculatePaymentSummary(payment.order.totalCost, updatedPayments);

    return { ok: true as const, ...summary, payments: updatedPayments };
  });
}
