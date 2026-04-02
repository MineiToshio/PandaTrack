"use client";

import type { StoreLogoCropArea } from "@/lib/store/logo";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

export async function getCroppedImageDataUrl(src: string, cropArea: StoreLogoCropArea): Promise<string> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create canvas context.");
  }

  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL("image/webp", 0.9);
}
