import { POSTHOG_EVENTS } from "@/lib/constants";
import { appendWaitlistToGoogleSheet } from "@/lib/integrations/GoogleAppsScript";
import { createSubscriber, tagSubscriberByLocale, tagWaitlistSubscriber } from "@/lib/integrations/kit";
import { submitWaitlist } from "@/app/[locale]/(landing)/_components/Waitlist/submitWaitlist";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/GoogleAppsScript", () => ({
  appendWaitlistToGoogleSheet: vi.fn(),
}));

vi.mock("@/lib/integrations/kit", () => ({
  createSubscriber: vi.fn(),
  tagSubscriberByLocale: vi.fn(),
  tagWaitlistSubscriber: vi.fn(),
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: vi.fn(),
}));

describe("submitWaitlist", () => {
  const posthogCapture = vi.fn();
  const posthogIdentify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPostHogClient).mockReturnValue({
      capture: posthogCapture,
      identify: posthogIdentify,
    } as unknown as ReturnType<typeof getPostHogClient>);
  });

  it("returns field errors for invalid input after trimming values", async () => {
    const formData = new FormData();
    formData.set("email", "   ");
    formData.set("name", "  Sergio  ");
    formData.set("comment", "  Looking forward to it  ");

    await expect(submitWaitlist(formData)).resolves.toEqual({
      success: false,
      fieldErrors: {
        email: ["emailRequired", "emailInvalid"],
      },
    });

    expect(createSubscriber).not.toHaveBeenCalled();
    expect(posthogCapture).not.toHaveBeenCalled();
  });

  it("submits the waitlist signup and tracks the stable success contract", async () => {
    const formData = new FormData();
    formData.set("email", "  collector@example.com  ");
    formData.set("name", "  Sergio  ");
    formData.set("comment", "  Looking forward to tracking pre-orders  ");
    formData.set("locale", "en");

    await expect(submitWaitlist(formData)).resolves.toEqual({ success: true });

    expect(createSubscriber).toHaveBeenCalledWith({
      email: "collector@example.com",
      firstName: "Sergio",
    });
    expect(tagWaitlistSubscriber).toHaveBeenCalledWith("collector@example.com");
    expect(tagSubscriberByLocale).toHaveBeenCalledWith("en", "collector@example.com");
    expect(appendWaitlistToGoogleSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "collector@example.com",
        name: "Sergio",
        locale: "en",
        comment: "Looking forward to tracking pre-orders",
      }),
    );
    expect(posthogCapture).toHaveBeenCalledWith({
      distinctId: "collector@example.com",
      event: POSTHOG_EVENTS.LANDING.WAITLIST.SUCCESS,
      properties: {
        email: "collector@example.com",
        has_name: true,
        locale: "en",
      },
    });
    expect(posthogIdentify).toHaveBeenCalledWith({
      distinctId: "collector@example.com",
      properties: expect.objectContaining({
        email: "collector@example.com",
        name: "Sergio",
        locale: "en",
      }),
    });
  });

  it("returns a generic error and tracks failure when subscriber creation fails", async () => {
    vi.mocked(createSubscriber).mockRejectedValueOnce(new Error("Kit offline"));

    const formData = new FormData();
    formData.set("email", "collector@example.com");
    formData.set("locale", "fr");

    await expect(submitWaitlist(formData)).resolves.toEqual({
      success: false,
      error: "submitError",
    });

    expect(tagWaitlistSubscriber).not.toHaveBeenCalled();
    expect(tagSubscriberByLocale).not.toHaveBeenCalled();
    expect(appendWaitlistToGoogleSheet).not.toHaveBeenCalled();
    expect(posthogCapture).toHaveBeenCalledWith({
      distinctId: "collector@example.com",
      event: POSTHOG_EVENTS.LANDING.WAITLIST.FAILED,
      properties: {
        email: "collector@example.com",
        error_message: "Kit offline",
        locale: "unknown",
      },
    });
  });
});
