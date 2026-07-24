import { describe, expect, it } from "vitest";
import { resolveStoreTombstone } from "../storeTombstone";

describe("resolveStoreTombstone", () => {
  it("reports a non-removed store as not removed (neutral tone is unused)", () => {
    expect(resolveStoreTombstone({ status: "APPROVED", removalReason: null })).toEqual({
      isRemoved: false,
      tone: "neutral",
    });
  });

  it("treats a pending or flagged store as not removed", () => {
    expect(resolveStoreTombstone({ status: "PENDING", removalReason: null }).isRemoved).toBe(false);
    expect(resolveStoreTombstone({ status: "FLAGGED", removalReason: null }).isRemoved).toBe(false);
  });

  it.each(["DUPLICATE", "CLOSED_OR_INACTIVE", "FALSE_INFO"] as const)(
    "uses the neutral tone for a removed store with the neutral reason %s",
    (removalReason) => {
      expect(resolveStoreTombstone({ status: "REJECTED", removalReason })).toEqual({
        isRemoved: true,
        tone: "neutral",
      });
    },
  );

  it("uses the sanction tone for a removed store with the ABUSE reason", () => {
    expect(resolveStoreTombstone({ status: "REJECTED", removalReason: "ABUSE" })).toEqual({
      isRemoved: true,
      tone: "sanction",
    });
  });

  it("falls back to the neutral tone for a removed store with no persisted reason", () => {
    expect(resolveStoreTombstone({ status: "REJECTED", removalReason: null })).toEqual({
      isRemoved: true,
      tone: "neutral",
    });
  });
});
