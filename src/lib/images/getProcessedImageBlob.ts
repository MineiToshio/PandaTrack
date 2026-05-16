"use client";

import type { ImageCropArea } from "./getCroppedImageDataUrl";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

/**
 * Renders the crop area onto a canvas at the given output size and returns a WebP Blob.
 * Used to produce the processed image that gets uploaded, avoiding server-side scaling.
 */
export async function getProcessedImageBlob(
  src: string,
  cropArea: ImageCropArea,
  outputSize: number,
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");

  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, outputSize, outputSize);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create image blob."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}
