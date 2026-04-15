export const AVATAR_ACCEPTED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const AVATAR_MAX_SOURCE_SIZE_BYTES = 10 * 1024 * 1024;
export const AVATAR_MAX_SOURCE_SIZE_MB = AVATAR_MAX_SOURCE_SIZE_BYTES / (1024 * 1024);
export const AVATAR_OUTPUT_SIZE_PX = 512;
export const AVATAR_OUTPUT_CONTENT_TYPE = "image/webp";

export type AvatarCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function isAcceptedAvatarMimeType(value: string): value is (typeof AVATAR_ACCEPTED_MIME_TYPES)[number] {
  return AVATAR_ACCEPTED_MIME_TYPES.includes(value as (typeof AVATAR_ACCEPTED_MIME_TYPES)[number]);
}

/** Treats empty strings like null so UI state matches persisted profile image. */
export function normalizeProfileImageUrl(url: string | null | undefined): string | null {
  if (url == null) {
    return null;
  }
  const trimmed = url.trim();
  return trimmed === "" ? null : trimmed;
}
