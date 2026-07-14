// PandaTrack service worker.
//
// Installability + push. It takes control of the page cleanly on every deploy and
// caches nothing (no offline/domain caching in MVP). On top of install/activate it
// handles `push` (render a notification from the JSON payload) and `notificationclick`
// (focus an open client and deep-link, or open a new window). Bumping SW_VERSION forces
// every open tab to pick up the new worker on its next activation instead of continuing
// to run a stale one.
const SW_VERSION = "push-opt-in-1";

// Exposed on `self` (inspectable from DevTools > Application > Service Workers) so the active
// version is verifiable without adding console noise.
self.SW_VERSION = SW_VERSION;

// The maskable PWA icon doubles as the notification icon so reminders are visually branded.
const NOTIFICATION_ICON_URL = "/icons/icon-192.png";
const NOTIFICATION_BADGE_URL = "/icons/icon-192.png";
const FALLBACK_NOTIFICATION_URL = "/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Parses the push payload defensively. A malformed or missing payload must never throw
 * out of the event handler, so anything unparseable yields an empty object and the
 * notification falls back to generic values.
 */
function parsePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch {
    return {};
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = typeof payload.title === "string" && payload.title ? payload.title : "PandaTrack";
  const url = typeof payload.url === "string" && payload.url ? payload.url : FALLBACK_NOTIFICATION_URL;

  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: NOTIFICATION_ICON_URL,
    badge: NOTIFICATION_BADGE_URL,
    tag: typeof payload.tag === "string" && payload.tag ? payload.tag : undefined,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : FALLBACK_NOTIFICATION_URL;
  const absoluteTarget = new URL(targetUrl, self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Reuse an already-open PandaTrack tab: focus it and navigate it to the deep link.
        if ("focus" in client) {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === absoluteTarget.origin) {
            return client.focus().then((focused) => {
              if (focused && "navigate" in focused) {
                return focused.navigate(absoluteTarget.href);
              }
              return focused;
            });
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTarget.href);
      }
      return undefined;
    }),
  );
});
