import { describe, expect, it } from "vitest";
import {
  isSanctionRemovalReason,
  NEUTRAL_STORE_REMOVAL_REASONS,
  SANCTION_STORE_REMOVAL_REASONS,
  STORE_REMOVAL_REASONS,
} from "../removalReason";

describe("isSanctionRemovalReason", () => {
  it("is true only for the ABUSE reason", () => {
    expect(isSanctionRemovalReason("ABUSE")).toBe(true);
  });

  it.each(["DUPLICATE", "CLOSED_OR_INACTIVE", "FALSE_INFO"] as const)(
    "is false for the neutral reason %s",
    (reason) => {
      expect(isSanctionRemovalReason(reason)).toBe(false);
    },
  );
});

describe("removal reason groups", () => {
  it("splits the four reasons into three neutral and one sanction", () => {
    expect(NEUTRAL_STORE_REMOVAL_REASONS).toEqual(["DUPLICATE", "CLOSED_OR_INACTIVE", "FALSE_INFO"]);
    expect(SANCTION_STORE_REMOVAL_REASONS).toEqual(["ABUSE"]);
  });

  it("exposes all four reasons with the sanction reason last", () => {
    expect(STORE_REMOVAL_REASONS).toEqual(["DUPLICATE", "CLOSED_OR_INACTIVE", "FALSE_INFO", "ABUSE"]);
    // Exactly one of the four is a sanction reason.
    expect(STORE_REMOVAL_REASONS.filter(isSanctionRemovalReason)).toEqual(["ABUSE"]);
  });
});
