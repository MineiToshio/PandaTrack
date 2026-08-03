// No `import "server-only"` here: the bare specifier is resolved by Next.js's own bundler
// aliasing, which Vitest's Vite-based transform lacks, so importing it would make this module
// unloadable from the real-buffer unit tests this file needs. `sharp` is a native Node addon
// that cannot bundle into a client component anyway, so the server boundary already holds without
// this module also declaring it.
import sharp from "sharp";
import {
  MAX_IMAGES_PER_SUBMISSION,
  MAX_IMAGE_FILE_BYTES,
  MAX_SUBMISSION_TOTAL_BYTES,
  MIN_IMAGE_DIMENSION,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
} from "./constants";

export const UPLOAD_VALIDATION_ERROR_CODES = [
  "empty-submission",
  "too-many-images",
  "file-too-large",
  "submission-too-large",
  "unsupported-format",
  "unreadable-file",
  "dimensions-out-of-range",
] as const;
export type UploadValidationErrorCode = (typeof UPLOAD_VALIDATION_ERROR_CODES)[number];

/** The three real, sharp-detected formats this feature accepts, regardless of declared MIME type. */
const ACCEPTED_REAL_FORMATS = ["jpeg", "png", "webp"] as const;
type AcceptedRealFormat = (typeof ACCEPTED_REAL_FORMATS)[number];

/**
 * Typed, developer-facing validation failure. `index` identifies the offending file inside the
 * submission when the failure is per-file; it is `null` for submission-level failures (image
 * count, total byte size). A separate localized-copy layer maps `code` to user-facing text; the
 * `message` here stays in English and is never shown to a user directly.
 */
export class ImageIntakeUploadValidationError extends Error {
  readonly code: UploadValidationErrorCode;
  readonly index: number | null;

  constructor(code: UploadValidationErrorCode, message: string, index: number | null = null) {
    super(message);
    this.name = "ImageIntakeUploadValidationError";
    this.code = code;
    this.index = index;
  }
}

/** One file accepted into a submission, with its real (sharp-detected) format and dimensions. */
export type ValidatedUploadImage = {
  buffer: Buffer;
  format: AcceptedRealFormat;
  width: number;
  height: number;
  byteSize: number;
};

/** Input shape: the declared MIME type is accepted for logging only, never trusted for validation. */
export type UploadValidationInput = {
  buffer: Buffer;
  declaredMimeType: string;
};

export type ValidateUploadResult =
  { ok: true; images: ValidatedUploadImage[] } | { ok: false; error: ImageIntakeUploadValidationError };

type ValidateOneImageResult =
  { ok: true; image: ValidatedUploadImage } | { ok: false; error: ImageIntakeUploadValidationError };

function isAcceptedRealFormat(format: string | undefined): format is AcceptedRealFormat {
  return format !== undefined && (ACCEPTED_REAL_FORMATS as readonly string[]).includes(format);
}

/**
 * Decodes and measures one file with `sharp.metadata()`. Validation and measurement only: this
 * function never re-encodes or writes back a transformed buffer: client-side compression already
 * produced the bytes, so this is a trust boundary check on them, not a second processing pass.
 */
async function validateOneImage(buffer: Buffer, index: number): Promise<ValidateOneImageResult> {
  // Inferred rather than annotated with a `sharp` namespace type: the default import used here
  // (matching this codebase's other sharp callers) does not expose `sharp` as a type namespace.
  let metadata;
  try {
    metadata = await sharp(buffer, { failOn: "error" }).metadata();
  } catch (error) {
    return {
      ok: false,
      error: new ImageIntakeUploadValidationError(
        "unreadable-file",
        `File at index ${index} could not be decoded: ${error instanceof Error ? error.message : "unknown decode error"}.`,
        index,
      ),
    };
  }

  // The real format from decoded header bytes, never the caller-declared MIME type: a lying
  // MIME on a genuinely supported file must pass, and a genuine mismatch must be caught here.
  if (!isAcceptedRealFormat(metadata.format)) {
    return {
      ok: false,
      error: new ImageIntakeUploadValidationError(
        "unsupported-format",
        `File at index ${index} decodes as "${metadata.format ?? "unknown"}", which is not one of ${ACCEPTED_REAL_FORMATS.join(", ")}.`,
        index,
      ),
    };
  }

  if (!metadata.width || !metadata.height) {
    return {
      ok: false,
      error: new ImageIntakeUploadValidationError(
        "unreadable-file",
        `File at index ${index} has no readable dimensions.`,
        index,
      ),
    };
  }

  const { width, height } = metadata;
  const withinWidth = width >= MIN_IMAGE_DIMENSION && width <= MAX_IMAGE_WIDTH;
  const withinHeight = height >= MIN_IMAGE_DIMENSION && height <= MAX_IMAGE_HEIGHT;
  if (!withinWidth || !withinHeight) {
    return {
      ok: false,
      error: new ImageIntakeUploadValidationError(
        "dimensions-out-of-range",
        `File at index ${index} is ${width}x${height}, outside the accepted ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} to ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT} range.`,
        index,
      ),
    };
  }

  return {
    ok: true,
    image: { buffer, format: metadata.format, width, height, byteSize: buffer.byteLength },
  };
}

/**
 * Validates one order-image-intake submission end to end: image count, per-file size, total
 * size, real type, dimensions, and decodability. Runs the cheap, allocation-free checks (count,
 * declared byte sizes) before the expensive decode pass, so an oversized or over-count submission
 * fails fast without ever calling into `sharp`.
 */
export async function validateUploadedImages(files: UploadValidationInput[]): Promise<ValidateUploadResult> {
  if (files.length < 1) {
    return {
      ok: false,
      error: new ImageIntakeUploadValidationError("empty-submission", "Submission contains no images."),
    };
  }

  if (files.length > MAX_IMAGES_PER_SUBMISSION) {
    return {
      ok: false,
      error: new ImageIntakeUploadValidationError(
        "too-many-images",
        `Expected between 1 and ${MAX_IMAGES_PER_SUBMISSION} images, received ${files.length}.`,
      ),
    };
  }

  for (let index = 0; index < files.length; index++) {
    const byteSize = files[index].buffer.byteLength;
    if (byteSize > MAX_IMAGE_FILE_BYTES) {
      return {
        ok: false,
        error: new ImageIntakeUploadValidationError(
          "file-too-large",
          `File at index ${index} is ${byteSize} bytes, exceeding the ${MAX_IMAGE_FILE_BYTES} byte per-file ceiling.`,
          index,
        ),
      };
    }
  }

  // Checked ahead of per-image decoding: this is the readable error meant to fire before the
  // platform's raw 413 on a Server Action body over its configured limit.
  const totalBytes = files.reduce((sum, file) => sum + file.buffer.byteLength, 0);
  if (totalBytes > MAX_SUBMISSION_TOTAL_BYTES) {
    return {
      ok: false,
      error: new ImageIntakeUploadValidationError(
        "submission-too-large",
        `Submission totals ${totalBytes} bytes, exceeding the ${MAX_SUBMISSION_TOTAL_BYTES} byte ceiling.`,
      ),
    };
  }

  const images: ValidatedUploadImage[] = [];
  for (let index = 0; index < files.length; index++) {
    const result = await validateOneImage(files[index].buffer, index);
    if (!result.ok) {
      return result;
    }
    images.push(result.image);
  }

  return { ok: true, images };
}
