import { vi } from "vitest";
import { OrderStatus } from "../../../../../generated/prisma/client";

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
 * `orderId`) + `order.update` for the write and cache refresh, and finally `order.findFirst` +
 * `paymentAllocation.findMany` per affected order for the returned snapshots.
 *
 * Every mocked method here dispatches on the shape of its own arguments (rather than call order),
 * so a single fixture instance answers every call in that sequence correctly regardless of which
 * refusal branch a given test is exercising.
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

type DebtByCurrency = Record<string, { committedMinor?: number; paidMinor?: number; lostMinor?: number }>;

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
      update: vi.fn().mockResolvedValue({}),
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
  };
}

/** Wires a fake `$transaction` on the given `prismaMock` to hand `tx` straight to the callback. */
export function runStorePaymentTx(prismaMock: { $transaction: ReturnType<typeof vi.fn> }, tx: unknown): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}
