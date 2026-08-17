import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  domainDateToIsoString,
  formatDomainDate,
  formatDomainShortDate,
  toDomainDate,
  toLocalIsoDateString,
  utcDomainDateToLocal,
} from "./domainDate";

/**
 * Domain dates are stored at midnight UTC. These tests run under a negative-offset
 * timezone (America/New_York, UTC-4/-5) so they reproduce the off-by-one bug: without
 * `timeZone: "UTC"`, a date saved on the 12th renders as the 11th for an American viewer.
 * The helpers must pin to the UTC calendar day regardless of the ambient timezone.
 */
describe("domainDate (negative-offset timezone)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  // A delivery "created today": stored as the UTC midnight instant of June 12, 2026.
  const utcMidnight = new Date("2026-06-12T00:00:00.000Z");

  it("formatDomainDate keeps the stored calendar day instead of shifting back one", () => {
    // Without timeZone:"UTC" this would be 06/11/2026 in America/New_York — the bug.
    expect(formatDomainDate(utcMidnight, "en-US", { year: "numeric", month: "2-digit", day: "2-digit" })).toBe(
      "06/12/2026",
    );
  });

  it("formatDomainDate defaults to the long shape on the correct day", () => {
    expect(formatDomainDate(utcMidnight, "en-US")).toBe("Jun 12, 2026");
  });

  it("formatDomainShortDate renders day + month on the correct day", () => {
    expect(formatDomainShortDate(utcMidnight, "en-US")).toBe("Jun 12");
  });

  it("ignores a caller-supplied timeZone and always pins to UTC", () => {
    expect(
      formatDomainDate(utcMidnight, "en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "America/New_York",
      }),
    ).toBe("06/12/2026");
  });

  it("utcDomainDateToLocal yields a local-midnight Date on the same calendar day", () => {
    const local = utcDomainDateToLocal(utcMidnight);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(5); // June (0-indexed)
    expect(local.getDate()).toBe(12);
    expect(local.getHours()).toBe(0);
    // Round-trips back to the same yyyy-mm-dd through local getters (the picker → submit path).
    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, "0");
    const d = String(local.getDate()).padStart(2, "0");
    expect(`${y}-${m}-${d}`).toBe("2026-06-12");
  });

  it("domainDateToIsoString serializes the UTC calendar day regardless of ambient timezone", () => {
    expect(domainDateToIsoString(utcMidnight)).toBe("2026-06-12");
  });

  it("domainDateToIsoString passes through undefined", () => {
    expect(domainDateToIsoString(undefined)).toBeUndefined();
  });
});

/**
 * `toLocalIsoDateString` / `toDomainDate` serialize a picker's LOCAL-midnight `Date`. The defect
 * they exist to prevent (`toISOString().split("T")[0]`, which converts to UTC first) only shows up
 * for a viewer EAST of UTC: local midnight converts BACKWARD into the previous UTC day there. West
 * of UTC (the block above, America/New_York) local midnight converts FORWARD into the same UTC day,
 * so the buggy serializer reads back the right answer by accident — which is why this suite must run
 * under a positive-offset zone to actually exercise the regression (see
 * `OrderCreateFormDomainDates.test.tsx`, which caught the real-world instance of this under Tokyo).
 */
describe("domainDate (positive-offset timezone)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Asia/Tokyo";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("toLocalIsoDateString reads the picker's LOCAL calendar day, not the UTC one", () => {
    // A DatePickerInput selection of "12 June" arrives as local midnight. Serializing it with
    // `toISOString().split("T")[0]` (the bug) converts to UTC first and reads back as the 11th
    // under this positive-offset timezone — the exact regression this helper exists to avoid.
    const localMidnight = new Date(2026, 5, 12); // June 12, 2026, local midnight in Tokyo
    expect(toLocalIsoDateString(localMidnight)).toBe("2026-06-12");
  });

  it("toDomainDate converts a picker's local-midnight Date to the same UTC calendar day", () => {
    const localMidnight = new Date(2026, 5, 12);
    const domain = toDomainDate(localMidnight);
    expect(domain.toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });
});
