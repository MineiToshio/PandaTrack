import type { ImageIntakeExtractErrorCode, ImageIntakeSaveErrorCode } from "../../../_actions/imageIntakeContract";
import type { ClientPrecheckErrorCode } from "@/lib/imageIntake/clientPrecheck";

/**
 * Failure the review surface is currently showing. The i18n key is resolved against the
 * `imageIntake.errors` namespace, and `values` carries the numbers a message interpolates.
 */
export type IntakeErrorState = {
  messageKey: string;
  values?: Record<string, number | string>;
};

/** Failures the client detects on its own, before anything leaves the device. */
export type IntakeClientErrorCode = ClientPrecheckErrorCode | "compression-failed";

const EXTRACT_ERROR_KEYS: Record<ImageIntakeExtractErrorCode, string> = {
  "empty-submission": "emptySubmission",
  "too-many-images": "tooManyImages",
  "file-too-large": "fileTooLarge",
  "submission-too-large": "submissionTooLarge",
  "unsupported-format": "unsupportedFormat",
  "unreadable-file": "unreadableFile",
  "dimensions-out-of-range": "dimensionsOutOfRange",
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

export function extractErrorMessageKey(code: ImageIntakeExtractErrorCode): string {
  return EXTRACT_ERROR_KEYS[code];
}

export function clientErrorMessageKey(code: IntakeClientErrorCode): string {
  return CLIENT_ERROR_KEYS[code];
}

export function saveErrorMessageKey(code: ImageIntakeSaveErrorCode): string {
  return SAVE_ERROR_KEYS[code];
}
