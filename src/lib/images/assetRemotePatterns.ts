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
 * the upload uses keeps both sides in lockstep instead of relying on a hand-kept list.
 *
 * Imported by `next.config.ts` through a relative path, so it must stay free of `@/` aliases.
 */
export function getAssetRemotePatterns(publicBaseUrl: string | undefined): RemotePattern[] {
  const patterns: RemotePattern[] = [{ protocol: "https", hostname: "*.r2.dev" }];

  const trimmed = publicBaseUrl?.trim();
  if (!trimmed) {
    return patterns;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return patterns;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return patterns;
  }

  const protocol = url.protocol === "https:" ? "https" : "http";
  if (!patterns.some((pattern) => pattern.hostname === url.hostname && pattern.protocol === protocol)) {
    patterns.push({ protocol, hostname: url.hostname });
  }

  return patterns;
}
