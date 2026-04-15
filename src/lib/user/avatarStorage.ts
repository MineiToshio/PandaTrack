import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CLOUDFLARE_ASSET_ROUTES } from "@/lib/constants";
import { AVATAR_OUTPUT_CONTENT_TYPE } from "@/lib/user/avatarShared";

type AssetStorageConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: AssetStorageConfig | null = null;

function getAssetStorageConfig(): AssetStorageConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const bucket = process.env.ASSETS_STORAGE_BUCKET?.trim();
  const endpoint = process.env.ASSETS_STORAGE_ENDPOINT?.trim();
  const region = process.env.ASSETS_STORAGE_REGION?.trim();
  const accessKeyId = process.env.ASSETS_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.ASSETS_STORAGE_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.ASSETS_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");

  if (!bucket || !endpoint || !region || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new Error("Assets storage is not configured.");
  }

  cachedConfig = { bucket, endpoint, region, accessKeyId, secretAccessKey, publicBaseUrl };
  return cachedConfig;
}

function getAssetStorageClient(): { client: S3Client; config: AssetStorageConfig } {
  const config = getAssetStorageConfig();

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return { client: cachedClient, config };
}

/**
 * Returns the stable R2 object key for a user-managed avatar.
 * Replacements overwrite the same key so no versioned keys accumulate in MVP.
 */
export function getUserAvatarObjectKey(userId: string): string {
  return `${CLOUDFLARE_ASSET_ROUTES.USER_IMAGES}/${userId}.webp`;
}

function getAvatarPublicUrl(objectKey: string): string {
  const { config } = getAssetStorageClient();
  return `${config.publicBaseUrl}/${objectKey}`;
}

/**
 * Uploads an avatar buffer to R2 and returns the public URL.
 * The URL uses a cache-buster timestamp so browsers fetch the latest version after a replacement.
 */
export async function uploadUserAvatarBuffer(userId: string, body: Buffer): Promise<string> {
  const { client, config } = getAssetStorageClient();
  const objectKey = getUserAvatarObjectKey(userId);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: body,
      ContentType: AVATAR_OUTPUT_CONTENT_TYPE,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const cacheBuster = Date.now();
  return `${getAvatarPublicUrl(objectKey)}?v=${cacheBuster}`;
}

/**
 * Deletes the user's avatar object from R2.
 * Callers must handle errors independently - a deletion failure must not revert the User.image clear.
 */
export async function deleteUserAvatarObject(userId: string): Promise<void> {
  const { client, config } = getAssetStorageClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: getUserAvatarObjectKey(userId),
    }),
  );
}
