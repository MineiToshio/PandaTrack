import { getTranslations } from "next-intl/server";
import { NotificationSubjectType, NotificationType, type StoreRemovalReason } from "../../../generated/prisma/client";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  pruneExpiredPushSubscription,
  recordNotificationDelivery,
} from "@/lib/data/notifications/notificationMutations";
import {
  getNotificationPreferences,
  getUserPushSubscriptions,
  hasNotificationBeenDelivered,
} from "@/lib/data/notifications/notificationQueries";
import { sendPushMessage, type PushMessagePayload } from "@/lib/push";
import { isSanctionRemovalReason } from "@/lib/store/removalReason";
import { routing } from "@/i18n/routing";
import { isLocale } from "@/types/locale";
import type { ReminderTranslator } from "./reminderPayload";

/** The `notifications` namespace copy prefix for each store-rejection variant. */
const NEUTRAL_PREFIX = "storeRejected";
const SANCTION_PREFIX = "storeRejectedAbuse";

/** The analytics variant label, the only property carried on the send event. */
type StoreRejectionVariant = "neutral" | "sanction";

export interface NotifyStoreRejectedInput {
  /** The store creator who receives the notice. Required; without it there is no recipient. */
  creatorUserId: string;
  storeId: string;
  /** Store display name, interpolated into the creator-facing copy via `{store}`. */
  storeName: string;
  /** Supplied by the caller; only its sanction-vs-neutral classification is read here. */
  removalReason: StoreRemovalReason;
  /** Creator's browsing locale; falls back to the default locale when absent or unsupported. */
  locale?: string | null;
}

/** Resolves a nullable locale to a concrete supported locale. */
function resolveLocale(locale: string | null | undefined): string {
  return locale && isLocale(locale) ? locale : routing.defaultLocale;
}

/**
 * Truncates a timestamp to midnight UTC so a same-day retried rejection keys the same
 * `NotificationDelivery` dedup tuple. Two `new Date()` calls differ by milliseconds, so
 * keying on the raw instant would let a retry send a second push; the UTC day makes it
 * idempotent without a schema-widening `removedAt` column.
 */
function truncateToUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Builds the serialized push payload for a store rejection. Framework-free (a plain
 * translator is injected) so it is unit tested without next-intl. Carries only
 * presentational copy plus a deep link to the store listing, never the removal reason
 * text, the admin identity, or subscriber keys.
 */
export function buildStoreRejectionPayload(input: {
  translate: ReminderTranslator;
  locale: string;
  storeId: string;
  storeName: string;
  sanction: boolean;
}): PushMessagePayload {
  const prefix = input.sanction ? SANCTION_PREFIX : NEUTRAL_PREFIX;
  return {
    title: input.translate(`${prefix}.title`),
    body: input.translate(`${prefix}.body`, { store: input.storeName }),
    // The store detail page 404s once the store leaves PENDING/APPROVED, so the deep link
    // targets the public listing, which stays reachable after the tombstone transition.
    url: `/${input.locale}${ROUTES.stores}`,
    tag: `${NotificationType.STORE_REJECTED}:${input.storeId}`,
  };
}

/**
 * Event-driven store-rejection notifier, invoked from the moderation action after the
 * `REJECTED` transition commits (never from the data-layer mutation, so i18n, PostHog, and
 * push transport stay out of `src/lib/data/`). It applies the same per-collector gating the
 * daily dispatcher applies (per-type opt-in, then an active subscription as the master
 * state), deduplicates by the `NotificationDelivery` tuple keyed to the decision day, sends
 * to every active subscription, prunes any endpoint the push service reports as expired, and
 * records the send once at least one push is accepted.
 *
 * Silent by design for expected non-send outcomes (opt-out, no subscription, same-day
 * duplicate): those are not errors. Unexpected failures propagate to the caller, which owns
 * the single Sentry capture and always returns the moderation success.
 */
export async function notifyStoreRejected(input: NotifyStoreRejectedInput): Promise<void> {
  const preferences = await getNotificationPreferences(input.creatorUserId);
  if (!preferences[NotificationType.STORE_REJECTED]) {
    return;
  }

  const subscriptions = await getUserPushSubscriptions(input.creatorUserId);
  if (subscriptions.length === 0) {
    return;
  }

  const dueDate = truncateToUtcDay(new Date());
  const alreadyDelivered = await hasNotificationBeenDelivered(
    input.creatorUserId,
    NotificationType.STORE_REJECTED,
    input.storeId,
    dueDate,
  );
  if (alreadyDelivered) {
    return;
  }

  const sanction = isSanctionRemovalReason(input.removalReason);
  const locale = resolveLocale(input.locale);
  const t = await getTranslations({ locale, namespace: "notifications" });
  const payload = buildStoreRejectionPayload({
    translate: (key, values) => t(key, values),
    locale,
    storeId: input.storeId,
    storeName: input.storeName,
    sanction,
  });

  let sentToAny = false;
  for (const subscription of subscriptions) {
    const result = await sendPushMessage(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload,
    );
    if (result === "SENT") {
      sentToAny = true;
    } else if (result === "EXPIRED") {
      await pruneExpiredPushSubscription(subscription.endpoint);
    }
  }

  if (!sentToAny) {
    return;
  }

  await recordNotificationDelivery({
    userId: input.creatorUserId,
    type: NotificationType.STORE_REJECTED,
    subjectType: NotificationSubjectType.STORE,
    subjectId: input.storeId,
    dueDate,
  });

  const variant: StoreRejectionVariant = sanction ? "sanction" : "neutral";
  getPostHogClient().capture({
    distinctId: input.creatorUserId,
    event: POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATION_STORE_REJECTED_SENT,
    properties: { variant },
  });
}
