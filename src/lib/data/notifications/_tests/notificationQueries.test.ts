import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationType } from "../../../../../generated/prisma/client";
import {
  getNotificationPreferences,
  getUserPushSubscriptions,
  hasNotificationBeenDelivered,
} from "../notificationQueries";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    pushSubscription: {
      findMany: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
    },
    notificationDelivery: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("getUserPushSubscriptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns every subscription for the collector", async () => {
    const rows = [{ id: "sub-1", endpoint: "https://push.example.com/1", p256dh: "k", auth: "a" }];
    prismaMock.pushSubscription.findMany.mockResolvedValueOnce(rows);

    const result = await getUserPushSubscriptions("user-1");

    expect(result).toBe(rows);
    expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  });
});

describe("getNotificationPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("synthesizes all-true defaults when no row exists", async () => {
    prismaMock.notificationPreference.findUnique.mockResolvedValueOnce(null);

    const result = await getNotificationPreferences("user-1");

    expect(result).toEqual({
      [NotificationType.PAYMENT_DUE]: true,
      [NotificationType.ARRIVAL_DUE]: true,
      [NotificationType.ARRIVAL_OVERDUE]: true,
    });
  });

  it("maps the stored row to the normalized preference map", async () => {
    prismaMock.notificationPreference.findUnique.mockResolvedValueOnce({
      paymentDueEnabled: false,
      arrivalDueEnabled: true,
      arrivalOverdueEnabled: false,
    });

    const result = await getNotificationPreferences("user-1");

    expect(result).toEqual({
      [NotificationType.PAYMENT_DUE]: false,
      [NotificationType.ARRIVAL_DUE]: true,
      [NotificationType.ARRIVAL_OVERDUE]: false,
    });
  });
});

describe("hasNotificationBeenDelivered", () => {
  beforeEach(() => vi.clearAllMocks());

  const dueDate = new Date("2026-07-20T00:00:00.000Z");

  it("returns true when a delivery row exists", async () => {
    prismaMock.notificationDelivery.findUnique.mockResolvedValueOnce({ id: "delivery-1" });

    const result = await hasNotificationBeenDelivered("user-1", NotificationType.PAYMENT_DUE, "order-1", dueDate);

    expect(result).toBe(true);
    expect(prismaMock.notificationDelivery.findUnique).toHaveBeenCalledWith({
      where: {
        userId_type_subjectId_dueDate: {
          userId: "user-1",
          type: NotificationType.PAYMENT_DUE,
          subjectId: "order-1",
          dueDate,
        },
      },
      select: { id: true },
    });
  });

  it("returns false when no delivery row exists", async () => {
    prismaMock.notificationDelivery.findUnique.mockResolvedValueOnce(null);

    const result = await hasNotificationBeenDelivered("user-1", NotificationType.ARRIVAL_DUE, "delivery-1", dueDate);

    expect(result).toBe(false);
  });
});
