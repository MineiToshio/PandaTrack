import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Vercel rejects request bodies over 4.5 MB with a raw 413 before the
      // action runs; 4 MB keeps our own readable validation error in front.
      bodySizeLimit: "4mb",
    },
  },
  // Forces libvips into every deployed function that can load sharp (image intake extraction,
  // avatar processing, store logo processing). Vercel's output file tracing (@vercel/nft) only
  // follows JS require/import edges; sharp's native addon (@img/sharp-linux-x64/lib/*.node) links
  // to @img/sharp-libvips-linux-x64/lib/libvips-cpp.so via dlopen at runtime, an edge nft cannot
  // see. Without this, the deployed function 500s with "ERR_DLOPEN_FAILED: libvips-cpp.so.*: cannot
  // open shared object file" at module load, before any application code or try/catch runs, so no
  // app-level error handling can catch it either. Found in production 2026-08-29 on
  // /orders/new/image; the darwin-arm64 package this repo uses locally is unaffected since it isn't
  // Vercel's linux-x64 builder, but keeping only the linux-x64 glob here is deliberate: nft
  // tolerates a glob that matches nothing on this machine, so there is no cost to including a
  // platform package that is absent locally, and no benefit to widening it past what the builder
  // actually needs. A broad route key is used (rather than one key per sharp-consuming page) because
  // Server Actions execute under the route of the page that submitted them, and sharp is imported
  // from three separate route trees (order image intake, settings/avatar, stores create/edit).
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/@img/sharp-libvips-linux-x64/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // Cloudflare R2 public bucket URLs (user avatars and other ASSETS_PUBLIC_BASE_URL hosts)
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "pandatrack",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Routes browser error reports through this app's own origin instead of letting them go straight
  // to `*.ingest.sentry.io`, which EasyPrivacy, uBlock Origin, Brave Shields and AdGuard all block
  // by default. Without it a client-side exception is dropped by the browser before it is ever
  // sent: no console error, no retry, and nothing in Sentry to find afterwards, which reads exactly
  // like "the error was never reported" rather than "the report was blocked". PostHog already
  // reaches this app through the first-party `/ingest/` rewrite above for the same reason; Sentry
  // was left un-tunnelled, so the two halves of the telemetry disagreed about what a user hit.
  //
  // The route must not collide with the proxy's matcher, which is `["/", "/(es|en)/:path*"]`
  // (`src/proxy.ts`): `/monitoring` carries no locale segment, so it does not match and the tunnel
  // reaches the Sentry rewrite intact. Keep that true if either the matcher or this path changes.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
