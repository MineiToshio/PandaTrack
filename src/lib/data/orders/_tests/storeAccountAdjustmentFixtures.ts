import { vi } from "vitest";
import { OrderStatus } from "../../../../../generated/prisma/client";

/**
 * Shared fake-transaction builder for the store account reconciliation write path (WO-11).
 *
 * `createStoreAccountAdjustment` walks a fixed sequence of Prisma calls inside its Serializable
 * transaction: `store.findFirst`, `storePayment.findMany` (the unassigned-pool read, via
 * `getUnassignedStoreMoneyMinor`), `order.findMany` (resolving every line's own order), and
 * `storeAccountAdjustmentLine.groupBy` (the canonical open-balance read, via
 * `openBalanceMinorByOrderId`), then `storeAccountAdjustment.create` +
 * `storeAccountAdjustmentLine.createMany` for the write.
 *
 * Every mocked method dispatches on the shape of its own arguments (rather than call order), so one
 * fixture instance answers every call in that sequence correctly regardless of which refusal branch
 * a given test exercises. This mirrors `storePaymentFixtures.ts`'s own documented approach; it is a
 * separate file (not an edit to that one) because another agent owns it concurrently.
 */

export type FixtureOrder = {
  id: string;
  storeId: string;
  currencyCode: string;
  status: OrderStatus;
  orderDate: Date;
  humanReadableId: string;
  totalCost: number;
  allocatedAmountMinor: number;
};

export function makeFixtureOrder(overrides: Partial<FixtureOrder> = {}): FixtureOrder {
  return {
    id: "order-1",
    storeId: "store-1",
    currencyCode: "PEN",
    status: OrderStatus.OPEN,
    orderDate: new Date("2020-01-01T00:00:00Z"),
    humanReadableId: "ORD-20200101-01",
    totalCost: 10000,
    allocatedAmountMinor: 0,
    ...overrides,
  };
}

export type CreateStoreAccountAdjustmentTxOptions = {
  storeExists?: boolean;
  /** Orders `order.findMany` can resolve, keyed by their own id. Filtered by the same
   *  `{ id: { in }, userId, storeId, currencyCode }` shape the mutation queries with. */
  orders?: FixtureOrder[];
  /** The store's own `userId` and `storeId` scoping the fixture enforces on `order.findMany`. */
  scopeUserId?: string;
  scopeStoreId?: string;
  scopeCurrencyCode?: string;
  /** The store's unassigned pool, expressed as `StorePayment` rows whose remainder
   *  (`amount - Σ allocations`) sums to the pool `getUnassignedStoreMoneyMinor` reads. Defaults to
   *  no payments at all, i.e. no parked money anywhere. */
  unassignedPayments?: Array<{ id: string; amount: number; paymentDate: Date }>;
  /** What is already allocated against each of `unassignedPayments`, keyed by payment id. */
  allocatedByPaymentId?: Record<string, number>;
  /** What earlier `StoreAccountAdjustment` lines have already written off, per order id. Feeds
   *  `openBalanceMinorByOrderId`'s own `storeAccountAdjustmentLine.groupBy` read. */
  writtenOffByOrderId?: Record<string, number>;
  createdAdjustmentId?: string;
  /** `User.timezone` the mutation reads to resolve the collector's own civil day
   *  (`resolveTodayStart`). `null` (the default) exercises the UTC fallback. */
  userTimezone?: string | null;
};

export type CreateStoreAccountAdjustmentTx = ReturnType<typeof makeCreateStoreAccountAdjustmentTx>;

export function makeCreateStoreAccountAdjustmentTx(options: CreateStoreAccountAdjustmentTxOptions = {}) {
  const {
    storeExists = true,
    orders = [],
    scopeUserId = "user-1",
    scopeStoreId = "store-1",
    scopeCurrencyCode = "PEN",
    unassignedPayments = [],
    allocatedByPaymentId = {},
    writtenOffByOrderId = {},
    createdAdjustmentId = "adjustment-new",
    userTimezone = null,
  } = options;

  const ordersById = new Map(orders.map((order) => [order.id, order]));

  return {
    store: {
      findFirst: vi.fn().mockResolvedValue(storeExists ? { id: scopeStoreId } : null),
    },
    // Read to resolve the collector's own civil day (`resolveTodayStart`) for `adjustmentDate`.
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: userTimezone }),
    },
    order: {
      // Resolves every line's own order by `{ id: { in }, userId, storeId, currencyCode }`, exactly
      // the shape `createStoreAccountAdjustment` queries with. An order outside this collector, this
      // store or this currency is simply absent from the result, which is what makes it NOT_FOUND.
      findMany: vi
        .fn()
        .mockImplementation(
          (args: { where: { id: { in: string[] }; userId: string; storeId: string; currencyCode: string } }) => {
            const ids: string[] = args.where.id?.in ?? [];
            if (
              args.where.userId !== scopeUserId ||
              args.where.storeId !== scopeStoreId ||
              args.where.currencyCode !== scopeCurrencyCode
            ) {
              return Promise.resolve([]);
            }
            return Promise.resolve(
              ids
                .map((id) => ordersById.get(id))
                .filter(
                  (order): order is FixtureOrder =>
                    order !== undefined && order.storeId === scopeStoreId && order.currencyCode === scopeCurrencyCode,
                ),
            );
          },
        ),
    },
    // The unassigned pool (`getUnassignedStoreMoneyMinor` → `getStorePaymentRemainders`): reads
    // every `StorePayment` of the pair, then every `PaymentAllocation` against them. The write
    // methods on both models are stubbed too, deliberately, so the Dashboard-isolation test can
    // assert they were never called rather than merely never having existed to call.
    storePayment: {
      findMany: vi
        .fn()
        .mockImplementation(() => Promise.resolve(unassignedPayments.map((payment) => ({ ...payment })))),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    paymentAllocation: {
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
        if (args.by.includes("paymentId")) {
          return Promise.resolve(
            Object.entries(allocatedByPaymentId).map(([paymentId, sum]) => ({ paymentId, _sum: { amountMinor: sum } })),
          );
        }
        return Promise.resolve([]);
      }),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Read by `openBalanceMinorByOrderId` for the per-line ceiling, net of every earlier
    // declaration's lines.
    storeAccountAdjustmentLine: {
      groupBy: vi.fn().mockImplementation((args: { where: { userId: string; orderId: { in: string[] } } }) => {
        const ids: string[] = args.where.orderId?.in ?? [];
        return Promise.resolve(
          ids
            .filter((id) => (writtenOffByOrderId[id] ?? 0) > 0)
            .map((id) => ({ orderId: id, _sum: { amountMinor: writtenOffByOrderId[id] } })),
        );
      }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    storeAccountAdjustment: {
      create: vi.fn().mockResolvedValue({ id: createdAdjustmentId }),
      findFirst: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
}

/** Wires a fake `$transaction` on the given `prismaMock` to hand `tx` straight to the callback. */
export function runStoreAccountAdjustmentTx(prismaMock: { $transaction: ReturnType<typeof vi.fn> }, tx: unknown): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

export type DeleteStoreAccountAdjustmentTxOptions = {
  /** The adjustment `storeAccountAdjustment.findFirst` can resolve, or `undefined` for "not found". */
  existingAdjustment?: { id: string } | null;
};

export function makeDeleteStoreAccountAdjustmentTx(options: DeleteStoreAccountAdjustmentTxOptions = {}) {
  const { existingAdjustment = null } = options;

  return {
    storeAccountAdjustment: {
      findFirst: vi.fn().mockResolvedValue(existingAdjustment),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
}

export type PreviewOrder = {
  id: string;
  orderDate: Date;
  humanReadableId: string;
  totalCost: number;
  allocatedAmountMinor: number;
  status: OrderStatus;
};

export function makePreviewOrder(overrides: Partial<PreviewOrder> = {}): PreviewOrder {
  return {
    id: "order-1",
    orderDate: new Date("2020-01-01T00:00:00Z"),
    humanReadableId: "ORD-20200101-01",
    totalCost: 10000,
    allocatedAmountMinor: 0,
    status: OrderStatus.OPEN,
    ...overrides,
  };
}

export type PreviewPrismaOptions = {
  orders?: PreviewOrder[];
  unassignedPayments?: Array<{ id: string; amount: number; paymentDate: Date }>;
  allocatedByPaymentId?: Record<string, number>;
  writtenOffByOrderId?: Record<string, number>;
  adjustments?: Array<{
    id: string;
    adjustmentDate: Date;
    createdAt: Date;
    reason: string;
    lines: Array<{
      orderId: string;
      amountMinor: number;
      order: { orderDate: Date; humanReadableId: string; status?: OrderStatus };
    }>;
  }>;
  /** What `listStoreAccountAdjustmentCurrencyCodes`'s own `distinct` read answers. */
  currencyCodes?: string[];
};

/**
 * Fake `prisma` singleton for the two read-only query functions. Both take the module-level
 * `prisma` import directly (no `$transaction`), so this is wired straight onto the mocked
 * `@/lib/prisma` export rather than through a `$transaction` callback.
 */
export function makePreviewPrisma(options: PreviewPrismaOptions = {}) {
  const {
    orders = [],
    unassignedPayments = [],
    allocatedByPaymentId = {},
    writtenOffByOrderId = {},
    adjustments = [],
    currencyCodes = [],
  } = options;

  return {
    order: {
      findMany: vi.fn().mockResolvedValue(orders.map((order) => ({ ...order }))),
    },
    storePayment: {
      findMany: vi
        .fn()
        .mockImplementation(() => Promise.resolve(unassignedPayments.map((payment) => ({ ...payment })))),
    },
    paymentAllocation: {
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
        if (args.by.includes("paymentId")) {
          return Promise.resolve(
            Object.entries(allocatedByPaymentId).map(([paymentId, sum]) => ({ paymentId, _sum: { amountMinor: sum } })),
          );
        }
        return Promise.resolve([]);
      }),
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
    storeAccountAdjustment: {
      // Dispatches on the shape of its own arguments: `listStoreAccountAdjustments` reads full rows
      // (with `select.lines`), `listStoreAccountAdjustmentCurrencyCodes` reads a bare `distinct`
      // list of currency codes. One fixture answers both call shapes correctly.
      findMany: vi.fn().mockImplementation((args: { distinct?: string[] }) => {
        if (args?.distinct?.includes("currencyCode")) {
          return Promise.resolve(currencyCodes.map((currencyCode) => ({ currencyCode })));
        }
        return Promise.resolve(adjustments);
      }),
    },
  };
}
