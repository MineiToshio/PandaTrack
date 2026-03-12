import {
  getPasswordRecoveryNextThrottleState,
  getPasswordRecoveryRemainingMinutes,
  parsePasswordRecoveryThrottleState,
} from "@/lib/auth/passwordRecoveryThrottle";
import { describe, expect, it } from "vitest";

describe("passwordRecoveryThrottle", () => {
  it("starts with a two-minute cooldown and escalates to 5, 15, and 60 minutes", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");

    const firstState = getPasswordRecoveryNextThrottleState(null, now);
    const secondState = getPasswordRecoveryNextThrottleState(firstState, now);
    const thirdState = getPasswordRecoveryNextThrottleState(secondState, now);
    const fourthState = getPasswordRecoveryNextThrottleState(thirdState, now);
    const fifthState = getPasswordRecoveryNextThrottleState(fourthState, now);

    expect(firstState.cooldownMinutes).toBe(2);
    expect(secondState.cooldownMinutes).toBe(5);
    expect(thirdState.cooldownMinutes).toBe(15);
    expect(fourthState.cooldownMinutes).toBe(60);
    expect(fifthState.cooldownMinutes).toBe(60);
  });

  it("returns the remaining wait time in rounded-up minutes", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");

    expect(
      getPasswordRecoveryRemainingMinutes(
        {
          stageIndex: 0,
          expiresAt: "2026-03-12T12:01:10.000Z",
        },
        now,
      ),
    ).toBe(2);
  });

  it("rejects malformed serialized states", () => {
    expect(parsePasswordRecoveryThrottleState("not-json")).toBeNull();
    expect(
      parsePasswordRecoveryThrottleState(JSON.stringify({ stageIndex: 99, expiresAt: "2026-03-12T12:00:00.000Z" })),
    ).toBeNull();
  });
});
