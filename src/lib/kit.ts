/**
 * Kit.com (ConvertKit) API client for waitlist and audience management.
 * @see https://developers.kit.com/api-reference/overview
 */

const KIT_API_BASE = "https://api.kit.com";

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
 * Returns the tag ID for the given locale when configured (KIT_TAG_ID_ES, KIT_TAG_ID_EN).
 * Used to tag waitlist subscribers by language for email segmentation.
 */
function getTagIdForLocale(locale: string): number | undefined {
  const raw = locale === "es" ? process.env.KIT_TAG_ID_ES : locale === "en" ? process.env.KIT_TAG_ID_EN : undefined;
  if (raw === undefined || raw === "") return undefined;
  const id = Number.parseInt(raw, 10);
  return Number.isNaN(id) ? undefined : id;
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
