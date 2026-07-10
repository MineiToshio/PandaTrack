import { prisma } from "@/lib/prisma";

/**
 * Lists the `providerId` values for all linked auth accounts of a user.
 * Used by account-capability derivation and verification snapshots.
 */
export async function listProviderIdsForUser(userId: string): Promise<string[]> {
  const rows = await prisma.account.findMany({
    where: { userId },
    select: { providerId: true },
  });

  return rows.map((row) => row.providerId);
}
