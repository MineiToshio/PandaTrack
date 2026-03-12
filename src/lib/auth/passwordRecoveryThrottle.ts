export const PASSWORD_RECOVERY_BACKOFF_MINUTES = [2, 5, 15, 60] as const;

export const PASSWORD_RECOVERY_CLIENT_STORAGE_KEY = "password-recovery-throttle";

export type PasswordRecoveryThrottleState = {
  stageIndex: number;
  expiresAt: string;
};

export type PasswordRecoveryNextThrottleState = PasswordRecoveryThrottleState & {
  cooldownMinutes: number;
};

function isValidStageIndex(stageIndex: number) {
  return Number.isInteger(stageIndex) && stageIndex >= 0 && stageIndex < PASSWORD_RECOVERY_BACKOFF_MINUTES.length;
}

export function parsePasswordRecoveryThrottleState(
  value: string | null | undefined,
): PasswordRecoveryThrottleState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("stageIndex" in parsed) ||
      !("expiresAt" in parsed) ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.stageIndex !== "number" ||
      !isValidStageIndex(parsed.stageIndex)
    ) {
      return null;
    }

    return {
      stageIndex: parsed.stageIndex,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function getPasswordRecoveryActiveThrottleState(
  state: PasswordRecoveryThrottleState | null,
  now: Date,
): PasswordRecoveryThrottleState | null {
  if (!state) {
    return null;
  }

  return new Date(state.expiresAt) > now ? state : null;
}

export function getPasswordRecoveryNextThrottleState(
  currentState: PasswordRecoveryThrottleState | null,
  now: Date,
): PasswordRecoveryNextThrottleState {
  const activeState = getPasswordRecoveryActiveThrottleState(currentState, now);
  const nextStageIndex = activeState
    ? Math.min(activeState.stageIndex + 1, PASSWORD_RECOVERY_BACKOFF_MINUTES.length - 1)
    : 0;
  const cooldownMinutes = PASSWORD_RECOVERY_BACKOFF_MINUTES[nextStageIndex];

  return {
    stageIndex: nextStageIndex,
    cooldownMinutes,
    expiresAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
  };
}

export function getPasswordRecoveryRemainingMinutes(state: PasswordRecoveryThrottleState, now: Date) {
  const remainingMs = new Date(state.expiresAt).getTime() - now.getTime();

  return Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
}
