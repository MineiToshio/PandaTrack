import { describe, expect, it } from "vitest";
import { validateDisplayNameCandidate, DISPLAY_NAME_MAX_LENGTH } from "@/lib/user-settings/displayNameRules";

describe("validateDisplayNameCandidate", () => {
  it("accepts a valid display name and returns the trimmed value", () => {
    const result = validateDisplayNameCandidate("  Panda Fan  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.name).toBe("Panda Fan");
    }
  });

  it("accepts a single-word name", () => {
    const result = validateDisplayNameCandidate("Panda");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.name).toBe("Panda");
    }
  });

  it("accepts names with apostrophes and dots", () => {
    const result = validateDisplayNameCandidate("O'Brien Jr.");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.name).toBe("O'Brien Jr.");
    }
  });

  it("accepts a name that is exactly the maximum length", () => {
    const name = "a".repeat(DISPLAY_NAME_MAX_LENGTH);
    const result = validateDisplayNameCandidate(name);
    expect(result.ok).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = validateDisplayNameCandidate("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("DISPLAY_NAME_EMPTY");
  });

  it("rejects a whitespace-only string", () => {
    const result = validateDisplayNameCandidate("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("DISPLAY_NAME_EMPTY");
  });

  it("rejects names exceeding the maximum length", () => {
    const name = "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1);
    const result = validateDisplayNameCandidate(name);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("DISPLAY_NAME_TOO_LONG");
  });

  it("rejects reserved system names case-insensitively", () => {
    expect(validateDisplayNameCandidate("admin").ok).toBe(false);
    expect(validateDisplayNameCandidate("Admin").ok).toBe(false);
    expect(validateDisplayNameCandidate("ADMIN").ok).toBe(false);
    expect(validateDisplayNameCandidate("pandatrack").ok).toBe(false);
    expect(validateDisplayNameCandidate("support").ok).toBe(false);
  });

  it("rejects names containing blocked tokens as word-level tokens", () => {
    expect(validateDisplayNameCandidate("shit").ok).toBe(false);
    expect(validateDisplayNameCandidate("Big Shit User").ok).toBe(false);
  });

  it("does not reject names containing blocked substrings when they are not separate tokens", () => {
    expect(validateDisplayNameCandidate("classic").ok).toBe(true);
    expect(validateDisplayNameCandidate("Pornography").ok).toBe(true);
    expect(validateDisplayNameCandidate("Nitpicking").ok).toBe(true);
  });

  it("trims and then applies length validation", () => {
    const paddedName = "  " + "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1) + "  ";
    const result = validateDisplayNameCandidate(paddedName);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("DISPLAY_NAME_TOO_LONG");
  });

  it("does not reject reserved names that appear as partial tokens in longer names", () => {
    expect(validateDisplayNameCandidate("Administrative").ok).toBe(true);
    expect(validateDisplayNameCandidate("subadmin").ok).toBe(true);
  });
});
