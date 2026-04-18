import { prisma } from "@/lib/prisma";
import { PasswordRecoveryThrottleState } from "@/lib/auth/passwordRecoveryThrottle";
import {
  deleteVerificationsByIdentifier,
  findVerificationMarkerById,
  upsertVerificationMarker,
  type VerificationMarker,
} from "@/queries/verification";

const PASSWORD_RESET_TOKEN_PREFIX = "reset-password:";

function buildPasswordResetVerificationIdentifier(token: string) {
  return `${PASSWORD_RESET_TOKEN_PREFIX}${token}`;
}

export async function getPasswordRecoveryThrottleMarker(scopeId: string): Promise<VerificationMarker | null> {
  return findVerificationMarkerById(prisma, scopeId);
}

export async function upsertPasswordRecoveryThrottleMarker(scopeId: string, state: PasswordRecoveryThrottleState) {
  const now = new Date();

  await upsertVerificationMarker(prisma, {
    id: scopeId,
    identifier: scopeId,
    value: JSON.stringify(state),
    expiresAt: new Date(state.expiresAt),
    now,
  });
}

export async function deletePasswordResetVerificationToken(token: string) {
  return deleteVerificationsByIdentifier(prisma, buildPasswordResetVerificationIdentifier(token));
}
