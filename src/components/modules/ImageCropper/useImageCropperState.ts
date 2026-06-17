"use client";

import { useCallback, useState } from "react";
import type { Area, Point } from "react-easy-crop";

const DEFAULT_CROP: Point = { x: 0, y: 0 };
const DEFAULT_ZOOM = 1;

export type ImageCropperState = {
  crop: Point;
  zoom: number;
  croppedAreaPixels: Area | null;
};

export type UseImageCropperState = ImageCropperState & {
  setCrop: (crop: Point) => void;
  setZoom: (zoom: number) => void;
  /** Wire to react-easy-crop's `onCropComplete` to capture the final crop area. */
  handleCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
  /** Reset all state to defaults. Call when closing the editor. */
  reset: () => void;
};

/**
 * Headless state hook for image cropping workflows. Pairs with the
 * `<CropperBody>` component (or a custom shell) to drive `react-easy-crop`.
 *
 * Consumers own the modal, dropzone, submission, and post-processing — this
 * hook only tracks crop position, zoom, and the final cropped-area pixels.
 */
export function useImageCropperState(): UseImageCropperState {
  const [crop, setCrop] = useState<Point>(DEFAULT_CROP);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const reset = useCallback(() => {
    setCrop(DEFAULT_CROP);
    setZoom(DEFAULT_ZOOM);
    setCroppedAreaPixels(null);
  }, []);

  return {
    crop,
    zoom,
    croppedAreaPixels,
    setCrop,
    setZoom,
    handleCropComplete,
    reset,
  };
}
