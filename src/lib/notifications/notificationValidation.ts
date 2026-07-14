import { z } from "zod";
import { NotificationType } from "../../../generated/prisma/client";

const MAX_ENDPOINT_LENGTH = 2000;
const MAX_KEY_LENGTH = 500;
const MAX_USER_AGENT_LENGTH = 500;

/**
 * Browser Web Push subscription payload as produced by
 * `PushSubscription.toJSON()` in the browser, plus an optional user agent the
 * client may attach so a collector can recognize the device later.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url({ message: "ENDPOINT_INVALID" }).max(MAX_ENDPOINT_LENGTH, { message: "ENDPOINT_TOO_LONG" }),
  keys: z.object({
    p256dh: z.string().min(1, { message: "P256DH_REQUIRED" }).max(MAX_KEY_LENGTH, { message: "P256DH_TOO_LONG" }),
    auth: z.string().min(1, { message: "AUTH_REQUIRED" }).max(MAX_KEY_LENGTH, { message: "AUTH_TOO_LONG" }),
  }),
  userAgent: z.string().max(MAX_USER_AGENT_LENGTH, { message: "USER_AGENT_TOO_LONG" }).optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/**
 * A single per-type preference mutation: which reminder type to toggle and
 * whether it is enabled. The `type` union is derived from the Prisma enum so it
 * stays in lockstep with the schema.
 */
export const notificationPreferenceInputSchema = z.object({
  type: z.enum(NotificationType, { message: "NOTIFICATION_TYPE_INVALID" }),
  enabled: z.boolean(),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceInputSchema>;
