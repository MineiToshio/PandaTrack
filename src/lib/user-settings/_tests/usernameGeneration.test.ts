import { describe, expect, it } from "vitest";
import { normalizeEmailLocalPartForUsernameBase } from "@/lib/user-settings/usernameGeneration";

describe("normalizeEmailLocalPartForUsernameBase", () => {
  it("collapses unsupported characters into hyphens", () => {
    expect(normalizeEmailLocalPartForUsernameBase("John.Doe+tag")).toBe("john-doe-tag");
  });

  it("falls back to empty normalization for noisy locals", () => {
    expect(normalizeEmailLocalPartForUsernameBase("...")).toBe("");
  });
});
