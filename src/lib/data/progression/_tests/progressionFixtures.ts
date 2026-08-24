import { vi } from "vitest";
import {
  DeliveryStatus,
  OrderItemDeliveryState,
  OrderStatus,
  StoreStatus,
  StoreVisibility,
} from "../../../../../generated/prisma/client";
import type { RecomputeLedgerEntry } from "../recompute";

/**
 * A small in-memory stand-in for the tables the recompute reads.
 *
 * The recompute's whole job is deciding which ledger entries still count against the CURRENT state
 * of other domains, so a test that stubs "eligible: true" would assert nothing. Describing a world
 * (these orders, at these stores, with these payments) and letting the real query shapes run against
 * it is what makes a scenario like "cancel it, then reactivate it" mean something.
 *
 * The fakes dispatch on the shape of the arguments rather than on call order, so adding a query does
 * not silently re-point an existing one at the wrong stub.
 */

export const USER_ID = "user-1";
export const OTHER_USER_ID = "user-2";

export type FakeStore = {
  id: string;
  status?: StoreStatus;
  visibility?: StoreVisibility;
  isPrivate?: boolean;
  createdByUserId?: string;
};

export type FakeOrder = {
  id: string;
  storeId: string;
  status?: OrderStatus;
  totalCost?: number;
  allocatedAmountMinor?: number;
  /** Civil day the order was placed, UTC midnight. Drives the patience medals. */
  orderDate?: Date;
  /** Real instant the row was written. Drives the midnight medal; never `orderDate`. */
  createdAt?: Date;
  /** Private note; only ever read at the call site that just wrote it. */
  note?: string | null;
};

export type FakeDelivery = {
  id: string;
  storeId: string;
  status?: DeliveryStatus;
  orderIds: string[];
  receivedDate?: Date | null;
};

export type FakeItem = {
  orderId: string;
  productTypeKey: string;
  deliveryState?: OrderItemDeliveryState;
  /** Deliveries this specific product arrived through. Defaults to every delivery of its order. */
  deliveryIds?: string[];
};

export type FakeLedgerRow = RecomputeLedgerEntry & { voidedAt?: Date | null };

export type FakeWorld = {
  stores?: FakeStore[];
  orders?: FakeOrder[];
  /** Orders that carry at least one assigned payment. Existence only; no amount is modelled. */
  paidOrderIds?: string[];
  deliveries?: FakeDelivery[];
  items?: FakeItem[];
  ledger?: FakeLedgerRow[];
  /**
   * The cached `UserProgress` row, or `null` for a collector who has never been recomputed. The
   * recompute only ever reads `highestRankIndex`, so the rest is optional and only the read-side
   * queries (which render the cached figures) need to state it.
   */
  progress?: FakeProgressRow | null;
  unlockedMedalKeys?: string[];
  /** Stores this collector has written a review for. */
  reviewedStoreIds?: string[];
  /** IANA timezone of the collector, resolving civil days and civil hours. */
  timezone?: string | null;
};

export type FakeProgressRow = {
  highestRankIndex: number;
  maturedPoints?: number;
  rankIndex?: number;
  lastRecomputedAt?: Date;
};

/**
 * An approved, public store: the only kind that credits anything.
 *
 * `createdByUserId` stays on the world model because the column is real, but no fake query returns
 * it and the fake gate ignores it: the engine stopped asking who registered a store, and a fixture
 * that still answered would let a re-introduced creator clause pass unnoticed.
 */
export function eligibleStore(id: string): FakeStore {
  return {
    id,
    status: StoreStatus.APPROVED,
    visibility: StoreVisibility.PUBLIC,
    isPrivate: false,
    createdByUserId: OTHER_USER_ID,
  };
}

/** A civil day at UTC midnight, the shape `occurredOn` is always stored in. */
export function civilDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

let ledgerSequence = 0;

/** A ledger row with sane defaults, so a test states only what it is actually about. */
export function ledgerEntry(
  overrides: Partial<FakeLedgerRow> & Pick<FakeLedgerRow, "ruleKey" | "entityType" | "entityId" | "points">,
): FakeLedgerRow {
  ledgerSequence += 1;
  const occurredOn = overrides.occurredOn ?? civilDay(2026, 3, 10);
  return {
    id: overrides.id ?? `entry-${ledgerSequence}`,
    ruleKey: overrides.ruleKey,
    entityType: overrides.entityType,
    entityId: overrides.entityId,
    points: overrides.points,
    occurredOn,
    createdAt: overrides.createdAt ?? new Date(occurredOn.getTime() + ledgerSequence),
    voidedAt: overrides.voidedAt ?? null,
  };
}

function inList(value: string, filter: { in?: string[] } | undefined): boolean {
  return filter?.in ? filter.in.includes(value) : true;
}

type ItemFilter = { deliveryState?: OrderItemDeliveryState };

type OrderWhere = {
  id?: { in?: string[] };
  storeId?: { in?: string[] };
  status?: { not?: OrderStatus };
  store?: unknown;
  items?: { some?: ItemFilter; every?: ItemFilter };
};

type AnyArgs = {
  where?: Record<string, unknown>;
  select?: Record<string, unknown>;
  distinct?: string[];
  data?: unknown;
};

/**
 * Builds the fake client. Pass the result straight into `recomputeUserProgress(userId, db)`: a
 * `Prisma.TransactionClient` is structurally satisfied by anything carrying the methods actually
 * called, which is why the recompute never needs the module-level singleton mocked.
 */
export function makeFakeDb(world: FakeWorld) {
  const stores = world.stores ?? [];
  const orders = world.orders ?? [];
  const paidOrderIds = new Set(world.paidOrderIds ?? []);
  const deliveries = world.deliveries ?? [];
  const items = world.items ?? [];
  const ledger = world.ledger ?? [];

  const storeById = new Map(stores.map((store) => [store.id, store]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const deliveryById = new Map(deliveries.map((delivery) => [delivery.id, delivery]));

  const itemsOf = (orderId: string): FakeItem[] => items.filter((item) => item.orderId === orderId);

  /** Deliveries one product arrived through: explicit links first, otherwise its order's own. */
  const deliveriesOfItem = (item: FakeItem): FakeDelivery[] =>
    item.deliveryIds
      ? item.deliveryIds.flatMap((id) => {
          const delivery = deliveryById.get(id);
          return delivery ? [delivery] : [];
        })
      : deliveries.filter((delivery) => delivery.orderIds.includes(item.orderId));

  /** Applies the status and item filters every medal-side order query shares. */
  const matchesOrder = (order: FakeOrder, where: OrderWhere): boolean => {
    if (where.status?.not && (order.status ?? OrderStatus.OPEN) === where.status.not) {
      return false;
    }
    if (where.store && !isStoreCreditEligible(order.storeId)) {
      return false;
    }
    if (!where.items) {
      return true;
    }
    const orderItems = itemsOf(order.id);
    if (where.items.some) {
      const state = where.items.some.deliveryState;
      const someMatch = orderItems.some((item) =>
        state ? (item.deliveryState ?? OrderItemDeliveryState.NONE) === state : true,
      );
      if (!someMatch) return false;
    }
    if (where.items.every) {
      const state = where.items.every.deliveryState;
      const everyMatch = orderItems.every((item) =>
        state ? (item.deliveryState ?? OrderItemDeliveryState.NONE) === state : true,
      );
      if (!everyMatch) return false;
    }
    return true;
  };

  const resolveStore = (storeId: string) => {
    const store = storeById.get(storeId);
    if (!store) return null;
    return {
      status: store.status ?? StoreStatus.APPROVED,
      visibility: store.visibility ?? StoreVisibility.PUBLIC,
      isPrivate: store.isPrivate ?? false,
    };
  };

  const isStoreCreditEligible = (storeId: string): boolean => {
    const store = resolveStore(storeId);
    return Boolean(
      store &&
        store.status === StoreStatus.APPROVED &&
        store.visibility === StoreVisibility.PUBLIC &&
        !store.isPrivate,
    );
  };

  const progressRow: { current: FakeProgressRow | null } = { current: world.progress ?? null };
  const upserts: Array<Record<string, unknown>> = [];
  const createdUnlocks: Array<Record<string, unknown>> = [];
  const auditEntries: Array<Record<string, unknown>> = [];
  const voidUpdates: Array<Record<string, unknown>> = [];

  const db = {
    pointLedgerEntry: {
      findMany: vi.fn(async (args: AnyArgs) => {
        const onlyLive = (args.where as { voidedAt?: null })?.voidedAt === null;
        return ledger
          .filter((row) => (onlyLive ? !row.voidedAt : true))
          .map(({ voidedAt: _voidedAt, ...rest }) => rest);
      }),
      updateMany: vi.fn(async (args: AnyArgs) => {
        const affected = ledger.filter((row) => !row.voidedAt);
        for (const row of affected) {
          row.voidedAt = (args.data as { voidedAt: Date }).voidedAt;
        }
        voidUpdates.push(args.data as Record<string, unknown>);
        return { count: affected.length };
      }),
    },

    order: {
      findMany: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as OrderWhere;

        // The adapter's settled query is the only one that asks for the money columns.
        if (args.select?.totalCost) {
          return orders
            .filter((order) => inList(order.id, where.id))
            .map((order) => ({
              id: order.id,
              totalCost: order.totalCost ?? 0,
              allocatedAmountMinor: order.allocatedAmountMinor ?? 0,
            }));
        }

        // "Which of these stores does the collector still have a live order at?", and its medal-side
        // sibling "…and actually received something from", told apart by the item filter.
        if (args.distinct?.includes("storeId")) {
          const matched = orders.filter((order) => inList(order.storeId, where.storeId) && matchesOrder(order, where));
          return [...new Set(matched.map((order) => order.storeId))].map((storeId) => ({ storeId }));
        }

        const matched = orders.filter((order) => inList(order.id, where.id) && matchesOrder(order, where));

        // The medal evaluator's own reads: the arrival shape (order date plus every delivery each
        // product arrived through) and the midnight check (the write instant, never the civil day).
        if (args.select?.items) {
          return matched.map((order) => ({
            orderDate: order.orderDate ?? civilDay(2026, 1, 1),
            items: itemsOf(order.id).map((item) => ({
              deliveryState: item.deliveryState ?? OrderItemDeliveryState.NONE,
              deliveryItems: deliveriesOfItem(item).map((delivery) => ({
                delivery: {
                  id: delivery.id,
                  status: delivery.status ?? DeliveryStatus.IN_TRANSIT,
                  receivedDate: delivery.receivedDate ?? null,
                },
              })),
            })),
          }));
        }
        if (args.select?.createdAt) {
          return matched.map((order) => ({ createdAt: order.createdAt ?? new Date("2026-03-10T15:00:00Z") }));
        }
        if (args.select && !args.select.status) {
          return matched.map((order) => ({ id: order.id }));
        }

        return matched.map((order) => ({
          id: order.id,
          status: order.status ?? OrderStatus.OPEN,
          store: resolveStore(order.storeId),
        }));
      }),
      findFirst: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as OrderWhere;
        const match = orders.find(
          (order) => inList(order.id, where.id) && inList(order.storeId, where.storeId) && matchesOrder(order, where),
        );
        return match ? { id: match.id } : null;
      }),
    },

    paymentAllocation: {
      findFirst: vi.fn(async (args: AnyArgs) => {
        // The real query nests the creditable-order filter, so the fake has to apply it too: a
        // payment against an unapproved store must not answer "yes, there is a payment".
        const where = (args.where ?? {}) as { userId?: string; order?: OrderWhere };
        const match = [...paidOrderIds].find((orderId) => {
          const order = orderById.get(orderId);
          if (!order) return false;
          if (where.order?.store && !isStoreCreditEligible(order.storeId)) return false;
          if (where.order?.status?.not && (order.status ?? OrderStatus.OPEN) === where.order.status.not) return false;
          return true;
        });
        return match ? { id: `allocation-${match}` } : null;
      }),
      findMany: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as { orderId?: { in?: string[] }; payment?: unknown };
        // Provenance query (migrated imports) versus the plain existence query.
        if (where.payment) {
          return [];
        }
        return [...paidOrderIds].filter((orderId) => inList(orderId, where.orderId)).map((orderId) => ({ orderId }));
      }),
    },

    storeAccountAdjustmentLine: {
      groupBy: vi.fn(async () => []),
    },

    delivery: {
      findFirst: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as { status?: DeliveryStatus };
        const match = deliveries.find(
          (delivery) =>
            (where.status ? (delivery.status ?? DeliveryStatus.IN_TRANSIT) === where.status : true) &&
            isStoreCreditEligible(delivery.storeId),
        );
        return match ? { id: match.id } : null;
      }),
      findMany: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as { id?: { in?: string[] } };
        return deliveries
          .filter((delivery) => inList(delivery.id, where.id))
          .map((delivery) => ({
            id: delivery.id,
            status: delivery.status ?? DeliveryStatus.IN_TRANSIT,
            store: resolveStore(delivery.storeId),
            orderItems: delivery.orderIds.map((orderId) => ({ orderItem: { orderId } })),
          }));
      }),
    },

    store: {
      findMany: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as { id?: { in?: string[] } };
        return stores
          .filter((store) => inList(store.id, where.id))
          .map((store) => ({ id: store.id, ...resolveStore(store.id)! }));
      }),
    },

    orderItem: {
      findMany: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as {
          userId?: string;
          productTypeKey?: { in?: string[] };
          deliveryState?: OrderItemDeliveryState;
          order?: unknown;
        };

        const matched = items.filter((item) => {
          if (!inList(item.productTypeKey, where.productTypeKey)) return false;
          if (where.deliveryState && (item.deliveryState ?? OrderItemDeliveryState.NONE) !== where.deliveryState) {
            return false;
          }
          // The nested filter is the store gate; a discovery through an ineligible store is not one.
          if (where.order) {
            const order = orderById.get(item.orderId);
            if (!order) return false;
            if ((order.status ?? OrderStatus.OPEN) === OrderStatus.CANCELLED) return false;
            if (!isStoreCreditEligible(order.storeId)) return false;
          }
          return true;
        });

        return [...new Set(matched.map((item) => item.productTypeKey))].map((productTypeKey) => ({ productTypeKey }));
      }),
    },

    userProgress: {
      findUnique: vi.fn(async () => progressRow.current),
      upsert: vi.fn(async (args: AnyArgs) => {
        const update = args as unknown as { update: { highestRankIndex: number } };
        progressRow.current = { ...progressRow.current, highestRankIndex: update.update.highestRankIndex };
        upserts.push(update.update);
        return update.update;
      }),
    },

    medalUnlock: {
      findMany: vi.fn(async () => (world.unlockedMedalKeys ?? []).map((medalKey) => ({ medalKey }))),
      createMany: vi.fn(async (args: AnyArgs) => {
        const rows = (args.data ?? []) as Array<Record<string, unknown>>;
        createdUnlocks.push(...rows);
        return { count: rows.length };
      }),
    },

    storeReview: {
      findFirst: vi.fn(async () => {
        // Mirrors the real filter: the store must be able to credit AND have delivered something.
        const match = (world.reviewedStoreIds ?? []).find(
          (storeId) =>
            isStoreCreditEligible(storeId) &&
            orders.some(
              (order) =>
                order.storeId === storeId &&
                (order.status ?? OrderStatus.OPEN) !== OrderStatus.CANCELLED &&
                itemsOf(order.id).some((item) => item.deliveryState === OrderItemDeliveryState.DELIVERED),
            ),
        );
        return match ? { id: `review-${match}` } : null;
      }),
    },

    user: {
      findUnique: vi.fn(async (args: AnyArgs) => {
        const id = (args.where as { id?: string })?.id;
        return id === USER_ID ? { id: USER_ID, timezone: world.timezone ?? null } : null;
      }),
    },

    adminAuditLog: {
      create: vi.fn(async (args: AnyArgs) => {
        const row = args.data as Record<string, unknown>;
        auditEntries.push(row);
        return { id: "audit-1", createdAt: new Date(), ...row };
      }),
    },
  };

  return { db, ledger, upserts, createdUnlocks, auditEntries, voidUpdates };
}
