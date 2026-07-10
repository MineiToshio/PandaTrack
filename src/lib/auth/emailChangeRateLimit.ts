import { findVerificationMarkerById } from "@/lib/data/auth/verificationQueries";
import { upsertVerificationMarker } from "@/lib/data/auth/verificationMutations";

export const EMAIL_CHANGE_COOLDOWN_DAYS = 7;

const EMAIL_CHANGE_RATE_PREFIX = "email-change-rate:";

export type EmailChangeRateRecord = {
  lastSuccessAt: string;
};

function buildEmailChangeRateScopeId(userId: string) {
  return `${EMAIL_CHANGE_RATE_PREFIX}${userId}`;
}

export function isWithinEmailChangeCooldown(lastSuccessAtIso: string, now: Date, windowDays: number): boolean {
  const last = new Date(lastSuccessAtIso).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return now.getTime() - last < windowMs;
}

export async function getEmailChangeRateRecord(userId: string): Promise<EmailChangeRateRecord | null> {
  const row = await findVerificationMarkerById(buildEmailChangeRateScopeId(userId));

  if (!row?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("lastSuccessAt" in parsed) ||
      typeof (parsed as EmailChangeRateRecord).lastSuccessAt !== "string"
    ) {
      return null;
    }
    return parsed as EmailChangeRateRecord;
  } catch {
    return null;
  }
}

export async function assertEmailChangeCooldownAllows(
  userId: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; retryAfterIso: string }> {
  const record = await getEmailChangeRateRecord(userId);
  if (!record?.lastSuccessAt) {
    return { ok: true };
  }

  if (!isWithinEmailChangeCooldown(record.lastSuccessAt, now, EMAIL_CHANGE_COOLDOWN_DAYS)) {
    return { ok: true };
  }

  const retryAt = new Date(new Date(record.lastSuccessAt).getTime() + EMAIL_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  return { ok: false, retryAfterIso: retryAt.toISOString() };
}

/**
 * Persists the timestamp of a successful email-change request (Better Auth accepted the change).
 * Uses the verification table with a stable id, similar to password recovery throttle storage.
 */
export async function recordSuccessfulEmailChange(userId: string, now: Date): Promise<void> {
  const id = buildEmailChangeRateScopeId(userId);
  const value = JSON.stringify({ lastSuccessAt: now.toISOString() } satisfies EmailChangeRateRecord);
  const expiresAt = new Date(now.getTime() + (EMAIL_CHANGE_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000);

  await upsertVerificationMarker({
    id,
    identifier: id,
    value,
    expiresAt,
    now,
  });
}
