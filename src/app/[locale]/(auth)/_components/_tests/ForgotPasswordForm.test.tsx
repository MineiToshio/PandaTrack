import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordForm from "@/app/[locale]/(auth)/_components/ForgotPasswordForm";
import { ROUTES } from "@/lib/constants";

const { requestPasswordResetMock } = vi.hoisted(() => ({
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
  retryLater: "We couldn't send the reset email right now. Please try again in a few minutes.",
  emailRequired: "Email is required.",
  emailInvalid: "Enter a valid email address.",
  dividerOr: "or",
} as const;

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: keyof typeof translationMap) => {
    if (namespace === "auth.forgotPassword" || namespace === "auth.errors" || namespace === "auth") {
      return translationMap[key];
    }

    return key;
  },
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    requestPasswordReset: requestPasswordResetMock,
  },
}));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks the form after the first successful reset request until refresh", async () => {
    const user = userEvent.setup();
    requestPasswordResetMock.mockResolvedValue({ error: null });

    render(<ForgotPasswordForm locale="en" signInHref="/en/sign-in" />);

    await user.type(screen.getByRole("textbox"), "collector@example.com");
    await user.click(screen.getByRole("button"));

    expect(await screen.findByRole("status")).toBeInTheDocument();

    expect(requestPasswordResetMock).toHaveBeenCalledWith({
      email: "collector@example.com",
      redirectTo: `/en${ROUTES.resetPassword}`,
    });

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("allows sending again after remounting the page", async () => {
    const user = userEvent.setup();
    requestPasswordResetMock.mockResolvedValue({ error: null });

    const { unmount } = render(<ForgotPasswordForm locale="en" signInHref="/en/sign-in" />);

    await user.type(screen.getByRole("textbox"), "collector@example.com");
    await user.click(screen.getByRole("button"));

    await screen.findByRole("status");
    unmount();

    render(<ForgotPasswordForm locale="en" signInHref="/en/sign-in" />);

    await waitFor(() => {
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });
});
