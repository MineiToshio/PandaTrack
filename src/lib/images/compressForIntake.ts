"use client";

import {
  INTAKE_JPEG_QUALITY,
  INTAKE_SEGMENT_OVERLAP_RATIO,
  INTAKE_TARGET_MAX_HEIGHT,
  INTAKE_TARGET_MAX_WIDTH,
  INTAKE_WEBP_QUALITY,
} from "@/lib/imageIntake/constants";
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

type SegmentPlan = {
  sourceY: number;
  sourceHeight: number;
};

/**
 * Computes vertical split points, in scaled (post width-normalisation) coordinates, for an image
 * taller than the target cap. Segment count is derived first from `ceil(scaledHeight / cap)`, and
 * segment height is then solved backwards from that count so the segments evenly cover the whole
 * image with exactly `INTAKE_SEGMENT_OVERLAP_RATIO` overlap between consecutive segments. Fixing
 * the count first (rather than fixing segment height at the cap and letting the count fall out of
 * a naive stride) keeps the count minimal: a 4800px scaled image at a 2400px cap needs exactly
 * two segments, not three, because the extra 10% overlap budget would otherwise push a
 * fixed-height stride past the end of the image.
 */
function planSegments(scaledHeight: number): SegmentPlan[] {
  if (scaledHeight <= INTAKE_TARGET_MAX_HEIGHT) {
    return [{ sourceY: 0, sourceHeight: scaledHeight }];
  }

  const segmentCount = Math.ceil(scaledHeight / INTAKE_TARGET_MAX_HEIGHT);
  const strideFactor = 1 - INTAKE_SEGMENT_OVERLAP_RATIO;
  const segmentHeight = scaledHeight / (1 + (segmentCount - 1) * strideFactor);
  const stride = segmentHeight * strideFactor;

  const plans: SegmentPlan[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const isLast = index === segmentCount - 1;
    const sourceY = isLast ? scaledHeight - segmentHeight : index * stride;
    plans.push({ sourceY, sourceHeight: segmentHeight });
  }

  return plans;
}

/** Picks the encoder type/quality pair for one canvas encode, using real (not assumed) WebP support. */
async function encodeCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; mimeType: string }> {
  const preferredType: SupportedEncodedImageType = supportsWebpEncoding() ? "image/webp" : "image/jpeg";
  const quality = preferredType === "image/webp" ? INTAKE_WEBP_QUALITY : INTAKE_JPEG_QUALITY;
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
  plan: SegmentPlan,
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

  const { blob, mimeType } = await encodeCanvas(canvas);
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
export async function compressForIntake(source: File | Blob): Promise<CompressForIntakeResult> {
  const decoded = await loadDrawableSource(source);

  try {
    const targetWidth = Math.min(decoded.width, INTAKE_TARGET_MAX_WIDTH);
    const scale = targetWidth / decoded.width;
    const scaledHeight = decoded.height * scale;

    const plans = planSegments(scaledHeight);

    if (plans.length > 1) {
      const segments = await Promise.all(
        plans.map((plan) => encodeSegment(decoded.drawable, decoded.width, targetWidth, scale, plan)),
      );
      return { segments };
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

    const { blob, mimeType } = await encodeCanvas(canvas);

    return {
      segments: [
        {
          blob,
          mimeType,
          width: targetWidth,
          height,
          recompressedLarger: blob.size >= source.size,
        },
      ],
    };
  } finally {
    decoded.dispose();
  }
}
