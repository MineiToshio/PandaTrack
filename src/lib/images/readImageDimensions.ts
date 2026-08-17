"use client";

/** Decoded pixel size of a picked file, as the browser sees it (EXIF orientation already applied). */
export type ImageDimensions = {
  width: number;
  height: number;
};

/**
 * How long a measurement may take before it is abandoned.
 *
 * The image is one the browser is already showing as a thumbnail, so this is generous by an order of
 * magnitude and exists only so a decode that never settles (a truncated file, an engine that fires
 * neither `load` nor `error`) cannot leave a promise pending for the life of the screen.
 */
const MEASURE_TIMEOUT_MS = 5_000;

/**
 * Measures an already-attached photo from the object URL its preview is drawn with.
 *
 * Deliberately takes the URL rather than the `File`: the attach surface has created that URL
 * already, so measuring costs no second object URL, no second decode of bytes the browser has in
 * hand, and no bookkeeping about who revokes what. The caller owns the URL's lifetime exactly as it
 * did before.
 *
 * Resolves `null` for anything it cannot measure instead of rejecting. An undecodable file is a real
 * outcome of this flow (an HEIC that slipped past the picker, a truncated download), and it belongs
 * to the compression step's own error rather than to a dimension check that would otherwise have to
 * invent a verdict about pixels it never saw. Silence is never an acceptance: the server's
 * `validateUploadedImages` stays the authority on what is read.
 */
export function readImageDimensionsFromUrl(objectUrl: string): Promise<ImageDimensions | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof window.Image !== "function") {
      resolve(null);
      return;
    }

    let settled = false;
    const settle = (dimensions: ImageDimensions | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(dimensions);
    };

    const timer = window.setTimeout(() => settle(null), MEASURE_TIMEOUT_MS);

    const image = new window.Image();
    image.onload = () => {
      const { naturalWidth, naturalHeight } = image;
      settle(naturalWidth > 0 && naturalHeight > 0 ? { width: naturalWidth, height: naturalHeight } : null);
    };
    image.onerror = () => settle(null);
    image.src = objectUrl;
  });
}
