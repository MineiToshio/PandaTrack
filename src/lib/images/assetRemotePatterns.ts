import { normalizeAssetsPublicBaseUrl } from "./assetsPublicBaseUrl";

type RemotePattern = {
  protocol: "https" | "http";
  hostname: string;
};

/**
 * Hosts `next/image` may optimize for persisted assets (store logos, user avatars).
 *
 * Every stored asset URL is built from `ASSETS_PUBLIC_BASE_URL`, and that base differs per
 * environment: dev serves from the bucket's `*.r2.dev` URL, production from a custom domain. A
 * host missing here makes Vercel's optimizer answer 400 `INVALID_IMAGE_OPTIMIZE_REQUEST`, so a
 * logo upload that succeeded renders as a broken image. Deriving the host from the same variable
 * (and the same normalization) the upload uses keeps both sides in lockstep.
 *
 * Imported by `next.config.ts` through a relative path, so it must stay free of `@/` aliases.
 */
export function getAssetRemotePatterns(publicBaseUrl: string | undefined): RemotePattern[] {
  const patterns: RemotePattern[] = [{ protocol: "https", hostname: "*.r2.dev" }];

  const normalized = normalizeAssetsPublicBaseUrl(publicBaseUrl);
  if (!normalized) {
    return patterns;
  }

  const url = new URL(normalized);
  const protocol = url.protocol === "https:" ? "https" : "http";
  if (!patterns.some((pattern) => pattern.hostname === url.hostname && pattern.protocol === protocol)) {
    patterns.push({ protocol, hostname: url.hostname });
  }

  return patterns;
}
