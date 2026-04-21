import type { Prisma } from "../../../../generated/prisma/client";
import { OrderHistoryEventType } from "../../../../generated/prisma/client";

type AppendHistoryParams = {
  tx: Prisma.TransactionClient;
  orderId: string;
  userId: string;
  eventType: OrderHistoryEventType;
  metadata?: Prisma.InputJsonValue;
};

export async function appendOrderHistoryEntry({
  tx,
  orderId,
  userId,
  eventType,
  metadata = {},
}: AppendHistoryParams): Promise<void> {
  await tx.orderHistory.create({
    data: { orderId, userId, eventType, metadata },
  });
}

export { OrderHistoryEventType };
