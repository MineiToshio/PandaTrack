import * as Sentry from "@sentry/nextjs";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  getNotificationPreferences,
  getUserPushSubscriptions,
  hasNotificationBeenDelivered,
} from "@/lib/data/notifications/notificationQueries";
import {
  pruneExpiredPushSubscription,
  recordNotificationDelivery,
} from "@/lib/data/notifications/notificationMutations";
import { getAllReminderCandidates } from "@/lib/data/notifications/reminderCandidateQueries";
import { dispatchReminders, type DispatchRunSummary } from "@/lib/notifications/reminderDispatch";
import type { ReminderTranslator } from "@/lib/notifications/reminderPayload";
import { sendPushMessage } from "@/lib/push";
import { routing } from "@/i18n/routing";
import { isLocale } from "@/types/locale";

// web-push signs with Node crypto and the run is a scheduled batch, so it must never be
// cached or run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BEARER_PREFIX = "Bearer ";
/** Stable non-PII distinct id for the server-side dispatch run event. */
const DISPATCH_DISTINCT_ID = "notification-dispatcher";

/**
 * Validates the `CRON_SECRET` bearer before any query or send. Fails closed: a request
 * is rejected when the secret is unset, the header is missing, or the token does not match
 * (`FR-09-20`, `AC-09-08`).
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `${BEARER_PREFIX}${secret}`;
}

/** Resolves a candidate's nullable locale to a concrete supported locale. */
function resolveReminderLocale(locale: string | null): string {
  return locale && isLocale(locale) ? locale : routing.defaultLocale;
}

async function loadTranslator(locale: string): Promise<ReminderTranslator> {
  const t = await getTranslations({ locale, namespace: "notifications" });
  return (key, values) => t(key, values);
}

/** Flattens the run summary into analytics-safe, snake_case, count-only properties. */
function toAnalyticsProperties(summary: DispatchRunSummary): Record<string, number> {
  const { totals, byType } = summary;
  return {
    attempted: totals.attempted,
    sent: totals.sent,
    deduped: totals.deduped,
    pruned: totals.pruned,
    transient_failures: totals.transientFailures,
    payment_due_sent: byType.PAYMENT_DUE.sent,
    arrival_due_sent: byType.ARRIVAL_DUE.sent,
    arrival_overdue_sent: byType.ARRIVAL_OVERDUE.sent,
  };
}

async function runDispatch(): Promise<DispatchRunSummary> {
  return dispatchReminders({
    now: new Date(),
    loadCandidates: getAllReminderCandidates,
    getPreferences: getNotificationPreferences,
    getSubscriptions: async (userId) => {
      const subscriptions = await getUserPushSubscriptions(userId);
      return subscriptions.map((subscription) => ({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      }));
    },
    hasBeenDelivered: hasNotificationBeenDelivered,
    recordDelivery: recordNotificationDelivery,
    sendPush: sendPushMessage,
    pruneSubscription: pruneExpiredPushSubscription,
    getTranslator: loadTranslator,
    resolveLocale: resolveReminderLocale,
  });
}

/**
 * Scheduled reminder dispatch entry point. Guarded by the `CRON_SECRET` bearer, it runs
 * the timezone-aware, deduplicated dispatcher and returns the run summary. An unexpected
 * failure is captured once with Sentry (no subscriber payloads) and returns `500`; the
 * run summary is also reported to PostHog for observability.
 */
async function handleDispatch(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const summary = await runDispatch();

    getPostHogClient().capture({
      distinctId: DISPATCH_DISTINCT_ID,
      event: POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATION_DISPATCH_RUN,
      properties: toAnalyticsProperties(summary),
    });

    return NextResponse.json(summary);
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "notifications");
      scope.setTag("route", "/api/notifications/dispatch");
      scope.setTag("severity", "high");
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "DISPATCH_FAILED" }, { status: 500 });
  }
}

/** Vercel Cron issues a GET with the `Authorization: Bearer ${CRON_SECRET}` header. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleDispatch(request);
}

/** POST is accepted for manual or programmatic invocation with the same guard. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleDispatch(request);
}
