import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_IMAGES_PER_SUBMISSION, MAX_IMAGE_FILE_BYTES, MAX_SUBMISSION_TOTAL_BYTES } from "../constants";
import { validateUploadedImages, type UploadValidationInput } from "../validateUpload";

async function buildPngBuffer(width = 400, height = 400): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();
}

async function buildJpegBuffer(width = 400, height = 400): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } } })
    .jpeg()
    .toBuffer();
}

async function buildWebpBuffer(width = 400, height = 400): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 50, g: 200, b: 100 } } })
    .webp()
    .toBuffer();
}

/**
 * Deterministic, constant-content buffer of an exact byte size. The per-file and total byte
 * ceilings are both checked before any image decode happens (see `validateUploadedImages`), so
 * these buffers never need to be real, decodable images: a fixed-size, fixed-content allocation
 * gives a reproducible size on every run instead of depending on how well random pixel noise
 * happens to compress under a given JPEG encoder.
 */
function buildBufferOfSize(byteSize: number): Buffer {
  return Buffer.alloc(byteSize, 0x1);
}

function toInput(buffer: Buffer, declaredMimeType = "image/jpeg"): UploadValidationInput {
  return { buffer, declaredMimeType };
}

describe("validateUploadedImages", () => {
  it("accepts a valid png, jpeg, and webp submission", async () => {
    const files = [
      toInput(await buildPngBuffer(), "image/png"),
      toInput(await buildJpegBuffer(), "image/jpeg"),
      toInput(await buildWebpBuffer(), "image/webp"),
    ];

    const result = await validateUploadedImages(files);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.images.map((image) => image.format)).toEqual(["png", "jpeg", "webp"]);
  });

  it("rejects a garbage buffer as unreadable-file", async () => {
    const garbage = Buffer.from("this is not an image, just plain text bytes");

    const result = await validateUploadedImages([toInput(garbage)]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unreadable-file");
  });

  it("accepts a real png whose declared MIME type falsely claims a different format", async () => {
    const pngBytes = await buildPngBuffer();

    // The declared MIME lies (claims JPEG); the real header bytes are PNG and must win.
    const result = await validateUploadedImages([toInput(pngBytes, "image/jpeg")]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.images[0].format).toBe("png");
  });

  it("rejects dimensions below the minimum as image-too-small, with the measurement and the position", async () => {
    const tiny = await buildPngBuffer(100, 100);

    const result = await validateUploadedImages([
      toInput(await buildPngBuffer(), "image/png"),
      toInput(tiny, "image/png"),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("image-too-small");
    // The position and the measurement are what let the screen name the photo and quote its size
    // back, instead of telling a collector that one of their photos is too small or too large.
    expect(result.error.index).toBe(1);
    expect(result.error.measured).toEqual({ width: 100, height: 100 });
  });

  it("rejects dimensions above the maximum as image-too-large, with the measurement and the position", async () => {
    const huge = await buildPngBuffer(4200, 400);

    const result = await validateUploadedImages([toInput(huge, "image/png")]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("image-too-large");
    expect(result.error.index).toBe(0);
    expect(result.error.measured).toEqual({ width: 4200, height: 400 });
  });

  it("rejects more than the maximum number of images as too-many-images", async () => {
    const single = await buildPngBuffer();
    const files = Array.from({ length: MAX_IMAGES_PER_SUBMISSION + 1 }, () => toInput(single, "image/png"));

    const result = await validateUploadedImages(files);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("too-many-images");
  });

  it("rejects an empty submission with its own empty-submission code", async () => {
    const result = await validateUploadedImages([]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("empty-submission");
  });

  it("rejects a single file over the per-file byte ceiling as file-too-large", async () => {
    // 512 KB clear of the ceiling on every run, not a value that depends on encoder output.
    const oversized = buildBufferOfSize(MAX_IMAGE_FILE_BYTES + 512 * 1024);
    expect(oversized.byteLength).toBeGreaterThan(MAX_IMAGE_FILE_BYTES);

    const result = await validateUploadedImages([toInput(oversized, "image/jpeg")]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("file-too-large");
  });

  it("rejects a submission whose total bytes exceed the ceiling as submission-too-large", async () => {
    // Three deterministic 1.5 MB buffers: each sits comfortably under the 2 MB per-file ceiling
    // (roughly 512 KB of margin) while their sum clears the 3.5 MB submission ceiling by
    // roughly 1 MB, so neither boundary depends on how well any encoder happens to compress.
    const perFileSize = 1.5 * 1024 * 1024;
    const files = Array.from({ length: 3 }, () => toInput(buildBufferOfSize(perFileSize), "image/jpeg"));
    for (const file of files) {
      expect(file.buffer.byteLength).toBeLessThan(MAX_IMAGE_FILE_BYTES);
    }
    const totalBytes = files.reduce((sum, file) => sum + file.buffer.byteLength, 0);
    expect(totalBytes).toBeGreaterThan(MAX_SUBMISSION_TOTAL_BYTES);

    const result = await validateUploadedImages(files);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("submission-too-large");
  });

  it("rejects a decodable but unsupported format (gif) as unsupported-format", async () => {
    const gif = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#ffffff" } })
      .gif()
      .toBuffer();

    const result = await validateUploadedImages([toInput(gif, "image/gif")]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported-format");
  });
});
