import { describe, expect, it } from "vitest";
import { isWithinUsernameChangeCooldown, USERNAME_CHANGE_COOLDOWN_DAYS } from "@/lib/auth/usernameChangeCooldown";

describe("isWithinUsernameChangeCooldown", () => {
  it("returns true when the last change is still inside the cooldown window", () => {
    const now = new Date("2026-04-05T12:00:00.000Z");
    const last = new Date("2026-04-01T12:00:00.000Z");
    expect(isWithinUsernameChangeCooldown(last, now, USERNAME_CHANGE_COOLDOWN_DAYS)).toBe(true);
  });

  it("returns false when the window has elapsed", () => {
    const now = new Date("2026-04-10T12:00:00.000Z");
    const last = new Date("2026-04-01T12:00:00.000Z");
    expect(isWithinUsernameChangeCooldown(last, now, USERNAME_CHANGE_COOLDOWN_DAYS)).toBe(false);
  });
});
