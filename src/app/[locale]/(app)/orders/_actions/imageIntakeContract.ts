import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import type { UploadValidationErrorCode } from "@/lib/imageIntake/validateUpload";

/**
 * Wire contract shared by the image-intake Server Actions and the review UI.
 *
 * It lives in its own module rather than inside either action because a `"use server"` file may
 * only export async functions: constants and types would break the build there. Keeping both
 * actions' shapes side by side also makes the one structural rule of this feature visible in a
 * single place, that extraction and persistence never meet in the same module.
 */

/** Form field every compressed image segment is attached under. */
export const IMAGE_INTAKE_FILES_FIELD = "images";

/** Form field carrying the request locale, so relative dates resolve in the user's own language. */
export const IMAGE_INTAKE_LOCALE_FIELD = "locale";

/**
 * Form field naming the door a submission came through, so quota and ledger rows can tell an
 * in-app pick from an OS share without either path needing its own pipeline. Anything other
 * than the literal "SHARE" is recorded as in-app: the field is client-supplied, so the server
 * treats it as a hint that can only choose between the two known doors, never invent a third.
 */
export const IMAGE_INTAKE_ENTRY_SOURCE_FIELD = "entrySource";

/**
 * Every reason an extraction can fail, as a code the UI maps to localized copy. The upload
 * validator's own codes ride through unchanged so the client precheck and the server validator
 * share one copy mapping instead of two that can drift.
 */
export type ImageIntakeExtractErrorCode =
  | UploadValidationErrorCode
  | "unauthorized"
  | "missing-base-currency"
  | "budget-blocked"
  | "rate-limited"
  | "quota-exceeded"
  | "daily-cap-exceeded"
  // A ceiling on billable attempts for the day, counting successes and failures alike. It is a
  // liability control rather than a personal allowance, which is why it never carries `remaining`:
  // there is no balance the collector owns, so there is no honest number to show them.
  | "daily-attempt-cap-exceeded"
  | "invalid-model-response"
  | "provider-error"
  // The provider answered a 4xx: it refused the request itself, so the failure is ours (a
  // malformed request, an unsupported schema keyword, a credential problem) and it is
  // deterministic. Split from `provider-error` for one reason only, that the copy must not tell
  // the collector to try again in a minute when every attempt will fail the same way.
  | "provider-rejected"
  // The model's answer hit the output ceiling and came back cut off mid-document. Split from
  // `provider-error` because the honest advice is the opposite one: the request was fine and the
  // model did answer, so retrying the same photos spends the same money to be cut off at the same
  // place. What resolves it is a smaller submission, and only a code of its own can say that.
  | "response-too-long"
  | "ledger-error"
  | "product-ceiling-exceeded"
  // The images were read and carried no purchase at all (a pet, a landscape, an unrelated
  // screenshot). Not an extraction failure: the answer was correct, there was simply nothing in it
  // to review, so the user is told that instead of landing on an empty review document.
  | "no-order-found"
  // The images described more than one purchase, so the collector is asked to split the submission
  // instead of being handed a draft that fused two orders into one. Like `no-order-found`, the read
  // itself succeeded; unlike it, the verdict is the model's self-report rather than something the
  // server can derive, because the evidence only exists in the images (see the warning code's own
  // note in `draftSchema.ts`).
  | "multiple-orders"
  | "server-error";

export type ImageIntakeExtractResult =
  | { ok: true; draft: ImageIntakeDraft; baseCurrencyCode: string }
  | {
      ok: false;
      code: ImageIntakeExtractErrorCode;
      productCount?: number;
      maxProducts?: number;
      /** Photos left in the collector's bag, on a quota refusal only, so the copy can state it. */
      remaining?: number;
      /** ISO instant the bag refills on, so the exhausted copy can state a real date. */
      renewalAtIso?: string;
      /**
       * Position of the offending upload inside this submission, on a per-file refusal only.
       *
       * It is an index into the uploaded images, which is not the same thing as an index into the
       * photos the collector attached: one tall screenshot is uploaded as several segments. Only the
       * client holds that mapping, which is why the server reports the position it does know and the
       * screen translates it back into the photo it came from. The alternative, sending each source
       * file's name along with its bytes, would put a user's filenames on the wire for no reason the
       * flow needs, next to a compression step whose whole purpose is to strip what the file carries.
       */
      imageIndex?: number;
      /** What the offending image actually measured, so the copy can quote it instead of the rule. */
      imageWidth?: number;
      imageHeight?: number;
    };

/** Every reason confirming a reviewed draft can fail. */
export type ImageIntakeSaveErrorCode =
  | "unauthorized"
  | "invalid-draft"
  | "store-required"
  | "total-required"
  | "store-not-found"
  | "invalid-product-type"
  | "server-error";

export type ImageIntakeSaveResult =
  | {
      ok: true;
      orderId: string;
      paymentsRecorded: number;
      paymentsSkipped: number;
      /**
       * Payment rows that carried a breakdown and were not written, as indexes into `draft.payments`.
       *
       * It exists because a dropped row costs more than it used to: a payment the server refuses is
       * two fields the collector can retype, but a payment with a breakdown is up to N hand-typed
       * lines, and dropping those in silence is the failure this field makes impossible.
       */
      skippedBreakdownIndexes: number[];
      /** Rows written WITHOUT their breakdown because a position no longer resolved. Money went in. */
      breakdownDropped: number;
    }
  | { ok: false; code: ImageIntakeSaveErrorCode };

/**
 * Shape a save token has to have to be accepted: an opaque hex-and-dash string, long enough to be
 * unguessable and short enough to bound the hashing. Nothing is read out of it, so its only job is
 * to be the same string on the second attempt as on the first.
 */
export const IMAGE_INTAKE_SAVE_TOKEN_PATTERN = /^[0-9a-fA-F-]{16,64}$/;

/**
 * Mints the token that keeps every retry of one review screen resolving to the same order.
 *
 * The save action's idempotency marker used to be derived from the draft's own contents, which is
 * exactly the wrong basis here: a save can report failure after the write went through, and the
 * collector's natural response is to correct something and press save again. A content-derived
 * marker changes the moment they do, so the retry looks like a different order and a second one is
 * created. A token minted once per extracted draft does not move when the draft does.
 */
export function newImageIntakeSaveToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
}
