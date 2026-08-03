"use client";

/**
 * Real canvas image-encoder detection and verified encoding.
 *
 * Some engines (Safari's WebKit canvas encoder, on both iPhone and Mac) accept a WebP encode
 * request and silently hand back a differently-typed blob instead of failing or omitting the
 * type, so user-agent sniffing or trusting the requested type is not reliable. The only
 * trustworthy signal is the actual type the encoder reports back on the produced output, which
 * is what every helper in this module checks.
 */

export type SupportedEncodedImageType = "image/webp" | "image/jpeg";

export type EncodedCanvasResult = {
  blob: Blob;
  mimeType: SupportedEncodedImageType;
};

let webpSupportCache: boolean | null = null;

/**
 * Returns whether the current browser's canvas encoder can actually produce WebP output.
 * Probes with `toDataURL` (synchronous, unlike `toBlob`) against a throwaway 1x1 canvas and reads
 * back the data URL's declared type: engines without a WebP encoder substitute PNG here instead
 * of throwing, so the declared type is the only trustworthy signal. Cached for the session
 * because encoder support cannot change while the page is open, and this may be called once per
 * image segment during a multi-photo submission.
 */
export function supportsWebpEncoding(): boolean {
  if (webpSupportCache !== null) {
    return webpSupportCache;
  }

  if (typeof document === "undefined") {
    webpSupportCache = false;
    return webpSupportCache;
  }

  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = 1;
  probeCanvas.height = 1;

  const dataUrl = probeCanvas.toDataURL("image/webp");
  webpSupportCache = dataUrl.startsWith("data:image/webp");
  return webpSupportCache;
}

/** Test-only: clears the cached encoder-support result so each test starts from a clean probe. */
export function resetEncoderSupportCache(): void {
  webpSupportCache = null;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Encodes a canvas to a blob and verifies the real type the encoder produced, rather than
 * trusting `preferredType`. If the verified type does not match what was requested, retries with
 * JPEG. Never returns a blob whose `type` disagrees with the `mimeType` it reports, which is the
 * exact mismatch that previously let Safari's silent PNG substitution reach callers that assumed
 * a WebP blob because that is what they asked for.
 *
 * `quality` applies to the requested `preferredType`; `fallbackQuality` (defaults to `quality`)
 * applies to the JPEG retry, so a caller that wants distinct WebP/JPEG qualities can pass both.
 */
export async function encodeCanvasToBlob(
  canvas: HTMLCanvasElement,
  preferredType: SupportedEncodedImageType,
  quality: number,
  fallbackQuality: number = quality,
): Promise<EncodedCanvasResult> {
  if (preferredType === "image/webp") {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (blob && blob.type === "image/webp") {
      return { blob, mimeType: "image/webp" };
    }
  }

  const jpegQuality = preferredType === "image/webp" ? fallbackQuality : quality;
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", jpegQuality);
  if (!jpegBlob || jpegBlob.type !== "image/jpeg") {
    throw new Error("Canvas failed to encode an image blob.");
  }

  return { blob: jpegBlob, mimeType: "image/jpeg" };
}

/** Maps a verified encoded type to the file extension callers should use, instead of hardcoding one. */
export function extensionForEncodedType(mimeType: SupportedEncodedImageType): "webp" | "jpg" {
  return mimeType === "image/webp" ? "webp" : "jpg";
}
