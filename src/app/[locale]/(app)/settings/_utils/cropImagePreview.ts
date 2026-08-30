import type { AvatarCropArea } from "@/lib/user/avatarShared";

/**
 * Synchronously renders the selected crop area of an already-loaded image onto a canvas and
 * returns a fresh object URL for the result.
 *
 * Used to build the settings avatar modal's optimistic preview: the URL this returns is backed
 * by its own `Blob`, independent from the editor's source object URL (which the modal revokes
 * when it closes). Ownership of the returned URL transfers to the caller, which must revoke it
 * once it is no longer shown (on reconciliation with the server result, or on rollback).
 *
 * Returns `null` when canvas rendering isn't available (should not happen in supported browsers).
 */
export function createCroppedPreviewUrl(image: HTMLImageElement, area: AvatarCropArea): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  const blob = dataUrlToBlob(canvas.toDataURL("image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}

/** Decodes a `data:` URL into a `Blob` synchronously, without a network round trip. */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  if (!mimeMatch || !base64) return null;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeMatch[1] });
}
