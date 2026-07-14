"use server";

import * as Sentry from "@sentry/nextjs";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/auth-server";
import {
  notificationPreferenceInputSchema,
  pushSubscriptionSchema,
  type NotificationPreferenceInput,
  type PushSubscriptionInput,
} from "@/lib/notifications/notificationValidation";
import {
  pruneExpiredPushSubscription,
  removePushSubscription,
  setNotificationPreference,
  upsertPushSubscription,
} from "@/lib/data/notifications/notificationMutations";
import { getUserPushSubscriptions } from "@/lib/data/notifications/notificationQueries";
import { sendPushMessage, type PushMessagePayload } from "@/lib/push";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { routing } from "@/i18n/routing";
import { isLocale } from "@/types/locale";

/** Shared unauthenticated outcome for every notification action. */
type UnauthorizedResult = { ok: false; error: "unauthorized" };

export type SubscribeToPushResult =
  { ok: true } | UnauthorizedResult | { ok: false; error: "SUBSCRIPTION_INVALID" } | { ok: false; error: "generic" };

/**
 * Persists this browser's push subscription for the session collector, upserting by
 * `endpoint` so re-enabling from the same browser never creates a duplicate row
 * (`FR-09-07`, `FR-09-10`). The payload is validated with the shared Zod schema at the
 * boundary; malformed input is rejected as `SUBSCRIPTION_INVALID` without touching the
 * database. The `notifications_enabled` analytics event fires client-side.
 */
export async function subscribeToPushAction(input: PushSubscriptionInput): Promise<SubscribeToPushResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "SUBSCRIPTION_INVALID" };
  }

  try {
    await upsertPushSubscription(session.user.id, parsed.data);
    return { ok: true };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "subscribeToPushAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}

export type UnsubscribeFromPushResult =
  { ok: true } | UnauthorizedResult | { ok: false; error: "SUBSCRIPTION_NOT_FOUND" } | { ok: false; error: "generic" };

/**
 * Removes this browser's server-side subscription so the dispatcher stops targeting it
 * (`FR-09-09`). Scoped to the session collector by endpoint ownership. An endpoint that is
 * not on file returns `SUBSCRIPTION_NOT_FOUND` so the client can reconcile its state. The
 * `notifications_disabled` analytics event fires client-side.
 */
export async function unsubscribeFromPushAction(endpoint: string): Promise<UnsubscribeFromPushResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  try {
    const subscriptions = await getUserPushSubscriptions(session.user.id);
    const owned = subscriptions.some((subscription) => subscription.endpoint === endpoint);
    if (!owned) {
      return { ok: false, error: "SUBSCRIPTION_NOT_FOUND" };
    }

    await removePushSubscription(session.user.id, endpoint);
    return { ok: true };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "unsubscribeFromPushAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}

export type SetNotificationPreferenceResult =
  { ok: true } | UnauthorizedResult | { ok: false; error: "validation" } | { ok: false; error: "generic" };

/**
 * Sets a single per-type reminder preference for the session collector (`FR-09-08`).
 * Unspecified types keep their stored value. The `notification_type_toggled` analytics
 * event fires client-side.
 */
export async function setNotificationPreferenceAction(
  input: NotificationPreferenceInput,
): Promise<SetNotificationPreferenceResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = notificationPreferenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  try {
    await setNotificationPreference(session.user.id, parsed.data.type, parsed.data.enabled);
    return { ok: true };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "setNotificationPreferenceAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}

export type SendTestNotificationResult =
  | { ok: true; sent: number; expired: number; failed: number }
  | UnauthorizedResult
  | { ok: false; error: "SUBSCRIPTION_NOT_FOUND" }
  | { ok: false; error: "generic" };

/**
 * Delivers one localized test push to the collector's own active subscriptions so they can
 * confirm the channel works (`FR-09-11`). Classifies each send, prunes any endpoint the push
 * service reports as expired (`410`/`404`), and reports a per-outcome summary. The
 * `notification_test_sent` analytics event fires here because the send truth lives server-side.
 */
export async function sendTestNotificationAction(locale: string): Promise<SendTestNotificationResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const resolvedLocale = isLocale(locale) ? locale : routing.defaultLocale;

  try {
    const subscriptions = await getUserPushSubscriptions(session.user.id);
    if (subscriptions.length === 0) {
      return { ok: false, error: "SUBSCRIPTION_NOT_FOUND" };
    }

    const t = await getTranslations({ locale: resolvedLocale, namespace: "notifications" });
    const payload: PushMessagePayload = {
      title: t("test.title"),
      body: t("test.body"),
      url: `/${resolvedLocale}${ROUTES.settings}`,
      tag: "pandatrack-test",
    };

    let sent = 0;
    let expired = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      const result = await sendPushMessage(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
      );
      if (result === "SENT") {
        sent += 1;
      } else if (result === "EXPIRED") {
        expired += 1;
        await pruneExpiredPushSubscription(subscription.endpoint);
      } else {
        failed += 1;
      }
    }

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATION_TEST_SENT,
      properties: { sent, expired, failed },
    });

    return { ok: true, sent, expired, failed };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: "sendTestNotificationAction", userId: session.user.id },
    });
    return { ok: false, error: "generic" };
  }
}
