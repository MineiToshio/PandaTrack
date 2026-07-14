import webpush from "web-push";

/**
 * Result of attempting to deliver a single push message.
 *
 * - `SENT`: the push service accepted the message.
 * - `EXPIRED`: the subscription is gone (`410`/`404`); the caller must prune it.
 * - `TRANSIENT_FAILURE`: any other failure; the caller logs it and continues.
 */
export type PushSendResult = "SENT" | "EXPIRED" | "TRANSIENT_FAILURE";

/**
 * The minimal push subscription shape the transport needs. Deliberately narrow
 * so nothing beyond the endpoint and its keys can leak into the send path.
 */
export interface PushSubscriptionTarget {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * The serialized notification payload. It carries only presentational fields and
 * a deep-link target: never money values, note text, or subscriber keys.
 */
export interface PushMessagePayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const HTTP_GONE = 410;
const HTTP_NOT_FOUND = 404;

let vapidConfigured = false;

/**
 * Configures the VAPID details from environment variables exactly once per
 * process. Throws when a required variable is missing so the caller can classify
 * the send as a transient failure rather than sending unsigned.
 */
function ensureVapidConfigured(): void {
  if (vapidConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID environment variables are not configured");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * Reads the HTTP status code off a thrown push error without assuming its shape.
 */
function readStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const { statusCode } = error as { statusCode?: unknown };
    return typeof statusCode === "number" ? statusCode : undefined;
  }
  return undefined;
}

/**
 * Signs and sends one payload to one subscription and classifies the outcome.
 * Never throws: transport and configuration errors are mapped to the result
 * union so a single bad subscription can never abort a batch.
 */
export async function sendPushMessage(
  subscription: PushSubscriptionTarget,
  payload: PushMessagePayload,
): Promise<PushSendResult> {
  try {
    ensureVapidConfigured();

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      },
      JSON.stringify(payload),
    );

    return "SENT";
  } catch (error) {
    const statusCode = readStatusCode(error);
    if (statusCode === HTTP_GONE || statusCode === HTTP_NOT_FOUND) {
      return "EXPIRED";
    }
    return "TRANSIENT_FAILURE";
  }
}
