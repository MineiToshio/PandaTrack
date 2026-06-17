import "server-only";

import sharp from "sharp";
import {
  isAcceptedStoreLogoMimeType,
  STORE_LOGO_MAX_PROCESSED_SIZE_BYTES,
  STORE_LOGO_OUTPUT_SIZE_PX,
} from "@/lib/store/logoShared";

export {
  getPendingStoreLogoObjectKey,
  getStoreLogoObjectKey,
  STORE_LOGO_ACCEPTED_MIME_TYPES,
  STORE_LOGO_MAX_SOURCE_SIZE_BYTES,
  STORE_LOGO_OUTPUT_CONTENT_TYPE,
  type StoreLogoAction,
} from "@/lib/store/logoShared";

export class StoreLogoError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "StoreLogoError";
  }
}

/**
 * Validates and normalizes a pre-processed logo file sent from the client.
 * The client already cropped and resized to STORE_LOGO_OUTPUT_SIZE_PX — Sharp
 * just ensures a consistent WebP output without re-scaling.
 */
export async function processStoreLogoFile(file: File): Promise<Buffer> {
  if (!isAcceptedStoreLogoMimeType(file.type)) {
    throw new StoreLogoError("logoInvalidType");
  }

  if (file.size <= 0) {
    throw new StoreLogoError("logoMalformed");
  }

  if (file.size > STORE_LOGO_MAX_PROCESSED_SIZE_BYTES) {
    throw new StoreLogoError("logoTooLarge");
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  try {
    return await sharp(inputBuffer, { failOn: "error" })
      .resize(STORE_LOGO_OUTPUT_SIZE_PX, STORE_LOGO_OUTPUT_SIZE_PX, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    throw new StoreLogoError("logoProcessingFailed", error instanceof Error ? error.message : undefined);
  }
}
