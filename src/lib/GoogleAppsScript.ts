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
 * Does not throw; logs errors so the main waitlist flow is not blocked.
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
      const text = await response.text();
      console.error("Waitlist Google Sheet append failed:", response.status, text);
      return;
    }

    const data = (await response.json()) as { success?: boolean; error?: string };
    if (data.success !== true) {
      console.error("Waitlist Google Sheet append error:", data.error ?? "Unknown");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Waitlist Google Sheet append request failed:", message);
  }
}
