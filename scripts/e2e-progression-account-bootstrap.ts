/**
 * One-time, idempotent bootstrap for the dedicated progression E2E account.
 *
 * `e2e/progression-unlock-surfaces.spec.ts` cannot run against the shared `E2E_USER_EMAIL`
 * account: that account carries the collector's own real, permanently-imported order history, and
 * the progression medals it unlocks and the rank it celebrates can never be re-locked
 * (`BR-12-08`). The suite needs an account whose progression state it can reset to a virgin state
 * on every run, so it needs an account of its own.
 *
 * This script creates that account through Better Auth's own sign-up endpoint (a real password
 * hash, not a hand-written row), the same pipeline a genuine sign-up goes through, including the
 * `databaseHooks.user.create.before` username generation in `src/lib/auth/auth.ts`. It requires
 * the dev server to already be running (`npm run dev`), because Better Auth's `nextCookies` plugin
 * needs a real request context to run, which only exists inside a route handler.
 *
 * Idempotent: if the account already exists, this is a no-op. Marks the account's email verified
 * directly (skipping the real verification email round-trip) since Better Auth does not require
 * verification to sign in here, and a throwaway account has no reason to depend on Resend.
 *
 * Usage:
 *   npm run e2e-progression-bootstrap
 *   npx tsx scripts/e2e-progression-account-bootstrap.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PROGRESSION_ACCOUNT_DISPLAY_NAME = "E2E Progression";
const DEFAULT_TRUSTED_PORT = "3000";

/** Refuses to bootstrap an email that matches one of the real, already-configured E2E accounts. */
function assertNotRealAccount(email: string): void {
  const realAccountEmails = [process.env.E2E_USER_EMAIL, process.env.E2E_ADMIN_EMAIL].filter(Boolean);
  if (realAccountEmails.includes(email)) {
    throw new Error(
      `Refusing to bootstrap ${email}: it matches E2E_USER_EMAIL or E2E_ADMIN_EMAIL. ` +
        "E2E_PROGRESSION_USER_EMAIL must name a dedicated, throwaway account.",
    );
  }
}

/** Mirrors `playwright.config.ts`'s own resolution of the local dev server's origin. */
function resolveBaseUrl(): string {
  if (process.env.PLAYWRIGHT_BASE_URL) return process.env.PLAYWRIGHT_BASE_URL;
  const port = process.env.PLAYWRIGHT_PORT ?? DEFAULT_TRUSTED_PORT;
  const host = process.env.PLAYWRIGHT_HOST ?? "localhost";
  return `http://${host}:${port}`;
}

async function main(): Promise<void> {
  const email = process.env.E2E_PROGRESSION_USER_EMAIL;
  const password = process.env.E2E_PROGRESSION_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_PROGRESSION_USER_EMAIL and E2E_PROGRESSION_USER_PASSWORD must both be set.");
  }
  assertNotRealAccount(email);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    console.log(`No-op: ${email} already exists (id ${existing.id}, role "${existing.role}"). Nothing changed.`);
    return;
  }

  const baseUrl = resolveBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email, password, name: PROGRESSION_ACCOUNT_DISPLAY_NAME }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Sign-up failed (${response.status}) against ${baseUrl}. Is the dev server running (npm run dev)? ${body}`,
    );
  }

  const created = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!created) {
    throw new Error(`Sign-up against ${baseUrl} reported success but no user row exists for ${email}.`);
  }
  await prisma.user.update({ where: { id: created.id }, data: { emailVerified: true } });

  console.log(`Created dedicated progression E2E account: ${email} (id ${created.id}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
