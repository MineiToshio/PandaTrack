import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compressForIntake } from "../compressForIntake";
import { resetEncoderSupportCache } from "../canvasEncoding";

const dimensionsByBlob = new WeakMap<Blob, { width: number; height: number }>();

function createFakeImageFile(width: number, height: number, sizeBytes: number, type = "image/png"): File {
  const file = new File([new Uint8Array(sizeBytes)], "source", { type });
  dimensionsByBlob.set(file, { width, height });
  return file;
}

type FakeImageBitmap = {
  width: number;
  height: number;
  close: () => void;
};

function mockCreateImageBitmap() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (blob: Blob): Promise<FakeImageBitmap> => {
      const dimensions = dimensionsByBlob.get(blob) ?? { width: 1080, height: 1080 };
      return { width: dimensions.width, height: dimensions.height, close: vi.fn() };
    }),
  );
}

function mockCanvasContext() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
}

function mockWebpSupport(supported: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (type?: string) {
    return type === "image/webp" && supported ? "data:image/webp;base64,AAAA" : "data:image/png;base64,AAAA";
  });
}

/** Mocks `toBlob` to always honour the requested type and produce a blob of the given byte size. */
function mockToBlobSize(sizeBytes: number) {
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob([new Uint8Array(sizeBytes)], { type: type ?? "image/png" }));
  });
}

describe("compressForIntake", () => {
  beforeEach(() => {
    resetEncoderSupportCache();
    mockCreateImageBitmap();
    mockCanvasContext();
    mockWebpSupport(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the native width and a single segment for a 1080x2400 input", async () => {
    mockToBlobSize(1000);
    const file = createFakeImageFile(1080, 2400, 500_000);

    const result = await compressForIntake(file);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].width).toBe(1080);
    expect(result.segments[0].height).toBe(2400);
    expect(result.segments[0].recompressedLarger).toBe(false);
    expect(result.segments[0].mimeType).toBe("image/webp");
    expect(result.segments[0].blob).not.toBe(file);
  });

  it("splits a 1080x4800 input into two overlapping segments", async () => {
    mockToBlobSize(1000);
    const file = createFakeImageFile(1080, 4800, 500_000);

    const result = await compressForIntake(file);

    expect(result.segments).toHaveLength(2);
    for (const segment of result.segments) {
      expect(segment.width).toBe(1080);
      expect(segment.recompressedLarger).toBe(false);
      expect(segment.blob).not.toBe(file);
    }

    // Both segments must exceed half of the total height (that's what an overlap means), and the
    // amount by which their combined height exceeds the source height is the overlap, which
    // should land close to the configured 10% of a segment's height.
    const [first, second] = result.segments;
    const combinedHeight = first.height + second.height;
    const overlapPx = combinedHeight - 4800;

    expect(overlapPx).toBeGreaterThan(0);
    expect(overlapPx / first.height).toBeCloseTo(0.1, 1);
  });

  it("does not upscale an input narrower than the 1080 target width", async () => {
    mockToBlobSize(1000);
    const file = createFakeImageFile(720, 900, 200_000);

    const result = await compressForIntake(file);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].width).toBe(720);
  });

  it("privacy invariant: never returns the original source blob, even when recompression does not shrink the file", async () => {
    // The rare case where the canvas-encoded candidate is not smaller than the source. Privacy
    // (stripped EXIF, no GPS) is an absolute guarantee, so the canvas output must still win over
    // falling back to the original bytes.
    const originalSize = 1_000;
    mockToBlobSize(5_000);
    const file = createFakeImageFile(300, 300, originalSize, "image/png");

    const result = await compressForIntake(file);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].recompressedLarger).toBe(true);
    expect(result.segments[0].blob).not.toBe(file);
    expect(result.segments[0].blob.size).toBe(5_000);
    expect(result.segments[0].mimeType).toBe("image/webp");
  });

  it("privacy invariant: never returns the original source blob when recompression does shrink the file", async () => {
    mockToBlobSize(1_000);
    const file = createFakeImageFile(1080, 1080, 500_000);

    const result = await compressForIntake(file);

    expect(result.segments[0].recompressedLarger).toBe(false);
    expect(result.segments[0].blob).not.toBe(file);
  });

  it("falls back to JPEG (never a mislabelled PNG) when the encoder lacks real WebP support", async () => {
    mockWebpSupport(false);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      // Simulates an engine that substitutes PNG when asked for WebP, same as the Safari bug.
      callback(new Blob([new Uint8Array(1_000)], { type: type === "image/webp" ? "image/png" : "image/jpeg" }));
    });
    const file = createFakeImageFile(1080, 1080, 500_000);

    const result = await compressForIntake(file);

    expect(result.segments[0].mimeType).toBe("image/jpeg");
    expect(result.segments[0].blob.type).toBe("image/jpeg");
    expect(result.segments[0].mimeType).not.toBe("image/png");
  });

  it("never logs a full image payload to the console", () => {
    const source = readFileSync(join(__dirname, "../compressForIntake.ts"), "utf-8");
    expect(source).not.toMatch(/console\.log/);
  });
});
