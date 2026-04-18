import type { PrismaClient } from "../../generated/prisma/client";

/**
 * Lists the `providerId` values for all linked auth accounts of a user.
 * Used by account-capability derivation and verification snapshots.
 */
export async function listProviderIdsForUser(db: PrismaClient, userId: string): Promise<string[]> {
  const rows = await db.account.findMany({
    where: { userId },
    select: { providerId: true },
  });

  return rows.map((row) => row.providerId);
}
