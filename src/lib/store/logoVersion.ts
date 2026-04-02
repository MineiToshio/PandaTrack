import { createHash } from "node:crypto";

export function getStoreLogoVersionToken(body: Buffer | Uint8Array): string {
  return createHash("sha1").update(body).digest("hex").slice(0, 12);
}

export function appendVersionTokenToAssetUrl(assetUrl: string, versionToken: string): string {
  const separator = assetUrl.includes("?") ? "&" : "?";
  return `${assetUrl}${separator}v=${versionToken}`;
}
