"use client";

import {
  INTAKE_JPEG_QUALITY,
  INTAKE_TARGET_MAX_WIDTH,
  INTAKE_WEBP_QUALITY,
  INTAKE_WEBP_QUALITY_LADDER,
  MAX_IMAGE_FILE_BYTES,
  MAX_SUBMISSION_TOTAL_BYTES,
} from "@/lib/imageIntake/constants";
import { planIntakeSegments, type IntakeSegmentPlan } from "@/lib/imageIntake/segmentPlan";
import { encodeCanvasToBlob, supportsWebpEncoding, type SupportedEncodedImageType } from "./canvasEncoding";

/**
 * One vertical slice of a source image, ready to upload independently. A receipt or a short
 * screenshot produces exactly one segment; a tall chat screenshot is split into several so the
 * extraction engine never receives an image so tall that downscaling makes its text illegible.
 */
export type CompressedImageSegment = {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  /**
   * True when the canvas-encoded candidate was not smaller than the original source bytes for
   * this segment. This is informational only and never changes what gets returned: privacy is an
   * absolute product guarantee, not something traded for a smaller upload. A canvas 2D repaint is
   * the only thing that strips EXIF and keeps GPS off the wire, so the encoded output is always
   * what this function returns, even on the rare source (typically an already-compressed image or
   * a flat-color screenshot) where re-encoding does not shrink it. The flag exists purely so this
   * rare case can be observed later, not to justify falling back to the original bytes.
   */
  recompressedLarger: boolean;
};

export type CompressForIntakeResult = {
  segments: CompressedImageSegment[];
  /**
   * What the source decoded to, before any normalisation.
   *
   * Reported because the decode already happened here and nothing else in the flow has these
   * numbers: the segments carry prepared dimensions, and a photo refused for its prepared size can
   * only be explained to its owner in terms of the photo they actually attached.
   */
  source: { width: number; height: number };
};

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

type DrawableSource = {
  drawable: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

/**
 * Decodes the source file into whatever the canvas 2D context can draw from. Prefers
 * `createImageBitmap` (decodes off the main thread, needs no object URL bookkeeping) and falls
 * back to an `<img>` element for engines that lack it.
 */
async function loadDrawableSource(source: Blob): Promise<DrawableSource> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(source);
    return {
      drawable: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(source);
  const image = await loadImageElement(objectUrl);
  return {
    drawable: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(objectUrl),
  };
}

/**
 * Picks the encoder type/quality pair for one canvas encode, using real (not assumed) WebP support.
 *
 * `webpQuality` is the rung of `INTAKE_WEBP_QUALITY_LADDER` this pass is encoding at. The JPEG
 * fallback keeps its own fixed quality: it exists for engines without a WebP encoder, and the ladder
 * was measured against WebP, so its rungs say nothing about what JPEG would produce.
 */
async function encodeCanvas(canvas: HTMLCanvasElement, webpQuality: number): Promise<{ blob: Blob; mimeType: string }> {
  const preferredType: SupportedEncodedImageType = supportsWebpEncoding() ? "image/webp" : "image/jpeg";
  const quality = preferredType === "image/webp" ? webpQuality : INTAKE_JPEG_QUALITY;
  return encodeCanvasToBlob(canvas, preferredType, quality, INTAKE_JPEG_QUALITY);
}

/**
 * Draws one segment of the proportionally scaled source onto a fresh canvas and encodes it.
 * `scale` maps scaled-space coordinates back to the decoded source image, so a single
 * `drawImage` call both crops the vertical slice and downsamples it in one pass, without
 * materialising an intermediate full-size scaled bitmap.
 */
async function encodeSegment(
  source: CanvasImageSource,
  sourceWidth: number,
  targetWidth: number,
  scale: number,
  plan: IntakeSegmentPlan,
  webpQuality: number,
): Promise<CompressedImageSegment> {
  const canvas = document.createElement("canvas");
  const segmentHeight = Math.round(plan.sourceHeight);
  canvas.width = targetWidth;
  canvas.height = segmentHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create canvas context.");
  }

  context.drawImage(
    source,
    0,
    plan.sourceY / scale,
    sourceWidth,
    plan.sourceHeight / scale,
    0,
    0,
    targetWidth,
    segmentHeight,
  );

  const { blob, mimeType } = await encodeCanvas(canvas, webpQuality);
  // Per-segment size is not compared against the source: the source was never split, so there is
  // no meaningful per-segment byte baseline to flag against.
  return { blob, mimeType, width: targetWidth, height: segmentHeight, recompressedLarger: false };
}

/**
 * Compresses a source photo for AI intake: caps dimensions, strips metadata via the canvas
 * repaint (a canvas 2D context never copies the source file's metadata into its pixel buffer, so
 * GPS and device data never leave the device, independent of the encoded format), and splits tall
 * screenshots into overlapping segments so downscaling never makes small text illegible.
 *
 * The canvas-encoded output is returned unconditionally, even when it is not smaller than the
 * original source bytes. Privacy outranks byte size here: the product's absolute guarantee is
 * that a photo's EXIF is stripped and its GPS coordinates never leave the device, and the canvas
 * repaint is the only step that provides that. Falling back to the original file on a size
 * regression would silently reintroduce EXIF and GPS on whatever rare source re-encodes larger
 * (typically a screenshot or an already-compressed image, both of which tend to re-encode well
 * anyway, so the regression is uncommon in practice). See
 * `CompressedImageSegment.recompressedLarger` for the purely informational flag this produces
 * instead.
 */
export async function compressForIntake(
  sourceFile: File | Blob,
  webpQuality: number = INTAKE_WEBP_QUALITY,
): Promise<CompressForIntakeResult> {
  const decoded = await loadDrawableSource(sourceFile);

  try {
    const targetWidth = Math.min(decoded.width, INTAKE_TARGET_MAX_WIDTH);
    const scale = targetWidth / decoded.width;
    const scaledHeight = decoded.height * scale;
    const source = { width: decoded.width, height: decoded.height };

    const plans = planIntakeSegments(scaledHeight);

    if (plans.length > 1) {
      const segments = await Promise.all(
        plans.map((plan) => encodeSegment(decoded.drawable, decoded.width, targetWidth, scale, plan, webpQuality)),
      );
      return { segments, source };
    }

    const height = Math.round(scaledHeight);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context.");
    }

    context.drawImage(decoded.drawable, 0, 0, decoded.width, decoded.height, 0, 0, targetWidth, height);

    const { blob, mimeType } = await encodeCanvas(canvas, webpQuality);

    return {
      segments: [
        {
          blob,
          mimeType,
          width: targetWidth,
          height,
          recompressedLarger: blob.size >= sourceFile.size,
        },
      ],
      source,
    };
  } finally {
    decoded.dispose();
  }
}

/**
 * How many source photos are decoded at once by {@link compressBatchForIntake}.
 *
 * Preparation is what makes an upload small, so nothing upstream bounds the size of what arrives
 * here: a batch is up to `MAX_IMAGES_PER_SUBMISSION` full-resolution screenshots. Decoding is the
 * expensive step and it is expensive in pixels, not in file bytes (a lossless screenshot is small on
 * disk and enormous once decoded), so preparing the whole batch at once would hold every decoded
 * bitmap in memory simultaneously and can take a phone's tab down. A small pool keeps peak memory
 * proportional to the pool rather than to the batch, while still overlapping the decode of the next
 * photo with the encode of the current one.
 */
const INTAKE_COMPRESSION_CONCURRENCY = 3;

/**
 * Prepares a whole batch of source photos, in order, with bounded concurrency.
 *
 * Returns results positionally aligned with `sourceFiles`: the order of the photos is what the
 * extraction reads as the order of the conversation, so it must survive the pool.
 */
export async function compressBatchForIntake(
  sourceFiles: readonly (File | Blob)[],
  webpQuality: number = INTAKE_WEBP_QUALITY,
): Promise<CompressForIntakeResult[]> {
  const results = new Array<CompressForIntakeResult>(sourceFiles.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < sourceFiles.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await compressForIntake(sourceFiles[index], webpQuality);
    }
  }

  const workerCount = Math.min(INTAKE_COMPRESSION_CONCURRENCY, sourceFiles.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));

  return results;
}

/** A whole submission, prepared and known to fit (or known not to) in a single request. */
export type PreparedIntakeSubmission = {
  results: CompressForIntakeResult[];
  /** The ladder rung the returned bytes were encoded at. */
  webpQuality: number;
  /** True when a rung below the default was needed to fit the submission in one request. */
  usedFallbackQuality: boolean;
  /** Total bytes of every segment across every photo, as returned. */
  totalBytes: number;
  /**
   * False when even the ladder's floor did not fit. The bytes are still returned, at the floor, so
   * the caller can report the real figure and say how many photos would have fit rather than
   * refusing with a rule and no number.
   */
  fits: boolean;
};

/** Whether a prepared submission clears both byte ceilings the upload is judged against. */
function submissionFits(results: CompressForIntakeResult[]): { fits: boolean; totalBytes: number } {
  const segments = results.flatMap((result) => result.segments);
  const totalBytes = segments.reduce((sum, segment) => sum + segment.blob.size, 0);
  const fits = totalBytes <= MAX_SUBMISSION_TOTAL_BYTES && segments.every((s) => s.blob.size <= MAX_IMAGE_FILE_BYTES);
  return { fits, totalBytes };
}

/**
 * Prepares a whole submission and, when it does not fit in one request, prepares it again at a
 * lower encode quality until it does.
 *
 * The retry exists because there is no other way out. Extraction is a SINGLE pass over the images as
 * one ordered conversation (`FR-11-20`), so a submission too large for one request cannot be split
 * across several without splitting the conversation with it: a payment read in the twelfth image
 * belongs to the order opened in the third, and two independent reads would produce two drafts that
 * neither the model nor the review screen can reconcile, at twice the provider cost. Sending less
 * information is therefore strictly better than sending it in pieces.
 *
 * What gets given up is chosen, not incidental. Dimensions are held fixed at every rung, so the
 * measurement that actually governs text recognition never moves; only WebP quality drops, and on
 * a text screenshot that costs almost nothing because flat regions hold few bits to surrender. The
 * submissions that reach the ladder at all are the photographic ones, which is exactly where the
 * bits are and exactly what the model is not reading. See `INTAKE_WEBP_QUALITY_LADDER`.
 *
 * Each rung re-decodes from source rather than re-encoding a cached canvas. Holding every decoded
 * bitmap of a batch in memory to avoid a second decode is the same memory hazard
 * `compressBatchForIntake` bounds on purpose, and this path is only reached by submissions whose
 * alternative is being refused outright, where a few extra seconds is the cheaper price.
 */
export async function prepareSubmissionForIntake(
  sourceFiles: readonly (File | Blob)[],
): Promise<PreparedIntakeSubmission> {
  const [firstRung, ...lowerRungs] = INTAKE_WEBP_QUALITY_LADDER;
  let webpQuality: number = firstRung;
  let results = await compressBatchForIntake(sourceFiles, webpQuality);
  let { fits, totalBytes } = submissionFits(results);

  for (const rung of lowerRungs) {
    if (fits) break;
    webpQuality = rung;
    results = await compressBatchForIntake(sourceFiles, rung);
    ({ fits, totalBytes } = submissionFits(results));
  }

  // When no rung fit, the floor's bytes are still what gets returned: the caller reports the real
  // total from them, so a collector who then trims the batch is trimming against a true figure
  // rather than guessing by how much they are over.
  return { results, webpQuality, usedFallbackQuality: webpQuality !== INTAKE_WEBP_QUALITY, totalBytes, fits };
}
