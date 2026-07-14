"use server";

import * as Sentry from "@sentry/nextjs";
import { userTimezoneSchema } from "@/app/[locale]/(app)/_schemas/userTimezoneSchema";
import { getSession } from "@/lib/auth/auth-server";
import { updateUserTimezone } from "@/lib/data/auth/userMutations";

export type SyncUserTimezoneErrorCode = "unauthorized" | "validation" | "generic";

export type SyncUserTimezoneResult = { ok: true } | { ok: false; error: SyncUserTimezoneErrorCode };

/**
 * Stores the timezone the collector's browser reports, so server-side surfaces that run without a
 * browser (the scheduled reminder dispatcher) and server-rendered periods (the dashboard) resolve
 * "today" in the collector's own civil day instead of falling back to `UTC`.
 *
 * The value comes from the client and is never trusted: it is validated against the runtime's zone
 * database before any write, and it is only ever written against the session user's own id.
 */
export async function syncUserTimezoneAction(timezone: string): Promise<SyncUserTimezoneResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = userTimezoneSchema.safeParse(timezone);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  try {
    await updateUserTimezone(session.user.id, parsed.data);
    return { ok: true };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "syncUserTimezoneAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}
