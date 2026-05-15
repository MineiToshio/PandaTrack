/**
 * Base URL of the app for the current environment. Use for auth callbacks, redirects, or
 * any place that needs the request origin without relying on NEXT_PUBLIC_SITE_URL.
 *
 * Resolution order:
 *   1. `process.env.NEXT_PUBLIC_APP_URL` — explicit override for local dev when the port
 *      is non-default (e.g. LAN binding on `:3001`) or when serving from a tunnel.
 *   2. `process.env.VERCEL_URL` — production / preview deploys.
 *   3. `http://localhost:3000` — fallback for the standard local dev port.
 */
export function getAppBaseUrl(): string {
  const explicitAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicitAppUrl) return explicitAppUrl.replace(/\/$/, "");
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
