import { prisma } from "@/lib/prisma";

export type VerificationMarkerUpsertInput = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  now: Date;
};

export type VerificationRecordCreateInput = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  now: Date;
};

/**
 * Creates or refreshes a verification marker keyed by `id`.
 * `createdAt`/`updatedAt` default to `now`; `expiresAt` comes from the caller policy.
 */
export async function upsertVerificationMarker(input: VerificationMarkerUpsertInput): Promise<void> {
  await prisma.verification.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      identifier: input.identifier,
      value: input.value,
      expiresAt: input.expiresAt,
      createdAt: input.now,
      updatedAt: input.now,
    },
    update: {
      value: input.value,
      expiresAt: input.expiresAt,
      updatedAt: input.now,
    },
  });
}

/**
 * Deletes every verification row matching the given `identifier`.
 * Returns the `{ count }` shape from `deleteMany` so callers can log/track cleanup results.
 */
export async function deleteVerificationsByIdentifier(identifier: string): Promise<{ count: number }> {
  return prisma.verification.deleteMany({
    where: { identifier },
  });
}

/**
 * Creates a new verification row (used for day-6 verification reminder markers and similar one-off records).
 */
export async function createVerificationRecord(input: VerificationRecordCreateInput): Promise<void> {
  await prisma.verification.create({
    data: {
      id: input.id,
      identifier: input.identifier,
      value: input.value,
      expiresAt: input.expiresAt,
      createdAt: input.now,
      updatedAt: input.now,
    },
  });
}
