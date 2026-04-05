import { describe, expect, it } from "vitest";
import { EMAIL_CHANGE_COOLDOWN_DAYS, isWithinEmailChangeCooldown } from "@/lib/auth/emailChangeRateLimit";

describe("isWithinEmailChangeCooldown", () => {
  it("returns false when last change is outside the window", () => {
    const now = new Date("2026-04-04T12:00:00.000Z");
    const last = new Date(now.getTime() - (EMAIL_CHANGE_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinEmailChangeCooldown(last, now, EMAIL_CHANGE_COOLDOWN_DAYS)).toBe(false);
  });

  it("returns true when last change is inside the window", () => {
    const now = new Date("2026-04-04T12:00:00.000Z");
    const last = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinEmailChangeCooldown(last, now, EMAIL_CHANGE_COOLDOWN_DAYS)).toBe(true);
  });
});
