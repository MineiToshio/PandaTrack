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
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

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
  allocatedAmountMinor: number;
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
    allocatedAmountMinor: 0,
    ...overrides,
  };
}

/** `pageSize` defaults to the smallest allow-listed option (`PAGE_SIZE_OPTIONS`) — the query
 *  layer clamps anything else back to `DEFAULT_PAGE_SIZE`, so tests must use an allow-listed value. */
function baseFilters(overrides: Partial<OrdersListPageFilters> = {}): OrdersListPageFilters {
  return { sort: "recent", page: 1, pageSize: 10, ...overrides };
}

function findManyArgs(callIndex = 0) {
  return prismaMock.order.findMany.mock.calls[callIndex][0] as {
    where: { AND?: Array<Record<string, unknown>> };
    orderBy: unknown;
    skip?: number;
    take?: number;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.order.count.mockResolvedValue(0);
});

describe("getOrdersList SQL pagination", () => {
  it("derives totalCount and totalPages from the filtered DB count, not an in-memory length", async () => {
    // The original bug surfaced when totals came from an unfiltered count; they must track the
    // same filtered `where` the DB paginates over.
    prismaMock.order.count.mockResolvedValue(25);

    const result = await getOrdersList("user-1", baseFilters({ pageSize: 10 }));

    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: expect.any(Object),
    });
    expect(result.totalCount).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("maps paidAmount, paymentPercentage and hasUnpaidBalance from the allocation cache", async () => {
    // The percentage is derived from the same allocated amount the card shows rather than read
    // from a second column, so the two can never disagree on a card.
    prismaMock.order.findMany.mockResolvedValue([
      makeRow("o1", { totalCost: 10_000, allocatedAmountMinor: 3_000 }),
      makeRow("o2", { totalCost: 10_000, allocatedAmountMinor: 10_000 }),
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

  it("keeps the name query as its own AND'd OR group", async () => {
    await getOrdersList("user-1", baseFilters({ nameQuery: "abc" }));

    const groups = findManyArgs().where.AND ?? [];
    const orGroups = groups.filter((group) => "OR" in group);
    expect(orGroups).toHaveLength(1);
  });

  it("uses native skip/take pagination and the DB count", async () => {
    prismaMock.order.count.mockResolvedValue(45);

    const result = await getOrdersList("user-1", baseFilters({ page: 2, pageSize: 10 }));

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(result.totalCount).toBe(45);
    expect(result.totalPages).toBe(5);
  });

  it("clamps an out-of-allow-list pageSize back to the default instead of trusting the caller", async () => {
    prismaMock.order.count.mockResolvedValue(0);

    const result = await getOrdersList("user-1", baseFilters({ pageSize: 2 }));

    const args = findManyArgs();
    expect(args.take).toBe(DEFAULT_PAGE_SIZE);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
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
