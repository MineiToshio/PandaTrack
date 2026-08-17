import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: vi.fn().mockResolvedValue(null),
}));

import { listOrderPaymentRecords } from "../orderPaymentAllocations";
import { getOrderDetail } from "../orderQueries";

/**
 * D0/D1 — an order's ledger is one row per TRANSFER, in every reader.
 *
 * Until now every payment in the system carried exactly one allocation, so "one allocation = one
 * payment row" held by accident. A payment broken down across an order's products carries N+1, and
 * the readers must not draw it as N+1 payments each with its own delete button.
 *
 * The assertions deliberately cover `getOrderDetail` as well as `listOrderPaymentRecords`. Fixing
 * only the second is the worst of the three outcomes and the one a single-reader test lets through:
 * the FIRST paint of a broken-down payment (from `getOrderDetail`) would show three rows, an add
 * would collapse them to one (from `listOrderPaymentRecords`), and the `router.refresh()` right
 * after would split them again.
 */

const PAYMENT_DATE = new Date("2026-08-01T00:00:00.000Z");

type AllocationFixture = {
  id: string;
  amountMinor: number;
  orderItemId?: string | null;
  paymentId?: string;
  paymentTotal?: number;
  /** Every allocation the PARENT payment carries, this order's included. */
  siblings?: Array<{ orderId: string; amountMinor: number; orderItemId: string | null }>;
};

/** One row exactly as `ORDER_PAYMENT_ALLOCATION_SELECT` projects it. */
function allocationRow(fixture: AllocationFixture) {
  const paymentId = fixture.paymentId ?? "payment-1";
  const orderItemId = fixture.orderItemId ?? null;
  return {
    id: fixture.id,
    amountMinor: fixture.amountMinor,
    orderItemId,
    payment: {
      id: paymentId,
      amount: fixture.paymentTotal ?? fixture.amountMinor,
      paymentDate: PAYMENT_DATE,
      allocations: fixture.siblings ?? [{ orderId: "order-1", amountMinor: fixture.amountMinor, orderItemId }],
    },
  };
}

/** A payment of 65.00 broken down across two products of the same order: 32.50 + 32.50. */
function splitPaymentRows() {
  const siblings = [
    { orderId: "order-1", amountMinor: 3250, orderItemId: "item-1" },
    { orderId: "order-1", amountMinor: 3250, orderItemId: "item-2" },
  ];
  return [
    allocationRow({ id: "alloc-1", amountMinor: 3250, orderItemId: "item-1", paymentTotal: 6500, siblings }),
    allocationRow({ id: "alloc-2", amountMinor: 3250, orderItemId: "item-2", paymentTotal: 6500, siblings }),
  ];
}

function makeTx(rows: ReturnType<typeof allocationRow>[]) {
  return { paymentAllocation: { findMany: vi.fn().mockResolvedValue(rows) } };
}

function makeOrderDetailRow(paymentAllocations: ReturnType<typeof allocationRow>[]) {
  return {
    id: "order-1",
    humanReadableId: "ORD-20260814-02",
    storeId: "store-1",
    store: { id: "store-1", name: "Store", slug: "store", status: "APPROVED", removalReason: null, logoUrl: null },
    orderDate: new Date("2026-07-01T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "PEN",
    exchangeRate: null,
    exchangeRateBaseCode: null,
    totalCost: 8100,
    note: null,
    status: "OPEN",
    cancellationReason: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    items: [
      {
        id: "item-1",
        name: "Kingdom 23",
        quantity: 1,
        unitPrice: 4050,
        productTypeKey: null,
        position: 0,
        deliveryState: "NONE",
        paidDeclaredAt: null,
        deliveryItems: [],
      },
      {
        id: "item-2",
        name: "Kingdom 24",
        quantity: 1,
        unitPrice: 4050,
        productTypeKey: null,
        position: 1,
        deliveryState: "NONE",
        paidDeclaredAt: null,
        deliveryItems: [],
      },
    ],
    paymentAllocations,
    history: [],
  };
}

describe("an order's payment ledger groups by transfer (D0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collapses a payment split across two products into ONE record in listOrderPaymentRecords", async () => {
    const tx = makeTx(splitPaymentRows());

    const records = await listOrderPaymentRecords(tx as never, "order-1", "user-1");

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "payment-1",
      paymentId: "payment-1",
      amount: 6500,
      paymentTotalMinor: 6500,
      detailedLineCount: 2,
      isShared: false,
      isPartialClaim: false,
    });
  });

  it("collapses the same payment into ONE record in getOrderDetail, which paints it first", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeOrderDetailRow(splitPaymentRows()));

    const detail = await getOrderDetail("order-1", "user-1");

    expect(detail?.payments).toHaveLength(1);
    expect(detail?.payments[0]).toMatchObject({ id: "payment-1", amount: 6500, detailedLineCount: 2 });
  });

  it("keeps the order's paid total right while collapsing, so the hero does not move", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeOrderDetailRow(splitPaymentRows()));

    const detail = await getOrderDetail("order-1", "user-1");

    // 32.50 + 32.50 against a total of 81.00. Grouping must sum the claim, never keep one line.
    expect(detail?.paidAmount).toBe(6500);
    expect(detail?.remainingAmount).toBe(1600);
  });

  it("still emits one record per payment when a payment carries the residual line too", async () => {
    const siblings = [
      { orderId: "order-1", amountMinor: 3250, orderItemId: "item-1" },
      { orderId: "order-1", amountMinor: 1000, orderItemId: null },
    ];
    const tx = makeTx([
      allocationRow({ id: "alloc-1", amountMinor: 3250, orderItemId: "item-1", paymentTotal: 4250, siblings }),
      allocationRow({ id: "alloc-2", amountMinor: 1000, orderItemId: null, paymentTotal: 4250, siblings }),
    ]);

    const records = await listOrderPaymentRecords(tx as never, "order-1", "user-1");

    expect(records).toHaveLength(1);
    // The residual is money, so it counts towards the claim; it names no product, so it does not
    // count towards `detailedLineCount`.
    expect(records[0]).toMatchObject({ amount: 4250, detailedLineCount: 1 });
  });

  it("keeps two genuinely separate transfers as two records, newest first", async () => {
    const older = {
      ...allocationRow({ id: "alloc-old", amountMinor: 1000, paymentId: "payment-old" }),
    };
    older.payment.paymentDate = new Date("2026-06-01T00:00:00.000Z");
    const tx = makeTx([allocationRow({ id: "alloc-new", amountMinor: 2000, paymentId: "payment-new" }), older]);

    const records = await listOrderPaymentRecords(tx as never, "order-1", "user-1");

    expect(records.map((record) => record.id)).toEqual(["payment-new", "payment-old"]);
  });
});

describe("isShared counts ORDERS, not lines (D1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call a payment shared when three of its lines belong to this same order", async () => {
    const siblings = [
      { orderId: "order-1", amountMinor: 2000, orderItemId: "item-1" },
      { orderId: "order-1", amountMinor: 2000, orderItemId: "item-2" },
      { orderId: "order-1", amountMinor: 2500, orderItemId: null },
    ];
    const tx = makeTx([
      allocationRow({ id: "a1", amountMinor: 2000, orderItemId: "item-1", paymentTotal: 6500, siblings }),
      allocationRow({ id: "a2", amountMinor: 2000, orderItemId: "item-2", paymentTotal: 6500, siblings }),
      allocationRow({ id: "a3", amountMinor: 2500, orderItemId: null, paymentTotal: 6500, siblings }),
    ]);

    const records = await listOrderPaymentRecords(tx as never, "order-1", "user-1");

    expect(records).toHaveLength(1);
    expect(records[0].isShared).toBe(false);
    // The claim covers the payment in full, so it is not a partial claim either: both flags drive
    // which delete-confirm modal opens.
    expect(records[0].isPartialClaim).toBe(false);
  });

  it("does call it shared when its two lines belong to two different orders", async () => {
    const siblings = [
      { orderId: "order-1", amountMinor: 4000, orderItemId: null },
      { orderId: "order-2", amountMinor: 2500, orderItemId: null },
    ];
    const tx = makeTx([allocationRow({ id: "a1", amountMinor: 4000, paymentTotal: 6500, siblings })]);

    const records = await listOrderPaymentRecords(tx as never, "order-1", "user-1");

    expect(records[0].isShared).toBe(true);
    // A shared payment is never a "partial claim": the rest of it is explaining another order, not
    // sitting unclaimed.
    expect(records[0].isPartialClaim).toBe(false);
  });

  it("flags a partial claim off the SUM of this order's lines, not off the first one", async () => {
    // Two lines of 20.00 against a payment of 65.00: this order claims 40.00 and 25.00 rides along
    // unclaimed. Read off a single line, the claim would look like 20.00 of 65.00.
    const siblings = [
      { orderId: "order-1", amountMinor: 2000, orderItemId: "item-1" },
      { orderId: "order-1", amountMinor: 2000, orderItemId: "item-2" },
    ];
    const tx = makeTx([
      allocationRow({ id: "a1", amountMinor: 2000, orderItemId: "item-1", paymentTotal: 6500, siblings }),
      allocationRow({ id: "a2", amountMinor: 2000, orderItemId: "item-2", paymentTotal: 6500, siblings }),
    ]);

    const records = await listOrderPaymentRecords(tx as never, "order-1", "user-1");

    expect(records[0]).toMatchObject({ amount: 4000, isPartialClaim: true, isShared: false });
  });
});
