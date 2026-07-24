import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatAuditInstant } from "./formatAuditInstant";

/**
 * Audit instants must render in UTC regardless of the machine timezone. These tests run under a
 * negative-offset zone (America/New_York, UTC-4 in July) so a naive local render would show a
 * different hour, and a cross-midnight instant would show the previous day. The formatter must pin
 * both the day and the time-of-day to UTC.
 */
describe("formatAuditInstant (negative-offset timezone)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  // 14:03 UTC is 10:03 in America/New_York: asserting "14:03" proves the UTC pin.
  const afternoon = new Date("2026-07-12T14:03:00.000Z");
  // 02:03 UTC on the 12th is 22:03 on the 11th locally: asserting day 12 + 02:03 proves both pins.
  const pastMidnight = new Date("2026-07-12T02:03:00.000Z");

  it("renders the UTC time-of-day, not the local one (en)", () => {
    const output = formatAuditInstant(afternoon, "en");
    expect(output).toContain("14:03");
    expect(output).toContain("Jul");
    expect(output).toContain("2026");
    expect(output).toContain("12");
  });

  it("renders the UTC time-of-day, not the local one (es)", () => {
    const output = formatAuditInstant(afternoon, "es");
    expect(output).toContain("14:03");
    expect(output.toLowerCase()).toContain("jul");
    expect(output).toContain("2026");
    expect(output).toContain("12");
  });

  it("keeps the UTC calendar day for an instant that is the previous day locally", () => {
    // Locally this is 2026-07-11 22:03; the UTC day (12) and time (02:03) must survive.
    expect(formatAuditInstant(pastMidnight, "en")).toContain("02:03");
    expect(formatAuditInstant(pastMidnight, "en")).toContain("12");
  });

  it("uses a 24-hour clock without an AM/PM marker in either locale", () => {
    expect(formatAuditInstant(afternoon, "en")).not.toMatch(/AM|PM/i);
    expect(formatAuditInstant(afternoon, "es")).not.toMatch(/AM|PM|a\.?\s?m\.?|p\.?\s?m\.?/i);
  });
});
