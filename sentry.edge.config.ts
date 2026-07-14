// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // The DSN is a public identifier (it ships in the client bundle), not a secret. It is read
  // from the environment so it can differ per deployment, with the current project DSN kept as a
  // fallback so initialization never breaks when the variable is unset.
  dsn:
    process.env.SENTRY_DSN ??
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://7807ffe2c7570780a1ccdf48bfb2db23@o4510888167866368.ingest.us.sentry.io/4510888169177088",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Keep default PII disabled: it would attach request headers (including
  // session cookies) to captured events.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
});
