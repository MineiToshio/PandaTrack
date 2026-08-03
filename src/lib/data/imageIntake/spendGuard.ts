import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  computeCostMicroUsd,
  SpendGuardBlockedError,
  type ImageIntakeFailureRecord,
  type ImageIntakeUsageRecord,
  type SpendGuard,
} from "@/lib/imageIntake/extractionEngine";
import {
  DAILY_ATTEMPT_CAP,
  DAILY_PHOTO_CAP,
  DEFAULT_MONTHLY_PHOTO_QUOTA,
  IMAGE_INTAKE_MAX_OUTPUT_TOKENS,
} from "@/lib/imageIntake/constants";
import { formatDayKey, formatPeriodKey } from "@/lib/imageIntake/quota";
import { sendEmailWithResend } from "@/lib/integrations/resend";
import { ImageIntakeUsageStatus, type ImageIntakeEntrySource } from "../../../../generated/prisma/client";
import { reserveImageIntakeUsage, settleImageIntakeUsage } from "./imageIntakeMutations";

const MICRO_USD_PER_USD = 1_000_000;
const DEFAULT_SPEND_ALERT_USD = 4;
const DEFAULT_SPEND_HARD_STOP_USD = 5;

/** One submission per user per this many milliseconds; enforced from the ledger's own timestamps. */
const RATE_LIMIT_WINDOW_MS = 10_000;

/**
 * Widest gap tolerated between the caller-supplied `now` and the server clock. The injected clock
 * exists so tests can pin period and rate-limit behavior; it is not a value to trust from a
 * request, because a skewed `now` would write into a different billing period and could read a
 * rate-limit window that has "already" elapsed. Beyond this gap the server clock wins.
 */
const MAX_CLOCK_SKEW_MS = 48 * 60 * 60 * 1000;

/**
 * Pre-call input estimate, in tokens. Gemini bills an image as a fixed number of tokens per tile,
 * so a photo at the intake pipeline's compression ceiling (see `INTAKE_TARGET_MAX_WIDTH` /
 * `INTAKE_TARGET_MAX_HEIGHT` in `src/lib/imageIntake/constants.ts`) lands near this figure. It is a
 * deliberately generous constant rather than a measurement: the reservation has to be computable
 * before the request exists, and over-reserving is the safe direction for a liability ceiling.
 */
const ESTIMATED_INPUT_TOKENS_PER_IMAGE = 1_120;

/**
 * The output side of the reservation is the WORST case the provider is allowed to bill, not a
 * typical draft, and it is the same number the request itself pins as `maxOutputTokens`. Reserving
 * the typical case would leave the ceiling comparing a real charge against a reservation one or two
 * orders of magnitude smaller, so enough concurrent requests could each pass the check and together
 * overshoot the ceiling by far more than the ceiling itself.
 *
 * The trade-off is deliberate and bounded. Between the reservation and its settlement, a request
 * occupies far more of the ceiling than it will end up costing, which lowers how much of the ceiling
 * is usable at any one instant. That over-reservation lasts only as long as the request: settlement
 * replaces it with the real figures, so it never accumulates. A ceiling that is genuinely a ceiling
 * is worth more than a slightly larger usable margin.
 */
const WORST_CASE_OUTPUT_TOKENS_PER_REQUEST = IMAGE_INTAKE_MAX_OUTPUT_TOKENS;

/** Treats an empty string the same as an unset variable, so `KEY=` in `.env` behaves like no override. */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

// `.default()`/`.optional()` must wrap the INNER schema, not the `z.preprocess()` call: a
// `ZodDefault`/`ZodOptional` only short-circuits when the raw input it receives is `undefined`.
// `IMAGE_INTAKE_ALERT_EMAIL=""` arrives as a defined empty string, so it skips that short-circuit
// and reaches `emptyToUndefined`, which turns it into `undefined` *after* the point where
// `.default()`/`.optional()` would have caught it if they wrapped the preprocess instead.
const spendGuardEnvSchema = z.object({
  alertUsd: z.preprocess(emptyToUndefined, z.coerce.number().finite().positive().default(DEFAULT_SPEND_ALERT_USD)),
  hardStopUsd: z.preprocess(
    emptyToUndefined,
    z.coerce.number().finite().positive().default(DEFAULT_SPEND_HARD_STOP_USD),
  ),
  alertEmail: z.preprocess(emptyToUndefined, z.string().trim().pipe(z.email()).optional()),
});

type SpendGuardEnv = {
  alertMicroUsd: number;
  hardStopMicroUsd: number;
  alertEmail: string | null;
};

/**
 * Parses the spend-guard environment once per guard construction, with Zod, converting USD to
 * integer micro-USD so every downstream comparison stays in the ledger's own integer unit. An
 * invalid override (a non-numeric threshold, a malformed alert address, an alert threshold above
 * the hard stop) throws here instead of silently falling back to a default: a bad override could
 * otherwise raise or remove the spend ceiling, or leave the warning permanently unreachable,
 * without anyone noticing.
 */
function parseSpendGuardEnv(): SpendGuardEnv {
  const parsed = spendGuardEnvSchema.safeParse({
    alertUsd: process.env.IMAGE_INTAKE_SPEND_ALERT_USD,
    hardStopUsd: process.env.IMAGE_INTAKE_SPEND_HARD_STOP_USD,
    alertEmail: process.env.IMAGE_INTAKE_ALERT_EMAIL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid image intake spend guard environment: ${parsed.error.message}`);
  }

  const alertMicroUsd = Math.round(parsed.data.alertUsd * MICRO_USD_PER_USD);
  const hardStopMicroUsd = Math.round(parsed.data.hardStopUsd * MICRO_USD_PER_USD);

  if (alertMicroUsd > hardStopMicroUsd) {
    throw new Error(
      "Invalid image intake spend guard environment: IMAGE_INTAKE_SPEND_ALERT_USD must not exceed " +
        "IMAGE_INTAKE_SPEND_HARD_STOP_USD, otherwise spend is cut off before the warning can ever fire.",
    );
  }

  return { alertMicroUsd, hardStopMicroUsd, alertEmail: parsed.data.alertEmail ?? null };
}

/** Falls back to the server clock when the caller's `now` is unusable or too far away (see `MAX_CLOCK_SKEW_MS`). */
function resolveTrustedNow(callerNow: Date, serverNow: Date): Date {
  const callerTime = callerNow instanceof Date ? callerNow.getTime() : Number.NaN;
  if (!Number.isFinite(callerTime) || Math.abs(callerTime - serverNow.getTime()) > MAX_CLOCK_SKEW_MS) {
    return serverNow;
  }
  return callerNow;
}

function estimateReservationMicroUsd(imageCount: number): number {
  return computeCostMicroUsd({
    inputTokens: imageCount * ESTIMATED_INPUT_TOKENS_PER_IMAGE,
    outputTokens: WORST_CASE_OUTPUT_TOKENS_PER_REQUEST,
  });
}

/**
 * Builds the alert email body. Deliberately carries aggregate figures only (period key, threshold,
 * running total): no user identity, order content, or extracted content ever reaches this email,
 * per the zero-retention posture the rest of this feature holds to (ADR 0020).
 *
 * This is an internal operations alert to the product's own administrator, not user-facing
 * product copy, so it is not localized through `src/i18n/locales`.
 */
function buildSpendAlertEmail(params: { periodKey: string; alertUsd: number; periodTotalUsd: number }): {
  subject: string;
  text: string;
} {
  const subject = `PandaTrack image intake: spend alert threshold crossed (${params.periodKey})`;
  const text = [
    `The image intake spend ledger crossed its alert threshold for period ${params.periodKey}.`,
    `Alert threshold: $${params.alertUsd.toFixed(2)} USD`,
    `Period spend so far: $${params.periodTotalUsd.toFixed(2)} USD`,
    "This is an aggregate figure only. No order content, image content, or user data is included.",
  ].join("\n");
  return { subject, text };
}

/**
 * Best-effort notification for an alert-threshold crossing. Never throws: the alert is a
 * monitoring aid, not the safety mechanism (the hard stop is), so a failed email or missing
 * recipient must never surface as an extraction failure.
 *
 * In-app admin notification was evaluated against the existing `src/lib/notifications/` pipeline
 * and deliberately not wired here: that pipeline is per-collector and preference-gated (push
 * subscriptions plus a fixed `NotificationPreference` column per type), with no concept of an
 * admin-targeted broadcast. Adding one would require a new `NotificationType`, a new
 * `NotificationPreference` column, and admin-audience targeting, none of which this ledger slice
 * is scoped to add; email is the whole alert channel for now.
 */
async function dispatchSpendAlert(params: {
  periodKey: string;
  alertMicroUsd: number;
  periodTotalMicroUsd: number;
  alertEmail: string | null;
}): Promise<void> {
  const alertUsd = params.alertMicroUsd / MICRO_USD_PER_USD;
  const periodTotalUsd = params.periodTotalMicroUsd / MICRO_USD_PER_USD;

  if (!params.alertEmail) {
    // No recipient configured, so the crossing has nowhere to be delivered. It is reported at
    // warning level rather than as an error: the hard stop still protects the budget, but a
    // threshold crossing nobody can see is worth surfacing where the rest of this feature reports.
    Sentry.captureMessage(
      `Image intake spend alert threshold crossed with no recipient configured (period ${params.periodKey}: ` +
        `${periodTotalUsd.toFixed(2)} of ${alertUsd.toFixed(2)} USD)`,
      { level: "warning", tags: { feature: "imageIntake", action: "spendAlertUndeliverable" } },
    );
    return;
  }

  const { subject, text } = buildSpendAlertEmail({ periodKey: params.periodKey, alertUsd, periodTotalUsd });

  try {
    await sendEmailWithResend({ to: params.alertEmail, subject, text });
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "spendAlertEmail" } });
  }
}

export type CreateImageIntakeSpendGuardInput = {
  userId: string;
  entrySource: ImageIntakeEntrySource;
  /** Injected rather than read from the clock, so period/day keys and the rate-limit check stay deterministic in tests. */
  now: Date;
  /**
   * Number of source images in this submission. Not part of `ImageIntakeUsageRecord` (the
   * extraction engine's contract only carries token/cost usage after the call completes), so the
   * caller, who already holds the images array before invoking `extract()`, supplies it here at
   * guard construction time.
   */
  imageCount: number;
  /** The same model id the caller passes to `extract()`, so the reservation row is attributable before the call answers. */
  model: string;
  /**
   * Resolved by the caller through the session (`getIsAdmin`), never from an environment allowlist
   * read here. Administrators spend no photos from a bag, but every other ceiling still applies:
   * the global cut-off, the rate limit, and the daily attempt cap all bind them, because those
   * three bound what the product can be charged, not what a collector is entitled to.
   */
  isAdmin: boolean;
};

/**
 * Builds the ledger-backed `SpendGuard` the extraction engine's contract (`extractionEngine.ts`)
 * requires, closed over one user's submission context. Construction itself parses and validates
 * the spend-guard environment (fail closed on an invalid override, see `parseSpendGuardEnv`), so
 * a misconfigured deployment never silently ships with no ceiling.
 *
 * The guard works as a reservation: `assertCanSpend()` writes a PENDING row holding an estimated
 * cost, and `recordUsage()` / `recordFailure()` settle that same row with the real figures. A
 * reservation that is never settled (a process killed mid-request) keeps counting at its estimate
 * forever. That is intentional: the ceiling exists to bound liability, so silently over-counting a
 * request that may well have been billed is safer than under-counting one that was.
 */
export function createImageIntakeSpendGuard(input: CreateImageIntakeSpendGuardInput): SpendGuard {
  const env = parseSpendGuardEnv();
  const now = resolveTrustedNow(input.now, new Date());
  const periodKey = formatPeriodKey(now);
  const dayKey = formatDayKey(now);
  const estimatedCostMicroUsd = estimateReservationMicroUsd(input.imageCount);

  let reservationId: string | null = null;

  async function settleReservation(
    status: typeof ImageIntakeUsageStatus.SUCCEEDED | typeof ImageIntakeUsageStatus.FAILED,
    record: ImageIntakeUsageRecord,
  ): Promise<void> {
    if (!reservationId) {
      throw new Error(
        "Image intake spend guard has no active reservation to settle: assertCanSpend() must " +
          "succeed exactly once before recordUsage() or recordFailure().",
      );
    }

    const result = await settleImageIntakeUsage({
      reservationId,
      periodKey,
      status,
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      costMicroUsd: record.costMicroUsd,
    });

    // Cleared only after the write committed: a failed settlement leaves the row PENDING at its
    // estimate, which still counts against the ceiling.
    reservationId = null;

    // Read from the same locked transaction that performed the settlement, so only the write that
    // actually pushes the total across the line sees the crossing. A settlement that comes in
    // under its own reservation lowers the period total, so a later one can cross the line again
    // and re-alert; that is one email per real crossing, which is the behavior worth having.
    const crossedAlertThreshold =
      result.periodTotalMicroUsdBefore < env.alertMicroUsd && result.periodTotalMicroUsdAfter >= env.alertMicroUsd;

    if (!crossedAlertThreshold) {
      return;
    }

    await dispatchSpendAlert({
      periodKey,
      alertMicroUsd: env.alertMicroUsd,
      periodTotalMicroUsd: result.periodTotalMicroUsdAfter,
      alertEmail: env.alertEmail,
    });
  }

  return {
    async assertCanSpend(): Promise<void> {
      let result: Awaited<ReturnType<typeof reserveImageIntakeUsage>>;

      try {
        result = await reserveImageIntakeUsage({
          userId: input.userId,
          periodKey,
          dayKey,
          entrySource: input.entrySource,
          imageCount: input.imageCount,
          model: input.model,
          estimatedInputTokens: input.imageCount * ESTIMATED_INPUT_TOKENS_PER_IMAGE,
          estimatedOutputTokens: WORST_CASE_OUTPUT_TOKENS_PER_REQUEST,
          estimatedCostMicroUsd,
          now,
          rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
          hardStopMicroUsd: env.hardStopMicroUsd,
          isAdmin: input.isAdmin,
          defaultMonthlyPhotoQuota: DEFAULT_MONTHLY_PHOTO_QUOTA,
          dailyPhotoCap: DAILY_PHOTO_CAP,
          dailyAttemptCap: DAILY_ATTEMPT_CAP,
        });
      } catch (error) {
        Sentry.captureException(error, { tags: { feature: "imageIntake", action: "assertCanSpend" } });
        // Fail closed: an unreadable or unwritable ledger must never be treated as "under budget",
        // so the submission is refused exactly as firmly as a real ceiling hit. It reports as a
        // ledger failure rather than as "budget-blocked" because nothing about the budget was
        // measured here: a lock timeout under contention, or a database that is simply down, would
        // otherwise tell the collector their spend ran out, which is a lie and points them at the
        // wrong remedy. "Budget-blocked" stays reserved for the case where the period total was
        // actually read and had reached the ceiling.
        throw new SpendGuardBlockedError("ledger-error", "LEDGER_RESERVATION_FAILED");
      }

      if (result.status === "quota-exceeded" || result.status === "daily-cap-exceeded") {
        // The balance travels with the refusal so the surface that reports it can state both
        // numbers ("vas a subir 5 y te quedan 3") without reading the roll-up a second time.
        throw new SpendGuardBlockedError(result.status, undefined, result.remaining);
      }

      if (result.status !== "reserved") {
        throw new SpendGuardBlockedError(result.status);
      }

      reservationId = result.reservationId;
    },

    async recordUsage(usage: ImageIntakeUsageRecord): Promise<void> {
      await settleReservation(ImageIntakeUsageStatus.SUCCEEDED, usage);
    },

    async recordFailure(failure: ImageIntakeFailureRecord | null): Promise<void> {
      // Without reported tokens (an aborted or never-answered request) the reservation's own
      // estimate stands: the request may still have been billed, and over-counting is the safe
      // direction for a ceiling.
      const settled: ImageIntakeUsageRecord = failure
        ? {
            model: failure.model,
            inputTokens: failure.inputTokens,
            outputTokens: failure.outputTokens,
            costMicroUsd: computeCostMicroUsd(failure),
          }
        : {
            model: input.model,
            inputTokens: input.imageCount * ESTIMATED_INPUT_TOKENS_PER_IMAGE,
            outputTokens: WORST_CASE_OUTPUT_TOKENS_PER_REQUEST,
            costMicroUsd: estimatedCostMicroUsd,
          };

      await settleReservation(ImageIntakeUsageStatus.FAILED, settled);
    },
  };
}
