import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import posthog from "posthog-js";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ResetPasswordForm from "@/app/[locale]/(auth)/_components/ResetPasswordForm";
import { POSTHOG_EVENTS } from "@/lib/constants";

const { pushMock, resetPasswordMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  resetPasswordMock: vi.fn(),
}));

const translationMap = {
  title: "Create a new password",
  description: "Enter your new password to finish account recovery.",
  password: "New password",
  submit: "Update password",
  helper: "This reset link can only be used once and expires after 60 minutes.",
  error: "We couldn't reset your password. Please try again.",
  invalidTitle: "This reset link is not valid",
  invalidDescription: "The link may be expired, broken, or already used. Request a new reset email and try again.",
  requestAnotherLink: "Request another reset link",
  linkToSignIn: "Back to sign in",
  goToSignIn: "Go to sign in",
  successTitle: "Password updated",
  successDescription: "Your password was updated successfully. Sign in with your new password.",
  dividerLabel: "or",
  generic: "Something went wrong. Please try again.",
  show: "Show password",
  hide: "Hide password",
} as const;

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: keyof typeof translationMap) => {
    if (namespace === "auth.resetPassword" || namespace === "auth.errors" || namespace === "auth.passwordVisibility") {
      return translationMap[key];
    }

    return key;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
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
    resetPassword: resetPasswordMock,
  },
}));

describe("ResetPasswordForm", () => {
  function getSubmitButton() {
    const submitButton = document.querySelector('button[type="submit"]');

    if (!(submitButton instanceof HTMLButtonElement)) {
      throw new Error("Submit button not found");
    }

    return submitButton;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the invalid fallback when the token is missing", () => {
    render(
      <ResetPasswordForm
        signInHref="/en/sign-in"
        forgotPasswordHref="/en/forgot-password"
        initialState="invalid"
        invalidDescription={translationMap.invalidDescription}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/en/forgot-password")).toBe(true);
    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_VIEWED, {
      locale: "en",
      state: "invalid",
    });
  });

  it("submits a valid token and shows the success state", async () => {
    const user = userEvent.setup();
    resetPasswordMock.mockResolvedValue({ error: null });

    render(
      <ResetPasswordForm
        token="valid-token"
        signInHref="/en/sign-in"
        forgotPasswordHref="/en/forgot-password"
        initialState="ready"
        invalidDescription={translationMap.invalidDescription}
      />,
    );

    await user.type(screen.getByLabelText(translationMap.password), "new-password-123");
    await user.click(getSubmitButton());

    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: "valid-token",
      newPassword: "new-password-123",
    });
    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_SUCCESS, {
      locale: "en",
    });
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/sign-in");
  });

  it("switches to the invalid fallback when the API rejects the token", async () => {
    const user = userEvent.setup();
    resetPasswordMock.mockResolvedValue({
      error: {
        code: "INVALID_TOKEN",
      },
    });

    render(
      <ResetPasswordForm
        token="expired-token"
        signInHref="/en/sign-in"
        forgotPasswordHref="/en/forgot-password"
        initialState="ready"
        invalidDescription={translationMap.invalidDescription}
      />,
    );

    await user.type(screen.getByLabelText(translationMap.password), "new-password-123");
    await user.click(getSubmitButton());

    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_FAILED, {
      locale: "en",
      error_code: "INVALID_TOKEN",
    });
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
