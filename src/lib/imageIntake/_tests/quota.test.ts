import { describe, expect, it } from "vitest";
import { DEFAULT_MONTHLY_PHOTO_QUOTA } from "../constants";
import {
  buildQuotaSnapshot,
  computePhotoOverflow,
  computeRemainingPhotos,
  formatDayKey,
  formatPeriodKey,
  nextPeriodStart,
  resolveEffectiveMonthlyLimit,
} from "../quota";

const NOW = new Date("2026-07-28T12:00:00Z");

describe("period keys", () => {
  it("derives the period and day keys in UTC, zero padded", () => {
    expect(formatPeriodKey(new Date("2026-01-05T23:30:00Z"))).toBe("2026-01");
    expect(formatDayKey(new Date("2026-01-05T23:30:00Z"))).toBe("2026-01-05");
  });

  it("rolls the balance over implicitly: the next period is the first instant of the next month", () => {
    expect(nextPeriodStart(NOW).toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(nextPeriodStart(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("resolveEffectiveMonthlyLimit", () => {
  it("applies the product default when there is no override", () => {
    expect(resolveEffectiveMonthlyLimit({ isAdmin: false, override: null })).toBe(DEFAULT_MONTHLY_PHOTO_QUOTA);
  });

  it("applies an override in either direction", () => {
    expect(resolveEffectiveMonthlyLimit({ isAdmin: false, override: 50 })).toBe(50);
    expect(resolveEffectiveMonthlyLimit({ isAdmin: false, override: 0 })).toBe(0);
  });

  it("leaves an administrator uncapped, override or not", () => {
    expect(resolveEffectiveMonthlyLimit({ isAdmin: true, override: null })).toBeNull();
    expect(resolveEffectiveMonthlyLimit({ isAdmin: true, override: 5 })).toBeNull();
  });
});

describe("computeRemainingPhotos", () => {
  it("never reports a negative balance, even after a limit is lowered below what was spent", () => {
    expect(computeRemainingPhotos(20, 25)).toBe(0);
  });

  it("keeps an uncapped balance uncapped", () => {
    expect(computeRemainingPhotos(null, 900)).toBeNull();
  });
});

describe("computePhotoOverflow", () => {
  it("reports how many photos must be removed for the batch to fit", () => {
    expect(computePhotoOverflow(5, 3)).toBe(2);
  });

  it("reports nothing when the batch fits exactly, so the only interruption stays rare", () => {
    expect(computePhotoOverflow(3, 3)).toBeNull();
    expect(computePhotoOverflow(1, 3)).toBeNull();
  });

  it("never interrupts an uncapped collector", () => {
    expect(computePhotoOverflow(50, null)).toBeNull();
  });
});

describe("buildQuotaSnapshot", () => {
  it("assembles the balance and the renewal date the exhausted copy states", () => {
    expect(buildQuotaSnapshot({ isAdmin: false, override: null, usedPhotos: 17, now: NOW })).toEqual({
      limit: DEFAULT_MONTHLY_PHOTO_QUOTA,
      usedPhotos: 17,
      remaining: 3,
      periodKey: "2026-07",
      renewalAtIso: "2026-08-01T00:00:00.000Z",
    });
  });

  it("reports an administrator with no limit and no balance to show", () => {
    const snapshot = buildQuotaSnapshot({ isAdmin: true, override: null, usedPhotos: 40, now: NOW });

    expect(snapshot.limit).toBeNull();
    expect(snapshot.remaining).toBeNull();
    expect(snapshot.usedPhotos).toBe(40);
  });
});
