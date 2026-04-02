import "server-only";

import sharp from "sharp";
import {
  isAcceptedStoreLogoMimeType,
  STORE_LOGO_MAX_SOURCE_SIZE_BYTES,
  STORE_LOGO_OUTPUT_SIZE_PX,
  type StoreLogoCropArea,
} from "@/lib/store/logoShared";

export {
  getPendingStoreLogoObjectKey,
  getStoreLogoObjectKey,
  parseStoreLogoCropArea,
  STORE_LOGO_ACCEPTED_MIME_TYPES,
  STORE_LOGO_MAX_SOURCE_SIZE_BYTES,
  STORE_LOGO_OUTPUT_CONTENT_TYPE,
  type StoreLogoAction,
  type StoreLogoCropArea,
} from "@/lib/store/logoShared";

export class StoreLogoError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "StoreLogoError";
  }
}

function clampCropArea(area: StoreLogoCropArea, sourceWidth: number, sourceHeight: number): StoreLogoCropArea {
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

export async function processStoreLogoFile(file: File, cropArea: StoreLogoCropArea): Promise<Buffer> {
  if (!isAcceptedStoreLogoMimeType(file.type)) {
    throw new StoreLogoError("logoInvalidType");
  }

  if (file.size <= 0) {
    throw new StoreLogoError("logoMalformed");
  }

  if (file.size > STORE_LOGO_MAX_SOURCE_SIZE_BYTES) {
    throw new StoreLogoError("logoTooLarge");
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const image = sharp(inputBuffer, { failOn: "error" });
  let metadata;

  try {
    metadata = await image.metadata();
  } catch (error) {
    throw new StoreLogoError("logoMalformed", error instanceof Error ? error.message : undefined);
  }

  if (!metadata.width || !metadata.height) {
    throw new StoreLogoError("logoMalformed");
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
      .resize(STORE_LOGO_OUTPUT_SIZE_PX, STORE_LOGO_OUTPUT_SIZE_PX, {
        fit: "cover",
        position: "centre",
      })
      .webp({
        quality: 82,
      })
      .toBuffer();
  } catch (error) {
    throw new StoreLogoError("logoProcessingFailed", error instanceof Error ? error.message : undefined);
  }
}
