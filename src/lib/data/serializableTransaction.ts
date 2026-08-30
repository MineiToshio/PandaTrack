import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Runs `work` in a Serializable transaction, retrying a bounded number of times on a
 * serialization failure.
 *
 * Money mutations read a balance and then write against it, so under concurrent submissions a
 * plain transaction can double-count on a stale read. Serializable isolation makes that
 * read-then-write conflict detectable: the database aborts the loser with `P2034`, and the loser
 * simply replays the whole decision against fresh data.
 *
 * The retry is safe only because every caller decides its refusals from data it reads inside the
 * callback: a replay re-reads and can legitimately reach a different verdict.
 */
const SERIALIZATION_FAILURE_CODE = "P2034";
const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === SERIALIZATION_FAILURE_CODE;
}

export async function runSerializableTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_RETRIES) {
        continue;
      }
      throw error;
    }
  }
}
