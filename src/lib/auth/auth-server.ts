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

const ADMIN_EMAILS_KEY = "ADMIN_EMAILS";

/**
 * Returns true if the session user is considered an admin (e.g. store moderation).
 * Admin emails are configured via ADMIN_EMAILS (comma-separated, trimmed).
 */
export function getIsAdmin(session: { user: { email?: string | null } } | null): boolean {
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return false;
  const list = process.env[ADMIN_EMAILS_KEY];
  if (!list) return false;
  const allowed = list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email);
}
