import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MIN_IMAGE_DIMENSION } from "../constants";
import { checkIntakeSourceDimensions, minIntakeSourceHeight } from "../dimensionPrecheck";
import { projectIntakeOutputDimensions } from "../segmentPlan";
import { validateUploadedImages } from "../validateUpload";

/**
 * The attach-time verdict and the server's own answer, checked against each other on real image
 * bytes.
 *
 * The bug this file is the regression cover for: a wide, short screenshot is refused, and the only
 * thing the collector was told was that one of their photos was "too small or too large". Nothing
 * about the photo is small. The preparation step normalises every upload to 1080px wide, and a crop
 * that is much wider than it is tall loses its height in that step, which is a different problem
 * with a different remedy.
 *
 * The two halves have to agree or the fix is worthless: a precheck that cleared a photo the server
 * then refused would move the failure later instead of earlier, and one that refused a photo the
 * server would have taken would cost the collector a read they could have had.
 */

/** Builds real bytes at the given size, so `sharp` measures an image rather than a fixture. */
async function pngOfSize(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 12, g: 34, b: 56 } } })
    .png()
    .toBuffer();
}

/** Runs a source through the preparation projection and asks the real server validator about it. */
async function serverVerdictForPreparedSource(width: number, height: number): Promise<string> {
  const prepared = projectIntakeOutputDimensions(width, height);
  const buffers = await Promise.all(prepared.map((segment) => pngOfSize(segment.width, segment.height)));
  const result = await validateUploadedImages(buffers.map((buffer) => ({ buffer, declaredMimeType: "image/png" })));
  return result.ok ? "accepted" : result.error.code;
}

describe("checkIntakeSourceDimensions", () => {
  it("accepts the screenshots collectors actually take", () => {
    // Phone portrait, tall chat capture, high-density laptop, 4K desktop.
    expect(checkIntakeSourceDimensions(1179, 2556)).toBeNull();
    expect(checkIntakeSourceDimensions(1179, 7000)).toBeNull();
    expect(checkIntakeSourceDimensions(3456, 2234)).toBeNull();
    expect(checkIntakeSourceDimensions(3840, 2160)).toBeNull();
  });

  it("calls a wide, short crop wide rather than small, and states the height it would need", () => {
    const issue = checkIntakeSourceDimensions(3000, 300);

    expect(issue).toEqual({
      code: "source-too-wide",
      width: 3000,
      height: 300,
      // 200 x 3000 / 1080, rounded up so the figure quoted is one that really passes.
      minSourceHeight: 556,
    });
  });

  it("calls a genuinely small photo small", () => {
    expect(checkIntakeSourceDimensions(150, 150)).toEqual({
      code: "source-too-small",
      width: 150,
      height: 150,
      minDimension: MIN_IMAGE_DIMENSION,
    });
  });

  it("decides nothing about dimensions it cannot trust", () => {
    expect(checkIntakeSourceDimensions(0, 0)).toBeNull();
    expect(checkIntakeSourceDimensions(Number.NaN, 500)).toBeNull();
  });

  it("quotes a minimum height that the same source really clears", async () => {
    const width = 3000;
    const minHeight = minIntakeSourceHeight(width);

    expect(checkIntakeSourceDimensions(width, minHeight)).toBeNull();
    await expect(serverVerdictForPreparedSource(width, minHeight)).resolves.toBe("accepted");
    // And it is the boundary, not a comfortable round number: two pixels under it is refused. The
    // one pixel of slack is the rounding the canvas does when it sizes the prepared image, which the
    // quoted figure absorbs on purpose rather than quoting a height that fails half the time.
    expect(checkIntakeSourceDimensions(width, minHeight - 2)?.code).toBe("source-too-wide");
    await expect(serverVerdictForPreparedSource(width, minHeight - 2)).resolves.toBe("image-too-small");
  });
});

describe("the attach-time verdict against the server's own answer", () => {
  const SOURCES: { label: string; width: number; height: number; serverCode: string }[] = [
    { label: "phone portrait screenshot", width: 1179, height: 2556, serverCode: "accepted" },
    { label: "tall chat screenshot, split into segments", width: 1179, height: 7000, serverCode: "accepted" },
    { label: "4K desktop screenshot", width: 3840, height: 2160, serverCode: "accepted" },
    { label: "10:1 chat strip", width: 3000, height: 300, serverCode: "image-too-small" },
    { label: "receipt strip", width: 2400, height: 300, serverCode: "image-too-small" },
    { label: "thumbnail", width: 150, height: 150, serverCode: "image-too-small" },
  ];

  it.each(SOURCES)("agrees with the server about a $label", async ({ width, height, serverCode }) => {
    const issue = checkIntakeSourceDimensions(width, height);

    await expect(serverVerdictForPreparedSource(width, height)).resolves.toBe(serverCode);
    expect(issue === null).toBe(serverCode === "accepted");
  });

  it("never lets the preparation step produce something over the server's upper bound", () => {
    // The half of the old message that named a photo "too large" was unreachable through this
    // pipeline: every prepared upload is capped well under the validator's ceiling. It is asserted
    // rather than assumed, because it is what makes "too small" the only honest wording here.
    for (const { width, height } of SOURCES) {
      for (const segment of projectIntakeOutputDimensions(width, height)) {
        expect(segment.width).toBeLessThanOrEqual(1080);
        expect(segment.height).toBeLessThanOrEqual(2400);
      }
    }
  });
});
