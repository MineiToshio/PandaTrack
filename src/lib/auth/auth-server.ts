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

/** Resolved (non-null) session shape returned by {@link getSession}. */
type ResolvedSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Thrown by {@link requireAdmin} when the caller is not an administrator. This is an expected
 * authorization outcome, not a bug: it must not be reported to Sentry. Callers translate it into the
 * right response for their layer (for example a 403 in an action, or a redirect in a page).
 */
export class AdminAccessError extends Error {
  constructor(message = "Admin access required") {
    super(message);
    this.name = "AdminAccessError";
  }
}

/**
 * Tests membership of the `admin` token in a stored role value. The `better-auth` admin plugin
 * stores roles as a comma-separated string, so a plain equality check would miss multi-role values
 * like `admin,moderator`. Only the literal `admin` token grants access.
 */
function roleGrantsAdmin(role: unknown): boolean {
  if (typeof role !== "string") return false;
  return role
    .split(",")
    .map((value) => value.trim())
    .includes("admin");
}

/**
 * Server-side authorization gate for every privileged action. Resolves the session, verifies the
 * database role, and throws {@link AdminAccessError} before any work runs when there is no session
 * or the role does not grant admin. Returns the resolved session/user when the check passes. This
 * helper never redirects; redirects belong to the route/page layer.
 */
export async function requireAdmin(): Promise<ResolvedSession> {
  const session = await getSession();
  if (!session?.user) {
    throw new AdminAccessError();
  }
  if (!roleGrantsAdmin((session.user as { role?: unknown }).role)) {
    throw new AdminAccessError();
  }
  return session;
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
