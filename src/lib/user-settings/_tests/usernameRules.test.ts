import { describe, expect, it } from "vitest";
import { normalizeUsernameForUniqueness, validateUsernameCandidate } from "@/lib/user-settings/usernameRules";

describe("validateUsernameCandidate", () => {
  it("accepts a valid mixed-case username and canonicalizes it to lowercase", () => {
    const result = validateUsernameCandidate("PandaFan-42");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.username).toBe("pandafan-42");
    }
  });

  it("rejects consecutive hyphens", () => {
    const result = validateUsernameCandidate("bad--name");
    expect(result.ok).toBe(false);
  });

  it("rejects leading and trailing hyphens", () => {
    expect(validateUsernameCandidate("-bad").ok).toBe(false);
    expect(validateUsernameCandidate("bad-").ok).toBe(false);
  });

  it("rejects reserved usernames case-insensitively", () => {
    expect(validateUsernameCandidate("Admin").ok).toBe(false);
    expect(validateUsernameCandidate("PANDATRACK").ok).toBe(false);
  });

  it("rejects blocked segments without substring false positives", () => {
    expect(validateUsernameCandidate("classic").ok).toBe(true);
    expect(validateUsernameCandidate("bad-shit").ok).toBe(false);
  });

  it("rejects out-of-range lengths", () => {
    expect(validateUsernameCandidate("ab").ok).toBe(false);
    expect(validateUsernameCandidate("a".repeat(31)).ok).toBe(false);
  });
});

describe("normalizeUsernameForUniqueness", () => {
  it("lowercases trimmed input", () => {
    expect(normalizeUsernameForUniqueness("  TeSt  ")).toBe("test");
  });
});
