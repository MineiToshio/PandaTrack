import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEncoderSupportCache } from "../canvasEncoding";
import { getProcessedImageBlob } from "../getProcessedImageBlob";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function mockCanvasContext() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
}

/** Mocks `toBlob` to return a blob whose real type is decided per requested type. */
function mockToBlob(typeForRequest: (requestedType: string | undefined) => string) {
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob([new Uint8Array(10)], { type: typeForRequest(type) }));
  });
}

describe("getProcessedImageBlob", () => {
  beforeEach(() => {
    resetEncoderSupportCache();
    mockCanvasContext();
    vi.stubGlobal("Image", FakeImage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reproduces the pre-existing Safari bug scenario and returns a correctly labelled JPEG instead of a PNG mislabelled as WebP", async () => {
    // Simulates Safari's canvas encoder (iPhone and Mac): asked for "image/webp", it silently
    // returns a non-null PNG blob instead of failing. The old implementation trusted the
    // requested type and handed that PNG blob straight to callers that treated it as WebP
    // (e.g. naming the uploaded file "logo.webp"), which is the production bug this fixes.
    // Against the old implementation (`canvas.toBlob(cb, "image/webp", quality)` with no
    // verification, returning the raw Blob), this assertion would fail: the old code had no
    // `mimeType` field at all and the blob it resolved would carry `type: "image/png"`.
    mockToBlob((type) => (type === "image/webp" ? "image/png" : "image/jpeg"));

    const result = await getProcessedImageBlob("blob:fake-source", { x: 0, y: 0, width: 100, height: 100 }, 256);

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.mimeType).not.toBe("image/png");
    expect(result.blob.type).not.toBe("image/png");
  });

  it("keeps WebP when the encoder genuinely supports it", async () => {
    mockToBlob((type) => type ?? "image/png");

    const result = await getProcessedImageBlob("blob:fake-source", { x: 0, y: 0, width: 100, height: 100 }, 256);

    expect(result.mimeType).toBe("image/webp");
    expect(result.blob.type).toBe("image/webp");
  });

  it("never returns a blob whose type disagrees with the reported mimeType", async () => {
    mockToBlob((type) => (type === "image/webp" ? "image/png" : "image/jpeg"));

    const result = await getProcessedImageBlob("blob:fake-source", { x: 0, y: 0, width: 100, height: 100 }, 256);

    expect(result.blob.type).toBe(result.mimeType);
  });
});
