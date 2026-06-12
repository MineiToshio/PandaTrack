"use client";

import "react-easy-crop/react-easy-crop.css";

import Cropper, { type Point } from "react-easy-crop";
import Label from "@/components/core/Label";
import { cn } from "@/lib/styles";

export type CropperShape = "round" | "rect";

export type CropperBodyProps = {
  /** Object URL or data URL of the source image being cropped. */
  imageUrl: string;
  /** Current crop offset (in display pixels). */
  crop: Point;
  /** Current zoom (>= 1). */
  zoom: number;
  /** Crop area shape — circular for avatars, rectangular for logos/covers. */
  shape: CropperShape;
  /** Display label for the zoom slider. */
  zoomLabel: string;
  /** Stable id used to associate the zoom range input with its label. */
  id: string;
  /** Disable interactions while the parent is committing the crop. */
  disabled?: boolean;
  /** Optional className for the outer wrapper. */
  className?: string;
  onCropChange: (crop: Point) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (
    croppedArea: import("react-easy-crop").Area,
    croppedAreaPixels: import("react-easy-crop").Area,
  ) => void;
};

/**
 * Headless cropper UI body: a `react-easy-crop` canvas + a zoom range slider.
 *
 * Consumers compose this inside their own modal/sheet/dropzone shell. The
 * component does NOT own state — pair it with `useImageCropperState` or your
 * own controlled state.
 *
 * Mirrors the canonical headless pattern used by Atlassian Atlaskit (`ImageCropper`
 * inside `AvatarPickerDialog`) and Zag.js (`image-cropper` machine with shape variant).
 */
export default function CropperBody({
  imageUrl,
  crop,
  zoom,
  shape,
  zoomLabel,
  id,
  disabled = false,
  className,
  onCropChange,
  onZoomChange,
  onCropComplete,
}: CropperBodyProps) {
  return (
    <div className={cn("space-y-5", className)} data-shape={shape}>
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] [background:var(--surface)]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape={shape}
          showGrid={false}
          objectFit="contain"
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-zoom`}>{zoomLabel}</Label>
        <input
          id={`${id}-zoom`}
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          className="w-full [accent-color:var(--accent)]"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
