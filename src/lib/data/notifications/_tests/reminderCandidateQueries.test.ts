import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeliveryStatus,
  NotificationSubjectType,
  NotificationType,
  OrderItemDeliveryState,
  OrderStatus,
} from "../../../../../generated/prisma/client";
import {
  getArrivalDueCandidates,
  getArrivalOverdueCandidates,
  getPaymentDueCandidates,
} from "../reminderCandidateQueries";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findMany: vi.fn() },
    delivery: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const NOW = new Date("2026-07-14T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.delivery.findMany.mockResolvedValue([]);
});

describe("getPaymentDueCandidates", () => {
  it("queries non-cancelled orders with an active subscription over a coarse forward window", async () => {
    await getPaymentDueCandidates(NOW);

    const where = prismaMock.order.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: OrderStatus.CANCELLED });
    expect(where.user).toEqual({ pushSubscriptions: { some: {} } });
    // Coarse window: [now - 1d, now + lead(3d) + 1d].
    expect(where.expectedDeliveryFrom.gte).toEqual(new Date("2026-07-13T12:00:00Z"));
    expect(where.expectedDeliveryFrom.lte).toEqual(new Date("2026-07-18T12:00:00Z"));
  });

  it("selects the collector's stored locale so the payload can be localized", async () => {
    await getPaymentDueCandidates(NOW);

    const select = prismaMock.order.findMany.mock.calls[0][0].select;
    expect(select.user).toEqual({ select: { timezone: true, locale: true } });
  });

  it("keeps only orders with an outstanding balance and maps them to candidates", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([
      {
        id: "order-outstanding",
        userId: "user-1",
        expectedDeliveryFrom: new Date("2026-07-15T00:00:00Z"),
        totalCost: 10000,
        allocatedAmountMinor: 4000,
        store: { name: "Panda Store" },
        user: { timezone: "America/Lima", locale: "en" },
      },
      {
        id: "order-paid",
        userId: "user-1",
        expectedDeliveryFrom: new Date("2026-07-15T00:00:00Z"),
        totalCost: 10000,
        allocatedAmountMinor: 10000,
        store: { name: "Paid Store" },
        user: { timezone: null, locale: null },
      },
    ]);

    const candidates = await getPaymentDueCandidates(NOW);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      userId: "user-1",
      type: NotificationType.PAYMENT_DUE,
      subjectType: NotificationSubjectType.ORDER,
      subjectId: "order-outstanding",
      dueDate: new Date("2026-07-15T00:00:00Z"),
      descriptor: "Panda Store",
      locale: "en",
      timezone: "America/Lima",
    });
  });
});

describe("getArrivalDueCandidates", () => {
  it("filters not-yet-arrived orders and IN_TRANSIT deliveries in the arrival window", async () => {
    await getArrivalDueCandidates(NOW);

    const orderWhere = prismaMock.order.findMany.mock.calls[0][0].where;
    expect(orderWhere.status).toEqual({ not: OrderStatus.CANCELLED });
    expect(orderWhere.items).toEqual({ none: { deliveryState: { not: OrderItemDeliveryState.NONE } } });
    expect(orderWhere.user).toEqual({ pushSubscriptions: { some: {} } });

    const deliveryWhere = prismaMock.delivery.findMany.mock.calls[0][0].where;
    expect(deliveryWhere.status).toBe(DeliveryStatus.IN_TRANSIT);
    expect(deliveryWhere.expectedArrivalFrom.gte).toEqual(new Date("2026-07-13T12:00:00Z"));
    expect(deliveryWhere.expectedArrivalFrom.lte).toEqual(new Date("2026-07-18T12:00:00Z"));
  });

  it("maps orders and deliveries to arrival-due candidates with the right subject type", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([
      {
        id: "order-1",
        userId: "user-1",
        expectedDeliveryFrom: new Date("2026-07-15T00:00:00Z"),
        store: { name: "Order Store" },
        user: { timezone: null, locale: null },
      },
    ]);
    prismaMock.delivery.findMany.mockResolvedValueOnce([
      {
        id: "delivery-1",
        userId: "user-2",
        expectedArrivalFrom: new Date("2026-07-16T00:00:00Z"),
        store: { name: "Delivery Store" },
        user: { timezone: "UTC", locale: "en" },
      },
    ]);

    const candidates = await getArrivalDueCandidates(NOW);

    expect(candidates).toEqual([
      {
        userId: "user-1",
        type: NotificationType.ARRIVAL_DUE,
        subjectType: NotificationSubjectType.ORDER,
        subjectId: "order-1",
        dueDate: new Date("2026-07-15T00:00:00Z"),
        descriptor: "Order Store",
        locale: null,
        timezone: null,
      },
      {
        userId: "user-2",
        type: NotificationType.ARRIVAL_DUE,
        subjectType: NotificationSubjectType.DELIVERY,
        subjectId: "delivery-1",
        dueDate: new Date("2026-07-16T00:00:00Z"),
        descriptor: "Delivery Store",
        locale: "en",
        timezone: "UTC",
      },
    ]);
  });
});

describe("getArrivalOverdueCandidates", () => {
  it("uses the reference-date OR clause bounded by now + padding", async () => {
    await getArrivalOverdueCandidates(NOW);

    const orderWhere = prismaMock.order.findMany.mock.calls[0][0].where;
    expect(orderWhere.OR).toEqual([
      { expectedDeliveryTo: { lt: new Date("2026-07-15T12:00:00Z") } },
      { expectedDeliveryTo: null, expectedDeliveryFrom: { lt: new Date("2026-07-15T12:00:00Z") } },
    ]);

    const deliveryWhere = prismaMock.delivery.findMany.mock.calls[0][0].where;
    expect(deliveryWhere.status).toBe(DeliveryStatus.IN_TRANSIT);
    expect(deliveryWhere.OR).toEqual([
      { expectedArrivalTo: { lt: new Date("2026-07-15T12:00:00Z") } },
      { expectedArrivalTo: null, expectedArrivalFrom: { lt: new Date("2026-07-15T12:00:00Z") } },
    ]);
  });

  it("resolves the reference date as `to ?? from` for the dedup key", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([
      {
        id: "order-to",
        userId: "user-1",
        expectedDeliveryFrom: new Date("2026-07-01T00:00:00Z"),
        expectedDeliveryTo: new Date("2026-07-05T00:00:00Z"),
        store: { name: "Store A" },
        user: { timezone: null, locale: "en" },
      },
      {
        id: "order-from-only",
        userId: "user-1",
        expectedDeliveryFrom: new Date("2026-07-02T00:00:00Z"),
        expectedDeliveryTo: null,
        store: { name: "Store B" },
        user: { timezone: null, locale: null },
      },
    ]);

    const candidates = await getArrivalOverdueCandidates(NOW);

    expect(candidates.map((candidate) => candidate.dueDate)).toEqual([
      new Date("2026-07-05T00:00:00Z"),
      new Date("2026-07-02T00:00:00Z"),
    ]);
    expect(candidates[0].type).toBe(NotificationType.ARRIVAL_OVERDUE);
    // A stored locale flows through; a collector without one stays null and the dispatcher
    // falls back to the default locale.
    expect(candidates.map((candidate) => candidate.locale)).toEqual(["en", null]);
  });
});
