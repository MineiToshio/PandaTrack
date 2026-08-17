import { z } from "zod";
import { CLOUDFLARE_ASSET_ROUTES } from "@/lib/constants";

export const STORE_LOGO_MAX_SOURCE_SIZE_BYTES = 4 * 1024 * 1024;
export const STORE_LOGO_MAX_SOURCE_SIZE_MB = STORE_LOGO_MAX_SOURCE_SIZE_BYTES / (1024 * 1024);
export const STORE_LOGO_MAX_PROCESSED_SIZE_BYTES = 1 * 1024 * 1024;
export const STORE_LOGO_OUTPUT_SIZE_PX = 512;
export const STORE_LOGO_OUTPUT_CONTENT_TYPE = "image/webp";
export const STORE_LOGO_ACCEPTED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const storeLogoActionSchema = z.enum(["keep", "set", "remove"]);

export type StoreLogoAction = z.infer<typeof storeLogoActionSchema>;

export function getStoreLogoObjectKey(storeId: string): string {
  return `${CLOUDFLARE_ASSET_ROUTES.STORE_LOGOS}/${storeId}.webp`;
}

export function getPendingStoreLogoObjectKey(storeId: string, userId: string): string {
  return `${CLOUDFLARE_ASSET_ROUTES.STORE_LOGOS_PENDING}/${storeId}-${userId}.webp`;
}

export function isAcceptedStoreLogoMimeType(value: string): value is (typeof STORE_LOGO_ACCEPTED_MIME_TYPES)[number] {
  return STORE_LOGO_ACCEPTED_MIME_TYPES.includes(value as (typeof STORE_LOGO_ACCEPTED_MIME_TYPES)[number]);
}

