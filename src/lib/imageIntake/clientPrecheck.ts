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
 * The only two things decidable about a photo the collector just attached, before preparation has
 * looked at it. Neither names a file, because neither is about one.
 */
export type AttachedPhotosPrecheckErrorCode = Extract<ClientPrecheckErrorCode, "empty-submission" | "too-many-images">;

export type AttachedPhotosPrecheckResult = { ok: true } | { ok: false; code: AttachedPhotosPrecheckErrorCode };

/**
 * First pass over the photos as attached, before the client preparation step runs.
 *
 * Deliberately count-only. A source photo's byte size says nothing about what this feature will
 * upload for it: preparation normalises every photo to `INTAKE_TARGET_MAX_WIDTH` and re-encodes it
 * (see `compressForIntake`), which turns a multi-megabyte lossless screenshot into a couple of
 * hundred kilobytes. Refusing the source for its own weight was therefore refusing a photo the
 * pipeline was about to make small, and it refused the most ordinary input this feature has: a
 * full-resolution phone screenshot, whose size is not something its owner can do anything about.
 *
 * The byte ceilings still exist and are still enforced, against the prepared upload, which is what
 * they were always about: fitting under the Server Action body limit. See
 * {@link precheckPreparedSegments}.
 *
 * Count is checked here because it is genuinely about what was attached, and knowing at attach time
 * beats discovering it after a preparation pass.
 */
export function precheckAttachedPhotos(files: readonly unknown[]): AttachedPhotosPrecheckResult {
  if (files.length < 1) {
    return { ok: false, code: "empty-submission" };
  }

  if (files.length > MAX_IMAGES_PER_SUBMISSION) {
    return { ok: false, code: "too-many-images" };
  }

  return { ok: true };
}

/**
 * How many of the attached photos, taken in order from the first, fit inside the submission budget.
 *
 * `perPhotoBytes` is one entry per attached photo, holding the combined size of every segment that
 * photo was prepared into, so a tall screenshot counts as the several uploads it really becomes.
 *
 * It exists so a refusal can end in a number. "These photos are too heavy together" leaves a
 * collector to remove one, retry, remove another, retry again; "the first four fit" is one decision.
 * Counting from the first, rather than picking the cheapest subset, keeps the answer aligned with
 * the order the images are read in: the batch is one conversation, and dropping from the end loses
 * its tail, while dropping the heaviest photos wherever they happen to sit loses its middle.
 */
export function countPhotosWithinSubmissionBudget(perPhotoBytes: readonly number[]): number {
  let runningTotal = 0;
  let count = 0;
  for (const bytes of perPhotoBytes) {
    if (runningTotal + bytes > MAX_SUBMISSION_TOTAL_BYTES) break;
    runningTotal += bytes;
    count += 1;
  }
  return Math.min(count, MAX_IMAGES_PER_SUBMISSION);
}

/**
 * Pure, client-safe pass over the segments the preparation step actually produced: count and byte
 * size, checked against the same constants and in the same order as the server's
 * `validateUploadedImages`. No `sharp`, no other Node-only API, nothing that touches the
 * filesystem or the network, so this is safe to call from a client component before a single byte
 * leaves the device.
 *
 * It runs on prepared segments rather than on source files because segments are what gets uploaded,
 * and one tall screenshot can become several of them. This is the last chance to turn an oversized
 * body into a readable message instead of a raw 413.
 *
 * It is not a security boundary: a client check is something any caller can bypass, so the server
 * always re-runs the full validation (`validateUploadedImages`, which additionally decodes and
 * checks real format and dimensions) and is the only source of truth for what gets accepted. The
 * error codes intentionally match the server's so a single localized-copy mapping covers both (see
 * `intakeErrorCopy.ts`).
 */
export function precheckPreparedSegments(segments: IntakeSubmissionFile[]): ClientPrecheckResult {
  if (segments.length < 1) {
    return { ok: false, code: "empty-submission", index: null };
  }

  if (segments.length > MAX_IMAGES_PER_SUBMISSION) {
    return { ok: false, code: "too-many-images", index: null };
  }

  for (let index = 0; index < segments.length; index++) {
    if (segments[index].size > MAX_IMAGE_FILE_BYTES) {
      return { ok: false, code: "file-too-large", index };
    }
  }

  const totalBytes = segments.reduce((sum, segment) => sum + segment.size, 0);
  if (totalBytes > MAX_SUBMISSION_TOTAL_BYTES) {
    return { ok: false, code: "submission-too-large", index: null };
  }

  return { ok: true };
}
