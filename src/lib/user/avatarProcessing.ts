import "server-only";

import sharp from "sharp";
import {
  isAcceptedAvatarMimeType,
  AVATAR_MAX_SOURCE_SIZE_BYTES,
  AVATAR_OUTPUT_SIZE_PX,
  type AvatarCropArea,
} from "@/lib/user/avatarShared";

export {
  AVATAR_ACCEPTED_MIME_TYPES,
  AVATAR_MAX_SOURCE_SIZE_BYTES,
  AVATAR_MAX_SOURCE_SIZE_MB,
  AVATAR_OUTPUT_CONTENT_TYPE,
  isAcceptedAvatarMimeType,
  type AvatarCropArea,
} from "@/lib/user/avatarShared";

export class AvatarProcessingError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AvatarProcessingError";
  }
}

function clampCropArea(area: AvatarCropArea, sourceWidth: number, sourceHeight: number): AvatarCropArea {
  const width = Math.min(area.width, sourceWidth);
  const height = Math.min(area.height, sourceHeight);
  const x = Math.min(area.x, Math.max(sourceWidth - width, 0));
  const y = Math.min(area.y, Math.max(sourceHeight - height, 0));

  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

/**
 * Processes an uploaded avatar file: validates type/size, crops, resizes to output size,
 * and encodes as WebP. Returns a Buffer ready for storage.
 */
export async function processAvatarFile(file: File, cropArea: AvatarCropArea): Promise<Buffer> {
  if (!isAcceptedAvatarMimeType(file.type)) {
    throw new AvatarProcessingError("avatarInvalidType");
  }

  if (file.size <= 0) {
    throw new AvatarProcessingError("avatarMalformed");
  }

  if (file.size > AVATAR_MAX_SOURCE_SIZE_BYTES) {
    throw new AvatarProcessingError("avatarTooLarge");
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const image = sharp(inputBuffer, { failOn: "error" });
  let metadata;

  try {
    metadata = await image.metadata();
  } catch (error) {
    throw new AvatarProcessingError("avatarMalformed", error instanceof Error ? error.message : undefined);
  }

  if (!metadata.width || !metadata.height) {
    throw new AvatarProcessingError("avatarMalformed");
  }

  const normalizedCropArea = clampCropArea(cropArea, metadata.width, metadata.height);

  try {
    return await image
      .extract({
        left: normalizedCropArea.x,
        top: normalizedCropArea.y,
        width: normalizedCropArea.width,
        height: normalizedCropArea.height,
      })
      .resize(AVATAR_OUTPUT_SIZE_PX, AVATAR_OUTPUT_SIZE_PX, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    throw new AvatarProcessingError("avatarProcessingFailed", error instanceof Error ? error.message : undefined);
  }
}
