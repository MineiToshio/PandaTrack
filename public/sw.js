// PandaTrack service worker.
//
// This is the installability-only version: it takes control of the page cleanly on
// every deploy and caches nothing. It intentionally does not implement `push` or
// `notificationclick` yet; those are added by a later version of this file. Bumping
// SW_VERSION forces every open tab to pick up the new worker on its next activation
// instead of continuing to run a stale one.
const SW_VERSION = "pwa-installability-1";

// Exposed on `self` (inspectable from DevTools > Application > Service Workers) so the active
// version is verifiable without adding console noise.
self.SW_VERSION = SW_VERSION;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
