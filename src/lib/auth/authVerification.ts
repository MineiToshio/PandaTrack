import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import * as Sentry from "@sentry/nextjs";
import { findUserVerificationSnapshot } from "@/queries/user";
import { createVerificationRecord, findFirstVerificationIdByIdentifier } from "@/queries/verification";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_GRACE_DAYS = 7;
const DAY_SIX_REMINDER_START_DAYS = 6;
const DAY_SIX_REMINDER_MARKER_PREFIX = "verification-day6-reminder:";
const DAY_SIX_REMINDER_SENTINEL_EXPIRES_AT = new Date("2100-01-01T00:00:00.000Z");

export type VerificationAccessState = "not_applicable" | "verified" | "grace" | "blocked";

export type VerificationSnapshot = {
  userId: string;
  email: string;
  createdAt: Date;
  /** Start of the 7-day verification window (`unverifiedGraceStartsAt` or account `createdAt`). */
  verificationGraceAnchor: Date;
  emailVerified: boolean;
  hasCredentialAccount: boolean;
  state: VerificationAccessState;
};

function getDeadline(createdAt: Date) {
  return new Date(createdAt.getTime() + VERIFICATION_GRACE_DAYS * DAY_IN_MS);
}

function getReminderWindowStart(createdAt: Date) {
  return new Date(createdAt.getTime() + DAY_SIX_REMINDER_START_DAYS * DAY_IN_MS);
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function getVerificationSnapshot(userId: string): Promise<VerificationSnapshot | null> {
  const user = await findUserVerificationSnapshot(prisma, userId);

  if (!user) {
    return null;
  }

  const hasCredentialAccount = user.accounts.some((account) => account.providerId === "credential");
  const createdAt = asDate(user.createdAt);
  const verificationGraceAnchor = asDate(user.unverifiedGraceStartsAt ?? user.createdAt);

  if (!hasCredentialAccount) {
    return {
      userId: user.id,
      email: user.email,
      createdAt,
      verificationGraceAnchor,
      emailVerified: user.emailVerified,
      hasCredentialAccount,
      state: "not_applicable",
    };
  }

  if (user.emailVerified) {
    return {
      userId: user.id,
      email: user.email,
      createdAt,
      verificationGraceAnchor,
      emailVerified: user.emailVerified,
      hasCredentialAccount,
      state: "verified",
    };
  }

  return {
    userId: user.id,
    email: user.email,
    createdAt,
    verificationGraceAnchor,
    emailVerified: user.emailVerified,
    hasCredentialAccount,
    state: new Date() >= getDeadline(verificationGraceAnchor) ? "blocked" : "grace",
  };
}

export async function sendVerificationEmail(
  email: string,
  callbackURL: string,
  requestHeaders: Headers,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await auth.api.sendVerificationEmail({
      headers: requestHeaders,
      body: {
        email,
        callbackURL,
      },
    });
    return { ok: true };
  } catch (error) {
    Sentry.captureException(error);
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    return { ok: false, error: errorMessage };
  }
}

export async function maybeSendDaySixVerificationReminder(
  snapshot: VerificationSnapshot,
  callbackURL: string,
  requestHeaders: Headers,
): Promise<{ sent: boolean; error?: string }> {
  if (snapshot.state !== "grace") {
    return { sent: false };
  }

  const now = new Date();
  const reminderStart = getReminderWindowStart(snapshot.verificationGraceAnchor);
  const deadline = getDeadline(snapshot.verificationGraceAnchor);

  if (now < reminderStart || now >= deadline) {
    return { sent: false };
  }

  const reminderIdentifier = `${DAY_SIX_REMINDER_MARKER_PREFIX}${snapshot.userId}`;
  const existingReminder = await findFirstVerificationIdByIdentifier(prisma, reminderIdentifier);

  if (existingReminder) {
    return { sent: false };
  }

  const sendResult = await sendVerificationEmail(snapshot.email, callbackURL, requestHeaders);
  const posthog = getPostHogClient();

  if (!sendResult.ok) {
    posthog.capture({
      distinctId: snapshot.email,
      event: POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_FAILED,
      properties: { reason: "day6_reminder_send_failed" },
    });
    return { sent: false, error: sendResult.error };
  }

  await createVerificationRecord(prisma, {
    id: crypto.randomUUID(),
    identifier: reminderIdentifier,
    value: "sent",
    expiresAt: DAY_SIX_REMINDER_SENTINEL_EXPIRES_AT,
    now: new Date(),
  });

  posthog.capture({
    distinctId: snapshot.email,
    event: POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_SENT,
    properties: { source: "day6_reminder" },
  });

  return { sent: true };
}
