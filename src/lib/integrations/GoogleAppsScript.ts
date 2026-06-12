import * as Sentry from "@sentry/nextjs";

export type WaitlistRowPayload = {
  createdAt: string;
  name: string;
  email: string;
  locale: string;
  comment: string;
};

const WEB_APP_URL = process.env.GOOGLE_APPS_SCRIPT_WAITLIST_WEB_APP_URL;

/**
 * Sends the waitlist row to the Google Apps Script web app so it can append it to the sheet.
 * Does not throw; failures are reported to Sentry so the main waitlist flow is not blocked.
 */
export async function appendWaitlistToGoogleSheet(payload: WaitlistRowPayload): Promise<void> {
  if (!WEB_APP_URL || WEB_APP_URL.trim() === "") {
    return;
  }

  try {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      Sentry.captureMessage("Waitlist Google Sheet append failed", {
        level: "error",
        tags: { flow: "waitlist", step: "sheetAppend" },
        extra: { status: response.status },
      });
      return;
    }

    const data = (await response.json()) as { success?: boolean; error?: string };
    if (data.success !== true) {
      Sentry.captureMessage("Waitlist Google Sheet append rejected", {
        level: "error",
        tags: { flow: "waitlist", step: "sheetAppend" },
        extra: { error: data.error ?? "Unknown" },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { flow: "waitlist", step: "sheetAppend" },
    });
  }
}
