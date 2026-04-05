import { prisma } from "@/lib/prisma";

export type AccountCapabilities = {
  hasGoogleAccount: boolean;
  hasCredentialAccount: boolean;
  canChangeEmail: boolean;
  canChangePassword: boolean;
  canSetPassword: boolean;
};

/**
 * Derives settings account capabilities from linked auth provider ids.
 * Used by settings and server actions; keep in sync with FRD-07 email and password rules.
 */
export function deriveAccountCapabilities(providerIds: readonly string[]): AccountCapabilities {
  const ids = new Set(providerIds);
  const hasGoogleAccount = ids.has("google");
  const hasCredentialAccount = ids.has("credential");

  return {
    hasGoogleAccount,
    hasCredentialAccount,
    canChangeEmail: hasCredentialAccount && !hasGoogleAccount,
    canChangePassword: hasCredentialAccount,
    canSetPassword: hasGoogleAccount && !hasCredentialAccount,
  };
}

export async function getAccountCapabilitiesForUser(userId: string): Promise<AccountCapabilities> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { providerId: true },
  });

  return deriveAccountCapabilities(accounts.map((row) => row.providerId));
}
