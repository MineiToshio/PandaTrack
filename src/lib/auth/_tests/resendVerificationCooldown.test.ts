import { describe, expect, it } from "vitest";
import {
  RESEND_VERIFICATION_COOLDOWN_SECONDS,
  isWithinResendVerificationCooldown,
} from "@/lib/auth/resendVerificationCooldown";

describe("isWithinResendVerificationCooldown", () => {
  it("returns true right after the last send", () => {
    const now = new Date("2026-04-04T12:00:00.000Z");
    const last = now.toISOString();
    expect(isWithinResendVerificationCooldown(last, now, RESEND_VERIFICATION_COOLDOWN_SECONDS)).toBe(true);
  });

  it("returns true a few seconds inside the window", () => {
    const now = new Date("2026-04-04T12:00:00.000Z");
    const last = new Date(now.getTime() - (RESEND_VERIFICATION_COOLDOWN_SECONDS - 5) * 1000).toISOString();
    expect(isWithinResendVerificationCooldown(last, now, RESEND_VERIFICATION_COOLDOWN_SECONDS)).toBe(true);
  });

  it("returns false once the window has elapsed", () => {
    const now = new Date("2026-04-04T12:00:00.000Z");
    const last = new Date(now.getTime() - (RESEND_VERIFICATION_COOLDOWN_SECONDS + 1) * 1000).toISOString();
    expect(isWithinResendVerificationCooldown(last, now, RESEND_VERIFICATION_COOLDOWN_SECONDS)).toBe(false);
  });
});
