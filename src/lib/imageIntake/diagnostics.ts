import * as Sentry from "@sentry/nextjs";

/**
 * The one place an order-image-intake failure is reported, for both destinations at once: a single
 * structured server line (visible in `next dev` output and in the platform's runtime logs) and one
 * Sentry event carrying the same fields.
 *
 * It exists because this feature is, by design, the hardest one in the product to debug after the
 * fact. Zero retention (`BR-11-13`, `FR-11-22`) means the images are gone the moment the request
 * ends and the model's response body is never stored, so when a collector reports "it did not work"
 * there is nothing left to look at. Anything not recorded at the moment of failure is unrecoverable,
 * and the ledger row alone only says a request failed, never why.
 *
 * **Every field is a number, an enum, or a fixed code. No content, ever.** That is a structural
 * guarantee rather than a convention: the type admits nothing a source image could have influenced,
 * so a diagnostic cannot become a way for a chat screenshot's contents to reach a log. Counts about
 * the model's answer are allowed precisely because they describe its SHAPE and not its text.
 */
export type ImageIntakeFailureStage = "provider" | "validation" | "ledger";

export type ImageIntakeFailureDiagnostics = {
  stage: ImageIntakeFailureStage;
  /** Sanitized failure code, assembled from fixed strings only (see `buildSanitizedMessage`). */
  code: string;
  /** The extract error code the collector's screen will resolve its copy from. */
  reportedAs: string;
  model: string;
  /** Prepared images actually sent, and their combined byte size. */
  imageCount: number;
  imageBytes: number;
  /** HTTP status when the provider answered with one; `null` for every other failure. */
  httpStatus?: number | null;
  /** Token counts as the provider reported them, plus the ceiling they were measured against. */
  promptTokens?: number | null;
  outputTokens?: number | null;
  /** Reasoning tokens, billed and counted against the same ceiling as the visible answer. */
  thoughtsTokens?: number | null;
  totalTokens?: number | null;
  maxOutputTokens?: number | null;
  /**
   * Shape of the answer the model managed to produce before it was cut off. Counts only: they are
   * what separates "this order really is enormous" from "the model repeated itself until the
   * ceiling" from "reasoning consumed the whole budget", which are three different bugs with three
   * different fixes and are indistinguishable from the token total alone.
   */
  partialChars?: number | null;
  groupsEmitted?: number | null;
  productsEmitted?: number | null;
  paymentsEmitted?: number | null;
  /** Number of schema issues, for a response that parsed but failed validation. */
  issueCount?: number | null;
  /**
   * Set to false when a richer Sentry event for this same failure was already sent elsewhere. The
   * console line is still written: local `next dev` output is where a failure is read while it is
   * being debugged, and Sentry is where it is read afterwards. One event per failure, one line per
   * failure, never two of either (see `.agents/rules/sentry-error-handling.mdc`).
   */
  captureToSentry?: boolean;
};

/** Fixed prefix so every line of this feature's failures is greppable as one stream. */
export const IMAGE_INTAKE_LOG_PREFIX = "[image-intake]";

function formatLine(diagnostics: ImageIntakeFailureDiagnostics): string {
  const parts = Object.entries(diagnostics)
    .filter(([key, value]) => key !== "captureToSentry" && value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`);
  return `${IMAGE_INTAKE_LOG_PREFIX} failure ${parts.join(" ")}`;
}

/**
 * Reports one intake failure. Safe to call on any failure path, including the expected ones: this
 * feature spends real money per attempt, so even a "normal" refusal is worth one line.
 *
 * Deliberately never throws. It runs on paths that are already failing, and a reporter that could
 * fail would turn a typed, handled outcome into an unhandled exception.
 */
export function reportImageIntakeFailure(diagnostics: ImageIntakeFailureDiagnostics): void {
  try {
    // One line, not five (see `.agents/rules/sentry-error-handling.mdc`). `console.warn` rather
    // than `error`: these are handled outcomes the surface already explains to the collector, and
    // the unhandled ones are what Sentry's severity is for.
    console.warn(formatLine(diagnostics));

    if (diagnostics.captureToSentry === false) return;

    Sentry.withScope((scope) => {
      scope.setTag("feature", "imageIntake");
      scope.setTag("stage", diagnostics.stage);
      scope.setTag("intakeCode", diagnostics.code);
      scope.setTag("reportedAs", diagnostics.reportedAs);
      scope.setContext("imageIntakeFailure", { ...diagnostics });
      Sentry.captureMessage(`${IMAGE_INTAKE_LOG_PREFIX} ${diagnostics.code}`, "warning");
    });
  } catch {
    // A diagnostic that cannot be written must not change the outcome it was describing.
  }
}

/**
 * Counts the structural landmarks of a partial JSON answer, without reading or retaining any value
 * from it.
 *
 * It counts occurrences of the response schema's own KEY names, which are fixed strings this
 * codebase wrote (`geminiProvider.ts`), never anything the model or a source image supplied. A key
 * name appears once per object of its kind, so the counts are a faithful census of how many groups,
 * products, and payments the model had emitted when it ran out of room.
 */
export function countPartialResponseShape(partialText: string): {
  partialChars: number;
  groupsEmitted: number;
  productsEmitted: number;
  paymentsEmitted: number;
} {
  const occurrences = (needle: string): number => partialText.split(needle).length - 1;
  return {
    partialChars: partialText.length,
    groupsEmitted: occurrences('"sourcePhrase"'),
    productsEmitted: occurrences('"unitPrice"'),
    paymentsEmitted: occurrences('"paidAt"'),
  };
}
