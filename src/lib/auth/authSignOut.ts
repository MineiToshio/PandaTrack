"use client";

import { clearShareStash } from "@/lib/pwa/shareStash";
import { authClient } from "./auth-client";

/**
 * The single client-side sign-out path.
 *
 * Ending a session has to end the device-local state that belongs to it, not only the cookie. The
 * share stash is the case that matters: the service worker parks shared screenshots in Cache
 * Storage without knowing whose they are, so anything still parked when a session ends would
 * outlive its owner and be waiting for whoever signs in next. On a phone or a computer two people
 * share, that is one person's private conversation handed to another.
 *
 * The cleanup runs before the sign-out request so it happens even if that request hangs or the user
 * closes the tab while it is in flight, and it never rejects, so it cannot prevent a sign-out.
 */
export async function signOutClient(options?: { onSuccess?: () => void }): Promise<void> {
  await clearShareStash();
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        options?.onSuccess?.();
      },
    },
  });
}
