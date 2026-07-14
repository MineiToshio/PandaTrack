import { NotificationType } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * A collector's per-type reminder preferences, normalized so every reminder type
 * always has a boolean. Collectors without a stored row are treated as fully
 * opted in (all defaults `true`).
 */
export type NotificationPreferenceMap = Record<NotificationType, boolean>;

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceMap = {
  [NotificationType.PAYMENT_DUE]: true,
  [NotificationType.ARRIVAL_DUE]: true,
  [NotificationType.ARRIVAL_OVERDUE]: true,
};

/**
 * Returns every active push subscription for a collector. Expired endpoints are
 * pruned on the send path, so every persisted row is by definition active.
 */
export async function getUserPushSubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
}

/**
 * Returns the collector's per-type preferences, synthesizing all-true defaults
 * when no row exists so callers never branch on a missing record.
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferenceMap> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: {
      paymentDueEnabled: true,
      arrivalDueEnabled: true,
      arrivalOverdueEnabled: true,
    },
  });

  if (!row) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    [NotificationType.PAYMENT_DUE]: row.paymentDueEnabled,
    [NotificationType.ARRIVAL_DUE]: row.arrivalDueEnabled,
    [NotificationType.ARRIVAL_OVERDUE]: row.arrivalOverdueEnabled,
  };
}

/**
 * Reports whether a reminder for this exact subject and due date was already
 * sent, using the same key as the `NotificationDelivery` unique constraint.
 */
export async function hasNotificationBeenDelivered(
  userId: string,
  type: NotificationType,
  subjectId: string,
  dueDate: Date,
): Promise<boolean> {
  const existing = await prisma.notificationDelivery.findUnique({
    where: { userId_type_subjectId_dueDate: { userId, type, subjectId, dueDate } },
    select: { id: true },
  });

  return existing !== null;
}
