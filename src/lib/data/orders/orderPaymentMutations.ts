import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculatePaymentSummary, type PaymentSummary } from "@/lib/orders/paymentSummary";
import { appendOrderHistoryEntry, OrderHistoryEventType } from "./orderHistoryMutations";

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
  currencyCode: string;
};

type DeletePaymentParams = {
  paymentId: string;
  orderId: string;
  userId: string;
};

type AddPaymentResult =
  | ({ ok: true; paymentId: string } & PaymentMutationSuccess)
  | { ok: false; error: "ORDER_NOT_FOUND" | "EXCEEDS_BALANCE" | "DATE_BEFORE_ORDER" };

type DeletePaymentResult = ({ ok: true } & PaymentMutationSuccess) | { ok: false; error: "NOT_FOUND" };

export async function addOrderPayment({
  orderId,
  userId,
  amount,
  paymentDate,
  currencyCode,
}: AddPaymentParams): Promise<AddPaymentResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, totalCost: true, orderDate: true },
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
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

    await appendOrderHistoryEntry({
      tx,
      orderId,
      userId,
      eventType: OrderHistoryEventType.PAYMENT_ADDED,
      metadata: { amount, currencyCode },
    });

    const updatedPayments = await tx.orderPayment.findMany({
      where: { orderId, userId },
      select: { id: true, amount: true, paymentDate: true },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });

    const summary = calculatePaymentSummary(order.totalCost, updatedPayments);

    return { ok: true, paymentId: payment.id, ...summary, payments: updatedPayments };
  });
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

    await appendOrderHistoryEntry({
      tx,
      orderId,
      userId,
      eventType: OrderHistoryEventType.PAYMENT_DELETED,
      metadata: { amount: payment.amount, currencyCode: payment.order.currencyCode },
    });

    const updatedPayments = await tx.orderPayment.findMany({
      where: { orderId, userId },
      select: { id: true, amount: true, paymentDate: true },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });

    const summary = calculatePaymentSummary(payment.order.totalCost, updatedPayments);

    return { ok: true as const, ...summary, payments: updatedPayments };
  });
}
