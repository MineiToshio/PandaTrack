/**
 * One-time, idempotent administrator bootstrap.
 *
 * Grants `role` `admin` to the account resolved from a supplied email, so the first administrator
 * exists in an environment before the app stops reading the environment allowlist. The email is the
 * stable per-environment key; the resolved user id differs per environment. The account must already
 * exist (sign in once first), otherwise the script fails loudly and writes nothing.
 *
 * Idempotent: if the account already has an admin role the script reports a no-op and exits 0. It
 * only ever elevates the single account resolved from the supplied email; it never demotes and never
 * touches any other account. After a write it re-reads and prints the resulting role for verification
 * (it never prints secrets).
 *
 * Run this per environment (dev, staging DB, prod) and verify the grant BEFORE deploying the code
 * that flips admin reads to the role and removes the allowlist, so the owner is never locked out.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-admin.ts <email>
 *   ADMIN_BOOTSTRAP_EMAIL=<email> npx tsx scripts/bootstrap-admin.ts
 *   npm run db-bootstrap-admin -- <email>
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { decideAdminGrant, resolveBootstrapEmail } from "../src/lib/auth/adminBootstrap";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const email = resolveBootstrapEmail(process.argv[2], process.env.ADMIN_BOOTSTRAP_EMAIL);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) {
    throw new Error(`No account found for ${email}. Sign in once with this email, then re-run the bootstrap.`);
  }

  const decision = decideAdminGrant(user.role);
  if (decision.kind === "noop") {
    console.log(`No-op: ${email} already has an admin role ("${decision.role}"). Nothing changed.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: decision.role } });

  const verified = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  console.log(`Granted admin to ${email}. Resulting role: "${verified?.role ?? "(unknown)"}".`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
