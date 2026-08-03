import * as Sentry from "@sentry/nextjs";
import { sweepExpiredShareStash } from "@/lib/pwa/shareStash";

const SERVICE_WORKER_SCRIPT_URL = "/sw.js";
const SERVICE_WORKER_SCOPE = "/";

let registrationAttempted = false;

/**
 * Registers the app service worker from the authenticated app shell.
 *
 * Idempotent: a module-level guard skips repeat calls within the same page session (for example
 * a duplicate effect invocation), on top of the browser's own registration semantics, which
 * resolve a repeat call with the same script URL and scope to the existing registration instead
 * of creating a new one.
 *
 * Fails closed: a browser without service worker support is an expected, silent no-op. An
 * unexpected registration error is captured once with Sentry and never rethrown, so the app
 * shell keeps rendering regardless of the outcome.
 *
 * Also sweeps an expired share stash out of Cache Storage on every app start, not only when the
 * intake screen mounts: opening PandaTrack on any screen is enough to reclaim a stash an
 * interrupted share left behind. Kicked off before the service worker support check, since Cache
 * Storage is independent of it, and never awaited: the sweep already resolves defensively on its
 * own and must never delay or block the app shell from rendering.
 */
export async function registerServiceWorker(): Promise<void> {
  if (registrationAttempted) return;
  registrationAttempted = true;

  void sweepExpiredShareStash().catch(() => undefined);

  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_SCRIPT_URL, { scope: SERVICE_WORKER_SCOPE });
  } catch (error) {
    Sentry.captureException(error, { extra: { action: "registerServiceWorker" } });
  }
}
