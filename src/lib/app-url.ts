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
