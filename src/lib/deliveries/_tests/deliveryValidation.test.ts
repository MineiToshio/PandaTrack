import { describe, expect, it } from "vitest";
import {
  deliveryCreateSchema,
  deliveryQuickArrivalSchema,
  deliveryStoreArrivalSchema,
  retrySettlementSchema,
  settlementContextRequestSchema,
  undoReopenSchema,
} from "../deliveryValidation";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx0";

describe("deliveryCreateSchema zero-decimal currency validation", () => {
  const baseInput = {
    storeId: VALID_CUID,
    deliveryDate: new Date("2020-01-01"),
    productIds: [VALID_CUID],
  };

  it("accepts a whole-major cost for a zero-decimal currency", () => {
    const result = deliveryCreateSchema.safeParse({ ...baseInput, currencyCode: "CLP", cost: 500000 });
    expect(result.success).toBe(true);
  });

  it("rejects a fractional-subunit cost for a zero-decimal currency", () => {
    const result = deliveryCreateSchema.safeParse({ ...baseInput, currencyCode: "JPY", cost: 500050 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("COST_FRACTIONAL_SUBUNITS");
    }
  });

  it("does not apply the whole-major rule to standard currencies", () => {
    const result = deliveryCreateSchema.safeParse({ ...baseInput, currencyCode: "USD", cost: 500050 });
    expect(result.success).toBe(true);
  });
});

describe("deliveryCreateSchema arrival date", () => {
  const baseInput = {
    storeId: VALID_CUID,
    deliveryDate: new Date("2026-01-10T00:00:00.000Z"),
    cost: 0,
    currencyCode: "USD",
    productIds: [VALID_CUID],
  };

  it("accepts an absent receivedDate (the wizard path)", () => {
    expect(deliveryCreateSchema.safeParse(baseInput).success).toBe(true);
  });

  it("accepts a receivedDate on or after the shipping date", () => {
    const result = deliveryCreateSchema.safeParse({
      ...baseInput,
      receivedDate: new Date("2026-01-12T00:00:00.000Z"),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a receivedDate earlier than the shipping date", () => {
    const result = deliveryCreateSchema.safeParse({
      ...baseInput,
      receivedDate: new Date("2026-01-09T00:00:00.000Z"),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("RECEIVED_BEFORE_SHIPPED");
    }
  });

  it("rejects a receivedDate in the future", () => {
    const result = deliveryCreateSchema.safeParse({
      ...baseInput,
      receivedDate: new Date(Date.now() + 86_400_000),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("RECEIVED_DATE_IN_FUTURE");
    }
  });
});

/**
 * The store-scoped arrival payload is the per-order quick arrival with the scope key swapped. Its
 * bounds and refinements are asserted here rather than assumed identical, because the two schemas
 * feed the same `createDelivery` transaction and a drift between them would only surface in
 * production, on whichever path was left weaker.
 */
describe("deliveryStoreArrivalSchema", () => {
  const YESTERDAY = addUtcDays(utcMidnightToday(), -1);

  function buildInput(overrides: Record<string, unknown> = {}) {
    return {
      storeId: VALID_CUID,
      productIds: [VALID_CUID],
      receivedDate: YESTERDAY,
      shippedDate: null,
      cost: 0,
      currencyCode: "USD",
      exchangeRate: null,
      settleRemainder: true,
      ...overrides,
    };
  }

  it("accepts a store-scoped selection", () => {
    expect(deliveryStoreArrivalSchema.safeParse(buildInput()).success).toBe(true);
  });

  it("scopes by store, not by order: an orderId is not a substitute for a storeId", () => {
    const { storeId: _storeId, ...withoutStore } = buildInput();
    const result = deliveryStoreArrivalSchema.safeParse({ ...withoutStore, orderId: VALID_CUID });
    expect(result.success).toBe(false);
  });

  it("rejects a storeId that is not a cuid", () => {
    const result = deliveryStoreArrivalSchema.safeParse(buildInput({ storeId: "not-a-cuid" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("INVALID_STORE_ID");
  });

  it("rejects an empty selection", () => {
    const result = deliveryStoreArrivalSchema.safeParse(buildInput({ productIds: [] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("NO_PRODUCTS_SELECTED");
  });

  it("accepts a selection at the 200-product ceiling", () => {
    const productIds = Array.from({ length: 200 }, () => VALID_CUID);
    expect(deliveryStoreArrivalSchema.safeParse(buildInput({ productIds })).success).toBe(true);
  });

  it("rejects a selection past the 200-product ceiling", () => {
    const productIds = Array.from({ length: 201 }, () => VALID_CUID);
    const result = deliveryStoreArrivalSchema.safeParse(buildInput({ productIds }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("TOO_MANY_PRODUCTS");
  });

  it("rejects a future arrival date", () => {
    const result = deliveryStoreArrivalSchema.safeParse(
      buildInput({ receivedDate: addUtcDays(utcMidnightToday(), 1) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("RECEIVED_DATE_IN_FUTURE");
  });

  it("rejects a box that arrived before it was dispatched", () => {
    const result = deliveryStoreArrivalSchema.safeParse(
      buildInput({ receivedDate: YESTERDAY, shippedDate: utcMidnightToday() }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("RECEIVED_BEFORE_SHIPPED");
  });

  it("rejects a fractional-subunit cost for a zero-decimal currency", () => {
    const result = deliveryStoreArrivalSchema.safeParse(buildInput({ currencyCode: "JPY", cost: 500050 }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("COST_FRACTIONAL_SUBUNITS");
  });
});

describe("settlement-on-arrival schema fields (WO-08)", () => {
  const YESTERDAY = addUtcDays(utcMidnightToday(), -1);

  function buildQuickArrivalInput(overrides: Record<string, unknown> = {}) {
    return {
      orderId: VALID_CUID,
      productIds: [VALID_CUID],
      receivedDate: YESTERDAY,
      shippedDate: null,
      cost: 0,
      currencyCode: "USD",
      exchangeRate: null,
      settleRemainder: true,
      ...overrides,
    };
  }

  it("requires settleRemainder: a payload silently omitting it is rejected, not defaulted", () => {
    const { settleRemainder: _settleRemainder, ...withoutFlag } = buildQuickArrivalInput();
    const result = deliveryQuickArrivalSchema.safeParse(withoutFlag);
    expect(result.success).toBe(false);
  });

  it("accepts settleRemainder false (the collector left the checkbox unchecked)", () => {
    expect(deliveryQuickArrivalSchema.safeParse(buildQuickArrivalInput({ settleRemainder: false })).success).toBe(true);
  });

  it("accepts an omitted settlementDate, deferring the default to the server", () => {
    const result = deliveryQuickArrivalSchema.safeParse(buildQuickArrivalInput());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.settlementDate).toBeUndefined();
  });

  it("rejects a future settlement date", () => {
    const result = deliveryQuickArrivalSchema.safeParse(
      buildQuickArrivalInput({ settlementDate: addUtcDays(utcMidnightToday(), 1) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("SETTLEMENT_DATE_IN_FUTURE");
  });

  it("accepts one manual amount per order in a batch, never a single shared figure", () => {
    const otherOrderId = "clyyyyyyyyyyyyyyyyyyyyyy0";
    const result = deliveryQuickArrivalSchema.safeParse(
      buildQuickArrivalInput({
        settlementIntents: [
          { orderId: VALID_CUID, manualAmountMinor: 1200, branchHint: "manual" },
          { orderId: otherOrderId, manualAmountMinor: 500 },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a negative manual amount", () => {
    const result = deliveryQuickArrivalSchema.safeParse(
      buildQuickArrivalInput({ settlementIntents: [{ orderId: VALID_CUID, manualAmountMinor: -1 }] }),
    );
    expect(result.success).toBe(false);
  });
});

describe("settlementContextRequestSchema", () => {
  it("accepts one or more orders, each with their own deliveredItemIds", () => {
    const result = settlementContextRequestSchema.safeParse({
      orders: [{ orderId: VALID_CUID, deliveredItemIds: [VALID_CUID] }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty orders list", () => {
    const result = settlementContextRequestSchema.safeParse({ orders: [] });
    expect(result.success).toBe(false);
  });
});

describe("retrySettlementSchema", () => {
  it("requires deliveryId, settleRemainder and a real domain settlementDate", () => {
    const result = retrySettlementSchema.safeParse({
      deliveryId: VALID_CUID,
      settleRemainder: true,
      settlementDate: addUtcDays(utcMidnightToday(), -1),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a settlementDate that never went through toDomainDate (not UTC midnight)", () => {
    const result = retrySettlementSchema.safeParse({
      deliveryId: VALID_CUID,
      settleRemainder: true,
      settlementDate: new Date("2026-05-02T05:00:00.000Z"),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("DATE_NOT_UTC_MIDNIGHT");
  });

  // MINOR fix J, 2026-08-20 review: `retrySettlementSchema` used to accept any domain date, future
  // included, unlike every other settlement date boundary (`settlementFields.settlementDate`).
  it("rejects a settlementDate in the future, mirroring settlementFields' own refinement", () => {
    const result = retrySettlementSchema.safeParse({
      deliveryId: VALID_CUID,
      settleRemainder: true,
      settlementDate: addUtcDays(utcMidnightToday(), 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("SETTLEMENT_DATE_IN_FUTURE");
  });
});

describe("undoReopenSchema", () => {
  it("accepts an empty snapshot: a reopen that reverted no settlement has nothing to restore", () => {
    const result = undoReopenSchema.safeParse({
      deliveryId: VALID_CUID,
      previousStatus: "DELIVERED",
      receivedDate: utcMidnightToday(),
      snapshot: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full payment snapshot with its allocations", () => {
    const result = undoReopenSchema.safeParse({
      deliveryId: VALID_CUID,
      previousStatus: "DELIVERED",
      receivedDate: utcMidnightToday(),
      snapshot: [
        {
          storeId: VALID_CUID,
          amount: 5000,
          paymentDate: addUtcDays(utcMidnightToday(), -1),
          currencyCode: "USD",
          note: null,
          exchangeRate: null,
          exchangeRateBaseCode: null,
          settledByDeliveryId: VALID_CUID,
          allocations: [{ orderId: VALID_CUID, orderItemId: null, amountMinor: 5000 }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("requires receivedDate when the previous status was DELIVERED", () => {
    const result = undoReopenSchema.safeParse({
      deliveryId: VALID_CUID,
      previousStatus: "DELIVERED",
      receivedDate: null,
      snapshot: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((e) => e.message)).toContain("RECEIVED_DATE_REQUIRED");
  });

  it("allows a null receivedDate when the previous status was CANCELLED", () => {
    const result = undoReopenSchema.safeParse({
      deliveryId: VALID_CUID,
      previousStatus: "CANCELLED",
      receivedDate: null,
      snapshot: [],
    });
    expect(result.success).toBe(true);
  });
});
