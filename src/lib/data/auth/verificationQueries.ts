import { prisma } from "@/lib/prisma";

export type VerificationMarker = {
  expiresAt: Date;
  value: string | null;
};

/**
 * Returns the verification row stored under the given primary id, if any.
 * Used by throttle/rate-limit markers keyed by a deterministic scope id.
 */
export async function findVerificationMarkerById(id: string): Promise<VerificationMarker | null> {
  return prisma.verification.findUnique({
    where: { id },
    select: {
      expiresAt: true,
      value: true,
    },
  });
}

/**
 * Returns the first verification row for `identifier`, or `null`.
 * Used by "reminder already sent" checks where only existence matters.
 */
export async function findFirstVerificationIdByIdentifier(identifier: string): Promise<{ id: string } | null> {
  return prisma.verification.findFirst({
    where: { identifier },
    select: { id: true },
  });
}
