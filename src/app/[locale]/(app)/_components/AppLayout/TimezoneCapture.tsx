"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { syncUserTimezoneAction } from "@/app/[locale]/(app)/_actions/syncUserTimezone";

type TimezoneCaptureProps = {
  /** The timezone currently stored for the collector, or `null` when none has ever been captured. */
  storedTimezone: string | null;
};

/**
 * Guards against repeat writes of the same value within a page session (a remount of the shell, a
 * duplicate effect invocation), on top of the stored-value comparison below.
 */
let syncedTimezone: string | null = null;

/** The browser's IANA timezone, or `null` when the runtime cannot resolve one. */
function readBrowserTimeZone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone ? timezone : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the collector's stored timezone aligned with the browser they actually use. The timezone is
 * only knowable in the browser, so it cannot be derived server-side the way the locale is; mounting
 * the capture in the shell also backfills every collector who signed up before it existed.
 *
 * The stored value is handed down from the server, so the steady state costs nothing: the action is
 * only called when the browser reports a zone the collector has no stored value for, or a different
 * one (a relocation, a trip). Invisible plumbing: it renders nothing, gives no feedback, and a
 * failure is captured once and swallowed so the shell is never blocked or broken by it.
 */
export default function TimezoneCapture({ storedTimezone }: TimezoneCaptureProps) {
  useEffect(() => {
    const browserTimezone = readBrowserTimeZone();

    if (!browserTimezone || browserTimezone === storedTimezone || browserTimezone === syncedTimezone) {
      return;
    }

    syncedTimezone = browserTimezone;

    void syncUserTimezoneAction(browserTimezone).catch((error: unknown) => {
      Sentry.captureException(error, { extra: { action: "syncUserTimezone" } });
    });
  }, [storedTimezone]);

  return null;
}
