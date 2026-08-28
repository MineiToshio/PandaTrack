import { z } from "zod";
import { Prisma } from "../../../../generated/prisma/client";
import type { PointLedgerSource } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { domainDateSchema } from "@/lib/domainDateSchema";
import { writeAuditEntry } from "@/lib/data/admin/adminAuditMutations";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "@/lib/data/admin/adminAuditVocabulary";
import { isKnownRuleKey } from "./pointRules";
import { recomputeUserProgress } from "./recompute";

/** Write side of the progression domain. */

/** How far ahead of the server's clock an `occurredOn` may legitimately sit.
 *
 *  It is a civil day pinned to UTC midnight, so a collector east of UTC genuinely credits a day that
 *  has not started in UTC yet: at 08:00 in Tokyo the correct civil day is still an hour in the
 *  future by the server's reckoning. One day of slack covers every real offset while still refusing
 *  a date that is simply wrong. */
const MAX_OCCURRED_ON_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

const awardPointsSchema = z.object({
  userId: z.string().min(1),
  ruleKey: z.string().refine(isKnownRuleKey, { message: "UNKNOWN_RULE_KEY" }),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  // The ledger admits no zero and no negative entry. A caller mistake must fail loudly here rather
  // than persist a row that quietly subtracts from a collector's total forever.
  points: z.number().int().positive(),
  occurredOn: domainDateSchema.refine((value) => value.getTime() - Date.now() <= MAX_OCCURRED_ON_LOOKAHEAD_MS, {
    message: "OCCURRED_ON_IN_FUTURE",
  }),
  source: z.enum(["LIVE", "BACKFILL"]),
});

export type AwardPointsInput = {
  userId: string;
  ruleKey: string;
  entityType: string;
  entityId: string;
  points: number;
  occurredOn: Date;
  source: PointLedgerSource;
};

export type AwardPointsResult = { credited: boolean };

/**
 * Appends one ledger entry, idempotently.
 *
 * Takes the caller's transaction client so the credit rides inside the host mutation's own
 * transaction: a mutation that ends up refusing must not leave a credit behind.
 *
 * Idempotency is the unique constraint, not a lookup. A `findFirst` followed by a conditional
 * `create` reads and writes in two steps, and two retries of the same host mutation racing each
 * other both see "no row yet" and both insert. Letting the database refuse the duplicate is the only
 * version of this that is correct under concurrency, so a `P2002` is an expected outcome here and
 * resolves to "already credited" rather than an error.
 *
 * Validation happens before the write, never after: this function has no refusal path once it has
 * issued its insert.
 */
export async function awardPoints(db: Prisma.TransactionClient, input: AwardPointsInput): Promise<AwardPointsResult> {
  const data = awardPointsSchema.parse(input);

  try {
    await db.pointLedgerEntry.create({
      data: {
        userId: data.userId,
        ruleKey: data.ruleKey,
        entityType: data.entityType,
        entityId: data.entityId,
        points: data.points,
        occurredOn: data.occurredOn,
        source: data.source,
      },
      select: { id: true },
    });
    return { credited: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { credited: false };
    }
    throw error;
  }
}

export type AwardPointsBatchResult = { credited: number };

/**
 * Appends several ledger entries at once, idempotently, and is what every credit call site inside a
 * host mutation must use.
 *
 * The difference from {@link awardPoints} is not batching, it is WHERE the duplicate is resolved.
 * `awardPoints` lets the insert fail and catches `P2002`, which is correct on its own but is not
 * safe inside somebody else's transaction: PostgreSQL aborts the whole transaction on a constraint
 * violation, so every statement after it fails too. A second credit for an entity already credited
 * would therefore roll back the order, payment or delivery that triggered it, which is precisely the
 * asymmetry the Error Contract forbids. `skipDuplicates` compiles to `ON CONFLICT DO NOTHING`: the
 * duplicate is resolved by the database without ever raising, so the host transaction survives.
 *
 * The return value counts rows actually inserted, not rows offered. A caller uses it to decide
 * whether anything changed at all, never to price the credit: what an entry is finally worth is the
 * recompute's answer, after the caps.
 */
export async function awardPointsBatch(
  db: Prisma.TransactionClient,
  inputs: readonly AwardPointsInput[],
): Promise<AwardPointsBatchResult> {
  if (inputs.length === 0) {
    return { credited: 0 };
  }

  const data = inputs.map((input) => awardPointsSchema.parse(input));

  const result = await db.pointLedgerEntry.createMany({ data, skipDuplicates: true });
  return { credited: result.count };
}

export type VoidUserProgressionPointsInput = {
  actorId: string;
  targetUserId: string;
  reason: string;
};

export type VoidUserProgressionPointsError = "VOID_REASON_REQUIRED" | "USER_NOT_FOUND" | "AUDIT_WRITE_FAILED";

export type VoidUserProgressionPointsResult =
  | { ok: true; voidedEntryCount: number; maturedPoints: number; highestRankIndex: number }
  | { ok: false; error: VoidUserProgressionPointsError };

/**
 * Raised when the audit write fails inside the void transaction.
 *
 * The refusal cannot be hoisted: whether the trail can be written is only knowable after the void
 * itself has been issued. Returning it would commit the void with no record of who did it or why, so
 * it throws to roll the whole thing back and is mapped to the caller's own error code outside.
 */
class ProgressionAuditWriteFailure extends Error {
  constructor(readonly cause: unknown) {
    super("PROGRESSION_AUDIT_WRITE_FAILED");
    this.name = "ProgressionAuditWriteFailure";
  }
}

/**
 * Voids every live ledger entry a collector has, and re-derives their progression in the same
 * transaction.
 *
 * No negative row is written and nothing is deleted: the entries stay, marked with who voided them
 * and why, and the recompute simply stops counting them. That keeps the answer to "why did my points
 * change" in the data instead of erasing it.
 *
 * `actorId` is taken on trust from the caller and is NOT an authorization check. Whatever eventually
 * calls this has to gate on the administrator role itself before it gets here.
 */
export async function voidUserProgressionPoints(
  input: VoidUserProgressionPointsInput,
): Promise<VoidUserProgressionPointsResult> {
  return prisma
    .$transaction<VoidUserProgressionPointsResult>(async (tx) => {
      // Both refusals are decided before the first write, so returning them commits nothing.
      const reason = input.reason.trim();
      if (reason.length === 0) {
        return { ok: false, error: "VOID_REASON_REQUIRED" };
      }

      const target = await tx.user.findUnique({ where: { id: input.targetUserId }, select: { id: true } });
      if (!target) {
        return { ok: false, error: "USER_NOT_FOUND" };
      }

      const voided = await tx.pointLedgerEntry.updateMany({
        where: { userId: input.targetUserId, voidedAt: null },
        data: { voidedAt: new Date(), voidedReason: reason, voidedByUserId: input.actorId },
      });

      const progress = await recomputeUserProgress(input.targetUserId, tx);

      try {
        await writeAuditEntry(
          {
            actorId: input.actorId,
            action: AUDIT_ACTIONS.PROGRESSION_VOID,
            targetType: AUDIT_TARGET_TYPES.USER,
            targetId: input.targetUserId,
            reason,
          },
          tx,
        );
      } catch (error) {
        throw new ProgressionAuditWriteFailure(error);
      }

      return {
        ok: true,
        voidedEntryCount: voided.count,
        maturedPoints: progress.derivedTotal,
        highestRankIndex: progress.highestRankIndex,
      };
    })
    .catch((error: unknown) => {
      if (error instanceof ProgressionAuditWriteFailure) {
        return { ok: false, error: "AUDIT_WRITE_FAILED" };
      }
      throw error;
    });
}

/**
 * Ensures the settings row exists without disturbing whatever it already holds.
 *
 * The row is created lazily: a collector who never touched the layer has none, and both writers
 * below need one to exist before they can operate on it. `update: {}` is deliberate, so a
 * concurrent caller that created the row first does not have its values overwritten.
 */
async function ensureProgressionSettings(db: Prisma.TransactionClient, userId: string): Promise<void> {
  await db.progressionSettings.upsert({ where: { userId }, create: { userId }, update: {} });
}

/**
 * Claims the once-per-rank celebration for `rankIndex`, and reports whether this caller won it.
 *
 * The claim is the write, not a read followed by a write: `updateMany` with `lastCelebratedRankIndex
 * { lt }` both tests and advances the watermark in one statement, so two tabs resolving the same
 * credited action cannot both decide they are the one that gets to celebrate. A recompute that
 * later re-derives the same rank finds the watermark already at or above it and claims nothing,
 * which is what makes the celebration unrepeatable rather than merely rare (`FR-12-19`).
 */
export async function claimRankCelebration(
  userId: string,
  rankIndex: number,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  await ensureProgressionSettings(db, userId);
  const claimed = await db.progressionSettings.updateMany({
    where: { userId, lastCelebratedRankIndex: { lt: rankIndex } },
    data: { lastCelebratedRankIndex: rankIndex },
  });
  return claimed.count > 0;
}

/**
 * Switches the whole progression layer off or back on for one collector (`FR-12-38`).
 *
 * Nothing is deleted and no accrual stops: the ledger keeps filling while the layer is hidden, so
 * turning it back on restores the accumulated progression instead of starting from zero
 * (`AC-12-13`). Purging is a separate, explicit act.
 */
export async function setProgressionVisibility(
  userId: string,
  hideProgression: boolean,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.progressionSettings.upsert({
    where: { userId },
    create: { userId, hideProgression },
    update: { hideProgression },
  });
}

export type PurgeProgressionLedgerResult = { deletedEntries: number; deletedUnlocks: number };

/**
 * Deletes one collector's whole points history, permanently (`FR-12-46`).
 *
 * The opposite of the administrative void above, and deliberately so: a void keeps the rows and
 * stops counting them, because an administrator has to be able to explain a total afterwards. This
 * is the collector exercising `BR-12-11` over their own data, so the rows really go.
 *
 * The celebration watermark goes back to zero with the history it was tracking. Leaving it behind
 * would silently swallow the first rank the collector reaches again on the way back up.
 *
 * Every statement is a delete over rows keyed by `userId`; there is no refusal path inside the
 * transaction, so nothing here can commit a partial purge (`ADR 0022`).
 */
export async function purgeProgressionLedger(userId: string): Promise<PurgeProgressionLedgerResult> {
  return prisma.$transaction(async (tx) => {
    const entries = await tx.pointLedgerEntry.deleteMany({ where: { userId } });
    const unlocks = await tx.medalUnlock.deleteMany({ where: { userId } });
    await tx.userProgress.deleteMany({ where: { userId } });
    await tx.progressionSettings.updateMany({ where: { userId }, data: { lastCelebratedRankIndex: 0 } });
    return { deletedEntries: entries.count, deletedUnlocks: unlocks.count };
  });
}
