import { prisma } from "@/lib/prisma";
import { PasswordRecoveryThrottleState } from "@/lib/auth/passwordRecoveryThrottle";

const PASSWORD_RESET_TOKEN_PREFIX = "reset-password:";

function buildPasswordResetVerificationIdentifier(token: string) {
  return `${PASSWORD_RESET_TOKEN_PREFIX}${token}`;
}

export async function getPasswordRecoveryThrottleMarker(scopeId: string) {
  return prisma.verification.findUnique({
    where: {
      id: scopeId,
    },
    select: {
      expiresAt: true,
      value: true,
    },
  });
}

export async function upsertPasswordRecoveryThrottleMarker(scopeId: string, state: PasswordRecoveryThrottleState) {
  const now = new Date();

  return prisma.verification.upsert({
    where: {
      id: scopeId,
    },
    update: {
      expiresAt: new Date(state.expiresAt),
      value: JSON.stringify(state),
      updatedAt: now,
    },
    create: {
      id: scopeId,
      identifier: scopeId,
      value: JSON.stringify(state),
      expiresAt: new Date(state.expiresAt),
      createdAt: now,
      updatedAt: now,
    },
  });
}

export async function deletePasswordResetVerificationToken(token: string) {
  return prisma.verification.deleteMany({
    where: {
      identifier: buildPasswordResetVerificationIdentifier(token),
    },
  });
}
