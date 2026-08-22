import { describe, expect, it } from "vitest";
import {
  buildNeedsFxReconciliationWhere,
  needsFxReconciliation,
  resolveExchangeRateBaseCode,
  resolveFxPair,
} from "../reconciliation";

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

describe("resolveFxPair", () => {
  it("drops a submitted rate for a row already in the base currency", () => {
    // A rate on a base-currency row is dead weight while the base stays put, and a wrong
    // "already reconciled" claim if the base ever moves to the stored target.
    expect(resolveFxPair("PEN", 1.1, "PEN")).toEqual({ exchangeRate: null, exchangeRateBaseCode: null });
  });

  it("keeps a usable rate for a foreign-currency row and stamps the base", () => {
    expect(resolveFxPair("USD", 3.393232, "PEN")).toEqual({
      exchangeRate: 3.393232,
      exchangeRateBaseCode: "PEN",
    });
  });

  it("keeps a null rate as the unset pair for a foreign-currency row", () => {
    expect(resolveFxPair("USD", null, "PEN")).toEqual({ exchangeRate: null, exchangeRateBaseCode: null });
  });

  it("clears the base code for a non-positive rate, matching resolveExchangeRateBaseCode", () => {
    expect(resolveFxPair("USD", 0, "PEN")).toEqual({ exchangeRate: 0, exchangeRateBaseCode: null });
  });

  it("passes the rate through with no base code when no base currency is configured", () => {
    expect(resolveFxPair("USD", 3.4, null)).toEqual({ exchangeRate: 3.4, exchangeRateBaseCode: null });
  });
});
