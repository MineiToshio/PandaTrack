import { describe, expect, it } from "vitest";
import { buildNeedsFxReconciliationWhere, needsFxReconciliation, resolveExchangeRateBaseCode } from "../reconciliation";

describe("needsFxReconciliation", () => {
  it("is false when no base currency is configured yet", () => {
    expect(needsFxReconciliation({ currencyCode: "USD", exchangeRate: null, exchangeRateBaseCode: null }, null)).toBe(
      false,
    );
  });

  it("is false when the row is already in the base currency", () => {
    expect(needsFxReconciliation({ currencyCode: "PEN", exchangeRate: null, exchangeRateBaseCode: null }, "PEN")).toBe(
      false,
    );
  });

  it("is true for a foreign currency with no rate", () => {
    expect(needsFxReconciliation({ currencyCode: "USD", exchangeRate: null, exchangeRateBaseCode: null }, "PEN")).toBe(
      true,
    );
  });

  it("is true for a foreign currency with a non-positive rate", () => {
    expect(needsFxReconciliation({ currencyCode: "USD", exchangeRate: 0, exchangeRateBaseCode: "PEN" }, "PEN")).toBe(
      true,
    );
  });

  it("is false for a rate stored against the current base", () => {
    expect(
      needsFxReconciliation({ currencyCode: "USD", exchangeRate: 3.393232, exchangeRateBaseCode: "PEN" }, "PEN"),
    ).toBe(false);
  });

  it("is true for a rate stored against a different base", () => {
    expect(
      needsFxReconciliation({ currencyCode: "USD", exchangeRate: 3.393232, exchangeRateBaseCode: "PEN" }, "EUR"),
    ).toBe(true);
  });

  it("is true for a legacy rate with no recorded base", () => {
    expect(needsFxReconciliation({ currencyCode: "USD", exchangeRate: 3.4, exchangeRateBaseCode: null }, "PEN")).toBe(
      true,
    );
  });

  it("survives a base-currency round trip without re-marking a reconciled rate", () => {
    // The regression this whole model exists for: PEN → EUR → PEN used to re-flag every USD order
    // even though its stored USD→PEN rate was never invalidated.
    const order = { currencyCode: "USD", exchangeRate: 3.393232, exchangeRateBaseCode: "PEN" };
    expect(needsFxReconciliation(order, "PEN")).toBe(false);
    expect(needsFxReconciliation(order, "EUR")).toBe(true);
    expect(needsFxReconciliation(order, "PEN")).toBe(false);
  });
});

describe("buildNeedsFxReconciliationWhere", () => {
  it("returns null without a base currency", () => {
    expect(buildNeedsFxReconciliationWhere(null)).toBeNull();
    expect(buildNeedsFxReconciliationWhere(undefined)).toBeNull();
  });

  it("matches the in-memory predicate's arms, including the explicit NULL base-code arm", () => {
    const where = buildNeedsFxReconciliationWhere("PEN");
    expect(where).toEqual({
      currencyCode: { not: "PEN" },
      OR: [
        { exchangeRate: null },
        { exchangeRate: { lte: 0 } },
        // Spelled out because SQL `<>` drops NULLs; without it, never-reconciled rows would be
        // invisible to the very list meant to surface them.
        { exchangeRateBaseCode: null },
        { exchangeRateBaseCode: { not: "PEN" } },
      ],
    });
  });
});

describe("resolveExchangeRateBaseCode", () => {
  it("records the base a usable rate was entered against", () => {
    expect(resolveExchangeRateBaseCode(3.4, "PEN")).toBe("PEN");
  });

  it("clears the base code when the rate is removed, so no stale claim survives", () => {
    expect(resolveExchangeRateBaseCode(null, "PEN")).toBeNull();
    expect(resolveExchangeRateBaseCode(0, "PEN")).toBeNull();
  });

  it("is null when the collector has no base currency yet", () => {
    expect(resolveExchangeRateBaseCode(3.4, null)).toBeNull();
  });
});
