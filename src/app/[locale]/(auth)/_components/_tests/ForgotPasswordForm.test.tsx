import * as Sentry from "@sentry/nextjs";
import { fireEvent, render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordForm from "@/app/[locale]/(auth)/_components/ForgotPasswordForm";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";

const { captureExceptionMock, posthogCaptureMock, requestPasswordResetMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  requestPasswordResetMock: vi.fn(),
}));

const translationMap = {
  title: "Reset your password",
  description: "Enter your account email and we will show the same response whether the account exists or not.",
  email: "Email",
  submit: "Send reset link",
  linkToSignIn: "Back to sign in",
  success:
    "We've sent a password reset email if this email is registered with PandaTrack. Check your inbox and spam folder to continue.",
  locked:
    "We've sent a password reset email if this email is registered with PandaTrack. Check your inbox and spam folder to continue.",
  sentWithCooldown:
    "We've sent a password reset email if this email is registered with PandaTrack. Check your inbox and spam folder. If you need another one, wait {minutes, plural, one {# minute} other {# minutes}}.",
  cooldownNotice:
    "We've already sent a reset link for this email recently. Use the latest email in your inbox and wait {minutes, plural, one {# minute} other {# minutes}} before requesting another.",
  retryLater: "We couldn't send the reset email right now. Please try again in a few minutes.",
  emailRequired: "Email is required.",
  emailInvalid: "Enter a valid email address.",
  dividerOr: "or",
} as const;

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: keyof typeof translationMap, values?: Record<string, number>) => {
    if (namespace === "auth.forgotPassword" || namespace === "auth.errors" || namespace === "auth") {
      if (key === "cooldownNotice" && values?.minutes) {
        return `${key}:${values.minutes}`;
      }

      return translationMap[key];
    }

    return key;
  },
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: posthogCaptureMock,
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    requestPasswordReset: requestPasswordResetMock,
  },
}));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
        clear: vi.fn(() => {
          storage.clear();
        }),
      },
    });
  });

  it("shows the neutral success message after the first successful reset request", async () => {
    requestPasswordResetMock.mockResolvedValue({ error: null });

    render(<ForgotPasswordForm locale="en" signInHref="/en/sign-in" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "collector@example.com" } });
    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("status")).toHaveTextContent(translationMap.success);
    expect(requestPasswordResetMock).toHaveBeenCalledWith({
      email: "collector@example.com",
      redirectTo: `/en${ROUTES.resetPassword}`,
    });
    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_SUBMITTED, {
      locale: "en",
    });
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("shows the remaining wait time instead of sending again during the active cooldown", async () => {
    requestPasswordResetMock.mockResolvedValue({ error: null });

    render(<ForgotPasswordForm locale="en" signInHref="/en/sign-in" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "collector@example.com" } });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("status")).toHaveTextContent("cooldownNotice:2");
    expect(requestPasswordResetMock).toHaveBeenCalledTimes(1);
  });

  it("tracks auth API failures and shows the retry-later message", async () => {
    requestPasswordResetMock.mockResolvedValue({
      error: {
        code: "PASSWORD_RESET_EMAIL_DELIVERY_FAILED",
      },
    });

    render(<ForgotPasswordForm locale="en" signInHref="/en/sign-in" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "collector@example.com" } });
    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(translationMap.retryLater);
    expect(posthog.capture).toHaveBeenNthCalledWith(1, POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_SUBMITTED, {
      locale: "en",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_FAILED, {
      locale: "en",
      error_code: "PASSWORD_RESET_EMAIL_DELIVERY_FAILED",
    });
  });

  it("captures unexpected request failures in Sentry and PostHog", async () => {
    const networkError = new Error("Network unavailable");
    requestPasswordResetMock.mockRejectedValue(networkError);

    render(<ForgotPasswordForm locale="en" signInHref="/en/sign-in" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "collector@example.com" } });
    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(translationMap.retryLater);
    expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    expect(posthog.capture).toHaveBeenNthCalledWith(1, POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_SUBMITTED, {
      locale: "en",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_FAILED, {
      locale: "en",
      error_code: "network_error",
    });
  });
});
