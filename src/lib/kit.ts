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
