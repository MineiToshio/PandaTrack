import { PasswordRecoveryThrottleState } from "@/lib/auth/passwordRecoveryThrottle";
import { findVerificationMarkerById, type VerificationMarker } from "@/lib/data/auth/verificationQueries";
import {
  deleteVerificationsByIdentifier,
  upsertVerificationMarker,
} from "@/lib/data/auth/verificationMutations";

const PASSWORD_RESET_TOKEN_PREFIX = "reset-password:";

function buildPasswordResetVerificationIdentifier(token: string) {
  return `${PASSWORD_RESET_TOKEN_PREFIX}${token}`;
}

export async function getPasswordRecoveryThrottleMarker(scopeId: string): Promise<VerificationMarker | null> {
  return findVerificationMarkerById(scopeId);
}

export async function upsertPasswordRecoveryThrottleMarker(scopeId: string, state: PasswordRecoveryThrottleState) {
  const now = new Date();

  await upsertVerificationMarker({
    id: scopeId,
    identifier: scopeId,
    value: JSON.stringify(state),
    expiresAt: new Date(state.expiresAt),
    now,
  });
}

export async function deletePasswordResetVerificationToken(token: string) {
  return deleteVerificationsByIdentifier(buildPasswordResetVerificationIdentifier(token));
}
