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

type FindManyArgs = { skip?: number; take?: number };

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
  payments: Array<{ amount: number }>;
};

/**
 * Builds a row already shaped like the Prisma select in getOrdersList. `paid` fully covers the
 * total (100%); otherwise the order is left unpaid (0%). Items are omitted — payment-state
 * filtering only depends on payments and totals.
 */
function makeOrder(id: string, dayOfMonth: number, paid: boolean): OrderRow {
  const totalCost = 10_000;
  return {
    id,
    humanReadableId: `ORD-${id}`,
    orderDate: new Date(2026, 0, dayOfMonth),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "USD",
    exchangeRate: null,
    totalCost,
    status: "OPEN" as OrderStatus,
    store: { id: "store-1", name: "Store One", slug: "store-one" },
    items: [],
    payments: paid ? [{ amount: totalCost }] : [],
  };
}

// Ten orders sorted by orderDate DESC (the native `recent` order). Odd days are paid, even unpaid,
// so the paid subset in descending-date order is [o9, o7, o5, o3, o1].
const ORDERS_DESC: OrderRow[] = [
  makeOrder("o9", 9, true),
  makeOrder("o8", 8, false),
  makeOrder("o7", 7, true),
  makeOrder("o6", 6, false),
  makeOrder("o5", 5, true),
  makeOrder("o4", 4, false),
  makeOrder("o3", 3, true),
  makeOrder("o2", 2, false),
  makeOrder("o1", 1, true),
  makeOrder("o0", 0, false),
];

const PAID_IDS_DESC = ["o9", "o7", "o5", "o3", "o1"];

function baseFilters(overrides: Partial<OrdersListPageFilters> = {}): OrdersListPageFilters {
  return { sort: "recent", page: 1, pageSize: 2, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  // findMany simulates the DB: native pagination slices by skip/take; the full-fetch path
  // (take without skip) returns the whole ordered set.
  prismaMock.order.findMany.mockImplementation((args: FindManyArgs) => {
    if (typeof args.skip === "number") {
      return Promise.resolve(ORDERS_DESC.slice(args.skip, args.skip + (args.take ?? ORDERS_DESC.length)));
    }
    return Promise.resolve(ORDERS_DESC);
  });
  // count returns the UNFILTERED total — the payment filter must not trust this value.
  prismaMock.order.count.mockResolvedValue(ORDERS_DESC.length);
});

describe("getOrdersList payment-state pagination (DATA-2)", () => {
  it("returns page-1 totals from the filtered set, not the DB count", async () => {
    const result = await getOrdersList("user-1", baseFilters({ paymentStates: ["paid"], page: 1 }));

    expect(result.orders.map((o) => o.id)).toEqual(["o9", "o7"]);
    expect(result.totalCount).toBe(PAID_IDS_DESC.length);
    expect(result.totalPages).toBe(Math.ceil(PAID_IDS_DESC.length / 2));
  });

  it("paginates the filtered set with a date sort — page 2 does not overlap page 1 (the bug)", async () => {
    const page1 = await getOrdersList("user-1", baseFilters({ paymentStates: ["paid"], page: 1 }));
    const page2 = await getOrdersList("user-1", baseFilters({ paymentStates: ["paid"], page: 2 }));

    expect(page1.orders.map((o) => o.id)).toEqual(["o9", "o7"]);
    // Before the fix, page 2 was sliced from a native DB page then filtered, corrupting boundaries.
    expect(page2.orders.map((o) => o.id)).toEqual(["o5", "o3"]);
    expect(page2.totalCount).toBe(PAID_IDS_DESC.length);
    expect(page2.page).toBe(2);

    const overlap = page1.orders.filter((a) => page2.orders.some((b) => b.id === a.id));
    expect(overlap).toEqual([]);
  });

  it("covers every filtered order across pages with no gaps under a date sort", async () => {
    const collected: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await getOrdersList("user-1", baseFilters({ paymentStates: ["paid"], page }));
      collected.push(...result.orders.map((o) => o.id));
    }
    expect(collected).toEqual(PAID_IDS_DESC);
  });

  it("still honors the payment-asc sort with a payment filter", async () => {
    const result = await getOrdersList(
      "user-1",
      baseFilters({ paymentStates: ["paid", "unpaid"], sort: "payment-asc", page: 1, pageSize: 3 }),
    );

    // Ascending paymentPercentage puts the unpaid (0%) orders before the paid (100%) ones.
    expect(result.orders.map((o) => o.paymentPercentage)).toEqual([0, 0, 0]);
    expect(result.totalCount).toBe(ORDERS_DESC.length);
  });

  it("uses native skip/take pagination and the DB count when no payment filter is present", async () => {
    const result = await getOrdersList("user-1", baseFilters({ page: 2, pageSize: 2 }));

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2 }),
    );
    expect(result.orders.map((o) => o.id)).toEqual(["o7", "o6"]);
    expect(result.totalCount).toBe(ORDERS_DESC.length);
    expect(result.totalPages).toBe(Math.ceil(ORDERS_DESC.length / 2));
  });
});
