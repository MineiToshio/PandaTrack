import { NotificationType } from "../../../generated/prisma/client";
import type { NotificationPreferenceMap } from "@/lib/data/notifications/notificationQueries";
import type { RecordNotificationDeliveryInput } from "@/lib/data/notifications/notificationMutations";
import type { ReminderCandidate } from "@/lib/data/notifications/reminderCandidateQueries";
import type { PushMessagePayload, PushSendResult, PushSubscriptionTarget } from "@/lib/push";
import { composeReminderPayload, type ReminderTranslator } from "./reminderPayload";
import { isCandidateInWindow, resolveTodayStart } from "./reminderWindows";

/** One collector subscription the dispatcher can target. */
export interface DispatchSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Per-type run counters. */
export interface ReminderTypeSummary {
  attempted: number;
  sent: number;
  deduped: number;
  pruned: number;
  transientFailures: number;
}

/** The dispatch run summary returned to the route and reported to analytics. */
export interface DispatchRunSummary {
  byType: Record<NotificationType, ReminderTypeSummary>;
  totals: ReminderTypeSummary;
}

/**
 * Collaborators the dispatcher core depends on. Injected so the core is exercised in
 * isolation with mocked data-layer, transport, and translation collaborators.
 */
export interface DispatchDeps {
  now: Date;
  loadCandidates: (now: Date) => Promise<ReminderCandidate[]>;
  getPreferences: (userId: string) => Promise<NotificationPreferenceMap>;
  getSubscriptions: (userId: string) => Promise<DispatchSubscription[]>;
  hasBeenDelivered: (userId: string, type: NotificationType, subjectId: string, dueDate: Date) => Promise<boolean>;
  recordDelivery: (input: RecordNotificationDeliveryInput) => Promise<{ recorded: boolean }>;
  sendPush: (target: PushSubscriptionTarget, payload: PushMessagePayload) => Promise<PushSendResult>;
  pruneSubscription: (endpoint: string) => Promise<void>;
  getTranslator: (locale: string) => Promise<ReminderTranslator>;
  /** Resolves a candidate's nullable locale to a concrete locale (default fallback). */
  resolveLocale: (locale: string | null) => string;
}

function emptyTypeSummary(): ReminderTypeSummary {
  return { attempted: 0, sent: 0, deduped: 0, pruned: 0, transientFailures: 0 };
}

function emptyRunSummary(): DispatchRunSummary {
  return {
    byType: {
      [NotificationType.PAYMENT_DUE]: emptyTypeSummary(),
      [NotificationType.ARRIVAL_DUE]: emptyTypeSummary(),
      [NotificationType.ARRIVAL_OVERDUE]: emptyTypeSummary(),
    },
    totals: emptyTypeSummary(),
  };
}

/** Sums the per-type counters into the run totals. */
function foldTotals(summary: DispatchRunSummary): void {
  for (const typeSummary of Object.values(summary.byType)) {
    summary.totals.attempted += typeSummary.attempted;
    summary.totals.sent += typeSummary.sent;
    summary.totals.deduped += typeSummary.deduped;
    summary.totals.pruned += typeSummary.pruned;
    summary.totals.transientFailures += typeSummary.transientFailures;
  }
}

/** Async memoizer keyed by a string, so per-collector lookups run once per run. */
function createAsyncCache<T>(load: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const cache = new Map<string, Promise<T>>();
  return (key: string) => {
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }
    const promise = load(key);
    cache.set(key, promise);
    return promise;
  };
}

/**
 * Pure-ish dispatch core: loads candidates, applies the ordered skip rules (preference
 * off, no active subscription, outside the collector's timezone window, already
 * delivered), then sends localized deep-linked payloads to every active subscription,
 * writing the dedup row on first success, pruning expired endpoints without aborting the
 * batch, and counting transient failures. Returns a per-type run summary.
 *
 * The batch is deliberately sequential per candidate so one slow endpoint cannot stall
 * the run through unbounded concurrency; each send is isolated by the transport's typed
 * result union, so a single failure never throws.
 */
export async function dispatchReminders(deps: DispatchDeps): Promise<DispatchRunSummary> {
  const summary = emptyRunSummary();

  const getPreferences = createAsyncCache(deps.getPreferences);
  const getSubscriptions = createAsyncCache(deps.getSubscriptions);
  const getTranslator = createAsyncCache(deps.getTranslator);
  const prunedEndpoints = new Set<string>();

  const candidates = await deps.loadCandidates(deps.now);

  for (const candidate of candidates) {
    const typeSummary = summary.byType[candidate.type];

    const preferences = await getPreferences(candidate.userId);
    if (!preferences[candidate.type]) {
      continue;
    }

    const allSubscriptions = await getSubscriptions(candidate.userId);
    const subscriptions = allSubscriptions.filter((subscription) => !prunedEndpoints.has(subscription.endpoint));
    if (subscriptions.length === 0) {
      continue;
    }

    const todayStart = resolveTodayStart(deps.now, candidate.timezone);
    if (!isCandidateInWindow(candidate.type, candidate.dueDate, todayStart)) {
      continue;
    }

    const alreadyDelivered = await deps.hasBeenDelivered(
      candidate.userId,
      candidate.type,
      candidate.subjectId,
      candidate.dueDate,
    );
    if (alreadyDelivered) {
      typeSummary.deduped += 1;
      continue;
    }

    typeSummary.attempted += 1;

    const locale = deps.resolveLocale(candidate.locale);
    const translate = await getTranslator(locale);
    const payload = composeReminderPayload({
      type: candidate.type,
      subjectType: candidate.subjectType,
      subjectId: candidate.subjectId,
      locale,
      descriptor: candidate.descriptor,
      translate,
    });

    let sentToAny = false;
    for (const subscription of subscriptions) {
      const result = await deps.sendPush(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
      );
      if (result === "SENT") {
        sentToAny = true;
      } else if (result === "EXPIRED") {
        typeSummary.pruned += 1;
        prunedEndpoints.add(subscription.endpoint);
        await deps.pruneSubscription(subscription.endpoint);
      } else {
        typeSummary.transientFailures += 1;
      }
    }

    if (sentToAny) {
      const { recorded } = await deps.recordDelivery({
        userId: candidate.userId,
        type: candidate.type,
        subjectType: candidate.subjectType,
        subjectId: candidate.subjectId,
        dueDate: candidate.dueDate,
      });
      if (recorded) {
        typeSummary.sent += 1;
      } else {
        // A concurrent run won the dedup row; treat as deduped rather than a fresh send.
        typeSummary.deduped += 1;
      }
    }
  }

  foldTotals(summary);
  return summary;
}
