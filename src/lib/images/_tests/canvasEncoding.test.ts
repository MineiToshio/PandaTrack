import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeCanvasToBlob,
  extensionForEncodedType,
  resetEncoderSupportCache,
  supportsWebpEncoding,
} from "../canvasEncoding";

function mockToDataURL(webpSupported: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (type?: string) {
    if (type === "image/webp" && webpSupported) {
      return "data:image/webp;base64,AAAA";
    }
    return "data:image/png;base64,AAAA";
  });
}

function mockPixelData(data = new Uint8ClampedArray([0, 0, 0, 255])) {
  const getImageData = vi.fn(() => ({ data }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getImageData,
  } as unknown as CanvasRenderingContext2D);
  return getImageData;
}

/** Mocks `toBlob` to return a blob whose real type is decided per requested type, simulating either a spec-compliant encoder or Safari's silent PNG substitution. */
function mockToBlob(typeForRequest: (requestedType: string | undefined) => string | null) {
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    const resultType = typeForRequest(type);
    if (!resultType) {
      callback(null);
      return;
    }
    callback(new Blob([new Uint8Array(10)], { type: resultType }));
  });
}

describe("canvasEncoding", () => {
  beforeEach(() => {
    resetEncoderSupportCache();
    mockPixelData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("supportsWebpEncoding", () => {
    it("returns true when the canvas encoder truly declares a WebP data URL", () => {
      mockToDataURL(true);
      expect(supportsWebpEncoding()).toBe(true);
    });

    it("returns false when the canvas encoder substitutes PNG for a WebP request", () => {
      mockToDataURL(false);
      expect(supportsWebpEncoding()).toBe(false);
    });

    it("caches the result for the session instead of re-probing on every call", () => {
      const spy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/webp;base64,AAAA");

      supportsWebpEncoding();
      supportsWebpEncoding();
      supportsWebpEncoding();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("encodeCanvasToBlob", () => {
    it("returns a verified WebP result when the encoder genuinely honours the request", async () => {
      mockToBlob((type) => type ?? "image/png");
      const canvas = document.createElement("canvas");

      const result = await encodeCanvasToBlob(canvas, "image/webp", 0.85);

      expect(result.mimeType).toBe("image/webp");
      expect(result.blob.type).toBe("image/webp");
      expect(canvas.getContext("2d")?.getImageData).not.toHaveBeenCalled();
    });

    it("falls back to a correctly labelled JPEG when the requested WebP type comes back mismatched (the Safari PNG-substitution bug)", async () => {
      // This is the exact failure mode that produced the pre-existing production bug: toBlob is
      // asked for "image/webp" and returns a non-null blob, but its real type is "image/png".
      mockToBlob((type) => (type === "image/webp" ? "image/png" : "image/jpeg"));
      const canvas = document.createElement("canvas");

      const result = await encodeCanvasToBlob(canvas, "image/webp", 0.85, 0.9);

      expect(result.mimeType).toBe("image/jpeg");
      expect(result.blob.type).toBe("image/jpeg");
      expect(result.mimeType).not.toBe("image/png");
    });

    it("never returns a blob whose real type disagrees with the reported mimeType", async () => {
      mockToBlob((type) => (type === "image/webp" ? "image/png" : "image/jpeg"));
      const canvas = document.createElement("canvas");

      const result = await encodeCanvasToBlob(canvas, "image/webp", 0.85);

      expect(result.blob.type).toBe(result.mimeType);
    });

    it.each([0, 254])("preserves PNG when WebP is unavailable and a pixel has alpha %s", async (alpha) => {
      mockToBlob((type) => (type === "image/webp" ? "image/png" : type ?? "image/png"));
      const getImageData = mockPixelData(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, alpha]));
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 1;

      const result = await encodeCanvasToBlob(canvas, "image/webp", 0.85, 0.85, { preserveAlpha: true });

      expect(result.mimeType).toBe("image/png");
      expect(result.blob.type).toBe("image/png");
      expect(getImageData).toHaveBeenCalledWith(0, 0, 2, 1);
      expect(canvas.toBlob).toHaveBeenCalledTimes(1);
    });

    it("preserves PNG when WebP is unavailable and reading pixels throws", async () => {
      mockToBlob((type) => (type === "image/webp" ? "image/png" : type ?? "image/png"));
      mockPixelData().mockImplementation(() => {
        throw new DOMException("The canvas is tainted.", "SecurityError");
      });

      const result = await encodeCanvasToBlob(document.createElement("canvas"), "image/webp", 0.85, 0.85, {
        preserveAlpha: true,
      });

      expect(result.mimeType).toBe("image/png");
      expect(result.blob.type).toBe("image/png");
    });

    it("uses PNG for transparent pixels when explicitly preserving alpha with the JPEG fallback", async () => {
      mockToBlob((type) => type ?? "image/png");
      mockPixelData(new Uint8ClampedArray([255, 255, 255, 0]));

      const result = await encodeCanvasToBlob(document.createElement("canvas"), "image/jpeg", 0.9, 0.9, {
        preserveAlpha: true,
      });

      expect(result.mimeType).toBe("image/png");
      expect(result.blob.type).toBe("image/png");
    });

    it.each(["image/webp", "image/jpeg"] as const)("skips alpha inspection by default for %s", async (preferredType) => {
      mockToBlob((type) => (type === "image/webp" ? "image/png" : type ?? "image/png"));
      const getImageData = mockPixelData(new Uint8ClampedArray([0, 0, 0, 0]));

      const result = await encodeCanvasToBlob(document.createElement("canvas"), preferredType, 0.85);

      expect(result.mimeType).toBe("image/jpeg");
      expect(result.blob.type).toBe("image/jpeg");
      expect(getImageData).not.toHaveBeenCalled();
    });

    it.each([null, "image/webp"])("retries JPEG when PNG encoding returns %s", async (pngResultType) => {
      mockPixelData(new Uint8ClampedArray([0, 0, 0, 0]));
      mockToBlob((type) => {
        if (type === "image/webp") return null;
        if (type === "image/png") return pngResultType;
        return "image/jpeg";
      });
      const canvas = document.createElement("canvas");

      const result = await encodeCanvasToBlob(canvas, "image/webp", 0.85, 0.9, { preserveAlpha: true });

      expect(result.mimeType).toBe("image/jpeg");
      expect(result.blob.type).toBe("image/jpeg");
      expect(vi.mocked(canvas.toBlob).mock.calls.map(([, type]) => type)).toEqual([
        "image/webp",
        "image/png",
        "image/jpeg",
      ]);
      expect(canvas.toBlob).toHaveBeenLastCalledWith(expect.any(Function), "image/jpeg", 0.9);
    });

    it("throws when neither WebP nor the JPEG fallback can be encoded", async () => {
      mockToBlob(() => null);
      const canvas = document.createElement("canvas");

      await expect(encodeCanvasToBlob(canvas, "image/webp", 0.85)).rejects.toThrow(
        "Canvas failed to encode an image blob.",
      );
    });
  });

  describe("extensionForEncodedType", () => {
    it("maps WebP to webp, JPEG to jpg, and PNG to png", () => {
      expect(extensionForEncodedType("image/webp")).toBe("webp");
      expect(extensionForEncodedType("image/jpeg")).toBe("jpg");
      expect(extensionForEncodedType("image/png")).toBe("png");
    });
  });

  it("never logs a full image payload (data URL or blob) to the console", () => {
    const source = readFileSync(join(__dirname, "../canvasEncoding.ts"), "utf-8");
    expect(source).not.toMatch(/console\.log/);
  });
});
