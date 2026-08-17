import { describe, expect, it } from "vitest";
import { deliveryCreateSchema, deliveryStoreArrivalSchema } from "../deliveryValidation";
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
