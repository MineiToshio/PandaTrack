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
