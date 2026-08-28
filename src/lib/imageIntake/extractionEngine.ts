import * as Sentry from "@sentry/nextjs";
import {
  parseImageIntakeModelResponse,
  type ImageIntakeDraft,
  type ImageIntakeDraftValidationError,
} from "./draftSchema";

/**
 * One source photo handed to the provider. Callers own how the buffer was produced (client
 * compression, a share-target upload); the engine only cares that it is already decoded bytes.
 */
export type ImagePart = {
  data: Buffer | string;
  mimeType: string;
};

/** The two locales the product ships today; kept as a runtime array so `prompt.ts` can build a Zod enum from it. */
export const EXTRACTION_LOCALES = ["es", "en"] as const;
export type ExtractionLocale = (typeof EXTRACTION_LOCALES)[number];

/**
 * One catalog category the model may choose from, as it is offered in the prompt: the key it must
 * answer with, plus the label a person reads, so the model has something meaningful to match a
 * product name against. Both are resolved per request from the live catalog, never from a list
 * hardcoded anywhere in this domain: an administrator can approve a new type at any time, and a
 * frozen list would make that type unreachable for extraction until someone edited code.
 */
export type ExtractionProductCategory = {
  key: string;
  label: string;
};

/**
 * Everything the prompt and the cost calculation need beyond the images themselves. `now` is
 * passed in rather than read from the clock inside this module so relative-date resolution stays
 * deterministic in tests.
 */
export type ExtractionContext = {
  baseCurrency: string;
  now: Date;
  locale: ExtractionLocale;
  /** The active catalog, read live by the caller. Empty means the model must suggest no category. */
  productCategories: ExtractionProductCategory[];
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  /**
   * Reasoning tokens the provider reported, when it reported any.
   *
   * Diagnostic only, and deliberately NOT added into `computeCostMicroUsd`: on this model the
   * reasoning tokens are counted inside `candidatesTokenCount`, so adding them would bill them
   * twice. It is recorded because it is the single field that separates "the model reasoned until
   * the ceiling" from "the model wrote a genuinely enormous order", which the output total alone
   * cannot distinguish.
   */
  thoughtsTokens?: number | null;
  totalTokens?: number | null;
};

/** The provider's raw JSON candidate plus the token counts billing is based on. */
export type ProviderResponse = {
  raw: unknown;
  usage: ProviderUsage;
};

/**
 * Per-request options the engine passes down. The signal is aborted when the engine's own timeout
 * fires, so the provider can cancel the in-flight HTTP request instead of leaving it running.
 */
export type ProviderRequestOptions = {
  signal?: AbortSignal;
};

/**
 * Boundary every extraction provider implements. `geminiProvider.ts` is the one production
 * implementation; tests supply doubles so no suite ever makes a real network call.
 */
export interface ExtractionProvider {
  generateDraft(
    images: ImagePart[],
    context: ExtractionContext,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResponse>;
}

/**
 * Lowest HTTP status treated as the provider's own failure rather than ours. Below it the request
 * was rejected because of what we sent, which is never retryable and never the user's doing.
 */
export const HTTP_SERVER_ERROR_STATUS_MIN = 500;

export const PROVIDER_TRANSPORT_REASONS = ["network", "server-error", "overloaded", "timeout"] as const;
export type ProviderTransportReason = (typeof PROVIDER_TRANSPORT_REASONS)[number];

/**
 * Builds the message carried by every provider error class below. The message is always assembled
 * from a fixed code plus an HTTP status, never copied from the provider's own error body: that
 * body is attacker-influenced content (it can echo text the model read out of a source image) and
 * must not be relayed into logs or Sentry.
 */
function buildSanitizedMessage(code: string, status: number | null): string {
  return status === null ? code : `${code}:${status}`;
}

/**
 * Thrown by an `ExtractionProvider` for a real network failure, a 5xx response, or a request the
 * engine had to abort at its timeout. This is the only error shape `extract()` treats as
 * retryable: a 4xx or a malformed response must be a `ProviderRequestError` instead, so it fails
 * fast without a retry that would double the spend.
 */
export class ProviderTransportError extends Error {
  readonly reason: ProviderTransportReason;
  readonly status: number | null;
  /** Token counts the provider reported for a request that failed after it was already billable. */
  readonly usage: ProviderUsage | null;

  constructor(options: { reason: ProviderTransportReason; status?: number | null; usage?: ProviderUsage | null }) {
    super(buildSanitizedMessage(`PROVIDER_TRANSPORT_ERROR:${options.reason}`, options.status ?? null));
    this.name = "ProviderTransportError";
    this.reason = options.reason;
    this.status = options.status ?? null;
    this.usage = options.usage ?? null;
  }
}

/**
 * What kind of non-retryable provider failure this is, independent of any HTTP status.
 *
 * The kind exists because retryability was previously inferred from the status alone, and three of
 * these five failures never carry one: a truncated, empty, or non-JSON body is a `200` the provider
 * answered and billed. Inferring from the status therefore classified them as transport failures and
 * told the collector to try again in a minute, which for a deterministic failure means paying for
 * the same refusal repeatedly. The kind states the answer instead of deriving it from a field that
 * is absent.
 *
 * - `rejected`: a 4xx. The API refused what we sent; a defect of ours that repeats until code changes.
 * - `truncated`: the answer hit the output ceiling and is cut off mid-document.
 * - `empty`: a body with no text at all.
 * - `not-json`: a body that claimed JSON and did not parse.
 * - `unexpected`: anything else thrown by the SDK.
 */
export const PROVIDER_REQUEST_ERROR_KINDS = ["rejected", "truncated", "empty", "not-json", "unexpected"] as const;
export type ProviderRequestErrorKind = (typeof PROVIDER_REQUEST_ERROR_KINDS)[number];

/**
 * Non-retryable provider failure: a 4xx, an empty body, a truncated body, or a body that claimed
 * JSON and was not. Google bills a response it produced even when that response is unusable, so this
 * error carries the reported token usage whenever the provider saw it.
 */
export class ProviderRequestError extends Error {
  readonly code: string;
  readonly kind: ProviderRequestErrorKind;
  readonly status: number | null;
  readonly usage: ProviderUsage | null;
  /**
   * Shape-only counts about the answer the provider produced, for the failures where that shape is
   * the whole diagnosis. Never carries content: see `countPartialResponseShape`.
   */
  readonly shape: ProviderResponseShape | null;

  constructor(options: {
    code: string;
    kind: ProviderRequestErrorKind;
    status?: number | null;
    usage?: ProviderUsage | null;
    shape?: ProviderResponseShape | null;
  }) {
    super(buildSanitizedMessage(options.code, options.status ?? null));
    this.name = "ProviderRequestError";
    this.code = options.code;
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.usage = options.usage ?? null;
    this.shape = options.shape ?? null;
  }
}

/**
 * True when the provider answered a request of ours with a 4xx.
 *
 * This is the one provider failure that is entirely our fault: a malformed request, a schema
 * keyword the endpoint does not accept, a credential problem. It is deterministic, so it fails
 * identically on every attempt, and the surface must not answer it with copy that invites the
 * collector to try again in a minute. A 5xx, a timeout, and a network failure are the opposite:
 * the same submission may well succeed on the next attempt.
 */
export function isProviderRequestRejected(error: unknown): boolean {
  return error instanceof ProviderRequestError && error.kind === "rejected";
}

/**
 * True when the provider's answer was cut off at the output ceiling.
 *
 * Separated from every other failure because it is the only one with a remedy the collector can
 * actually apply. It is not a transport hiccup (retrying repeats it, at full price) and not a defect
 * they should be told we are fixing (the request was well formed and the model answered): the answer
 * simply did not fit. What resolves it is a smaller submission, and the copy must say so.
 */
export function isProviderResponseTruncated(error: unknown): boolean {
  return error instanceof ProviderRequestError && error.kind === "truncated";
}

/** Shape-only census of a model answer. Counts of schema KEY names; never any value it carried. */
export type ProviderResponseShape = {
  partialChars: number;
  groupsEmitted: number;
  productsEmitted: number;
  paymentsEmitted: number;
};

/** Shape counts attached to a failed provider call, when the provider produced a body at all. */
export function readProviderErrorShape(error: unknown): ProviderResponseShape | null {
  return error instanceof ProviderRequestError ? error.shape : null;
}

/** Token usage attached to a failed provider call, when the provider reported any. */
export function readProviderErrorUsage(error: unknown): ProviderUsage | null {
  if (error instanceof ProviderTransportError || error instanceof ProviderRequestError) {
    return error.usage;
  }
  return null;
}

/**
 * Every reason a spend guard may refuse a submission.
 *
 * `budget-blocked` is reserved for one situation only: the guard read the period total and that
 * total had reached the product's ceiling. A guard that could not read or write the ledger at all
 * must refuse as `ledger-error` instead, so an infrastructure outage never reaches the collector as
 * a claim about a budget nobody actually measured. Both refusals are equally fail-closed; they
 * differ only in what they let the surface honestly say.
 *
 * `daily-attempt-cap-exceeded` is a liability control rather than a personal allowance: it counts
 * requests sent, whatever they returned, and applies to every account including administrators.
 */
export const SPEND_GUARD_BLOCK_CODES = [
  "budget-blocked",
  "ledger-error",
  "rate-limited",
  "quota-exceeded",
  "daily-cap-exceeded",
  "daily-attempt-cap-exceeded",
] as const;
export type SpendGuardBlockCode = (typeof SPEND_GUARD_BLOCK_CODES)[number];

/** The two refusals that are about the collector's own photo bag rather than the product's ceiling. */
export const QUOTA_BLOCK_CODES = ["quota-exceeded", "daily-cap-exceeded"] as const;
export type QuotaBlockCode = (typeof QUOTA_BLOCK_CODES)[number];

export function isQuotaBlockCode(code: SpendGuardBlockCode): code is QuotaBlockCode {
  return code === "quota-exceeded" || code === "daily-cap-exceeded";
}

/**
 * Thrown by a `SpendGuard.assertCanSpend()` implementation when a submission must not proceed.
 * The real ledger-backed guard lives outside this module; this class is the contract it throws
 * against so `extract()` can map the refusal to a typed outcome without knowing anything about
 * the ledger.
 *
 * `remaining` carries how many photos the collector still has when the refusal is a quota one, so
 * the surface that reports it can state both numbers without a second read. It stays `null` for
 * the product-level refusals (the global ceiling and the rate limit), which say nothing about a
 * personal balance.
 */
export class SpendGuardBlockedError extends Error {
  readonly code: SpendGuardBlockCode;
  readonly remaining: number | null;

  constructor(code: SpendGuardBlockCode, message?: string, remaining: number | null = null) {
    super(message ?? code);
    this.name = "SpendGuardBlockedError";
    this.code = code;
    this.remaining = remaining;
  }
}

/** Usage row the engine asks the guard to record after a successful, validated extraction. */
export type ImageIntakeUsageRecord = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
};

/**
 * What the engine knows about a billable request that failed. `null` means the provider never
 * reported token counts (an aborted or never-answered request), in which case the guard falls
 * back to the estimate it reserved before the call.
 */
export type ImageIntakeFailureRecord = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Contract the ledger-backed spend guard implements (built separately in
 * `src/lib/data/imageIntake/`). Defined here, next to the caller, so the engine can be tested
 * against a double without depending on Prisma or the real ledger.
 */
export interface SpendGuard {
  /** Must be called, and must resolve, before any provider request is made. */
  assertCanSpend(): Promise<void>;
  /** Called once, after a successful and schema-valid extraction, to record real spend. */
  recordUsage(usage: ImageIntakeUsageRecord): Promise<void>;
  /**
   * Called on every failure path that happens after `assertCanSpend()` succeeded. Google bills a
   * request whose answer never validated, and a failure that leaves no ledger row would be
   * invisible to both the spend ceiling and the rate limit, so a caller could burn the budget in
   * a loop of deliberately failing requests without ever moving either.
   */
  recordFailure(failure: ImageIntakeFailureRecord | null): Promise<void>;
}

export type ExtractionDeps = {
  provider: ExtractionProvider;
  spendGuard: SpendGuard;
};

export type ExtractionOutcome =
  | { status: "ok"; draft: ImageIntakeDraft }
  | { status: "invalid-model-response"; error: ImageIntakeDraftValidationError }
  | { status: "provider-error"; error: Error }
  /** The ledger itself could not be read or written, before or after the call. Fail closed, retryable by the user. */
  | { status: "ledger-error" }
  | { status: "budget-blocked" }
  | { status: "rate-limited" }
  /** Too many billable attempts today, whatever they returned. A liability control, not a photo allowance. */
  | { status: "daily-attempt-cap-exceeded" }
  /** The collector's own monthly bag cannot cover this submission; `remaining` is what is left of it. */
  | { status: "quota-exceeded"; remaining: number }
  | { status: "daily-cap-exceeded"; remaining: number };

export const EXTRACTION_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Retries a transport failure gets before the submission is given up on.
 *
 * Two, not one. A single retry was sized for the assumption that a transport failure is rare; it is
 * not. Measured against the live API on 2026-08-21, `gemini-3.1-flash-lite` answered one request in
 * three with a `503`, one of them only after 34 seconds, while the very next identical request
 * succeeded in four. At that rate a two-attempt submission fails outright several times in a
 * hundred, which is what a collector experiences as "the photo upload just does not work", and the
 * ledger records it as a failed attempt with no token usage: the exact signature of the failure this
 * change came from.
 *
 * Retrying is close to free here and never doubles the spend. A `503` is the provider refusing
 * before it generated anything, so there is nothing to bill, and the reservation is settled exactly
 * once whatever the attempt count (see `SpendGuard`), so extra attempts add no ledger rows, consume
 * no extra photo quota, and cannot move the global ceiling. What they cost is the collector's time,
 * which is why the count stays small and the per-attempt timeout stays where it is.
 */
export const EXTRACTION_MAX_TRANSPORT_RETRIES = 2;

/**
 * Pause before a retried attempt.
 *
 * An immediate retry is the wrong answer to the two failures most likely to be waiting: a model that
 * is momentarily overloaded and a rate limit that is measured over a window. Both need a moment
 * more than they need another request, and firing instantly mostly buys a second copy of the same
 * refusal. It is kept short because a collector is watching a spinner while it elapses.
 */
export const EXTRACTION_RETRY_BACKOFF_MS = 700;

/**
 * Wall-clock ceiling on the whole provider phase, retries and backoffs included.
 *
 * The per-attempt timeout and the retry count describe attempts, not elapsed time, and multiplied
 * out they describe a request that may legitimately run for 92 seconds. Nothing in this module can
 * grant that: the route this action is posted to declares `maxDuration = 60` (the hosting plan's
 * ceiling), and past it the function is killed outright. A kill is strictly worse than a refusal,
 * because it happens after the ledger has already reserved the submission and leaves that
 * reservation `PENDING` forever, counting against the collector's monthly bag for a read they never
 * received.
 *
 * So the retry budget is expressed in time rather than in attempts, and 55 seconds leaves the route
 * five to settle the ledger and return an answer the collector can act on. The attempt count still
 * caps retries; this caps how long they may take. Both bounds apply, whichever is reached first.
 */
export const EXTRACTION_TOTAL_BUDGET_MS = 55_000;

/**
 * Shortest attempt worth starting with the remaining budget.
 *
 * A retry fired with two seconds left cannot succeed (the fastest observed live read is several
 * times that) but can still consume the remainder of the budget and turn a reportable failure into
 * a platform kill. Below this the loop stops and reports the failure it already has.
 */
export const EXTRACTION_MIN_ATTEMPT_MS = 8_000;

/**
 * USD per 1,000,000 tokens for `gemini-3.1-flash-lite` on the paid tier. Verified against
 * Google's published Gemini API rate card on 2026-07-28 (ADR 0020); revisit this pair if Google
 * changes the rate card, and update the ADR's cost assumptions in the same change.
 */
export const GEMINI_INPUT_USD_PER_MILLION_TOKENS = 0.25;
export const GEMINI_OUTPUT_USD_PER_MILLION_TOKENS = 1.5;

/**
 * Integer micro-USD cost for a request. A price per million tokens divided by 1e6 tokens, then
 * multiplied back up by 1e6 micro-USD per USD, cancels to "tokens times price per million" ==
 * micro-USD directly, which is why there is no explicit 1e6 division/multiplication here.
 */
export function computeCostMicroUsd(usage: ProviderUsage): number {
  const inputCostMicroUsd = usage.inputTokens * GEMINI_INPUT_USD_PER_MILLION_TOKENS;
  const outputCostMicroUsd = usage.outputTokens * GEMINI_OUTPUT_USD_PER_MILLION_TOKENS;
  return Math.round(inputCostMicroUsd + outputCostMicroUsd);
}

/**
 * Runs one provider attempt under a hard timeout, cancelling it through an `AbortSignal` when the
 * timeout fires. Cancelling matters beyond not waiting: an un-aborted request keeps running, is
 * still billed, and would overlap with the retry, so the same submission could pay twice. The
 * cancellation is client-side only (the SDK documents that the service may finish and bill the
 * call anyway), which is why a timed-out attempt still settles its ledger reservation as a
 * billable failure instead of being forgotten.
 */
function callProviderAttempt(
  provider: ExtractionProvider,
  images: ImagePart[],
  context: ExtractionContext,
  timeoutMs: number,
): Promise<ProviderResponse> {
  const controller = new AbortController();

  return new Promise<ProviderResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTransportError({ reason: "timeout" }));
    }, timeoutMs);

    let call: Promise<ProviderResponse>;
    try {
      call = provider.generateDraft(images, context, { signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }

    call
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

type ProviderCallResult = { status: "ok"; response: ProviderResponse } | { status: "provider-error"; error: Error };

/**
 * Retries a `ProviderTransportError` (network, 5xx, 408/429, or a timeout) under two bounds at
 * once: `EXTRACTION_MAX_TRANSPORT_RETRIES` attempts and `EXTRACTION_TOTAL_BUDGET_MS` of wall clock.
 *
 * The time bound is the one that keeps this function honest on the platform. Each attempt is given
 * whatever is left of the budget, never more than `EXTRACTION_REQUEST_TIMEOUT_MS`, so the loop
 * always returns a typed failure the caller can settle the ledger against instead of being killed
 * mid-call with the reservation still open.
 */
async function callProviderWithRetry(
  provider: ExtractionProvider,
  images: ImagePart[],
  context: ExtractionContext,
  now: () => number = Date.now,
): Promise<ProviderCallResult> {
  const deadline = now() + EXTRACTION_TOTAL_BUDGET_MS;
  let attempt = 0;

  for (;;) {
    attempt += 1;
    const attemptTimeoutMs = Math.min(EXTRACTION_REQUEST_TIMEOUT_MS, deadline - now());
    try {
      const response = await callProviderAttempt(provider, images, context, attemptTimeoutMs);
      return { status: "ok", response };
    } catch (error) {
      const isTransportError = error instanceof ProviderTransportError;
      const hasRetryLeft = attempt <= EXTRACTION_MAX_TRANSPORT_RETRIES;
      // A retry must fit entirely inside what is left: the backoff, then an attempt long enough to
      // plausibly succeed. Otherwise the budget is spent producing the same failure later.
      const hasBudgetLeft = deadline - now() - EXTRACTION_RETRY_BACKOFF_MS >= EXTRACTION_MIN_ATTEMPT_MS;
      if (isTransportError && hasRetryLeft && hasBudgetLeft) {
        await new Promise((resolve) => setTimeout(resolve, EXTRACTION_RETRY_BACKOFF_MS));
        continue;
      }
      return {
        status: "provider-error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * Best-effort ledger write for a billable request that failed. The money is already spent by the
 * time this runs, so a bookkeeping write that itself fails must never turn a typed failure
 * outcome into a thrown exception; it is reported and swallowed instead.
 */
async function recordFailureBestEffort(
  spendGuard: SpendGuard,
  modelId: string,
  usage: ProviderUsage | null,
): Promise<void> {
  try {
    await spendGuard.recordFailure(
      usage ? { model: modelId, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } : null,
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "recordFailure" } });
  }
}

/**
 * Runs one extraction: spend guard first, then the provider (with timeout and retry), then
 * strict schema validation, then ledger settlement. Every failure mode is a typed outcome rather
 * than a thrown error, so callers never need a try/catch to handle the expected cases, and every
 * path after a successful `assertCanSpend()` settles the guard's reservation exactly once.
 */
export async function extract(
  images: ImagePart[],
  context: ExtractionContext,
  deps: ExtractionDeps,
  modelId: string,
): Promise<ExtractionOutcome> {
  try {
    await deps.spendGuard.assertCanSpend();
  } catch (error) {
    if (error instanceof SpendGuardBlockedError) {
      if (isQuotaBlockCode(error.code)) {
        // A quota refusal is the only block that carries a personal number, and it is what the
        // overflow copy states back to the collector.
        return { status: error.code, remaining: error.remaining ?? 0 };
      }
      return { status: error.code };
    }
    // An unexpected error from the guard itself (not a business refusal) is a bug, not an
    // extraction outcome: let it propagate so it surfaces the way any other unexpected error does.
    throw error;
  }

  const callResult = await callProviderWithRetry(deps.provider, images, context);
  if (callResult.status === "provider-error") {
    await recordFailureBestEffort(deps.spendGuard, modelId, readProviderErrorUsage(callResult.error));
    return { status: "provider-error", error: callResult.error };
  }

  const parsed = parseImageIntakeModelResponse(callResult.response.raw);
  if (!parsed.ok) {
    // Reported, not just returned. This is the one failure nothing else can reconstruct
    // afterwards: the images are discarded by design (zero retention) and the response body is
    // never stored, so without this the only evidence a rejection ever happened is a collector
    // saying the app did not understand their photos, and the cause has to be guessed.
    //
    // Only the issue list travels, and it carries no extracted content: `parseImageIntakeDraft`
    // builds each issue from the Zod path (our own field names and array indices, since every
    // object in the contract is `.strict()` with fixed keys) plus the schema's own message, and it
    // is the one issue whose Zod message would interpolate model-written key names, the
    // unrecognized-keys one, that it replaces with a count.
    Sentry.captureException(parsed.error, {
      tags: { feature: "imageIntake", action: "invalidModelResponse" },
      extra: { issues: parsed.error.issues },
    });
    // A response that reached us but failed validation was produced, and therefore billed: it is
    // a failure for the user and a real charge for the ledger.
    await recordFailureBestEffort(deps.spendGuard, modelId, callResult.response.usage);
    return { status: "invalid-model-response", error: parsed.error };
  }

  try {
    await deps.spendGuard.recordUsage({
      model: modelId,
      inputTokens: callResult.response.usage.inputTokens,
      outputTokens: callResult.response.usage.outputTokens,
      costMicroUsd: computeCostMicroUsd(callResult.response.usage),
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "recordUsage" } });
    // Fail closed: a draft handed back without a settled ledger row is spend the ceiling cannot
    // see, so the extraction is rejected rather than delivered off the books.
    return { status: "ledger-error" };
  }

  return { status: "ok", draft: parsed.draft };
}
