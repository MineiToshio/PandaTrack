import * as Sentry from "@sentry/nextjs";
import { fireEvent, render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleSignInButton from "@/app/[locale]/(auth)/_components/GoogleSignInButton";
import { POSTHOG_EVENTS } from "@/lib/constants";

const { captureExceptionMock, posthogCaptureMock, signInSocialMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  signInSocialMock: vi.fn(),
}));

const translationMap: Record<string, string> = {
  googleButton: "Continue with Google",
  generic: "Something went wrong. Please try again.",
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => translationMap[key] ?? key,
}));

vi.mock("posthog-js", () => ({
  default: { capture: posthogCaptureMock },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signIn: {
      social: signInSocialMock,
    },
  },
}));

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures a rejected social sign-in call and shows a generic error instead of crashing", async () => {
    const networkError = new Error("Network unavailable");
    signInSocialMock.mockRejectedValue(networkError);

    render(<GoogleSignInButton callbackURL="/en/dashboard" variant="signIn" />);

    fireEvent.click(screen.getByRole("button", { name: translationMap.googleButton }));

    expect(await screen.findByRole("alert")).toHaveTextContent(translationMap.generic);
    expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.AUTH.GOOGLE_SIGNIN_CLICKED, { locale: "en" });
  });
});
