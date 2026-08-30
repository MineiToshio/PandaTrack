import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createR2RequestHandler } from "@/lib/r2RequestHandler";
import { STORE_LOGO_OUTPUT_CONTENT_TYPE } from "@/lib/store/logoShared";
import { appendVersionTokenToAssetUrl, getStoreLogoVersionToken } from "@/lib/store/logoVersion";

type StoreLogoStorageConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: StoreLogoStorageConfig | null = null;

function getStoreLogoStorageConfig(): StoreLogoStorageConfig {
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

  cachedConfig = {
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };

  return cachedConfig;
}

function getStoreLogoStorageClient(): { client: S3Client; config: StoreLogoStorageConfig } {
  const config = getStoreLogoStorageConfig();

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestHandler: createR2RequestHandler(),
    });
  }

  return {
    client: cachedClient,
    config,
  };
}

export function getStoreLogoPublicUrl(objectKey: string): string {
  const { config } = getStoreLogoStorageClient();
  return `${config.publicBaseUrl}/${objectKey}`;
}

export async function uploadStoreLogoBuffer(objectKey: string, body: Buffer): Promise<string> {
  const { client, config } = getStoreLogoStorageClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: body,
      ContentType: STORE_LOGO_OUTPUT_CONTENT_TYPE,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return appendVersionTokenToAssetUrl(getStoreLogoPublicUrl(objectKey), getStoreLogoVersionToken(body));
}

export async function deleteStoreLogoObject(objectKey: string): Promise<void> {
  const { client, config } = getStoreLogoStorageClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
  );
}
