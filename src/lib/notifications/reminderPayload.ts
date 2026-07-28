import { NotificationSubjectType, NotificationType } from "../../../generated/prisma/client";
import { ROUTES } from "@/lib/constants";
import type { ReminderNotificationType } from "@/lib/data/notifications/reminderCandidateQueries";
import type { PushMessagePayload } from "@/lib/push";

/**
 * Minimal translator surface the payload composer needs: the same call shape a
 * next-intl `getTranslations` scope exposes, narrowed so composition can be unit
 * tested with a plain function and never depends on the framework.
 */
export type ReminderTranslator = (key: string, values?: Record<string, string>) => string;

/** Maps each dispatcher reminder type to its `notifications` namespace copy prefix. */
const TRANSLATION_PREFIX_BY_TYPE: Record<ReminderNotificationType, string> = {
  [NotificationType.PAYMENT_DUE]: "paymentDue",
  [NotificationType.ARRIVAL_DUE]: "arrivalDue",
  [NotificationType.ARRIVAL_OVERDUE]: "arrivalOverdue",
};

/** Locale-prefixed deep link to the owning order or delivery detail surface. */
function buildDeepLink(locale: string, subjectType: NotificationSubjectType, subjectId: string): string {
  const base = subjectType === NotificationSubjectType.DELIVERY ? ROUTES.deliveries : ROUTES.orders;
  return `/${locale}${base}/${subjectId}`;
}

export interface ComposeReminderPayloadInput {
  type: ReminderNotificationType;
  subjectType: NotificationSubjectType;
  subjectId: string;
  locale: string;
  /** Currency-free display descriptor (the store name). */
  descriptor: string;
  translate: ReminderTranslator;
}

/**
 * Builds the serialized push payload for one reminder. It carries only presentational
 * copy, a deep-link URL, and a collapse tag: never money values, note text, or
 * subscriber keys (send contract). Copy is interpolated with the currency-free subject
 * descriptor only.
 */
export function composeReminderPayload(input: ComposeReminderPayloadInput): PushMessagePayload {
  const prefix = TRANSLATION_PREFIX_BY_TYPE[input.type];
  return {
    title: input.translate(`${prefix}.title`, { subject: input.descriptor }),
    body: input.translate(`${prefix}.body`, { subject: input.descriptor }),
    url: buildDeepLink(input.locale, input.subjectType, input.subjectId),
    tag: `${input.type}:${input.subjectId}`,
  };
}
