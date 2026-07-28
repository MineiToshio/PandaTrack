import { z } from "zod";
import { ADMIN_ROLE, roleGrantsAdmin } from "@/lib/auth/adminRole";

/** Environment variable the bootstrap reads when no email is passed as a CLI argument. */
export const ADMIN_BOOTSTRAP_EMAIL_ENV = "ADMIN_BOOTSTRAP_EMAIL";

const bootstrapEmailSchema = z
  .string()
  .trim()
  .min(1)
  .pipe(z.email())
  .transform((value) => value.toLowerCase());

/**
 * Validates and normalizes the bootstrap target email at the boundary. The CLI argument wins over
 * the `ADMIN_BOOTSTRAP_EMAIL` environment value. Throws a loud, actionable error when neither yields
 * a valid email, so the operator can never silently bootstrap the wrong (or no) account.
 */
export function resolveBootstrapEmail(cliArg: string | undefined, envValue: string | undefined): string {
  const parsed = bootstrapEmailSchema.safeParse(cliArg ?? envValue);
  if (!parsed.success) {
    throw new Error(
      "A valid admin email is required. Pass it as the first argument " +
        `(npx tsx scripts/bootstrap-admin.ts <email>) or set ${ADMIN_BOOTSTRAP_EMAIL_ENV}.`,
    );
  }
  return parsed.data;
}

/** Outcome of the pure admin-grant decision, resolved before any database write. */
export type AdminGrantDecision = { kind: "noop"; role: string } | { kind: "grant"; role: string };

/**
 * Pure grant decision for the bootstrap. When the current role already grants admin, the bootstrap
 * is a no-op (idempotent re-run); otherwise it resolves to writing the `admin` role. It performs no
 * database access, so it is unit-testable in isolation. The bootstrap only elevates: it never
 * resolves to a decision that drops an existing admin grant.
 */
export function decideAdminGrant(currentRole: string | null | undefined): AdminGrantDecision {
  if (roleGrantsAdmin(currentRole)) {
    return { kind: "noop", role: typeof currentRole === "string" ? currentRole : ADMIN_ROLE };
  }
  return { kind: "grant", role: ADMIN_ROLE };
}
