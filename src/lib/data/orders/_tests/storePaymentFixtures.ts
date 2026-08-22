import { vi } from "vitest";
import { OrderItemDeliveryState, OrderStatus } from "../../../../../generated/prisma/client";

/**
 * Shared fake-transaction builder for the store-level payment write path.
 *
 * `createStorePayment` (and, through it, `addOrderPayment`) walks a fixed sequence of Prisma
 * calls inside its Serializable transaction: `store.findFirst`, optionally
 * `order.findMany` (distinct currencies) for inherited-currency resolution, `order.aggregate` +
 * `storePayment.aggregate` + `paymentAllocation.aggregate` (money left declared lost against a
 * cancelled order, excluded from the ceiling) for the debt ceiling, `order.findMany` (by id) + optionally
 * `paymentAllocation.groupBy` (by `orderItemId`) for allocation validation, then
 * `storePayment.create` + `paymentAllocation.createMany` + `paymentAllocation.groupBy` (by
 * `orderId`) + `order.updateMany` for the write and cache refresh, and finally `order.findFirst` +
 * `paymentAllocation.findMany` per affected order for the returned snapshots.
 *
 * Every mocked method here dispatches on the shape of its own arguments (rather than call order),
 * so a single fixture instance answers every call in that sequence correctly regardless of which
 * refusal branch a given test is exercising.
 *
 * `validateAllocations` also reads the net open balance for every targeted order via
 * `openBalanceMinorByOrderId`, which sources its adjustment-line term from
 * `tx.storeAccountAdjustmentLine.groupBy({ by: ["orderId"], ... })`. `writtenOffByOrderId` seeds
 * that read per order id; it defaults to no lines anywhere, which is what keeps every existing
 * test's behaviour (the gross-equivalent case, `BR-05-32`) unchanged.
 */

export type FixtureOrder = {
  id: string;
  storeId: string;
  currencyCode: string;
  status: OrderStatus;
  orderDate: Date;
  totalCost: number;
  allocatedAmountMinor: number;
  items: Array<{ id: string; unitPrice: number | null; quantity: number }>;
};

export function makeFixtureOrder(overrides: Partial<FixtureOrder> = {}): FixtureOrder {
  return {
    id: "order-1",
    storeId: "store-1",
    currencyCode: "USD",
    status: OrderStatus.OPEN,
    orderDate: new Date("2020-01-01T00:00:00Z"),
    totalCost: 10000,
    allocatedAmountMinor: 0,
    items: [],
    ...overrides,
  };
}

type DebtByCurrency = Record<
  string,
  {
    committedMinor?: number;
    paidMinor?: number;
    lostMinor?: number;
    /**
     * `Σ StoreAccountAdjustmentLine.amountMinor` over this store/currency pair's non-cancelled
     * orders (WO-11's ceiling subtrahend, `getStoreDebtMinor`'s own `storeAccountAdjustmentLine`
     * read). Defaults to 0, which is what keeps every existing test's ceiling figure unchanged.
     */
    writtenOffMinor?: number;
  }
>;

export type CreateStorePaymentTxOptions = {
  storeExists?: boolean;
  orders?: FixtureOrder[];
  /** Rows `resolveInheritedStoreCurrency` reads when the caller did not name a currency. */
  inheritedCurrencyRows?: Array<{ currencyCode: string }>;
  debtByCurrency?: DebtByCurrency;
  /** What earlier payments already declared against each targeted item, keyed by item id. */
  allocatedByItemId?: Record<string, number>;
  /** What the DB reports as each order's total declared AFTER this payment's rows are written. */
  cacheAfterWriteByOrderId?: Record<string, number>;
  /** Snapshot `loadAffectedOrderSnapshots` reads back per order id. */
  snapshotsByOrderId?: Record<string, { totalCost: number; allocatedAmountMinor: number }>;
  paymentRecordsByOrderId?: Record<string, unknown[]>;
  createdPaymentId?: string;
  /** Item ids reachable as this collector's AND belonging to an order of this store. */
  declarableItemIds?: string[];
  /** The collector's base currency, read by the base-currency FX guard. */
  baseCurrencyCode?: string | null;
  /**
   * What earlier `StoreAccountAdjustment` lines have already written off, per order id. Feeds
   * `openBalanceMinorByOrderId`'s `storeAccountAdjustmentLine.groupBy` read. Defaults to no lines
   * anywhere.
   */
  writtenOffByOrderId?: Record<string, number>;
};

export type CreateStorePaymentTx = ReturnType<typeof makeCreateStorePaymentTx>;

export function makeCreateStorePaymentTx(options: CreateStorePaymentTxOptions = {}) {
  const {
    storeExists = true,
    orders = [],
    inheritedCurrencyRows = [],
    debtByCurrency = {},
    allocatedByItemId = {},
    cacheAfterWriteByOrderId = {},
    snapshotsByOrderId = {},
    paymentRecordsByOrderId = {},
    createdPaymentId = "payment-new",
    declarableItemIds = [],
    baseCurrencyCode = "PEN",
    writtenOffByOrderId = {},
  } = options;

  const ordersById = new Map(orders.map((order) => [order.id, order]));

  return {
    store: {
      findFirst: vi.fn().mockResolvedValue(storeExists ? { id: "store-1" } : null),
    },
    order: {
      findMany: vi.fn().mockImplementation((args: { where: { id?: { in: string[] } }; distinct?: string[] }) => {
        if (args.distinct) return Promise.resolve(inheritedCurrencyRows);
        const ids: string[] = args.where.id?.in ?? [];
        return Promise.resolve(
          ids.map((id) => ordersById.get(id)).filter((order): order is FixtureOrder => order !== undefined),
        );
      }),
      aggregate: vi.fn().mockImplementation((args: { where: { currencyCode: string } }) => {
        const entry = debtByCurrency[args.where.currencyCode] ?? {};
        return Promise.resolve({ _sum: { totalCost: entry.committedMinor ?? 0 } });
      }),
      findFirst: vi.fn().mockImplementation((args: { where: { id: string } }) => {
        const snapshot = snapshotsByOrderId[args.where.id];
        return Promise.resolve(snapshot ? { ...snapshot } : null);
      }),
      // `recalculateOrderAllocationCache`'s own write, scoped to `{ id, userId }` (defense in depth).
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    storePayment: {
      aggregate: vi.fn().mockImplementation((args: { where: { currencyCode: string } }) => {
        const entry = debtByCurrency[args.where.currencyCode] ?? {};
        return Promise.resolve({ _sum: { amount: entry.paidMinor ?? 0 } });
      }),
      create: vi.fn().mockResolvedValue({ id: createdPaymentId }),
    },
    paymentAllocation: {
      aggregate: vi.fn().mockImplementation((args: { where: { payment: { currencyCode: string } } }) => {
        const entry = debtByCurrency[args.where.payment.currencyCode] ?? {};
        return Promise.resolve({ _sum: { amountMinor: entry.lostMinor ?? 0 } });
      }),
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
        if (args.by.includes("orderItemId")) {
          return Promise.resolve(
            Object.entries(allocatedByItemId).map(([orderItemId, sum]) => ({
              orderItemId,
              _sum: { amountMinor: sum },
            })),
          );
        }
        return Promise.resolve(
          Object.entries(cacheAfterWriteByOrderId).map(([orderId, sum]) => ({ orderId, _sum: { amountMinor: sum } })),
        );
      }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockImplementation((args: { where: { orderId: string } }) => {
        return Promise.resolve(paymentRecordsByOrderId[args.where.orderId] ?? []);
      }),
    },
    // `declarePaidItemIds` is checked twice on purpose: `findMany` proves store membership before
    // the first write, `count` re-proves ownership inside the batch mutation.
    orderItem: {
      findMany: vi
        .fn()
        .mockImplementation((args: { where: { id: { in: string[] } } }) =>
          Promise.resolve(args.where.id.in.filter((id) => declarableItemIds.includes(id)).map((id) => ({ id }))),
        ),
      count: vi
        .fn()
        .mockImplementation((args: { where: { id: { in: string[] } } }) =>
          Promise.resolve(args.where.id.in.filter((id) => declarableItemIds.includes(id)).length),
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode }),
    },
    // Read by `openBalanceMinorByOrderId` (`orderOpenBalance.ts`) to build the third term of the
    // canonical open balance. Dispatches on the same
    // `{ by: ["orderId"], where: { userId, orderId: { in } } }` shape the module calls it with.
    storeAccountAdjustmentLine: {
      groupBy: vi.fn().mockImplementation((args: { where: { userId: string; orderId: { in: string[] } } }) => {
        const ids: string[] = args.where.orderId?.in ?? [];
        return Promise.resolve(
          ids
            .filter((id) => (writtenOffByOrderId[id] ?? 0) > 0)
            .map((id) => ({ orderId: id, _sum: { amountMinor: writtenOffByOrderId[id] } })),
        );
      }),
      // Read by `getStoreDebtMinor` (WO-11's `validationCeilingMinor` subtrahend). Scoped by
      // currency like the other three debt aggregates above; defaults to 0 everywhere, which is
      // what keeps every pre-WO-11 test's ceiling figure unchanged.
      aggregate: vi.fn().mockImplementation((args: { where: { order: { currencyCode: string } } }) => {
        const entry = debtByCurrency[args.where.order.currencyCode] ?? {};
        return Promise.resolve({ _sum: { amountMinor: entry.writtenOffMinor ?? 0 } });
      }),
    },
  };
}

/** Wires a fake `$transaction` on the given `prismaMock` to hand `tx` straight to the callback. */
export function runStorePaymentTx(prismaMock: { $transaction: ReturnType<typeof vi.fn> }, tx: unknown): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

/**
 * Fake `Prisma.TransactionClient` for `consumeUnassignedStoreMoneyOnOrderClose`, which takes a
 * caller-owned `tx` directly rather than opening its own `$transaction` (there is deliberately no
 * `runStorePaymentTx` wiring here: the function under test is called with this object as its `tx`
 * argument, not through `prismaMock.$transaction`).
 *
 * Stateful on purpose: `paymentAllocation.createMany` folds its written rows straight into the same
 * `allocatedByPaymentId` map `paymentAllocation.groupBy` reads back, so two sequential calls against
 * the SAME fixture (two orders draining one shared pool) see the second call's own pool already
 * reduced by the first call's write, exactly as two sequential transactions would.
 */
export type ConsumeUnassignedStoreMoneyOrder = {
  id: string;
  storeId: string;
  currencyCode: string;
  totalCost: number;
  allocatedAmountMinor: number;
};

export type ConsumeUnassignedStoreMoneyTxOptions = {
  /** Orders `order.findFirst` can resolve, keyed by their own id. */
  orders?: ConsumeUnassignedStoreMoneyOrder[];
  /** What earlier `StoreAccountAdjustment` lines have already written off, per order id. */
  writtenOffByOrderId?: Record<string, number>;
  /** The unassigned pool's own `StorePayment` rows, in whatever order the fixture is given; the
   *  fixture itself does not re-sort them, so a test asserting drain order must pass them pre-sorted
   *  oldest first, exactly as the real `orderBy` would return them. */
  payments?: Array<{ id: string; amount: number; paymentDate: Date }>;
  /** What is already allocated against each payment BEFORE this call, keyed by payment id. */
  allocatedByPaymentId?: Record<string, number>;
  /** What `recalculateOrderAllocationCache`'s own `groupBy` should report per order id afterward. */
  cacheAfterWriteByOrderId?: Record<string, number>;
};

export function makeConsumeUnassignedStoreMoneyTx(options: ConsumeUnassignedStoreMoneyTxOptions = {}) {
  const {
    orders = [],
    writtenOffByOrderId = {},
    payments = [],
    allocatedByPaymentId = {},
    cacheAfterWriteByOrderId = {},
  } = options;

  const ordersById = new Map(orders.map((order) => [order.id, order]));
  // Mutable: `paymentAllocation.createMany` writes into this map so a second call in the same test
  // sees the first call's own consumption already reflected, the way two real transactions would.
  const state = { allocatedByPaymentId: { ...allocatedByPaymentId } };

  return {
    order: {
      findFirst: vi.fn().mockImplementation((args: { where: { id: string; userId: string } }) => {
        const order = ordersById.get(args.where.id);
        return Promise.resolve(order ? { ...order } : null);
      }),
      // `recalculateOrderAllocationCache`'s own write, scoped to `{ id, userId }` (defense in depth).
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    storeAccountAdjustmentLine: {
      groupBy: vi.fn().mockImplementation((args: { where: { orderId: { in: string[] } } }) => {
        const ids: string[] = args.where.orderId?.in ?? [];
        return Promise.resolve(
          ids
            .filter((id) => (writtenOffByOrderId[id] ?? 0) > 0)
            .map((id) => ({ orderId: id, _sum: { amountMinor: writtenOffByOrderId[id] } })),
        );
      }),
    },
    storePayment: {
      // Scoped by (userId, storeId, currencyCode) in the real query; the fixture's own payment list
      // is already scoped to one such combination per test. Genuinely SORTS by the caller's own
      // `orderBy` (rather than trusting the test's own array order), so a mutation that drains
      // newest-first instead of oldest-first is actually caught by a test asserting drain order,
      // not passed by construction because the fixture happened to hand rows back pre-sorted.
      findMany: vi.fn().mockImplementation((args: { orderBy?: Array<Record<string, "asc" | "desc">> } = {}) => {
        const orderBy = args.orderBy ?? [];
        const sorted = [...payments].sort((a, b) => {
          for (const clause of orderBy) {
            const [field, direction] = Object.entries(clause)[0] as [keyof typeof a, "asc" | "desc"];
            const left = a[field];
            const right = b[field];
            let comparison = 0;
            if (left instanceof Date && right instanceof Date) comparison = left.getTime() - right.getTime();
            else if (left < right) comparison = -1;
            else if (left > right) comparison = 1;
            if (comparison !== 0) return direction === "asc" ? comparison : -comparison;
          }
          return 0;
        });
        return Promise.resolve(sorted.map((payment) => ({ ...payment })));
      }),
    },
    paymentAllocation: {
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
        if (args.by.includes("paymentId")) {
          return Promise.resolve(
            Object.entries(state.allocatedByPaymentId).map(([paymentId, sum]) => ({
              paymentId,
              _sum: { amountMinor: sum },
            })),
          );
        }
        // recalculateOrderAllocationCache's own "by orderId" read.
        return Promise.resolve(
          Object.entries(cacheAfterWriteByOrderId).map(([orderId, sum]) => ({ orderId, _sum: { amountMinor: sum } })),
        );
      }),
      createMany: vi.fn().mockImplementation((args: { data: Array<{ paymentId: string; amountMinor: number }> }) => {
        for (const row of args.data) {
          state.allocatedByPaymentId[row.paymentId] =
            (state.allocatedByPaymentId[row.paymentId] ?? 0) + row.amountMinor;
        }
        return Promise.resolve({ count: args.data.length });
      }),
    },
  };
}

/**
 * Fully stateful in-memory fixture for `runOrderCloseMoneyTransaction` (WO-08), the one caller that
 * runs `consumeUnassignedStoreMoneyOnOrderClose`, `resolveSettlementPlan`, and
 * `createStorePaymentInTx` against the SAME `tx` inside one transaction.
 *
 * Every other fixture in this file is deliberately static (a fixed map of canned responses),
 * because their functions under test only ever read a value once per call. This one cannot be: the
 * whole point of the "double-counting guard" tests is that consumption's own write
 * (`order.updateMany`) must be visible to the settlement read that follows it IN THE SAME transaction,
 * exactly as a real `tx` would show it. So `orders` and `payments` here are mutable, single sources
 * of truth that every mocked method reads from and writes into, instead of two independent static
 * maps that could silently drift apart.
 */
export type OrderCloseMoneyOrder = {
  id: string;
  storeId: string;
  currencyCode: string;
  totalCost: number;
  allocatedAmountMinor: number;
  /** `StoreAccountAdjustmentLine` total already written off against this order. Static per test. */
  writtenOffMinor?: number;
  /**
   * The order's own FX pair (F6, 2026-08-20 review): a settlement `StorePayment` must inherit it
   * exactly like `addOrderPayment` does for a single-order payment. Represented as a plain `number`
   * here rather than a `Prisma.Decimal`: the real column is `Decimal?`, but `Number(order.exchangeRate)`
   * is the only thing the production code ever does with it, so a plain number is behaviourally
   * identical for this fixture and avoids pulling in a Decimal constructor just for tests.
   */
  exchangeRate?: number | null;
  exchangeRateBaseCode?: string | null;
  items: Array<{ id: string; unitPrice: number | null; quantity: number; deliveryState: OrderItemDeliveryState }>;
};

export type OrderCloseMoneyPayment = {
  id: string;
  storeId: string;
  currencyCode: string;
  amount: number;
  paymentDate: Date;
  allocations: Array<{ orderId: string; orderItemId: string | null; amountMinor: number }>;
};

export type OrderCloseMoneyTxOptions = {
  orders: OrderCloseMoneyOrder[];
  /** Pre-existing `StorePayment` rows (e.g. the unassigned pool), mutated by both the consumption
   *  and the settlement writes exactly as one shared pool would be across two real transactions. */
  payments?: OrderCloseMoneyPayment[];
  storeExists?: boolean;
};

export type OrderCloseMoneyTx = ReturnType<typeof makeOrderCloseMoneyTx>;

export function makeOrderCloseMoneyTx(options: OrderCloseMoneyTxOptions) {
  const { orders, payments = [], storeExists = true } = options;

  const ordersById = new Map(
    orders.map((order) => [order.id, { ...order, items: order.items.map((i) => ({ ...i })) }]),
  );
  const paymentRows = payments.map((payment) => ({ ...payment, allocations: [...payment.allocations] }));
  let nextPaymentSuffix = 0;

  const allAllocations = () =>
    paymentRows.flatMap((payment) =>
      payment.allocations.map((allocation) => ({ ...allocation, paymentId: payment.id })),
    );

  return {
    store: {
      findFirst: vi.fn().mockResolvedValue(storeExists ? { id: "store-1" } : null),
    },
    order: {
      // Dispatches on the shape of `select`, matching each of this module's three distinct reads:
      // resolveSettlementPlan's `{ items: {...} }` (and `totalCost`), consumption's `{ storeId,
      // currencyCode, totalCost, allocatedAmountMinor }`, the money transaction's own bare `{
      // storeId, currencyCode }` (no `totalCost`), and loadAffectedOrderSnapshots's bare `{
      // totalCost, allocatedAmountMinor }`. Checked in order of specificity: `items` first, then
      // "wants totalCost" (consumption and loadAffectedOrderSnapshots both qualify and both get the
      // full row, which is harmless since each only reads the fields its own select named), and
      // only the storeId/currencyCode-only shape falls through to the narrowest reply.
      findFirst: vi.fn().mockImplementation((args: { where: { id: string }; select?: Record<string, unknown> }) => {
        const order = ordersById.get(args.where.id);
        if (!order) return Promise.resolve(null);
        const select = args.select ?? {};
        if (select.items) {
          return Promise.resolve({
            id: order.id,
            totalCost: order.totalCost,
            allocatedAmountMinor: order.allocatedAmountMinor,
            items: order.items.map((item) => ({ ...item })),
          });
        }
        if (select.totalCost) {
          return Promise.resolve({
            id: order.id,
            storeId: order.storeId,
            currencyCode: order.currencyCode,
            totalCost: order.totalCost,
            allocatedAmountMinor: order.allocatedAmountMinor,
          });
        }
        return Promise.resolve({
          storeId: order.storeId,
          currencyCode: order.currencyCode,
          exchangeRate: order.exchangeRate ?? null,
          exchangeRateBaseCode: order.exchangeRateBaseCode ?? null,
        });
      }),
      // validateAllocations's own read, keyed by id, always against the order(s) this settlement
      // targets (itself). Reads the SAME mutable order, so a post-consumption `allocatedAmountMinor`
      // is what the EXCEEDS_BALANCE ceiling sees here too.
      findMany: vi.fn().mockImplementation((args: { where: { id?: { in: string[] } } }) => {
        const ids = args.where.id?.in ?? [];
        return Promise.resolve(
          ids
            .map((id) => ordersById.get(id))
            .filter((order): order is NonNullable<typeof order> => order !== undefined)
            .map((order) => ({
              id: order.id,
              humanReadableId: `HR-${order.id}`,
              storeId: order.storeId,
              currencyCode: order.currencyCode,
              status: OrderStatus.OPEN,
              orderDate: new Date("2019-01-01T00:00:00Z"),
              totalCost: order.totalCost,
              allocatedAmountMinor: order.allocatedAmountMinor,
              items: order.items.map((item) => ({
                id: item.id,
                name: item.id,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
              })),
            })),
        );
      }),
      // `recalculateOrderAllocationCache`'s own write, scoped to `{ id, userId }` (defense in depth).
      updateMany: vi
        .fn()
        .mockImplementation(
          (args: { where: { id: string; userId: string }; data: { allocatedAmountMinor: number } }) => {
            const order = ordersById.get(args.where.id);
            if (order) order.allocatedAmountMinor = args.data.allocatedAmountMinor;
            return Promise.resolve({ count: order ? 1 : 0 });
          },
        ),
      // getStoreDebtMinor's own ceiling read: the store's whole committed total in that currency, no
      // per-test wiring needed since every settlement here stays within its own order's own balance.
      aggregate: vi.fn().mockImplementation((args: { where: { currencyCode: string } }) => {
        const sum = [...ordersById.values()]
          .filter((order) => order.currencyCode === args.where.currencyCode)
          .reduce((total, order) => total + order.totalCost, 0);
        return Promise.resolve({ _sum: { totalCost: sum } });
      }),
    },
    storePayment: {
      findMany: vi.fn().mockImplementation((args: { where: { storeId: string; currencyCode: string } }) => {
        const { storeId, currencyCode } = args.where;
        const matches = paymentRows.filter(
          (payment) => payment.storeId === storeId && payment.currencyCode === currencyCode,
        );
        const sorted = [...matches].sort(
          (a, b) => a.paymentDate.getTime() - b.paymentDate.getTime() || a.id.localeCompare(b.id),
        );
        return Promise.resolve(
          sorted.map((payment) => ({ id: payment.id, amount: payment.amount, paymentDate: payment.paymentDate })),
        );
      }),
      aggregate: vi.fn().mockImplementation((args: { where: { currencyCode: string } }) => {
        const sum = paymentRows
          .filter((payment) => payment.currencyCode === args.where.currencyCode)
          .reduce((total, payment) => total + payment.amount, 0);
        return Promise.resolve({ _sum: { amount: sum } });
      }),
      create: vi
        .fn()
        .mockImplementation(
          (args: { data: { storeId: string; currencyCode: string; amount: number; paymentDate: Date } }) => {
            const id = `settlement-payment-${nextPaymentSuffix++}`;
            paymentRows.push({
              id,
              storeId: args.data.storeId,
              currencyCode: args.data.currencyCode,
              amount: args.data.amount,
              paymentDate: args.data.paymentDate,
              allocations: [],
            });
            return Promise.resolve({ id });
          },
        ),
    },
    paymentAllocation: {
      // The undetailed-money condition (b): does the order already carry an `orderItemId IS NULL`
      // allocation? Reads the live allocation list, so a settlement written earlier in the same
      // batch is visible to the next order's own resolver call.
      findFirst: vi.fn().mockImplementation((args: { where: { orderId: string; orderItemId: null } }) => {
        const match = allAllocations().find(
          (allocation) => allocation.orderId === args.where.orderId && allocation.orderItemId === null,
        );
        return Promise.resolve(match ? { id: `${match.paymentId}-${match.orderId}` } : null);
      }),
      // Three distinct call shapes share this one mock, dispatched on `by`: "paymentId" is
      // `getStorePaymentRemainders`'s own read, "orderItemId" is the settlement resolver's and
      // `validateAllocations`'s per-item sum, and "orderId" is `recalculateOrderAllocationCache`'s.
      groupBy: vi.fn().mockImplementation((args: { by: string[]; where: Record<string, unknown> }) => {
        const all = allAllocations();
        if (args.by.includes("paymentId")) {
          const ids = (args.where.paymentId as { in?: string[] } | undefined)?.in ?? [];
          return Promise.resolve(
            ids.map((paymentId) => ({
              paymentId,
              _sum: {
                amountMinor: all.filter((a) => a.paymentId === paymentId).reduce((s, a) => s + a.amountMinor, 0),
              },
            })),
          );
        }
        if (args.by.includes("orderItemId")) {
          const ids = (args.where.orderItemId as { in?: string[] } | undefined)?.in ?? [];
          return Promise.resolve(
            ids
              .filter((orderItemId) => all.some((a) => a.orderItemId === orderItemId))
              .map((orderItemId) => ({
                orderItemId,
                _sum: {
                  amountMinor: all.filter((a) => a.orderItemId === orderItemId).reduce((s, a) => s + a.amountMinor, 0),
                },
              })),
          );
        }
        // "orderId": recalculateOrderAllocationCache.
        const ids = (args.where.orderId as { in?: string[] } | undefined)?.in ?? [];
        return Promise.resolve(
          ids.map((orderId) => ({
            orderId,
            _sum: { amountMinor: all.filter((a) => a.orderId === orderId).reduce((s, a) => s + a.amountMinor, 0) },
          })),
        );
      }),
      createMany: vi
        .fn()
        .mockImplementation(
          (args: {
            data: Array<{ paymentId: string; orderId: string; orderItemId: string | null; amountMinor: number }>;
          }) => {
            for (const row of args.data) {
              const payment = paymentRows.find((p) => p.id === row.paymentId);
              if (payment)
                payment.allocations.push({
                  orderId: row.orderId,
                  orderItemId: row.orderItemId,
                  amountMinor: row.amountMinor,
                });
            }
            return Promise.resolve({ count: args.data.length });
          },
        ),
      // listOrderPaymentRecords's own read (loadAffectedOrderSnapshots): none of these tests assert
      // on the returned `affectedOrders.payments` field, so an empty ledger is a safe simplification.
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }),
    },
    orderItem: {
      // Every product on an order tracked by this fixture is reachable for `declarePaidItemIds`:
      // these tests are about the money, not this narrower ownership guard (already covered by
      // `storePaymentMutations.test.ts`).
      findMany: vi.fn().mockImplementation((args: { where: { id: { in: string[] } } }) => {
        const known = new Set([...ordersById.values()].flatMap((order) => order.items.map((item) => item.id)));
        return Promise.resolve(args.where.id.in.filter((id) => known.has(id)).map((id) => ({ id })));
      }),
      count: vi.fn().mockImplementation((args: { where: { id: { in: string[] } } }) => {
        const known = new Set([...ordersById.values()].flatMap((order) => order.items.map((item) => item.id)));
        return Promise.resolve(args.where.id.in.filter((id) => known.has(id)).length);
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: null }),
    },
    storeAccountAdjustmentLine: {
      groupBy: vi.fn().mockImplementation((args: { where: { orderId: { in: string[] } } }) => {
        const ids = args.where.orderId?.in ?? [];
        return Promise.resolve(
          ids
            .filter((id) => (ordersById.get(id)?.writtenOffMinor ?? 0) > 0)
            .map((id) => ({ orderId: id, _sum: { amountMinor: ordersById.get(id)!.writtenOffMinor } })),
        );
      }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }),
    },
    // Test-only accessor: lets a test read back the live order/payment state without re-deriving it
    // from the individual mock call histories.
    __state: { ordersById, paymentRows },
  };
}

/** Wires a fake `$transaction` on the given `prismaMock` so `runOrderCloseMoneyTransaction`'s
 *  per-order `runSerializableTransaction` calls all hand the SAME stateful `tx` to their callback,
 *  exactly as two sequential real transactions against the same rows would. */
export function runOrderCloseMoneyTx(prismaMock: { $transaction: ReturnType<typeof vi.fn> }, tx: unknown): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

/**
 * Fixture for `restoreSettlementPayments`'s own ownership verification (F2 of the 2026-08-20
 * adversarial review): every id a restore snapshot names (`settledByDeliveryId`, `storeId`, each
 * allocation's `orderId` and `orderItemId`) must resolve against the caller BEFORE the first write.
 *
 * Deliberately separate from {@link makeOrderCloseMoneyTx}: that fixture models the write side of a
 * settlement (consumption + `createStorePaymentInTx`), which `restoreSettlementPayments` never calls
 * (it writes `StorePayment` / `PaymentAllocation` rows directly, verbatim). This one models only what
 * the ownership pre-checks and the verbatim writes themselves touch.
 *
 * Records the caller does NOT own are simply absent from the corresponding list: `findMany` mocks
 * dispatch on which ids are actually reachable, exactly as a real `{ id: { in }, userId }` query would
 * silently omit a row belonging to someone else, rather than erroring.
 */
export type RestoreSettlementDelivery = { id: string };
export type RestoreSettlementStore = { id: string };
export type RestoreSettlementOrder = { id: string; storeId: string };
export type RestoreSettlementOrderItem = { id: string; orderId: string };

export type RestoreSettlementTxOptions = {
  /** Delivery ids reachable for this caller (`{ id, userId }`). */
  deliveries?: RestoreSettlementDelivery[];
  /** Store ids that exist at all (existence only; no `userId` on `Store`). */
  stores?: RestoreSettlementStore[];
  /** Order ids reachable for this caller (`{ id, userId }`), with the store they actually belong to. */
  orders?: RestoreSettlementOrder[];
  /** Order item ids reachable for this caller (`{ id, userId }`), with the order they actually belong to. */
  orderItems?: RestoreSettlementOrderItem[];
  /** What `recalculateOrderAllocationCache`'s own `groupBy` should report per order id afterward. */
  cacheAfterWriteByOrderId?: Record<string, number>;
};

export type RestoreSettlementTx = ReturnType<typeof makeRestoreSettlementTx>;

export function makeRestoreSettlementTx(options: RestoreSettlementTxOptions = {}) {
  const { deliveries = [], stores = [], orders = [], orderItems = [], cacheAfterWriteByOrderId = {} } = options;

  const deliveryIds = new Set(deliveries.map((delivery) => delivery.id));
  const storeIds = new Set(stores.map((store) => store.id));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const itemById = new Map(orderItems.map((item) => [item.id, item]));

  type CreatedPayment = {
    id: string;
    storeId: string;
    amount: number;
    paymentDate: Date;
    exchangeRate: unknown;
    exchangeRateBaseCode: string | null;
    settledByDeliveryId: string | null;
    allocations: Array<{ orderId: string; orderItemId: string | null; amountMinor: number }>;
  };
  const createdPayments: CreatedPayment[] = [];
  let nextId = 0;

  return {
    delivery: {
      findMany: vi.fn().mockImplementation((args: { where: { id: { in: string[] } } }) => {
        const ids: string[] = args.where.id?.in ?? [];
        return Promise.resolve(ids.filter((id) => deliveryIds.has(id)).map((id) => ({ id })));
      }),
    },
    store: {
      findMany: vi.fn().mockImplementation((args: { where: { id: { in: string[] } } }) => {
        const ids: string[] = args.where.id?.in ?? [];
        return Promise.resolve(ids.filter((id) => storeIds.has(id)).map((id) => ({ id })));
      }),
    },
    order: {
      findMany: vi.fn().mockImplementation((args: { where: { id: { in: string[] } } }) => {
        const ids: string[] = args.where.id?.in ?? [];
        return Promise.resolve(
          ids
            .map((id) => orderById.get(id))
            .filter((order): order is RestoreSettlementOrder => order !== undefined)
            .map((order) => ({ id: order.id, storeId: order.storeId })),
        );
      }),
      // `recalculateOrderAllocationCache`'s own write, scoped to `{ id, userId }` (defense in depth).
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderItem: {
      findMany: vi.fn().mockImplementation((args: { where: { id: { in: string[] } } }) => {
        const ids: string[] = args.where.id?.in ?? [];
        return Promise.resolve(
          ids
            .map((id) => itemById.get(id))
            .filter((item): item is RestoreSettlementOrderItem => item !== undefined)
            .map((item) => ({ id: item.id, orderId: item.orderId })),
        );
      }),
    },
    storePayment: {
      create: vi.fn().mockImplementation(
        (args: {
          data: {
            storeId: string;
            amount: number;
            paymentDate: Date;
            exchangeRate: unknown;
            exchangeRateBaseCode: string | null;
            settledByDeliveryId: string | null;
          };
        }) => {
          const id = `restored-payment-${nextId++}`;
          createdPayments.push({
            id,
            storeId: args.data.storeId,
            amount: args.data.amount,
            paymentDate: args.data.paymentDate,
            exchangeRate: args.data.exchangeRate,
            exchangeRateBaseCode: args.data.exchangeRateBaseCode,
            settledByDeliveryId: args.data.settledByDeliveryId,
            allocations: [],
          });
          return Promise.resolve({ id });
        },
      ),
    },
    paymentAllocation: {
      createMany: vi
        .fn()
        .mockImplementation(
          (args: {
            data: Array<{ paymentId: string; orderId: string; orderItemId: string | null; amountMinor: number }>;
          }) => {
            for (const row of args.data) {
              const payment = createdPayments.find((p) => p.id === row.paymentId);
              if (payment) {
                payment.allocations.push({
                  orderId: row.orderId,
                  orderItemId: row.orderItemId,
                  amountMinor: row.amountMinor,
                });
              }
            }
            return Promise.resolve({ count: args.data.length });
          },
        ),
      groupBy: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            Object.entries(cacheAfterWriteByOrderId).map(([orderId, sum]) => ({ orderId, _sum: { amountMinor: sum } })),
          ),
        ),
    },
    // Test-only accessor: lets a test read back what was actually written without re-deriving it
    // from the individual mock call histories.
    __state: { createdPayments },
  };
}

/** Wires a fake `$transaction` on the given `prismaMock` to hand `tx` straight to the callback,
 *  matching {@link runStorePaymentTx}'s own shape for `restoreSettlementPayments`'s fixture. */
export function runRestoreSettlementTx(prismaMock: { $transaction: ReturnType<typeof vi.fn> }, tx: unknown): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}
