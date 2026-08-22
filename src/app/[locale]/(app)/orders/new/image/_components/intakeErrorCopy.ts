import type { ImageIntakeExtractErrorCode, ImageIntakeSaveErrorCode } from "../../../_actions/imageIntakeContract";
import type { ClientPrecheckErrorCode } from "@/lib/imageIntake/clientPrecheck";
import type { IntakeDimensionIssue } from "@/lib/imageIntake/dimensionPrecheck";
import {
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_DIMENSION,
} from "@/lib/imageIntake/constants";

/**
 * One sentence about one photo, listed under the failure's own message.
 *
 * A submission is a batch, so a refusal that names no photo leaves the collector to guess which of
 * twenty screenshots to fix. Every per-file failure therefore produces one of these, carrying the
 * photo's own label (position, plus its filename when there is one) and the figures its sentence
 * quotes: what the photo measures, and what would have been accepted.
 */
export type IntakePhotoIssueMessage = {
  messageKey: string;
  values: Record<string, number | string>;
};

/**
 * Failure the review surface is currently showing. The i18n key is resolved against the
 * `imageIntake.errors` namespace, and `values` carries the numbers a message interpolates.
 */
export type IntakeErrorState = {
  messageKey: string;
  values?: Record<string, number | string>;
  /** Per-photo detail lines, when the failure could be attributed to specific photos. */
  photos?: IntakePhotoIssueMessage[];
  /** Fixed failure code shown to the collector, for the failures nothing else can identify later. */
  reference?: string;
};

/** Bytes as the megabytes the copy quotes, at one decimal, which is the precision a person reads. */
function toMegabytes(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/**
 * Turns an attach-time dimension verdict into the line the collector reads.
 *
 * Each cause gets its own sentence because each has its own remedy: a small photo needs a bigger
 * capture, while a wide, short crop needs height, and telling the second one it is "too small" is
 * how someone ends up staring at a 3000 px screenshot wondering what the app is talking about.
 */
export function dimensionIssueMessage(issue: IntakeDimensionIssue, photo: string): IntakePhotoIssueMessage {
  if (issue.code === "source-too-small") {
    return {
      messageKey: "photoTooSmall",
      values: { photo, width: issue.width, height: issue.height, minDimension: issue.minDimension },
    };
  }

  if (issue.code === "source-too-wide") {
    return {
      messageKey: "photoTooWide",
      values: { photo, width: issue.width, height: issue.height, minHeight: issue.minSourceHeight },
    };
  }

  return {
    messageKey: "photoTooLarge",
    values: {
      photo,
      width: issue.width,
      height: issue.height,
      maxWidth: issue.maxWidth,
      maxHeight: issue.maxHeight,
    },
  };
}

/**
 * The line for a photo whose PREPARED bytes exceed the per-file ceiling, quoting the prepared size
 * rather than the source's. A source photo is never refused for its own weight (see
 * `precheckAttachedPhotos`), so the remedy this sentence gives is about detail, not about finding a
 * lighter file: the collector cannot make their screenshot compress further by picking another one.
 */
export function fileTooLargeMessage(photo: string, byteSize: number): IntakePhotoIssueMessage {
  return {
    messageKey: "photoTooHeavy",
    values: { photo, size: toMegabytes(byteSize), maxSize: toMegabytes(MAX_IMAGE_FILE_BYTES) },
  };
}

/**
 * The line for a dimension refusal the server made, on an image the attach-time check had cleared
 * or could not measure. The figures are the server's own measurement of the prepared upload, so the
 * sentence stays about what was actually refused rather than restating the rule.
 */
export function serverDimensionMessage(
  code: "image-too-small" | "image-too-large",
  photo: string,
  width: number,
  height: number,
): IntakePhotoIssueMessage {
  return code === "image-too-small"
    ? { messageKey: "photoTooSmall", values: { photo, width, height, minDimension: MIN_IMAGE_DIMENSION } }
    : {
        messageKey: "photoTooLarge",
        values: { photo, width, height, maxWidth: MAX_IMAGE_WIDTH, maxHeight: MAX_IMAGE_HEIGHT },
      };
}

/** Failures the client detects on its own, before anything leaves the device. */
export type IntakeClientErrorCode = ClientPrecheckErrorCode | "compression-failed";

const EXTRACT_ERROR_KEYS: Record<ImageIntakeExtractErrorCode, string> = {
  "empty-submission": "emptySubmission",
  "too-many-images": "tooManyImages",
  "file-too-large": "fileTooLarge",
  "submission-too-large": "submissionTooLarge",
  "unsupported-format": "unsupportedFormat",
  "unreadable-file": "unreadableFile",
  // Fallbacks only: both codes normally arrive with a position and a measurement, and the screen
  // then lists the offending photo by name instead of showing these.
  "image-too-small": "imageTooSmall",
  "image-too-large": "imageTooLarge",
  unauthorized: "unauthorized",
  "missing-base-currency": "missingBaseCurrency",
  "budget-blocked": "budgetBlocked",
  "rate-limited": "rateLimited",
  "quota-exceeded": "quotaExceeded",
  "daily-cap-exceeded": "dailyCapExceeded",
  "daily-attempt-cap-exceeded": "dailyAttemptCapExceeded",
  "invalid-model-response": "invalidModelResponse",
  "provider-error": "providerError",
  "provider-rejected": "providerRejected",
  "response-too-long": "responseTooLong",
  "ledger-error": "ledgerError",
  "product-ceiling-exceeded": "productCeilingExceeded",
  "no-order-found": "noOrderFound",
  "multiple-orders": "multipleOrders",
  "server-error": "serverError",
};

const CLIENT_ERROR_KEYS: Record<IntakeClientErrorCode, string> = {
  "empty-submission": "emptySubmission",
  "too-many-images": "tooManyImages",
  "file-too-large": "fileTooLarge",
  "submission-too-large": "submissionTooLarge",
  "compression-failed": "compressionFailed",
};

const SAVE_ERROR_KEYS: Record<ImageIntakeSaveErrorCode, string> = {
  unauthorized: "unauthorized",
  "invalid-draft": "saveInvalidDraft",
  "store-required": "saveStoreRequired",
  "total-required": "saveTotalRequired",
  // A store that vanished between review and save leaves the user with the same next step as a
  // store that was never picked: choose one from the list.
  "store-not-found": "saveStoreRequired",
  "invalid-product-type": "saveInvalidDraft",
  "server-error": "serverError",
};

/**
 * The failures whose cause lives entirely on the server and is gone by the time anyone asks about
 * it.
 *
 * Zero retention (`BR-11-13`) means the images are discarded when the request ends and the model's
 * answer is never stored, so a collector reporting "it did not work" leaves nothing to look at: the
 * ledger row says a request failed, never why. The full diagnosis is written at the moment of
 * failure (see `reportImageIntakeFailure`), but it goes to the server log and to Sentry, which is
 * not somewhere the person in front of the screen can reach, and their copy is deliberately
 * plain-language and identical across several distinct causes ("provider-error" covers a network
 * drop, a 5xx, a rate limit, and a timeout alike).
 *
 * Showing the fixed code closes that gap: it costs the collector nothing to quote, and it turns
 * "the photo upload failed" into an answerable report. Only these codes get one. A refusal the
 * collector can act on (too many photos, quota spent, no order in the images) explains itself, and
 * a reference under it would read as a malfunction where there is none.
 *
 * The value is a code from a fixed union, never anything derived from a source image, so it carries
 * no content out of the photos.
 */
const DIAGNOSABLE_EXTRACT_ERROR_CODES = new Set<ImageIntakeExtractErrorCode>([
  "invalid-model-response",
  "provider-error",
  "provider-rejected",
  "response-too-long",
  "ledger-error",
  "server-error",
]);

export function extractErrorMessageKey(code: ImageIntakeExtractErrorCode): string {
  return EXTRACT_ERROR_KEYS[code];
}

/** The reference to print under an opaque failure, or `null` when the message already explains itself. */
export function extractErrorReference(code: ImageIntakeExtractErrorCode): string | null {
  return DIAGNOSABLE_EXTRACT_ERROR_CODES.has(code) ? code : null;
}

export function clientErrorMessageKey(code: IntakeClientErrorCode): string {
  return CLIENT_ERROR_KEYS[code];
}

export function saveErrorMessageKey(code: ImageIntakeSaveErrorCode): string {
  return SAVE_ERROR_KEYS[code];
}
