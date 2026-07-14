import type { PushSubscriptionInput } from "@/lib/notifications/notificationValidation";

/**
 * Outcome of attempting to subscribe this browser to push.
 *
 * - `subscribed`: permission granted and a subscription was created; carries the
 *   serialized payload to persist server-side.
 * - `permission-denied`: the collector denied (or previously blocked) permission.
 *   The caller must surface guidance and never retry silently (`FR-09-12`).
 * - `unsupported`: the browser lacks the service worker or Push API.
 * - `failed`: an unexpected error while subscribing (for example the push service
 *   rejected the request).
 */
export type SubscribeResult =
  | { status: "subscribed"; subscription: PushSubscriptionInput }
  | { status: "permission-denied" }
  | { status: "unsupported" }
  | { status: "failed" };

/**
 * Reports whether this browser exposes everything the opt-in flow needs: a service
 * worker container, the Push API, and the Notification API. Used to render the
 * `UNSUPPORTED` degraded state (`FR-09-12`).
 */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Returns the current browser notification permission, or `"unsupported"` when the
 * Notification API is unavailable so callers can branch without touching a missing global.
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Decodes a URL-safe base64 VAPID public key into the `Uint8Array` the Push API
 * requires as its `applicationServerKey`.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Back the array with a concrete ArrayBuffer so it satisfies the Push API's
  // `BufferSource` type (a SharedArrayBuffer-backed view would not).
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Normalizes a browser `PushSubscription` into the server-action input shape,
 * attaching the current user agent so a collector can recognize the device later.
 * Returns `null` when the browser omitted either encryption key.
 */
function toSubscriptionInput(subscription: PushSubscription): PushSubscriptionInput | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    return null;
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh, auth },
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

/**
 * Returns the live push subscription for this browser, or `null` when none exists.
 * Used to derive the master toggle state (`ACTIVE` requires a live subscription).
 */
export async function getExistingSubscription(): Promise<PushSubscriptionInput | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  return toSubscriptionInput(subscription);
}

/**
 * Requests notification permission and subscribes this browser to push with the
 * public VAPID key. Reuses an existing subscription when one is already present
 * (so re-enabling never duplicates). Never throws: every failure maps to a typed
 * result the caller reconciles into UI state.
 */
export async function subscribeBrowserToPush(vapidPublicKey: string): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    return { status: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { status: "permission-denied" };
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const input = toSubscriptionInput(subscription);
    if (!input) {
      return { status: "failed" };
    }
    return { status: "subscribed", subscription: input };
  } catch {
    return { status: "failed" };
  }
}

/**
 * Unsubscribes this browser from push and returns the endpoint that was removed so
 * the caller can deactivate the matching server-side row. Returns `null` when there
 * was no live subscription to remove.
 */
export async function unsubscribeBrowserFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}
