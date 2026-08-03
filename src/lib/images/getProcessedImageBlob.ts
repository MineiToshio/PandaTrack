"use client";

import { encodeCanvasToBlob, type EncodedCanvasResult } from "./canvasEncoding";
import type { ImageCropArea } from "./getCroppedImageDataUrl";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

export type ProcessedImageBlob = EncodedCanvasResult;

/**
 * Renders the crop area onto a canvas at the given output size and returns the encoded blob.
 * Used to produce the processed image that gets uploaded, avoiding server-side scaling.
 *
 * Requests WebP but verifies the encoder's real output type instead of trusting the request:
 * Safari's canvas encoder (iPhone and Mac) previously accepted the WebP request and silently
 * returned a PNG blob, which is how avatars and store logos ended up stored as PNG bytes under a
 * ".webp" filename. Falls back to a correctly labelled JPEG when that happens; callers must read
 * `mimeType` off the result rather than assuming WebP.
 */
export async function getProcessedImageBlob(
  src: string,
  cropArea: ImageCropArea,
  outputSize: number,
  quality = 0.92,
): Promise<ProcessedImageBlob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");

  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, outputSize, outputSize);

  return encodeCanvasToBlob(canvas, "image/webp", quality);
}
