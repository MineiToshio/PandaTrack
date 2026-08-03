// PandaTrack service worker.
//
// Installability + push + the share-target hand-off. It takes control of the page cleanly on
// every deploy and caches nothing for offline use (no domain caching in MVP). On top of
// install/activate it handles `push` (render a notification from the JSON payload),
// `notificationclick` (focus an open client and deep-link, or open a new window), and `fetch`
// for exactly one request: the share-target POST, which never reaches the network. `activate`
// also sweeps an expired share stash out of Cache Storage (see the comment above
// `sweepExpiredShareStashOnActivate`): it is the one lifecycle point guaranteed to run without
// depending on the intake screen ever mounting. Bumping SW_VERSION forces every open tab to pick
// up the new worker on its next activation instead of continuing to run a stale one.
const SW_VERSION = "share-target-2";

// Exposed on `self` (inspectable from DevTools > Application > Service Workers) so the active
// version is verifiable without adding console noise.
self.SW_VERSION = SW_VERSION;

// The maskable PWA icon doubles as the notification icon so reminders are visually branded.
const NOTIFICATION_ICON_URL = "/icons/icon-192.png";
const NOTIFICATION_BADGE_URL = "/icons/icon-192.png";
const FALLBACK_NOTIFICATION_URL = "/";

// Share-target contract. Every value below is mirrored in `src/lib/pwa/shareStash.ts`, which is
// where it is documented; this file is a static asset and cannot import it. A unit test reads this
// file and fails if the two sides drift.
const SHARE_TARGET_ACTION_PATH = "/api/orders/image-intake/share";
const SHARE_TARGET_FILES_FIELD = "images";
const SHARE_INTAKE_PATH = "/orders/new/image";
const SHARE_SOURCE_PARAM = "source";
const SHARE_SOURCE_SHARE = "share";
const SHARE_STASH_PARAM = "stash";
const SHARE_STASH_FAILED = "failed";
const SHARE_STASH_CACHE_NAME = "panda-share-stash";
const SHARE_STASH_INDEX_URL = "/__panda-share-stash/index.json";
const SHARE_STASH_FILE_URL_PREFIX = "/__panda-share-stash/file-";
const SHARE_STASH_INDEX_VERSION = 1;
// 5 minutes. Mirrors SHARE_STASH_TTL_MS in src/lib/pwa/shareStash.ts, see that file for why.
const SHARE_STASH_TTL_MS = 300000;

// The redirect has to name a locale: the app's routing only serves locale-prefixed paths, so an
// unprefixed `/orders/new/image` would 404. The user's own choice lives in the next-intl cookie
// when they have one; otherwise the default locale is used, and the app's own locale handling
// takes over from there.
const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const SUPPORTED_LOCALES = ["es", "en"];
const DEFAULT_LOCALE = "es";

// See Other: turns the POST into a plain GET navigation, which is what the intake screen expects.
const SHARE_REDIRECT_STATUS = 303;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), sweepExpiredShareStashOnActivate()]));
});

/**
 * Checks the stash index has the shape the pickup can read, without trusting where it came from.
 * Mirrors `isShareStashIndex` in `src/lib/pwa/shareStash.ts`; this file cannot import that module.
 */
function isShareStashIndexShape(index) {
  if (!index || typeof index !== "object") return false;
  if (index.version !== SHARE_STASH_INDEX_VERSION) return false;
  if (typeof index.createdAt !== "number" || !Number.isFinite(index.createdAt)) return false;
  return Array.isArray(index.files);
}

/**
 * Drops a stash left behind by an interrupted share.
 *
 * The intake screen sweeps expired stashes on mount, and the app shell sweeps them on every
 * start, but both depend on a document actually loading and running React. A share where the
 * browser is killed, the JS bundle fails to load, or the app is closed mid-redirect never reaches
 * either of those, so the bytes would otherwise sit in Cache Storage on disk with nothing
 * scheduled to reclaim them until the browser evicts under storage pressure, on no guaranteed
 * schedule. `activate` fires on every fresh install and every version bump regardless of what the
 * page does next, so it is the one lifecycle point that can close that gap.
 *
 * Never throws: an unreadable index cannot be trusted either way, so the safe answer is the same
 * one every other defensive path in this file gives, drop the bucket.
 *
 * `activate` plus the app-start sweep already close the residue window that matters. A
 * `periodicSync` registration was considered on top of them: it needs a separate permission grant
 * the browser is free to refuse, has no guaranteed interval even when granted, and Safari does not
 * implement it at all, so it would add real complexity for a case the two existing sweeps already
 * cover. A `message`-triggered sweep was considered too, but nothing else in this worker talks to
 * its clients over `postMessage`, and there is no event today that would fire it earlier than the
 * app-start sweep already does. Neither is implemented; this comment is the record of that call.
 */
async function sweepExpiredShareStashOnActivate() {
  try {
    const cache = await caches.open(SHARE_STASH_CACHE_NAME);
    const indexResponse = await cache.match(SHARE_STASH_INDEX_URL);
    if (!indexResponse) return;

    const index = await indexResponse.json();
    if (!isShareStashIndexShape(index) || Date.now() - index.createdAt > SHARE_STASH_TTL_MS) {
      await caches.delete(SHARE_STASH_CACHE_NAME);
    }
  } catch {
    try {
      await caches.delete(SHARE_STASH_CACHE_NAME);
    } catch {
      // Storage is genuinely unreachable here; there is nothing else this worker can do.
    }
  }
}

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

/**
 * Resolves the locale for the share redirect from the next-intl cookie, defensively: the Cookie
 * Store API is not available in every worker, and a tampered or stale value must never produce a
 * path the app cannot serve.
 */
async function resolveShareLocale() {
  try {
    if (!self.cookieStore || typeof self.cookieStore.get !== "function") return DEFAULT_LOCALE;
    const cookie = await self.cookieStore.get(LOCALE_COOKIE_NAME);
    const value = cookie && typeof cookie.value === "string" ? cookie.value : "";
    return SUPPORTED_LOCALES.indexOf(value) === -1 ? DEFAULT_LOCALE : value;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Builds the navigation the share turns into. `stashStatus` is set only when the hand-off failed,
 * so the screen can show a readable error and offer to attach the photos manually instead of
 * leaving the user on a blank upload panel wondering where their screenshot went.
 */
function buildShareRedirect(locale, stashStatus) {
  const url = new URL(`/${locale}${SHARE_INTAKE_PATH}`, self.location.origin);
  url.searchParams.set(SHARE_SOURCE_PARAM, SHARE_SOURCE_SHARE);
  if (stashStatus) {
    url.searchParams.set(SHARE_STASH_PARAM, stashStatus);
  }
  return Response.redirect(url.href, SHARE_REDIRECT_STATUS);
}

/**
 * Writes the shared files into Cache Storage under synthetic request keys, plus a JSON index the
 * page uses to rebuild them as `File` objects in the original order.
 *
 * The bucket is dropped first: a stale stash from an earlier share must never be picked up as if
 * it were what the user just shared.
 */
async function stashSharedFiles(files) {
  await caches.delete(SHARE_STASH_CACHE_NAME);
  const cache = await caches.open(SHARE_STASH_CACHE_NAME);

  const entries = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const key = `${SHARE_STASH_FILE_URL_PREFIX}${index}`;
    await cache.put(
      new Request(key),
      new Response(file, { headers: { "content-type": file.type || "application/octet-stream" } }),
    );
    entries.push({
      key,
      name: typeof file.name === "string" && file.name ? file.name : `shared-${index}`,
      type: typeof file.type === "string" ? file.type : "",
    });
  }

  await cache.put(
    new Request(SHARE_STASH_INDEX_URL),
    new Response(JSON.stringify({ version: SHARE_STASH_INDEX_VERSION, createdAt: Date.now(), files: entries }), {
      headers: { "content-type": "application/json" },
    }),
  );
}

/**
 * Answers the share-target POST without ever touching the network.
 *
 * The OS posts the original, uncompressed file. Handing it to the server as is would breach the
 * request ceiling on a single large screenshot, so the bytes are parked locally and the page picks
 * them up and runs the same compression and upload path an in-app pick runs.
 *
 * A share with no usable image redirects without a stash: the screen then asks for the photos
 * instead of reporting a failure the user cannot act on. Only a genuine hand-off failure carries
 * the error marker.
 */
async function handleSharedImages(request) {
  const locale = await resolveShareLocale();

  try {
    const formData = await request.formData();
    const files = formData
      .getAll(SHARE_TARGET_FILES_FIELD)
      .filter((entry) => typeof File !== "undefined" && entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      await caches.delete(SHARE_STASH_CACHE_NAME);
      return buildShareRedirect(locale, null);
    }

    await stashSharedFiles(files);
    return buildShareRedirect(locale, null);
  } catch {
    // Nothing about the payload is logged or reported from here: it is the user's own screenshot.
    // The stash is dropped so a half-written bucket can never be picked up as a complete share.
    try {
      await caches.delete(SHARE_STASH_CACHE_NAME);
    } catch {
      // Already unreachable storage; the page's own TTL check discards whatever remains.
    }
    return buildShareRedirect(locale, SHARE_STASH_FAILED);
  }
}

self.addEventListener("fetch", (event) => {
  // Exactly one request is intercepted. Everything else, including every navigation and every
  // asset, falls through to the network untouched: this worker caches nothing.
  const request = event.request;
  if (request.method !== "POST") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin || url.pathname !== SHARE_TARGET_ACTION_PATH) return;

  event.respondWith(handleSharedImages(request));
});
