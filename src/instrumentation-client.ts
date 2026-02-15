// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://7807ffe2c7570780a1ccdf48bfb2db23@o4510888167866368.ingest.us.sentry.io/4510888169177088",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// PostHog analytics initialization
// https://posthog.com/docs/libraries/next-js
import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2025-11-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
});

type PosthogClickDelegateOptions = {
  /** Attribute containing the PostHog event name (e.g. "landing_cta_clicked"). */
  eventAttribute: string;
  /** Attribute containing JSON-serialized event properties. Must be a JSON object. */
  propsAttribute: string;
  /** Attribute selector used to find the nearest element to track. */
  selector: string;
  /** Global guard key to prevent double registration (e.g. during HMR). */
  globalGuardKey: string;
};

const POSTHOG_CLICK_DELEGATE_OPTIONS: PosthogClickDelegateOptions = {
  eventAttribute: "data-ph-event",
  propsAttribute: "data-ph-props",
  selector: "[data-ph-event]",
  globalGuardKey: "__pandatrack_posthog_click_delegate_registered__",
};

function parsePosthogProps(rawProps: string | null): Record<string, unknown> | undefined {
  if (!rawProps) return undefined;

  try {
    const parsed = JSON.parse(rawProps) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function registerPosthogClickDelegate(options: PosthogClickDelegateOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const globalWindow = window as unknown as Record<string, unknown>;
  if (globalWindow[options.globalGuardKey]) return;
  globalWindow[options.globalGuardKey] = true;

  document.addEventListener(
    "click",
    (event) => {
      if ("button" in event && typeof event.button === "number" && event.button !== 0) return;

      const target = event.target as HTMLElement | null;
      const elementToTrack = target?.closest?.(options.selector) as HTMLElement | null;
      if (!elementToTrack) return;

      const eventName = elementToTrack.getAttribute(options.eventAttribute);
      if (!eventName) return;

      const rawProps = elementToTrack.getAttribute(options.propsAttribute);
      const eventProps = parsePosthogProps(rawProps);

      posthog.capture(eventName, eventProps);
    },
    { capture: true },
  );
}

registerPosthogClickDelegate(POSTHOG_CLICK_DELEGATE_OPTIONS);
