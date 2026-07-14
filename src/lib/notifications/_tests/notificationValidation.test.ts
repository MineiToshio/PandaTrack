import { describe, expect, it } from "vitest";
import { NotificationType } from "../../../../generated/prisma/client";
import { notificationPreferenceInputSchema, pushSubscriptionSchema } from "../notificationValidation";

describe("pushSubscriptionSchema", () => {
  const validKeys = { p256dh: "p256dh-key", auth: "auth-key" };

  it("accepts a well-formed payload without userAgent", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.com/endpoint-1",
      keys: validKeys,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a well-formed payload with userAgent", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.com/endpoint-1",
      keys: validKeys,
      userAgent: "Mozilla/5.0",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a payload missing endpoint", () => {
    const result = pushSubscriptionSchema.safeParse({ keys: validKeys });

    expect(result.success).toBe(false);
  });

  it("rejects a payload with a non-URL endpoint", () => {
    const result = pushSubscriptionSchema.safeParse({ endpoint: "not-a-url", keys: validKeys });

    expect(result.success).toBe(false);
  });

  it("rejects a payload missing the p256dh key", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.com/endpoint-1",
      keys: { auth: "auth-key" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a payload missing the auth key", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.com/endpoint-1",
      keys: { p256dh: "p256dh-key" },
    });

    expect(result.success).toBe(false);
  });
});

describe("notificationPreferenceInputSchema", () => {
  it.each(Object.values(NotificationType))("accepts %s with a boolean", (type) => {
    const result = notificationPreferenceInputSchema.safeParse({ type, enabled: true });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown notification type", () => {
    const result = notificationPreferenceInputSchema.safeParse({ type: "UNKNOWN_TYPE", enabled: true });

    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean enabled flag", () => {
    const result = notificationPreferenceInputSchema.safeParse({ type: NotificationType.PAYMENT_DUE, enabled: "yes" });

    expect(result.success).toBe(false);
  });
});
