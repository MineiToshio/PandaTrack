/** The role token that grants administrator access. */
export const ADMIN_ROLE = "admin";

/**
 * Tests membership of the `admin` token in a stored role value. The `better-auth` admin plugin
 * stores roles as a comma-separated string, so a plain equality check would miss multi-role values
 * like `admin,moderator`. Only the literal `admin` token grants access.
 *
 * This is the single membership check shared by every admin read (`getIsAdmin`, `requireAdmin`, and
 * the bootstrap script), so the `admin` token resolves identically in all paths. It lives in its own
 * dependency-free module so maintenance scripts can reuse it without pulling in server-only imports.
 */
export function roleGrantsAdmin(role: unknown): boolean {
  if (typeof role !== "string") return false;
  return role
    .split(",")
    .map((value) => value.trim())
    .includes(ADMIN_ROLE);
}
