import { Prisma, NotificationType, NotificationSubjectType } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PushSubscriptionInput } from "@/lib/notifications/notificationValidation";

type PreferenceColumn = "paymentDueEnabled" | "arrivalDueEnabled" | "arrivalOverdueEnabled";

const PREFERENCE_COLUMN_BY_TYPE: Record<NotificationType, PreferenceColumn> = {
  [NotificationType.PAYMENT_DUE]: "paymentDueEnabled",
  [NotificationType.ARRIVAL_DUE]: "arrivalDueEnabled",
  [NotificationType.ARRIVAL_OVERDUE]: "arrivalOverdueEnabled",
};

const UNIQUE_CONSTRAINT_ERROR = "P2002";

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_ERROR;
}

/**
 * Upserts a browser push subscription keyed by its unique endpoint. The `userId`
 * is always taken from the session-scoped argument (never free input) on both
 * create and update, so re-subscribing claims the browser endpoint for the
 * current collector and keeps ownership unambiguous.
 */
export async function upsertPushSubscription(userId: string, input: PushSubscriptionInput) {
  const now = new Date();

  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent,
      lastSeenAt: now,
    },
    update: {
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent,
      lastSeenAt: now,
    },
  });
}

/**
 * Removes a collector's own subscription. Ownership-scoped by `endpoint` plus
 * `userId` so one collector can never unsubscribe another's endpoint.
 */
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
}

/**
 * Prunes an expired subscription from the send path. Driven by the transport's
 * `410`/`404` signal, so it deletes by the unique `endpoint` alone.
 */
export async function pruneExpiredPushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Sets a single per-type preference for a collector, creating the preference row
 * with all-true defaults on first write and updating only the toggled column
 * thereafter.
 */
export async function setNotificationPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  const column = PREFERENCE_COLUMN_BY_TYPE[type];
  const columnValue = { [column]: enabled } as Record<PreferenceColumn, boolean>;

  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...columnValue },
    update: columnValue,
  });
}

export interface RecordNotificationDeliveryInput {
  userId: string;
  type: NotificationType;
  subjectType: NotificationSubjectType;
  subjectId: string;
  dueDate: Date;
}

/**
 * Records a delivery in a dedup-safe way. The `(userId, type, subjectId, dueDate)`
 * unique constraint guarantees once-only delivery at the database level; a
 * concurrent or repeated write surfaces as `P2002`, which is swallowed and
 * reported as `recorded: false` so the caller stays idempotent.
 */
export async function recordNotificationDelivery(
  input: RecordNotificationDeliveryInput,
): Promise<{ recorded: boolean }> {
  try {
    await prisma.notificationDelivery.create({
      data: {
        userId: input.userId,
        type: input.type,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        dueDate: input.dueDate,
      },
    });
    return { recorded: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { recorded: false };
    }
    throw error;
  }
}
