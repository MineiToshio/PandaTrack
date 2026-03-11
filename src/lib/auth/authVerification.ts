import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import * as Sentry from "@sentry/nextjs";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_GRACE_DAYS = 7;
const DAY_SIX_REMINDER_START_DAYS = 6;
const DAY_SIX_REMINDER_MARKER_PREFIX = "verification-day6-reminder:";

export type VerificationAccessState = "not_applicable" | "verified" | "grace" | "blocked";

type VerificationSnapshot = {
  userId: string;
  email: string;
  createdAt: Date;
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      emailVerified: true,
      accounts: {
        select: {
          providerId: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const hasCredentialAccount = user.accounts.some((account) => account.providerId === "credential");
  const createdAt = asDate(user.createdAt);

  if (!hasCredentialAccount) {
    return {
      userId: user.id,
      email: user.email,
      createdAt,
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
      emailVerified: user.emailVerified,
      hasCredentialAccount,
      state: "verified",
    };
  }

  return {
    userId: user.id,
    email: user.email,
    createdAt,
    emailVerified: user.emailVerified,
    hasCredentialAccount,
    state: new Date() >= getDeadline(createdAt) ? "blocked" : "grace",
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
  const reminderStart = getReminderWindowStart(snapshot.createdAt);
  const deadline = getDeadline(snapshot.createdAt);

  if (now < reminderStart || now >= deadline) {
    return { sent: false };
  }

  const reminderIdentifier = `${DAY_SIX_REMINDER_MARKER_PREFIX}${snapshot.userId}`;
  const existingReminder = await prisma.verification.findFirst({
    where: { identifier: reminderIdentifier },
    select: { id: true },
  });

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

  await prisma.verification.create({
    data: {
      id: crypto.randomUUID(),
      identifier: reminderIdentifier,
      value: "sent",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  posthog.capture({
    distinctId: snapshot.email,
    event: POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_SENT,
    properties: { source: "day6_reminder" },
  });

  return { sent: true };
}
