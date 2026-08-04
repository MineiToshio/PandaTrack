import { describe, expect, it } from "vitest";
import { deliveryCreateSchema } from "../deliveryValidation";

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
