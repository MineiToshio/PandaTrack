import { findVerificationMarkerById } from "@/lib/data/auth/verificationQueries";
import { upsertVerificationMarker } from "@/lib/data/auth/verificationMutations";

/**
 * Anti-spam window for the "resend verification email" action (FR: account access and recovery).
 * `auth.api.sendVerificationEmail` is a server-side Better Auth call, so it bypasses Better Auth's
 * own HTTP-router rate limiter entirely; without this, a user (or a script) can trigger unlimited
 * sends by re-invoking the Server Action.
 */
export const RESEND_VERIFICATION_COOLDOWN_SECONDS = 60;

const RESEND_VERIFICATION_COOLDOWN_PREFIX = "resend-verification-cooldown:";

export type ResendVerificationCooldownRecord = {
  lastSentAt: string;
};

function buildResendVerificationCooldownScopeId(userId: string): string {
  return `${RESEND_VERIFICATION_COOLDOWN_PREFIX}${userId}`;
}

export function isWithinResendVerificationCooldown(lastSentAtIso: string, now: Date, windowSeconds: number): boolean {
  const last = new Date(lastSentAtIso).getTime();
  const windowMs = windowSeconds * 1000;
  return now.getTime() - last < windowMs;
}

export async function getResendVerificationCooldownRecord(
  userId: string,
): Promise<ResendVerificationCooldownRecord | null> {
  const row = await findVerificationMarkerById(buildResendVerificationCooldownScopeId(userId));

  if (!row?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("lastSentAt" in parsed) ||
      typeof (parsed as ResendVerificationCooldownRecord).lastSentAt !== "string"
    ) {
      return null;
    }
    return parsed as ResendVerificationCooldownRecord;
  } catch {
    return null;
  }
}

export type ResendVerificationCooldownCheck = { ok: true } | { ok: false; retryAfterSeconds: number };

export async function assertResendVerificationCooldownAllows(
  userId: string,
  now: Date,
): Promise<ResendVerificationCooldownCheck> {
  const record = await getResendVerificationCooldownRecord(userId);
  if (!record?.lastSentAt) {
    return { ok: true };
  }

  if (!isWithinResendVerificationCooldown(record.lastSentAt, now, RESEND_VERIFICATION_COOLDOWN_SECONDS)) {
    return { ok: true };
  }

  const elapsedMs = now.getTime() - new Date(record.lastSentAt).getTime();
  const remainingMs = RESEND_VERIFICATION_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
}

/**
 * Records a resend attempt as soon as it passes the cooldown check, before the email provider is
 * called. This spends the cooldown window even when the send itself later fails, so a retry loop
 * against a struggling email provider is still rate-limited instead of getting a free pass.
 */
export async function recordResendVerificationAttempt(userId: string, now: Date): Promise<void> {
  const id = buildResendVerificationCooldownScopeId(userId);
  const value = JSON.stringify({ lastSentAt: now.toISOString() } satisfies ResendVerificationCooldownRecord);
  const expiresAt = new Date(now.getTime() + (RESEND_VERIFICATION_COOLDOWN_SECONDS + 30) * 1000);

  await upsertVerificationMarker({ id, identifier: id, value, expiresAt, now });
}
