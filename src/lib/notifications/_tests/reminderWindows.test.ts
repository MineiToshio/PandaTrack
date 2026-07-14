import { describe, expect, it } from "vitest";
import { NotificationType } from "../../../../generated/prisma/client";
import { isCandidateInWindow, isOverdue, isWithinDueWindow, resolveTodayStart } from "../reminderWindows";

const utc = (iso: string): Date => new Date(iso);

describe("resolveTodayStart", () => {
  it("resolves the UTC-midnight instant of the collector's civil day", () => {
    const now = utc("2026-07-14T12:00:00Z");
    expect(resolveTodayStart(now, "UTC")).toEqual(utc("2026-07-14T00:00:00Z"));
  });

  it("falls back to UTC for a null or invalid timezone", () => {
    const now = utc("2026-07-14T12:00:00Z");
    expect(resolveTodayStart(now, null)).toEqual(utc("2026-07-14T00:00:00Z"));
    expect(resolveTodayStart(now, "Not/AZone")).toEqual(utc("2026-07-14T00:00:00Z"));
  });

  it("shifts the civil day forward for a positive-offset timezone near midnight", () => {
    // 23:30 UTC is already the next civil day in a UTC+14 zone.
    const now = utc("2026-07-14T23:30:00Z");
    expect(resolveTodayStart(now, "UTC")).toEqual(utc("2026-07-14T00:00:00Z"));
    expect(resolveTodayStart(now, "Pacific/Kiritimati")).toEqual(utc("2026-07-15T00:00:00Z"));
  });
});

describe("isWithinDueWindow", () => {
  const today = utc("2026-07-14T00:00:00Z");

  it("includes the window start (today) and excludes the exclusive end (today + lead)", () => {
    expect(isWithinDueWindow(utc("2026-07-14T00:00:00Z"), today, 3)).toBe(true);
    expect(isWithinDueWindow(utc("2026-07-16T00:00:00Z"), today, 3)).toBe(true);
    expect(isWithinDueWindow(utc("2026-07-17T00:00:00Z"), today, 3)).toBe(false);
  });

  it("excludes past-dated subjects", () => {
    expect(isWithinDueWindow(utc("2026-07-13T00:00:00Z"), today, 3)).toBe(false);
  });
});

describe("isOverdue", () => {
  const today = utc("2026-07-14T00:00:00Z");

  it("is true only for reference dates strictly before today", () => {
    expect(isOverdue(utc("2026-07-13T00:00:00Z"), today)).toBe(true);
    expect(isOverdue(utc("2026-07-14T00:00:00Z"), today)).toBe(false);
    expect(isOverdue(utc("2026-07-15T00:00:00Z"), today)).toBe(false);
  });
});

describe("isCandidateInWindow", () => {
  const today = utc("2026-07-14T00:00:00Z");

  it("gates due types on the forward lead window", () => {
    expect(isCandidateInWindow(NotificationType.PAYMENT_DUE, utc("2026-07-15T00:00:00Z"), today)).toBe(true);
    expect(isCandidateInWindow(NotificationType.PAYMENT_DUE, utc("2026-07-20T00:00:00Z"), today)).toBe(false);
    expect(isCandidateInWindow(NotificationType.ARRIVAL_DUE, utc("2026-07-16T00:00:00Z"), today)).toBe(true);
  });

  it("gates the overdue type on the past boundary", () => {
    expect(isCandidateInWindow(NotificationType.ARRIVAL_OVERDUE, utc("2026-07-13T00:00:00Z"), today)).toBe(true);
    expect(isCandidateInWindow(NotificationType.ARRIVAL_OVERDUE, utc("2026-07-14T00:00:00Z"), today)).toBe(false);
  });
});
