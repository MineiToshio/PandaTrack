import { prisma } from "@/lib/prisma";
import { listProviderIdsForUser } from "@/queries/account";

export type AccountCapabilities = {
  hasGoogleAccount: boolean;
  hasCredentialAccount: boolean;
  canChangeEmail: boolean;
  canChangePassword: boolean;
  canSetPassword: boolean;
};

/**
 * Derives settings account capabilities from linked auth provider ids.
 * Used by settings and server actions; keep in sync with the settings email and password rules.
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
  const providerIds = await listProviderIdsForUser(prisma, userId);
  return deriveAccountCapabilities(providerIds);
}
