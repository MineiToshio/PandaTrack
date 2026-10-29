/**
 * Normalizes `ASSETS_PUBLIC_BASE_URL` into an absolute `http(s)` origin (plus optional path) with
 * no trailing slash, or `undefined` when it is missing or unusable.
 *
 * A bare host (`assets.example.com`) is accepted and gets `https://`. Without that, every stored
 * asset URL is scheme-less, the browser resolves it relative to the current page, and an upload
 * that succeeded renders as a broken image.
 *
 * Imported by `next.config.ts` through a relative path, so it must stay free of `@/` aliases.
 */
export function normalizeAssetsPublicBaseUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return undefined;
  }

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return undefined;
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
