/**
 * Kit.com (ConvertKit) API client for waitlist and audience management.
 * @see https://developers.kit.com/api-reference/overview
 */

import * as Sentry from "@sentry/nextjs";

const KIT_API_BASE = "https://api.kit.com";

function parseTagId(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const id = Number.parseInt(raw, 10);
  return Number.isNaN(id) ? undefined : id;
}

export const KIT_TAG = {
  waitlist: parseTagId(process.env.KIT_TAG_ID_WAITLIST),
  appUser: parseTagId(process.env.KIT_TAG_ID_APP_USER),
  locale: {
    es: parseTagId(process.env.KIT_TAG_ID_ES),
    en: parseTagId(process.env.KIT_TAG_ID_EN),
  },
} as const;

function getApiKey(): string {
  const key = process.env.KIT_API_KEY;
  if (!key?.trim()) {
    throw new Error("KIT_API_KEY is not set. Configure it in your environment.");
  }
  return key.trim();
}

export type CreateSubscriberInput = {
  email: string;
  firstName?: string | null;
};

export type KitSubscriber = {
  id: number;
  first_name: string | null;
  email_address: string;
  state: string;
  created_at: string;
  fields: Record<string, unknown>;
};

/**
 * Creates or updates a subscriber in Kit.com (upsert by email).
 * @see https://developers.kit.com/api-reference/subscribers/create-a-subscriber
 */
export async function createSubscriber(input: CreateSubscriberInput): Promise<KitSubscriber> {
  const apiKey = getApiKey();
  const response = await fetch(`${KIT_API_BASE}/v4/subscribers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify({
      email_address: input.email,
      first_name: input.firstName ?? undefined,
      state: "active",
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const messages = Array.isArray(body?.errors) ? body.errors : [response.statusText];
    throw new Error(`Kit create subscriber failed: ${messages.join(", ")}`);
  }

  const data = (await response.json()) as { subscriber: KitSubscriber };
  return data.subscriber;
}

/**
 * Syncs an authenticated user to Kit: creates or updates subscriber and tags with app_user.
 * Non-blocking and safe to call from auth hooks; logs to Sentry on failure without throwing.
 * No-op when KIT_API_KEY or KIT_TAG_ID_APP_USER is not set.
 */
export async function syncAuthenticatedUserToKit(email: string, firstName?: string | null): Promise<void> {
  if (!process.env.KIT_API_KEY?.trim() || KIT_TAG.appUser === undefined) {
    return;
  }
  try {
    await createSubscriber({ email, firstName });
    const tagId = KIT_TAG.appUser;
    if (tagId !== undefined) {
      await tagSubscriberByEmail(tagId, email);
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

function getTagIdForLocale(locale: string): number | undefined {
  return locale === "es" ? KIT_TAG.locale.es : locale === "en" ? KIT_TAG.locale.en : undefined;
}

/**
 * Tags an existing subscriber by email. Subscriber must exist (create first if needed).
 * @see https://developers.kit.com/api-reference/tags/tag-a-subscriber-by-email-address
 */
export async function tagSubscriberByEmail(tagId: number, email: string): Promise<void> {
  const apiKey = getApiKey();
  const response = await fetch(`${KIT_API_BASE}/v4/tags/${tagId}/subscribers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify({ email_address: email }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const messages = Array.isArray(body?.errors) ? body.errors : [response.statusText];
    throw new Error(`Kit tag subscriber failed: ${messages.join(", ")}`);
  }
}

/**
 * Tags a subscriber by locale when a tag ID is configured for that locale.
 * No-op when locale is not supported or tag ID is not set. Use for waitlist language segmentation.
 */
export async function tagSubscriberByLocale(locale: string, email: string): Promise<void> {
  const tagId = getTagIdForLocale(locale);
  if (tagId === undefined) return;
  await tagSubscriberByEmail(tagId, email);
}

/**
 * Tags a subscriber as waitlist when a tag ID is configured.
 * No-op when KIT_TAG_ID_WAITLIST is not set.
 */
export async function tagWaitlistSubscriber(email: string): Promise<void> {
  const tagId = KIT_TAG.waitlist;
  if (tagId === undefined) return;
  await tagSubscriberByEmail(tagId, email);
}
