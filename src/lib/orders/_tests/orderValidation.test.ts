import { describe, expect, it } from "vitest";
import { orderItemRowSchema, orderCreateSchema } from "../orderValidation";

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx0";

describe("orderItemRowSchema", () => {
  const validItem = {
    name: "Figura limitada",
    quantity: 1,
    unitPrice: null,
    productTypeKey: null,
    position: 1,
  };

  it("accepts a valid item with no unit price", () => {
    expect(orderItemRowSchema.safeParse(validItem).success).toBe(true);
  });

  it("accepts unitPrice of 0 (free item)", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, unitPrice: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects quantity below 1", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, quantity: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages).toContain("QUANTITY_TOO_LOW");
    }
  });

  it("rejects non-integer quantity", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, quantity: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages).toContain("QUANTITY_MUST_BE_INTEGER");
    }
  });

  it("rejects negative unitPrice", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, unitPrice: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages).toContain("UNIT_PRICE_TOO_LOW");
    }
  });

  it("rejects non-integer unitPrice", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, unitPrice: 10.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages).toContain("UNIT_PRICE_MUST_BE_INTEGER");
    }
  });

  it("rejects empty name", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages).toContain("ITEM_NAME_REQUIRED");
    }
  });
});

describe("orderCreateSchema exchangeRate validation", () => {
  const baseInput = {
    storeId: VALID_CUID,
    orderDate: new Date(),
    currencyCode: "USD",
    totalCost: 10000,
  };

  it("accepts exchangeRate of 0.01 (minimum)", () => {
    const result = orderCreateSchema.safeParse({ ...baseInput, exchangeRate: 0.01 });
    expect(result.success).toBe(true);
  });

  it("accepts exchangeRate of 99999.99 (maximum)", () => {
    const result = orderCreateSchema.safeParse({ ...baseInput, exchangeRate: 99999.99 });
    expect(result.success).toBe(true);
  });

  it("rejects exchangeRate below 0.01", () => {
    const result = orderCreateSchema.safeParse({ ...baseInput, exchangeRate: 0.005 });
    expect(result.success).toBe(false);
  });

  it("rejects exchangeRate above 99999.99", () => {
    const result = orderCreateSchema.safeParse({ ...baseInput, exchangeRate: 100000 });
    expect(result.success).toBe(false);
  });

  it("accepts null exchangeRate", () => {
    const result = orderCreateSchema.safeParse({ ...baseInput, exchangeRate: null });
    expect(result.success).toBe(true);
  });
});
