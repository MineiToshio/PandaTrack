import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";

/**
 * Returns the current session from the request cookies (server-side only).
 * Use in Server Components, Server Actions, or Route Handlers.
 *
 * @returns The session and user, or null if unauthenticated
 */
export async function getSession() {
  const requestHeaders = await headers();
  return auth.api.getSession({
    headers: requestHeaders,
  });
}
