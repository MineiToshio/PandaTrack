"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_SESSION_KEEPALIVE_MIN_INTERVAL_MS } from "@/lib/constants";

/** Survives shell remounts so a client-side navigation does not re-trigger the request. */
let lastKeepAliveAt: number | null = null;

function requestSessionRefresh() {
  const now = Date.now();
  if (lastKeepAliveAt !== null && now - lastKeepAliveAt < AUTH_SESSION_KEEPALIVE_MIN_INTERVAL_MS) {
    return;
  }
  lastKeepAliveAt = now;
  // An expected failure (offline, expired session) needs no reporting: the next server render
  // already redirects a signed-out collector to sign-in.
  void authClient.getSession().catch(() => {});
}

/**
 * Keeps the sliding session alive from the browser. Server renders read the session without
 * refreshing it because they cannot write cookies, so the only place the cookie expiry moves
 * forward is the `/api/auth/get-session` route this calls. Runs on mount and whenever the tab or
 * installed PWA comes back to the foreground, since a PWA can resume for weeks without a reload.
 * Renders nothing.
 */
export default function SessionKeepAlive() {
  useEffect(() => {
    requestSessionRefresh();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestSessionRefresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return null;
}
