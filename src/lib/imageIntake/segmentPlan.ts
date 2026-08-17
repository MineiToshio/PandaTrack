import { INTAKE_SEGMENT_OVERLAP_RATIO, INTAKE_TARGET_MAX_HEIGHT, INTAKE_TARGET_MAX_WIDTH } from "./constants";

/**
 * Pure geometry of the client image pipeline: how one source photo is normalised in width and,
 * when it is tall, split into overlapping vertical segments.
 *
 * It lives apart from `compressForIntake` (which owns the canvas work) because two callers need the
 * same answer: the compressor, which draws the segments, and the attach-time dimension precheck,
 * which has to know what the compressor *will* produce before a single pixel is drawn. A photo is
 * refused for its prepared dimensions, not for the ones the file reports, so a precheck computing
 * that projection on its own would be a second copy of this arithmetic, free to drift from the one
 * that decides what actually gets uploaded.
 */

/** One vertical slice of the width-normalised image, in scaled (post width-normalisation) pixels. */
export type IntakeSegmentPlan = {
  sourceY: number;
  sourceHeight: number;
};

/**
 * Computes vertical split points, in scaled coordinates, for an image taller than the target cap.
 * Segment count is derived first from `ceil(scaledHeight / cap)`, and segment height is then solved
 * backwards from that count so the segments evenly cover the whole image with exactly
 * `INTAKE_SEGMENT_OVERLAP_RATIO` overlap between consecutive segments. Fixing the count first
 * (rather than fixing segment height at the cap and letting the count fall out of a naive stride)
 * keeps the count minimal: a 4800px scaled image at a 2400px cap needs exactly two segments, not
 * three, because the extra 10% overlap budget would otherwise push a fixed-height stride past the
 * end of the image.
 */
export function planIntakeSegments(scaledHeight: number): IntakeSegmentPlan[] {
  if (scaledHeight <= INTAKE_TARGET_MAX_HEIGHT) {
    return [{ sourceY: 0, sourceHeight: scaledHeight }];
  }

  const segmentCount = Math.ceil(scaledHeight / INTAKE_TARGET_MAX_HEIGHT);
  const strideFactor = 1 - INTAKE_SEGMENT_OVERLAP_RATIO;
  const segmentHeight = scaledHeight / (1 + (segmentCount - 1) * strideFactor);
  const stride = segmentHeight * strideFactor;

  const plans: IntakeSegmentPlan[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const isLast = index === segmentCount - 1;
    const sourceY = isLast ? scaledHeight - segmentHeight : index * stride;
    plans.push({ sourceY, sourceHeight: segmentHeight });
  }

  return plans;
}

/** Pixel dimensions of one prepared image, exactly as the canvas will size it. */
export type IntakeOutputDimensions = {
  width: number;
  height: number;
};

/**
 * Dimensions of every image one source photo will be uploaded as, given the source's own decoded
 * dimensions. Mirrors `compressForIntake`'s canvas sizing, rounding included, so a caller can decide
 * whether the upload validator will accept the result without doing the work of producing it.
 */
export function projectIntakeOutputDimensions(sourceWidth: number, sourceHeight: number): IntakeOutputDimensions[] {
  const targetWidth = Math.min(sourceWidth, INTAKE_TARGET_MAX_WIDTH);
  const scale = targetWidth / sourceWidth;
  const scaledHeight = sourceHeight * scale;

  return planIntakeSegments(scaledHeight).map((plan) => ({
    width: targetWidth,
    height: Math.round(plan.sourceHeight),
  }));
}
