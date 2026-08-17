import { INTAKE_TARGET_MAX_WIDTH, MAX_IMAGE_HEIGHT, MAX_IMAGE_WIDTH, MIN_IMAGE_DIMENSION } from "./constants";
import { projectIntakeOutputDimensions } from "./segmentPlan";

/**
 * Why a source photo cannot be read, decided from its own decoded dimensions before it is prepared
 * or uploaded.
 *
 * The two small cases are deliberately separate, because they are separate problems with separate
 * remedies and only one of them is about a small photo:
 *
 * - `source-too-small` is a genuinely small file (a thumbnail, an icon, a saved chat avatar). The
 *   remedy is a bigger capture.
 * - `source-too-wide` is a photo whose own pixels are plentiful but whose shape defeats the
 *   preparation step: the pipeline normalises every upload to `INTAKE_TARGET_MAX_WIDTH`, so a wide,
 *   short crop (a single chat line, a receipt strip) is scaled down until its height falls under the
 *   readable minimum. The photo is not small, it is out of proportion, and the remedy is height:
 *   crop less from the sides, or attach the whole screenshot.
 *
 * Reporting both as "too small" is what makes the message read as a lie to anyone looking at a
 * 3000 px wide screenshot.
 */
export type IntakeDimensionIssue =
  | {
      code: "source-too-small";
      width: number;
      height: number;
      minDimension: number;
    }
  | {
      code: "source-too-wide";
      width: number;
      height: number;
      /** Height this photo would need, at its own width, to survive the preparation step. */
      minSourceHeight: number;
    }
  | {
      code: "source-too-large";
      width: number;
      height: number;
      maxWidth: number;
      maxHeight: number;
    };

/**
 * Smallest source height that still clears `MIN_IMAGE_DIMENSION` after the width normalisation, at
 * a given source width. Rounded up, so the figure quoted to a collector is one that really passes.
 */
export function minIntakeSourceHeight(sourceWidth: number): number {
  const targetWidth = Math.min(sourceWidth, INTAKE_TARGET_MAX_WIDTH);
  return Math.ceil((MIN_IMAGE_DIMENSION * sourceWidth) / targetWidth);
}

/**
 * Verdict on one source photo, from the dimensions the browser decoded for it.
 *
 * Client-safe and pure: no canvas, no decoding, no Node API. The caller reads the dimensions (see
 * `readImageDimensions`) and this decides, so the collector can be told at attach time, about the
 * photo they just picked and by name, rather than after a compression pass, an upload, and a round
 * trip that all end in a message naming nothing.
 *
 * Returns `null` for anything it cannot decide, including a source whose dimensions could not be
 * read. Silence here is never an acceptance: the server's `validateUploadedImages` remains the only
 * authority on what gets read, and this check exists to move the honest answer earlier, not to
 * replace it.
 */
export function checkIntakeSourceDimensions(sourceWidth: number, sourceHeight: number): IntakeDimensionIssue | null {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth < 1 || sourceHeight < 1) {
    return null;
  }

  if (sourceWidth < MIN_IMAGE_DIMENSION || sourceHeight < MIN_IMAGE_DIMENSION) {
    return {
      code: "source-too-small",
      width: sourceWidth,
      height: sourceHeight,
      minDimension: MIN_IMAGE_DIMENSION,
    };
  }

  const prepared = projectIntakeOutputDimensions(sourceWidth, sourceHeight);

  if (prepared.some((segment) => segment.height < MIN_IMAGE_DIMENSION || segment.width < MIN_IMAGE_DIMENSION)) {
    return {
      code: "source-too-wide",
      width: sourceWidth,
      height: sourceHeight,
      minSourceHeight: minIntakeSourceHeight(sourceWidth),
    };
  }

  // Never reachable from the pipeline as it stands (preparation caps every upload at
  // `INTAKE_TARGET_MAX_WIDTH` by `INTAKE_TARGET_MAX_HEIGHT`, both far under these ceilings), and
  // kept anyway so the two checks stay a matched pair: if the preparation targets ever grow past the
  // validator's ceilings, this reports it at attach time instead of leaving the server to refuse an
  // upload the client had already promised was fine.
  if (prepared.some((segment) => segment.width > MAX_IMAGE_WIDTH || segment.height > MAX_IMAGE_HEIGHT)) {
    return {
      code: "source-too-large",
      width: sourceWidth,
      height: sourceHeight,
      maxWidth: MAX_IMAGE_WIDTH,
      maxHeight: MAX_IMAGE_HEIGHT,
    };
  }

  return null;
}
