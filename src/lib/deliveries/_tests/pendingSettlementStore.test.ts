import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearAllPendingSettlements,
  clearPendingSettlement,
  formatSettledTotals,
  readPendingSettlement,
  writePendingSettlement,
  type PendingSettlementEntry,
} from "../pendingSettlementStore";

function buildEntry(overrides: Partial<PendingSettlementEntry> = {}): PendingSettlementEntry {
  return {
    deliveryId: "delivery-1",
    settleRemainder: true,
    settlementDate: "2026-05-02",
    settlementIntents: [{ orderId: "order-1", manualAmountMinor: 1200, branchHint: "manual" }],
    // Real "now", not a fixed past date (MAJOR F9's TTL sweep discards anything older than 14
    // days): a fixed literal here would eventually fall outside the TTL purely with the passage of
    // real time and start failing tests that have nothing to do with the sweep itself.
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("pendingSettlementStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is pending for a delivery", () => {
    expect(readPendingSettlement("delivery-1")).toBeNull();
  });

  it("persists an entry and reads it back verbatim (survives a simulated reload)", () => {
    const entry = buildEntry();
    writePendingSettlement(entry);

    // Simulate a fresh page load: read straight from localStorage rather than any in-memory cache.
    const reread = readPendingSettlement("delivery-1");

    expect(reread).toEqual(entry);
  });

  it("scopes entries by delivery id: a different delivery's read stays null", () => {
    writePendingSettlement(buildEntry({ deliveryId: "delivery-1" }));

    expect(readPendingSettlement("delivery-2")).toBeNull();
  });

  it("overwrites a previous entry for the same delivery", () => {
    writePendingSettlement(buildEntry({ settleRemainder: true }));
    writePendingSettlement(buildEntry({ settleRemainder: false }));

    expect(readPendingSettlement("delivery-1")?.settleRemainder).toBe(false);
  });

  it("clears an entry, after which it reads null again", () => {
    writePendingSettlement(buildEntry());
    clearPendingSettlement("delivery-1");

    expect(readPendingSettlement("delivery-1")).toBeNull();
  });

  it("treats a corrupt stored value as nothing pending rather than throwing", () => {
    window.localStorage.setItem("pandatrack:pendingSettlement:delivery-1", "{not-json");

    expect(readPendingSettlement("delivery-1")).toBeNull();
  });

  it("treats a stored value whose deliveryId does not match the key as nothing pending", () => {
    window.localStorage.setItem(
      "pandatrack:pendingSettlement:delivery-1",
      JSON.stringify(buildEntry({ deliveryId: "delivery-9" })),
    );

    expect(readPendingSettlement("delivery-1")).toBeNull();
  });

  // MAJOR F9, 2026-08-20 review: a `Retry` affordance is a live money-transaction concern, not a
  // permanent record — an entry this stale is clutter (the collector moved on long ago), and
  // re-attempting a money transaction against a delivery this old risks surprising them more than it
  // resolves anything. Before the fix this test fails: `readPendingSettlement` returned the entry
  // verbatim regardless of its age.
  describe("TTL sweep (14 days)", () => {
    const originalNow = Date.now;
    afterEach(() => {
      Date.now = originalNow;
    });

    it("discards an entry older than 14 days on read, and sweeps it off storage", () => {
      const fifteenDaysAgo = new Date("2026-04-17T10:00:00.000Z");
      writePendingSettlement(buildEntry({ createdAt: fifteenDaysAgo.toISOString() }));
      Date.now = () => new Date("2026-05-02T10:00:00.001Z").getTime();

      expect(readPendingSettlement("delivery-1")).toBeNull();
      // Swept, not merely hidden: a second read (simulating a later call, or another tab) still
      // finds nothing rather than re-discovering the same stale row.
      expect(window.localStorage.getItem("pandatrack:pendingSettlement:delivery-1")).toBeNull();
    });

    it("keeps an entry just under the TTL", () => {
      const thirteenDaysAgo = new Date("2026-04-19T10:00:00.000Z");
      writePendingSettlement(buildEntry({ createdAt: thirteenDaysAgo.toISOString() }));
      Date.now = () => new Date("2026-05-02T10:00:00.000Z").getTime();

      expect(readPendingSettlement("delivery-1")).not.toBeNull();
    });
  });

  describe("clearAllPendingSettlements", () => {
    it("clears every pending entry regardless of delivery id", () => {
      writePendingSettlement(buildEntry({ deliveryId: "delivery-1" }));
      writePendingSettlement(buildEntry({ deliveryId: "delivery-2" }));
      window.localStorage.setItem("some-other-app-key", "untouched");

      clearAllPendingSettlements();

      expect(readPendingSettlement("delivery-1")).toBeNull();
      expect(readPendingSettlement("delivery-2")).toBeNull();
      // Never a blanket `localStorage.clear()`: only this store's own prefixed keys are dropped.
      expect(window.localStorage.getItem("some-other-app-key")).toBe("untouched");
    });

    it("does not throw when nothing is pending", () => {
      expect(() => clearAllPendingSettlements()).not.toThrow();
    });
  });
});

describe("formatSettledTotals", () => {
  it("returns null when nothing settled", () => {
    expect(
      formatSettledTotals([{ status: "refused", settledAmountMinor: null, currencyCode: "USD" }], "en"),
    ).toBeNull();
  });

  it("ignores a zero settled amount", () => {
    expect(formatSettledTotals([{ status: "settled", settledAmountMinor: 0, currencyCode: "USD" }], "en")).toBeNull();
  });

  it("sums settled amounts sharing the same currency", () => {
    const result = formatSettledTotals(
      [
        { status: "settled", settledAmountMinor: 2000, currencyCode: "USD" },
        { status: "settled", settledAmountMinor: 3000, currencyCode: "USD" },
        { status: "refused", settledAmountMinor: null, currencyCode: "USD" },
      ],
      "en",
    );

    expect(result).toContain("50");
    expect(result).toContain("USD");
  });

  it("joins two different currencies with a plus sign", () => {
    const result = formatSettledTotals(
      [
        { status: "settled", settledAmountMinor: 2000, currencyCode: "USD" },
        { status: "settled", settledAmountMinor: 5000, currencyCode: "PEN" },
      ],
      "en",
    );

    expect(result).toContain(" + ");
    expect(result).toContain("USD");
    expect(result).toContain("PEN");
  });
});
