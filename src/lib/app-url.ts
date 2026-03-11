/**
 * Base URL of the app for the current environment. Use for auth callbacks, redirects, or
 * any place that needs the request origin without relying on NEXT_PUBLIC_SITE_URL.
 * - Local: http://localhost:3000
 * - Vercel: https://${VERCEL_URL}
 */
export function getAppBaseUrl(): string {
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

/**
 * Public site URL for assets that must be reachable outside the local runtime,
 * such as email images opened in external clients.
 */
export function getPublicSiteUrl(): string {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (explicitSiteUrl) {
    return explicitSiteUrl.replace(/\/$/, "");
  }

  return getAppBaseUrl();
}
