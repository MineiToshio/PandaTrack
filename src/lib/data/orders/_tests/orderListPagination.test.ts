import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OrderStatus } from "../../../../../generated/prisma/client";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getOrdersList } from "../orderQueries";
import type { OrdersListPageFilters } from "../orderQueries";

type OrderRow = {
  id: string;
  humanReadableId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  totalCost: number;
  status: OrderStatus;
  store: { id: string; name: string; slug: string };
  items: never[];
  paidAmountMinor: number;
  paymentPercent: number;
};

/**
 * Builds a row already shaped like the Prisma select in getOrdersList. Filtering, sorting, and
 * pagination now run in SQL, so these tests assert the query the function hands to Prisma (the
 * `where`/`orderBy`/`skip`/`take`) and how it maps the persisted payment cache — the DB itself
 * owns applying them, which is exactly what removes the old in-memory `take: 1000` path.
 */
function makeRow(id: string, overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id,
    humanReadableId: `ORD-${id}`,
    orderDate: new Date(2026, 0, 1),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "USD",
    exchangeRate: null,
    totalCost: 10_000,
    status: "OPEN" as OrderStatus,
    store: { id: "store-1", name: "Store One", slug: "store-one" },
    items: [],
    paidAmountMinor: 0,
    paymentPercent: 0,
    ...overrides,
  };
}

function baseFilters(overrides: Partial<OrdersListPageFilters> = {}): OrdersListPageFilters {
  return { sort: "recent", page: 1, pageSize: 2, ...overrides };
}

function findManyArgs(callIndex = 0) {
  return prismaMock.order.findMany.mock.calls[callIndex][0] as {
    where: { AND?: Array<Record<string, unknown>> };
    orderBy: unknown;
    skip?: number;
    take?: number;
  };
}

function paymentBranch(callIndex = 0) {
  const groups = findManyArgs(callIndex).where.AND ?? [];
  return groups.find((group) => "OR" in group) as { OR: Array<Record<string, unknown>> } | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.order.count.mockResolvedValue(0);
});

describe("getOrdersList SQL payment-state pagination", () => {
  it("pushes the payment-state filter into SQL and paginates natively (no in-memory full fetch)", async () => {
    prismaMock.order.count.mockResolvedValue(5);

    await getOrdersList("user-1", baseFilters({ paymentStates: ["paid"], page: 2, pageSize: 2 }));

    const args = findManyArgs();
    // Native skip/take pagination — the removed path used `take: 1000` with no skip.
    expect(args.skip).toBe(2);
    expect(args.take).toBe(2);
    // The paid state maps onto the persisted paymentPercent cache.
    expect(paymentBranch()).toEqual({ OR: [{ paymentPercent: { gte: 100 } }] });
  });

  it("derives totalCount and totalPages from the filtered DB count, not an in-memory length", async () => {
    // The original bug surfaced when totals came from an unfiltered count; they must track the
    // same filtered `where` the DB paginates over.
    prismaMock.order.count.mockResolvedValue(5);

    const result = await getOrdersList("user-1", baseFilters({ paymentStates: ["paid"], pageSize: 2 }));

    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ AND: expect.any(Array) }),
    });
    expect(result.totalCount).toBe(5);
    expect(result.totalPages).toBe(3);
  });

  it("sorts payment-asc by the persisted paymentPercent with a stable orderDate tiebreaker", async () => {
    await getOrdersList("user-1", baseFilters({ sort: "payment-asc" }));

    const args = findManyArgs();
    expect(args.orderBy).toEqual([{ paymentPercent: "asc" }, { orderDate: "desc" }]);
    expect(args.skip).toBe(0);
    expect(args.take).toBe(2);
  });

  it("maps paidAmount, paymentPercentage and hasUnpaidBalance straight from the persisted cache", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      makeRow("o1", { totalCost: 10_000, paidAmountMinor: 3_000, paymentPercent: 30 }),
      makeRow("o2", { totalCost: 10_000, paidAmountMinor: 10_000, paymentPercent: 100 }),
    ]);
    prismaMock.order.count.mockResolvedValue(2);

    const result = await getOrdersList("user-1", baseFilters());

    expect(result.orders[0]).toMatchObject({
      id: "o1",
      paidAmount: 3000,
      paymentPercentage: 30,
      hasUnpaidBalance: true,
    });
    expect(result.orders[1]).toMatchObject({
      id: "o2",
      paidAmount: 10000,
      paymentPercentage: 100,
      hasUnpaidBalance: false,
    });
  });

  it("expresses the overdue state as a date/status predicate independent of payment progress", async () => {
    await getOrdersList("user-1", baseFilters({ paymentStates: ["overdue"] }));

    const branch = paymentBranch();
    expect(branch?.OR[0]).toMatchObject({
      expectedDeliveryTo: { lt: expect.any(Date) },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    });
  });

  it("combines multiple payment states as OR branches", async () => {
    await getOrdersList("user-1", baseFilters({ paymentStates: ["paid", "unpaid"] }));

    expect(paymentBranch()).toEqual({
      OR: [{ paymentPercent: { gte: 100 } }, { paymentPercent: 0 }],
    });
  });

  it("keeps the payment filter and a name query as separate AND'd OR groups", async () => {
    await getOrdersList("user-1", baseFilters({ paymentStates: ["partial"], nameQuery: "abc" }));

    const groups = findManyArgs().where.AND ?? [];
    const orGroups = groups.filter((group) => "OR" in group);
    // One OR group for the name/id match, one for the payment state.
    expect(orGroups).toHaveLength(2);
    expect(orGroups).toContainEqual({ OR: [{ paymentPercent: { gt: 0, lt: 100 } }] });
  });

  it("uses native skip/take pagination and the DB count when no payment filter is present", async () => {
    prismaMock.order.count.mockResolvedValue(10);

    const result = await getOrdersList("user-1", baseFilters({ page: 2, pageSize: 2 }));

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 2, take: 2 }));
    expect(result.totalCount).toBe(10);
    expect(result.totalPages).toBe(5);
  });
});

describe("getOrdersList delivery-lateness filters", () => {
  it("expresses deliveryLateOnly as the window fully closed, not just started", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true }));

    const where = findManyArgs().where as Record<string, unknown>;
    expect(where.OR).toEqual([
      { expectedDeliveryTo: { lt: expect.any(Date) } },
      { expectedDeliveryTo: null, expectedDeliveryFrom: { lt: expect.any(Date) } },
    ]);
    expect(where.status).toEqual({ notIn: ["COMPLETED", "CANCELLED"] });
  });

  it("lets deliveryLateOnly win over deliveryOverdueOnly when both are set", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true, deliveryOverdueOnly: true }));

    const where = findManyArgs().where as Record<string, unknown>;
    expect(where.OR).toBeDefined();
    expect(where.expectedDeliveryFrom).toBeUndefined();
  });

  it("intersects deliveryLateOnly with explicit statuses instead of forcing notIn", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true, statuses: ["IN_TRANSIT"] }));

    const where = findManyArgs().where as Record<string, unknown>;
    expect(where.status).toEqual({ in: ["IN_TRANSIT"] });
  });

  it("still applies the looser deliveryOverdueOnly ('Por recibir') window-started predicate on its own", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryOverdueOnly: true }));

    const where = findManyArgs().where as Record<string, unknown>;
    expect(where.expectedDeliveryFrom).toEqual({ lte: expect.any(Date) });
    expect(where.OR).toBeUndefined();
  });
});
