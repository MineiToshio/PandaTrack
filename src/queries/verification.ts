import type { PrismaClient } from "../../generated/prisma/client";

export type VerificationMarker = {
  expiresAt: Date;
  value: string | null;
};

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
 * Returns the verification row stored under the given primary id, if any.
 * Used by throttle/rate-limit markers keyed by a deterministic scope id.
 */
export async function findVerificationMarkerById(db: PrismaClient, id: string): Promise<VerificationMarker | null> {
  return db.verification.findUnique({
    where: { id },
    select: {
      expiresAt: true,
      value: true,
    },
  });
}

/**
 * Creates or refreshes a verification marker keyed by `id`.
 * `createdAt`/`updatedAt` default to `now`; `expiresAt` comes from the caller policy.
 */
export async function upsertVerificationMarker(db: PrismaClient, input: VerificationMarkerUpsertInput): Promise<void> {
  await db.verification.upsert({
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
export async function deleteVerificationsByIdentifier(
  db: PrismaClient,
  identifier: string,
): Promise<{ count: number }> {
  return db.verification.deleteMany({
    where: { identifier },
  });
}

/**
 * Returns the first verification row for `identifier`, or `null`.
 * Used by "reminder already sent" checks where only existence matters.
 */
export async function findFirstVerificationIdByIdentifier(
  db: PrismaClient,
  identifier: string,
): Promise<{ id: string } | null> {
  return db.verification.findFirst({
    where: { identifier },
    select: { id: true },
  });
}

/**
 * Creates a new verification row (used for day-6 verification reminder markers and similar one-off records).
 */
export async function createVerificationRecord(db: PrismaClient, input: VerificationRecordCreateInput): Promise<void> {
  await db.verification.create({
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
