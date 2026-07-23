import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { roleGrantsAdmin } from "@/lib/auth/adminRole";

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

/**
 * Returns true when the session user's database role grants admin. Backs the non-throwing admin
 * reads (store auto-approval, the direct-edit hint, and private-store visibility) that need a boolean
 * rather than the throwing {@link requireAdmin} gate. Shares the single {@link roleGrantsAdmin}
 * membership check with {@link requireAdmin}, so the `admin` token resolves identically in both
 * paths. Non-throwing: returns false for no session, no user, or a role that does not grant admin.
 */
export function getIsAdmin(session: { user: { role?: unknown } } | null): boolean {
  return roleGrantsAdmin(session?.user?.role);
}
