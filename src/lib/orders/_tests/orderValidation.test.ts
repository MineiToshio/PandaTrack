import { describe, expect, it } from "vitest";
import {
  orderItemRowSchema,
  orderCreateSchema,
  orderCancelSchema,
  orderPaymentCreateSchema,
  orderPaymentDeleteSchema,
  exchangeRateSchema,
  storePaymentCreateSchema,
} from "../orderValidation";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";

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
      const messages = result.error.issues.map((e) => e.message);
      expect(messages).toContain("QUANTITY_TOO_LOW");
    }
  });

  it("rejects non-integer quantity", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, quantity: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message);
      expect(messages).toContain("QUANTITY_MUST_BE_INTEGER");
    }
  });

  it("rejects negative unitPrice", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, unitPrice: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message);
      expect(messages).toContain("UNIT_PRICE_TOO_LOW");
    }
  });

  it("rejects non-integer unitPrice", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, unitPrice: 10.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message);
      expect(messages).toContain("UNIT_PRICE_MUST_BE_INTEGER");
    }
  });

  it("rejects empty name", () => {
    const result = orderItemRowSchema.safeParse({ ...validItem, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message);
      expect(messages).toContain("ITEM_NAME_REQUIRED");
    }
  });
});

describe("orderCreateSchema exchangeRate validation", () => {
  const baseInput = {
    storeId: VALID_CUID,
    orderDate: utcMidnightToday(),
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

  it("accepts a sub-cent exchangeRate (weak-currency pair)", () => {
    const result = orderCreateSchema.safeParse({ ...baseInput, exchangeRate: 0.005 });
    expect(result.success).toBe(true);
  });

  it("rejects exchangeRate below the 6-decimal floor", () => {
    const result = orderCreateSchema.safeParse({ ...baseInput, exchangeRate: 0.0000001 });
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

describe("orderCreateSchema zero-decimal currency validation", () => {
  const clpInput = {
    storeId: VALID_CUID,
    orderDate: utcMidnightToday(),
    currencyCode: "CLP",
  };

  it("accepts a whole-major totalCost for a zero-decimal currency", () => {
    const result = orderCreateSchema.safeParse({ ...clpInput, totalCost: 4300000 });
    expect(result.success).toBe(true);
  });

  it("rejects a fractional-subunit totalCost for a zero-decimal currency", () => {
    const result = orderCreateSchema.safeParse({ ...clpInput, totalCost: 4300050 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("TOTAL_COST_FRACTIONAL_SUBUNITS");
    }
  });

  it("rejects a fractional-subunit item unitPrice for a zero-decimal currency", () => {
    const result = orderCreateSchema.safeParse({
      ...clpInput,
      totalCost: 4300000,
      items: [{ name: "Figura", quantity: 1, unitPrice: 150050, productTypeKey: null, position: 1 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("UNIT_PRICE_FRACTIONAL_SUBUNITS");
    }
  });

  it("does not apply the whole-major rule to standard currencies", () => {
    const result = orderCreateSchema.safeParse({
      storeId: VALID_CUID,
      orderDate: utcMidnightToday(),
      currencyCode: "USD",
      totalCost: 4300050,
    });
    expect(result.success).toBe(true);
  });
});

describe("orderPaymentCreateSchema", () => {
  const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx0";
  const today = utcMidnightToday();
  const yesterday = addUtcDays(today, -1);
  const tomorrow = addUtcDays(today, 1);

  const validBase = { orderId: VALID_CUID, amount: 1000, paymentDate: yesterday };

  it("accepts a valid payment", () => {
    expect(orderPaymentCreateSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects amount of 0", () => {
    const result = orderPaymentCreateSchema.safeParse({ ...validBase, amount: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("AMOUNT_TOO_LOW");
    }
  });

  it("rejects negative amount", () => {
    const result = orderPaymentCreateSchema.safeParse({ ...validBase, amount: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts amount of 1 (minimum valid)", () => {
    expect(orderPaymentCreateSchema.safeParse({ ...validBase, amount: 1 }).success).toBe(true);
  });

  it("rejects a future paymentDate", () => {
    const result = orderPaymentCreateSchema.safeParse({ ...validBase, paymentDate: tomorrow });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("PAYMENT_DATE_IN_FUTURE");
    }
  });

  it("accepts paymentDate of today", () => {
    expect(orderPaymentCreateSchema.safeParse({ ...validBase, paymentDate: today }).success).toBe(true);
  });

  it("rejects orderId that is not a cuid", () => {
    const result = orderPaymentCreateSchema.safeParse({ ...validBase, orderId: "not-a-cuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("INVALID_ORDER_ID");
    }
  });
});

describe("orderCancelSchema", () => {
  it("defaults paymentsChoice to lost when omitted", () => {
    const result = orderCancelSchema.safeParse({ orderId: VALID_CUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentsChoice).toBe("lost");
    }
  });

  it("accepts an explicit credit choice", () => {
    const result = orderCancelSchema.safeParse({ orderId: VALID_CUID, paymentsChoice: "credit" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentsChoice).toBe("credit");
    }
  });

  it("normalizes the per-order vocabulary the current cancel dialog still sends", () => {
    const kept = orderCancelSchema.safeParse({ orderId: VALID_CUID, paymentsChoice: "keep" });
    const removed = orderCancelSchema.safeParse({ orderId: VALID_CUID, paymentsChoice: "remove" });
    expect(kept.success && kept.data.paymentsChoice).toBe("lost");
    expect(removed.success && removed.data.paymentsChoice).toBe("credit");
  });

  it("rejects an unknown paymentsChoice value", () => {
    const result = orderCancelSchema.safeParse({ orderId: VALID_CUID, paymentsChoice: "delete" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-cuid orderId", () => {
    const result = orderCancelSchema.safeParse({ orderId: "not-a-cuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("INVALID_ORDER_ID");
    }
  });
});

describe("orderPaymentDeleteSchema", () => {
  const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx0";

  it("accepts valid paymentId and orderId", () => {
    expect(orderPaymentDeleteSchema.safeParse({ paymentId: VALID_CUID, orderId: VALID_CUID }).success).toBe(true);
  });

  /**
   * The field was renamed from `allocationId` to `paymentId` when an order's ledger became one row
   * per transfer. What must NOT ride along with that rename is a tightening to `cuid()`: 606 of the
   * collector's 626 payments were carried over from the per-order ledger and keep a prefixed
   * `mig_*` id of 29 characters. Tightening the shape would leave 96.8% of the payments impossible
   * to delete, and deleting is the only way to correct a payment there is.
   */
  it("accepts the derived id a payment carried over from the per-order ledger has", () => {
    const result = orderPaymentDeleteSchema.safeParse({
      paymentId: `mig_pay_${VALID_CUID}`,
      orderId: VALID_CUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 29-character `mig_*` id, the real shape 606 of 626 payments carry", () => {
    // Measured, not assumed. A `cuid()` rule accepts 25 characters starting with `c`, so this exact
    // length and prefix is what a tightening would break.
    const legacyId = `mig_${VALID_CUID}`;
    expect(legacyId).toHaveLength(29);
    expect(orderPaymentDeleteSchema.safeParse({ paymentId: legacyId, orderId: VALID_CUID }).success).toBe(true);
  });

  it("rejects an empty paymentId", () => {
    const result = orderPaymentDeleteSchema.safeParse({
      paymentId: "",
      orderId: VALID_CUID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("INVALID_PAYMENT_ID");
    }
  });
});

// The exported canonical schema is reused by the FX-reconciliation action; these cases lock the
// bounds so a lax inline schema can never silently accept a wildly out-of-range or sub-cent rate.
describe("exchangeRateSchema (shared canonical rate schema)", () => {
  it("accepts a typical rate", () => {
    expect(exchangeRateSchema.safeParse(1.5).success).toBe(true);
  });

  it("rejects an absurdly large rate (1e12)", () => {
    expect(exchangeRateSchema.safeParse(1e12).success).toBe(false);
  });

  it("accepts weak-currency rates quoted at up to 6 decimals", () => {
    expect(exchangeRateSchema.safeParse(0.0065).success).toBe(true);
    expect(exchangeRateSchema.safeParse(0.000731).success).toBe(true);
    expect(exchangeRateSchema.safeParse(1.0847).success).toBe(true);
    expect(exchangeRateSchema.safeParse(0.000001).success).toBe(true);
  });

  it("rejects precision beyond 6 decimals", () => {
    expect(exchangeRateSchema.safeParse(0.1234567).success).toBe(false);
    expect(exchangeRateSchema.safeParse(0.0000001).success).toBe(false);
  });

  it("rejects zero", () => {
    expect(exchangeRateSchema.safeParse(0).success).toBe(false);
  });

  it("rejects a negative rate", () => {
    expect(exchangeRateSchema.safeParse(-1).success).toBe(false);
  });
});

describe("orderCreateSchema items bound", () => {
  const baseInput = {
    storeId: VALID_CUID,
    orderDate: utcMidnightToday(),
    currencyCode: "USD",
    totalCost: 10000,
  };

  const makeItem = (position: number) => ({
    name: `Item ${position}`,
    quantity: 1,
    unitPrice: null,
    productTypeKey: null,
    position,
  });

  it("accepts an order at the item ceiling (200)", () => {
    const items = Array.from({ length: 200 }, (_, index) => makeItem(index + 1));
    expect(orderCreateSchema.safeParse({ ...baseInput, items }).success).toBe(true);
  });

  it("rejects an order above the item ceiling (201)", () => {
    const items = Array.from({ length: 201 }, (_, index) => makeItem(index + 1));
    const result = orderCreateSchema.safeParse({ ...baseInput, items });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((e) => e.message)).toContain("TOO_MANY_ITEMS");
    }
  });
});

describe("domain dates must arrive at UTC midnight", () => {
  // The bug, reproduced at the boundary where it entered. A picker's local-midnight `Date` survives
  // the Server Action boundary as its exact instant, which from Lima (UTC-5) is that day at 05:00Z.
  // `z.coerce.date()` waved it through, so three `store_payment` rows, two `order_payment` rows and
  // two `delivery.receivedDate` rows landed five hours off every other domain date in the
  // collection. The clients now call `toDomainDate`; this is the server refusing to store the skew
  // if one of them ever forgets again.
  const LOCAL_MIDNIGHT_IN_LIMA = new Date("2026-01-05T05:00:00.000Z");
  const UTC_MIDNIGHT = new Date("2026-01-05T00:00:00.000Z");

  it("orderPaymentCreateSchema refuses a paymentDate that is not UTC midnight", () => {
    const result = orderPaymentCreateSchema.safeParse({
      orderId: VALID_CUID,
      amount: 1000,
      paymentDate: LOCAL_MIDNIGHT_IN_LIMA,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("DATE_NOT_UTC_MIDNIGHT");
    }
  });

  it("storePaymentCreateSchema refuses a paymentDate that is not UTC midnight", () => {
    const result = storePaymentCreateSchema.safeParse({
      storeId: VALID_CUID,
      amount: 15000,
      paymentDate: LOCAL_MIDNIGHT_IN_LIMA,
      currencyCode: "PEN",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("DATE_NOT_UTC_MIDNIGHT");
    }
  });

  it("storePaymentCreateSchema accepts the same calendar day once normalized", () => {
    const result = storePaymentCreateSchema.safeParse({
      storeId: VALID_CUID,
      amount: 15000,
      paymentDate: UTC_MIDNIGHT,
      currencyCode: "PEN",
    });
    expect(result.success).toBe(true);
  });

  it("still accepts the `yyyy-mm-dd` text the FormData routes send", () => {
    // The order/delivery create+edit routes were never affected precisely because they send text,
    // which coercion reads as UTC midnight. That must keep working unchanged.
    const result = orderCreateSchema.safeParse({
      storeId: VALID_CUID,
      orderDate: "2026-01-05",
      currencyCode: "USD",
      totalCost: 10000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderDate.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    }
  });
});
