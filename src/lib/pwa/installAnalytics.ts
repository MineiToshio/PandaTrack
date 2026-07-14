import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";

let listenersAttached = false;

/**
 * Wires best-effort PWA install analytics from the authenticated app shell.
 *
 * Idempotent: a module-level guard prevents attaching duplicate listeners on a repeat call.
 * Best-effort by design: not every browser exposes `beforeinstallprompt` or `appinstalled`
 * (notably iOS Safari and several in-app browsers never fire either), so these events measure
 * what is observable rather than every install.
 */
export function initPwaInstallAnalytics(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
}

function handleBeforeInstallPrompt(): void {
  posthog.capture(POSTHOG_EVENTS.NOTIFICATIONS.PWA_INSTALL_PROMPT_SHOWN);
}

function handleAppInstalled(): void {
  posthog.capture(POSTHOG_EVENTS.NOTIFICATIONS.PWA_INSTALLED);
}
