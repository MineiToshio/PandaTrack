import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { appendOrderHistoryEntry, OrderHistoryEventType } from "./orderHistoryMutations";

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

type AddPaymentResult = { ok: true; paymentId: string } | { ok: false; error: "ORDER_NOT_FOUND" | "UNAUTHORIZED" };

type DeletePaymentResult = { ok: true } | { ok: false; error: "PAYMENT_NOT_FOUND" | "UNAUTHORIZED" };

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
      select: { id: true },
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
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

    return { ok: true, paymentId: payment.id };
  });
}

export async function deleteOrderPayment({
  paymentId,
  orderId,
  userId,
}: DeletePaymentParams): Promise<DeletePaymentResult> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.orderPayment.findFirst({
      where: { id: paymentId, orderId, userId },
      select: {
        id: true,
        amount: true,
        order: { select: { currencyCode: true } },
      },
    });

    if (!payment) {
      return { ok: false as const, error: "PAYMENT_NOT_FOUND" as const };
    }

    await tx.orderPayment.delete({ where: { id: paymentId } });

    await appendOrderHistoryEntry({
      tx,
      orderId,
      userId,
      eventType: OrderHistoryEventType.PAYMENT_DELETED,
      metadata: { amount: payment.amount, currencyCode: payment.order.currencyCode },
    });

    return { ok: true as const };
  });
}
