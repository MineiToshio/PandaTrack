import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OrderStatus } from "../../../../../generated/prisma/client";

/**
 * `order.fields.*` is Prisma's column reference, the only way a `where` can compare two columns of
 * the same row in SQL. The mock stands in for the real `FieldRef` object so the assertions below
 * can prove the query passes THAT and not a literal; the real reference was exercised against the
 * dev database directly (`totalCost > allocatedAmountMinor` returns the same set the in-memory
 * derivation does).
 */
const { prismaMock, ALLOCATED_FIELD_REF } = vi.hoisted(() => {
  const allocatedFieldRef = { __fieldRef: "Order.allocatedAmountMinor" };
  return {
    ALLOCATED_FIELD_REF: allocatedFieldRef,
    prismaMock: {
      order: {
        findMany: vi.fn(),
        count: vi.fn(),
        fields: { allocatedAmountMinor: allocatedFieldRef },
      },
    },
  };
});

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

  /**
   * T10d — the filter and the row chips sit on the same page, so they have to agree about which
   * orders are late. Once `isOrderArrivalObserved` stopped the chip flagging an order whose every
   * product is already at the store, a filter that kept matching it would put that order in the
   * "Entrega atrasada" results with no chip on it, which is the same pairing failure the civil-day
   * guard exists to prevent in the timezone dimension.
   */
  it("narrows deliveryLateOnly to orders that still have a product waiting", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true }));

    const where = findManyArgs().where as Record<string, unknown> & {
      AND?: Array<{ OR?: Array<Record<string, unknown>> }>;
    };
    const itemsGroup = (where.AND ?? []).find((group) => Array.isArray(group.OR));
    // "Waiting" spelled the way `deriveItemDeliveryState` derives it: still at NONE **and** not
    // carried by a live delivery. `deliveryState: "NONE"` alone would call an in-transit product
    // waiting, because a delivery does not rewrite the item's own column.
    expect(itemsGroup?.OR).toContainEqual({
      items: {
        some: {
          deliveryState: "NONE",
          deliveryItems: { none: { delivery: { status: { not: "CANCELLED" } } } },
        },
      },
    });
  });

  /**
   * H1 — `items: { some: { ...waiting } }` on its own can never match an order with zero items, so
   * an itemless order past its window kept the amber "Atrasado" chip
   * (`isOrderArrivalObserved([]) === false`, see orderDerivedState.ts) while silently dropping out of
   * these results: the two readings of the same order disagreeing, resolved oppositely by the chip
   * and by the filter. `items: { none: {} }` is the SQL reading of that same `false`.
   */
  it("also keeps an itemless order in deliveryLateOnly, the same way its chip stays amber", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true }));

    const where = findManyArgs().where as Record<string, unknown> & {
      AND?: Array<{ OR?: Array<Record<string, unknown>> }>;
    };
    const itemsGroup = (where.AND ?? []).find((group) => Array.isArray(group.OR));
    expect(itemsGroup?.OR).toContainEqual({ items: { none: {} } });
  });

  it("adds no such narrow to the looser 'Por recibir' filter", async () => {
    // The control: `deliveryOverdueOnly` answers "is the window open", a question the products do
    // not settle, so copying the narrow across would silently hide rows from a different filter.
    await getOrdersList("user-1", baseFilters({ deliveryOverdueOnly: true }));

    expect((findManyArgs().where as Record<string, unknown>).items).toBeUndefined();
  });

  it("lets deliveryLateOnly win over deliveryOverdueOnly when both are set", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true, deliveryOverdueOnly: true }));

    const where = findManyArgs().where as Record<string, unknown>;
    expect(where.OR).toBeDefined();
    expect(where.expectedDeliveryFrom).toBeUndefined();
  });

  /**
   * H2 — `isOrderOverdue` hard-zeroes COMPLETED/CANCELLED whatever the caller's own status
   * selection says (orderDerivedState.ts), so the `notIn` narrow has to hold even when the caller
   * passes explicit statuses, not only when it omits them. Before this, ticking "Cancelado" alongside
   * "Atrasados" skipped the narrow entirely and could return a cancelled order with a waiting product
   * and no overdue chip on it — the same pairing failure as the itemless case above.
   */
  it("intersects deliveryLateOnly with the still-pending statuses even when explicit statuses are set", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true, statuses: ["IN_TRANSIT"] }));

    const where = findManyArgs().where as Record<string, unknown>;
    expect(where.status).toEqual({ in: ["IN_TRANSIT"], notIn: ["COMPLETED", "CANCELLED"] });
  });

  it("leaves nothing to match when the caller combines Cancelado with Atrasados", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryLateOnly: true, statuses: ["CANCELLED"] }));

    const where = findManyArgs().where as Record<string, unknown>;
    // `in: ["CANCELLED"]` intersected with `notIn: ["COMPLETED", "CANCELLED"]` is the empty set by
    // construction: Prisma resolves the AND itself, so asserting the shape sent to it is as far as
    // this mock-based test can go, and is the behaviour the SQL narrow is meant to guarantee.
    expect(where.status).toEqual({ in: ["CANCELLED"], notIn: ["COMPLETED", "CANCELLED"] });
  });

  it("still applies the looser deliveryOverdueOnly ('Por recibir') window-started predicate on its own", async () => {
    await getOrdersList("user-1", baseFilters({ deliveryOverdueOnly: true }));

    const where = findManyArgs().where as Record<string, unknown>;
    expect(where.expectedDeliveryFrom).toEqual({ lte: expect.any(Date) });
    expect(where.OR).toBeUndefined();
  });
});

/**
 * "Con saldo pendiente" (`FR-05-35`'s companion filter). ADR 0025 retired the paid/partial/unpaid
 * filter because a per-order percentage stopped being a fact under store-level payments; whether an
 * order's declared allocations cover its own total never stopped being one.
 */
describe("getOrdersList con saldo pendiente filter", () => {
  function balanceGroup() {
    return (findManyArgs().where.AND ?? []).find((group) => "totalCost" in group) as
      { totalCost: { gt: unknown }; status: { not: string } } | undefined;
  }

  it("adds no balance condition when the filter is off", async () => {
    await getOrdersList("user-1", baseFilters());
    expect(balanceGroup()).toBeUndefined();
  });

  it("compares totalCost against the allocation cache column, not a literal", async () => {
    await getOrdersList("user-1", baseFilters({ withBalanceOnly: true }));

    // A literal here (`{ gt: 0 }`) would return every order with a price, which is the whole list.
    expect(balanceGroup()?.totalCost.gt).toBe(ALLOCATED_FIELD_REF);
  });

  it("always excludes cancelled orders, which owe nothing whatever their total says", async () => {
    await getOrdersList("user-1", baseFilters({ withBalanceOnly: true, statuses: ["CANCELLED", "COMPLETED"] }));

    // ADR 0025 defines store debt as `Σ committed (non-cancelled) − Σ paid`; the filter has to
    // agree with that formula even when the collector explicitly ticks the Cancelado pill.
    expect(balanceGroup()?.status).toEqual({ not: "CANCELLED" });
  });

  it("counts the same rows it lists", async () => {
    await getOrdersList("user-1", baseFilters({ withBalanceOnly: true }));

    // Pagination breaks the moment the count and the page read different `where`s.
    expect(prismaMock.order.count.mock.calls[0][0]).toEqual({ where: findManyArgs().where });
  });
});
