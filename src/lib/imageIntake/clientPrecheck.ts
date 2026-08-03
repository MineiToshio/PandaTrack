import { MAX_IMAGES_PER_SUBMISSION, MAX_IMAGE_FILE_BYTES, MAX_SUBMISSION_TOTAL_BYTES } from "./constants";
import type { UploadValidationErrorCode } from "./validateUpload";

/**
 * The subset of `UploadValidationErrorCode` this precheck can actually detect. Format,
 * decodability, and dimensions all require decoding the file, which this module deliberately
 * cannot do (see below), so those codes stay server-only.
 */
export type ClientPrecheckErrorCode = Extract<
  UploadValidationErrorCode,
  "empty-submission" | "too-many-images" | "file-too-large" | "submission-too-large"
>;

/** Whatever the caller has on hand before upload: a `File`, or anything else with a byte size. */
export type IntakeSubmissionFile = { size: number };

export type ClientPrecheckResult = { ok: true } | { ok: false; code: ClientPrecheckErrorCode; index: number | null };

/**
 * Pure, client-safe first pass over an order-image-intake submission: file count and byte size
 * only, checked against the same constants and in the same order as the server's
 * `validateUploadedImages`. No `sharp`, no other Node-only API, nothing that touches the
 * filesystem or the network, so this is safe to call from a client component before a single byte
 * leaves the device.
 *
 * This is UX only, the earliest possible feedback so a user does not wait for a round trip to
 * learn they picked 25 photos or one enormous screenshot. It is not a security boundary: a client
 * check is something any caller can bypass, so the server always re-runs the full validation
 * (`validateUploadedImages`, which additionally decodes and checks real format and dimensions)
 * and is the only source of truth for what gets accepted. The error codes intentionally match the
 * server's so a single localized-copy mapping covers both (see `intakeErrorCopy.ts`).
 */
export function precheckIntakeSubmission(files: IntakeSubmissionFile[]): ClientPrecheckResult {
  if (files.length < 1) {
    return { ok: false, code: "empty-submission", index: null };
  }

  if (files.length > MAX_IMAGES_PER_SUBMISSION) {
    return { ok: false, code: "too-many-images", index: null };
  }

  for (let index = 0; index < files.length; index++) {
    if (files[index].size > MAX_IMAGE_FILE_BYTES) {
      return { ok: false, code: "file-too-large", index };
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_SUBMISSION_TOTAL_BYTES) {
    return { ok: false, code: "submission-too-large", index: null };
  }

  return { ok: true };
}
