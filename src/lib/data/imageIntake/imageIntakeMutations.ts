import { prisma } from "@/lib/prisma";
import { EXTRACTION_TOTAL_BUDGET_MS } from "@/lib/imageIntake/extractionEngine";
import { resolveEffectiveMonthlyLimit } from "@/lib/imageIntake/quota";
import { ImageIntakeUsageStatus, type ImageIntakeEntrySource, type Prisma } from "../../../../generated/prisma/client";

/**
 * Safety margin added on top of the extraction phase's own wall-clock budget
 * (`EXTRACTION_TOTAL_BUDGET_MS`, see `extractionEngine.ts`) before a PENDING reservation is treated
 * as abandoned rather than merely slow. Ten minutes is comfortably longer than any request this
 * feature can legitimately still be running, including every retry and backoff that budget already
 * bounds, so a reservation still PENDING past this point can only be a leak (a process killed
 * mid-extraction, never settled), never a slow-but-alive one.
 */
const STALE_PENDING_RESERVATION_MARGIN_MS = 10 * 60 * 1000;

/**
 * Exported so the guard test can assert the exact cutoff the global aggregate applies, rather than
 * re-deriving it from the two constants above.
 */
export const STALE_PENDING_RESERVATION_THRESHOLD_MS = EXTRACTION_TOTAL_BUDGET_MS + STALE_PENDING_RESERVATION_MARGIN_MS;

/**
 * Every ledger read and write in this module runs inside one transaction that first takes
 * `pg_advisory_xact_lock(hashtext(periodKey))`.
 *
 * Postgres rejects `FOR UPDATE` on an aggregate query, so the running period total cannot be
 * locked the way a row can. The advisory lock serializes every concurrent reservation and
 * settlement for the same period behind it (it is released automatically at commit/rollback), so
 * the total any caller reads always reflects every previously committed row. Without it, N
 * concurrent submissions could all read the same under-budget total and all proceed, and two
 * settlements could each believe they were the one that crossed the alert threshold.
 */
async function takePeriodLock(tx: Prisma.TransactionClient, periodKey: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${periodKey}))`;
}

export type ReserveImageIntakeUsageInput = {
  userId: string;
  periodKey: string;
  dayKey: string;
  entrySource: ImageIntakeEntrySource;
  imageCount: number;
  model: string;
  /** Conservative pre-call estimate; replaced by the real figures at settlement. */
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostMicroUsd: number;
  now: Date;
  /** Thresholds are decided by the caller (`spendGuard.ts`); this module only enforces them atomically. */
  rateLimitWindowMs: number;
  hardStopMicroUsd: number;
  /**
   * Administrators spend no photos from a bag: neither the monthly limit nor the daily cap is
   * enforced for them, while the reservation row and the roll-up are still written and the global
   * ceiling above still applies.
   */
  isAdmin: boolean;
  /** Product default, applied when the user carries no per-user override. */
  defaultMonthlyPhotoQuota: number;
  dailyPhotoCap: number;
  /**
   * Billable attempts allowed per user per day, counting every row of the day whatever its status.
   * Unlike the photo caps this one binds administrators too: it limits what the product can be
   * charged for, not what a collector is entitled to.
   */
  dailyAttemptCap: number;
};

export type ReserveImageIntakeUsageResult =
  | { status: "reserved"; reservationId: string; periodTotalMicroUsdBeforeReservation: number }
  | { status: "rate-limited" }
  /** Only ever returned after the period total was actually read and found at or above the ceiling. */
  | { status: "budget-blocked" }
  /** Photos left in the monthly bag, which is fewer than this submission needs. */
  | { status: "quota-exceeded"; remaining: number }
  /** Photos left today under the anti-burst cap; the monthly bag itself may still be healthy. */
  | { status: "daily-cap-exceeded"; remaining: number }
  /**
   * Too many billable attempts today. Carries no remaining balance on purpose: it is not a personal
   * allowance the collector spent, so there is no honest "you have N left" to state.
   */
  | { status: "daily-attempt-cap-exceeded" };

/**
 * Checks the per-user rate limit, the global period ceiling, the per-user daily attempt cap, and
 * the collector's own photo bag, and, when all of them pass, writes a PENDING reservation row plus
 * the matching roll-up increment, all under the same period lock.
 *
 * The reservation is what makes the ceilings hold under concurrency: the estimate, the photo count,
 * and the row itself are visible to every request that checks afterwards, so requests already in
 * flight cannot be spent twice over.
 *
 * The three families of check are deliberately counted differently:
 *
 * - Money (the global ceiling) reads every status, because a request that failed may still have
 *   been billed.
 * - Attempts (the daily attempt cap) also read every status, because a request that failed was
 *   still sent. This is what stops a deterministic failure from being free to repeat forever.
 * - Photos (the monthly bag and the daily photo cap) deliberately ignore failures, because a
 *   provider failure is never billed to the collector and gives its photos back at settlement.
 *
 * The photo reservation covers the whole submission: either every photo fits or nothing is
 * written, so half a submission is never processed.
 */
export async function reserveImageIntakeUsage(
  input: ReserveImageIntakeUsageInput,
): Promise<ReserveImageIntakeUsageResult> {
  return prisma.$transaction(async (tx) => {
    await takePeriodLock(tx, input.periodKey);

    const latest = await tx.imageIntakeUsage.findFirst({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (latest && input.now.getTime() - latest.createdAt.getTime() < input.rateLimitWindowMs) {
      return { status: "rate-limited" };
    }

    // Every SUCCEEDED/FAILED row counts, whatever its age: it is a settled, real cost. A PENDING
    // row counts too, UNLESS it is older than `STALE_PENDING_RESERVATION_THRESHOLD_MS`: a
    // reservation that has outlived any request this feature could still legitimately be running
    // is not "in flight", it is a row a process killed mid-extraction never got to settle. Counting
    // it forever at its worst-case estimate would let enough orphans alone disable photo intake for
    // every user with $0 of real spend behind the block; excluding it here is the one place that
    // matters, since `settleImageIntakeUsage` clears it the moment (if ever) it does resolve.
    const staleBefore = new Date(input.now.getTime() - STALE_PENDING_RESERVATION_THRESHOLD_MS);
    const totals = await tx.imageIntakeUsage.aggregate({
      where: {
        periodKey: input.periodKey,
        OR: [{ status: { not: ImageIntakeUsageStatus.PENDING } }, { createdAt: { gte: staleBefore } }],
      },
      _sum: { costMicroUsd: true },
    });
    const periodTotalMicroUsdBeforeReservation = totals._sum.costMicroUsd ?? 0;

    if (periodTotalMicroUsdBeforeReservation >= input.hardStopMicroUsd) {
      return { status: "budget-blocked" };
    }

    // Counts the day's rows whatever they returned, administrators included. The photo caps below
    // forgive a provider failure, which is right for the collector, but that refund must not also
    // make the attempt itself free: without this, a request that always fails costs real money and
    // consumes nothing, and a loop of them can drain the shared ceiling for the whole product.
    const attemptsToday = await tx.imageIntakeUsage.count({
      where: { userId: input.userId, dayKey: input.dayKey },
    });
    if (attemptsToday >= input.dailyAttemptCap) {
      return { status: "daily-attempt-cap-exceeded" };
    }

    // Read inside the lock, not before it: an override granted while a submission is in flight
    // must apply to the next reservation, not to a value captured earlier in the request.
    const account = await tx.user.findUnique({
      where: { id: input.userId },
      select: { aiMonthlyPhotoLimit: true },
    });
    const monthlyLimit = resolveEffectiveMonthlyLimit({
      isAdmin: input.isAdmin,
      override: account?.aiMonthlyPhotoLimit ?? null,
    });

    const rollUp = await tx.imageIntakePeriod.findUnique({
      where: { userId_periodKey: { userId: input.userId, periodKey: input.periodKey } },
      select: { usedPhotos: true },
    });
    const usedPhotos = rollUp?.usedPhotos ?? 0;

    if (monthlyLimit !== null) {
      const remaining = Math.max(0, monthlyLimit - usedPhotos);
      if (input.imageCount > remaining) {
        return { status: "quota-exceeded", remaining };
      }

      // The daily cap reads the ledger rather than the roll-up, which is monthly by definition.
      // FAILED rows are excluded for the same reason they are refunded from the roll-up: a
      // provider failure must not cost the collector a photo, today's cap included.
      const dailyUsage = await tx.imageIntakeUsage.aggregate({
        where: {
          userId: input.userId,
          dayKey: input.dayKey,
          status: { in: [ImageIntakeUsageStatus.PENDING, ImageIntakeUsageStatus.SUCCEEDED] },
        },
        _sum: { imageCount: true },
      });
      const dailyRemaining = Math.max(0, input.dailyPhotoCap - (dailyUsage._sum.imageCount ?? 0));
      if (input.imageCount > dailyRemaining) {
        return { status: "daily-cap-exceeded", remaining: dailyRemaining };
      }
    }

    const reservation = await tx.imageIntakeUsage.create({
      data: {
        userId: input.userId,
        periodKey: input.periodKey,
        dayKey: input.dayKey,
        entrySource: input.entrySource,
        status: ImageIntakeUsageStatus.PENDING,
        imageCount: input.imageCount,
        model: input.model,
        inputTokens: input.estimatedInputTokens,
        outputTokens: input.estimatedOutputTokens,
        costMicroUsd: input.estimatedCostMicroUsd,
        orderId: null,
      },
      select: { id: true },
    });

    // The roll-up is written for every collector, administrators included: they have no cap, but
    // their consumption is still recorded.
    await tx.imageIntakePeriod.upsert({
      where: { userId_periodKey: { userId: input.userId, periodKey: input.periodKey } },
      create: {
        userId: input.userId,
        periodKey: input.periodKey,
        usedPhotos: input.imageCount,
        costMicroUsd: input.estimatedCostMicroUsd,
      },
      update: {
        usedPhotos: { increment: input.imageCount },
        costMicroUsd: { increment: input.estimatedCostMicroUsd },
      },
    });

    return { status: "reserved", reservationId: reservation.id, periodTotalMicroUsdBeforeReservation };
  });
}

export type SettleImageIntakeUsageInput = {
  reservationId: string;
  periodKey: string;
  status: typeof ImageIntakeUsageStatus.SUCCEEDED | typeof ImageIntakeUsageStatus.FAILED;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
};

export type SettleImageIntakeUsageResult = {
  /** Global period total excluding this reservation, immediately before it was settled. */
  periodTotalMicroUsdBefore: number;
  /** Same total including this reservation's real settled cost. */
  periodTotalMicroUsdAfter: number;
};

/**
 * Replaces a PENDING reservation with the real outcome and cost, corrects the collector's roll-up
 * in the same locked transaction, and reports the period total before and after, so the caller can
 * detect an alert-threshold crossing from the same read that performed the settlement.
 *
 * Photos are given back on FAILED and kept on SUCCEEDED: a provider failure or timeout is never
 * billed to the collector, while the money it may still have cost stays counted against the global
 * ceiling.
 *
 * A missing or already-settled reservation throws: it means the caller lost track of its own
 * reservation, which would otherwise silently double-count or lose a charge.
 */
export async function settleImageIntakeUsage(
  input: SettleImageIntakeUsageInput,
): Promise<SettleImageIntakeUsageResult> {
  return prisma.$transaction(async (tx) => {
    await takePeriodLock(tx, input.periodKey);

    const reservation = await tx.imageIntakeUsage.findUnique({
      where: { id: input.reservationId },
      select: { status: true, costMicroUsd: true, userId: true, imageCount: true },
    });

    if (!reservation) {
      throw new Error("IMAGE_INTAKE_RESERVATION_NOT_FOUND");
    }
    if (reservation.status !== ImageIntakeUsageStatus.PENDING) {
      throw new Error("IMAGE_INTAKE_RESERVATION_ALREADY_SETTLED");
    }

    const totals = await tx.imageIntakeUsage.aggregate({
      where: { periodKey: input.periodKey },
      _sum: { costMicroUsd: true },
    });
    // The aggregate still counts this reservation at its estimate, so removing it yields the
    // period total as it stands without this submission.
    const periodTotalMicroUsdBefore = (totals._sum.costMicroUsd ?? 0) - reservation.costMicroUsd;

    await tx.imageIntakeUsage.update({
      where: { id: input.reservationId },
      data: {
        status: input.status,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costMicroUsd: input.costMicroUsd,
      },
    });

    const consumesPhotos = input.status === ImageIntakeUsageStatus.SUCCEEDED;

    // The roll-up moves by the difference between what was reserved and what the request really
    // cost, so it never depends on the order settlements arrive in. An upsert rather than an
    // update because a reservation may predate its roll-up (a row written before this aggregate
    // existed), in which case settling it is what creates the row rather than what fails on it.
    await tx.imageIntakePeriod.upsert({
      where: { userId_periodKey: { userId: reservation.userId, periodKey: input.periodKey } },
      create: {
        userId: reservation.userId,
        periodKey: input.periodKey,
        usedPhotos: consumesPhotos ? reservation.imageCount : 0,
        costMicroUsd: input.costMicroUsd,
      },
      update: {
        costMicroUsd: { increment: input.costMicroUsd - reservation.costMicroUsd },
        ...(consumesPhotos ? {} : { usedPhotos: { decrement: reservation.imageCount } }),
      },
    });

    return {
      periodTotalMicroUsdBefore,
      // A failed request that Google still billed counts toward the ceiling exactly like a
      // successful one: the money left the account either way.
      periodTotalMicroUsdAfter: periodTotalMicroUsdBefore + input.costMicroUsd,
    };
  });
}
