import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma, NotificationSubjectType, NotificationType } from "../../../../../generated/prisma/client";
import {
  pruneExpiredPushSubscription,
  recordNotificationDelivery,
  removePushSubscription,
  setNotificationPreference,
  upsertPushSubscription,
} from "../notificationMutations";
import type { PushSubscriptionInput } from "@/lib/notifications/notificationValidation";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    notificationPreference: {
      upsert: vi.fn(),
    },
    notificationDelivery: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const subscriptionInput: PushSubscriptionInput = {
  endpoint: "https://push.example.com/endpoint-1",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
  userAgent: "Mozilla/5.0",
};

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("upsertPushSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts by endpoint and always writes the session userId on create and update", async () => {
    prismaMock.pushSubscription.upsert.mockResolvedValueOnce({ id: "sub-1" });

    await upsertPushSubscription("user-1", subscriptionInput);

    const args = prismaMock.pushSubscription.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ endpoint: subscriptionInput.endpoint });
    expect(args.create).toMatchObject({
      userId: "user-1",
      endpoint: subscriptionInput.endpoint,
      p256dh: "p256dh-key",
      auth: "auth-key",
    });
    expect(args.update).toMatchObject({ userId: "user-1", p256dh: "p256dh-key", auth: "auth-key" });
  });
});

describe("removePushSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes scoped by endpoint and userId", async () => {
    prismaMock.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 });

    await removePushSubscription("user-1", subscriptionInput.endpoint);

    expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: subscriptionInput.endpoint, userId: "user-1" },
    });
  });
});

describe("pruneExpiredPushSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes by endpoint alone", async () => {
    prismaMock.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 });

    await pruneExpiredPushSubscription(subscriptionInput.endpoint);

    expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: subscriptionInput.endpoint },
    });
  });
});

describe("setNotificationPreference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps the reminder type to its column on both create and update", async () => {
    prismaMock.notificationPreference.upsert.mockResolvedValueOnce({ userId: "user-1" });

    await setNotificationPreference("user-1", NotificationType.ARRIVAL_OVERDUE, false);

    const args = prismaMock.notificationPreference.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1" });
    expect(args.create).toEqual({ userId: "user-1", arrivalOverdueEnabled: false });
    expect(args.update).toEqual({ arrivalOverdueEnabled: false });
  });
});

describe("recordNotificationDelivery", () => {
  beforeEach(() => vi.clearAllMocks());

  const input = {
    userId: "user-1",
    type: NotificationType.PAYMENT_DUE,
    subjectType: NotificationSubjectType.ORDER,
    subjectId: "order-1",
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
  };

  it("records a fresh delivery", async () => {
    prismaMock.notificationDelivery.create.mockResolvedValueOnce({ id: "delivery-1" });

    const result = await recordNotificationDelivery(input);

    expect(result).toEqual({ recorded: true });
    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: NotificationType.PAYMENT_DUE,
        subjectType: NotificationSubjectType.ORDER,
        subjectId: "order-1",
        dueDate: input.dueDate,
      },
    });
  });

  it("swallows the unique-constraint violation and reports recorded false", async () => {
    prismaMock.notificationDelivery.create.mockRejectedValueOnce(uniqueConstraintError());

    const result = await recordNotificationDelivery(input);

    expect(result).toEqual({ recorded: false });
  });

  it("rethrows non-unique errors", async () => {
    prismaMock.notificationDelivery.create.mockRejectedValueOnce(new Error("connection lost"));

    await expect(recordNotificationDelivery(input)).rejects.toThrow("connection lost");
  });
});
