import * as Sentry from "@sentry/nextjs";
import { fireEvent, render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "@/app/[locale]/(auth)/_components/SignInForm";
import { POSTHOG_EVENTS } from "@/lib/constants";

const { captureExceptionMock, posthogCaptureMock, signInEmailMock, routerPushMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  signInEmailMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

const translationMap: Record<string, string> = {
  title: "Sign in",
  subtitle: "Welcome back",
  submit: "Sign in",
  email: "Email",
  emailPlaceholder: "you@example.com",
  password: "Password",
  forgotPassword: "Forgot password?",
  footPrefix: "No account?",
  footLink: "Sign up",
  divider: "or",
  googleButton: "Continue with Google",
  invalidCredentials: "Invalid email or password.",
  generic: "Something went wrong. Please try again.",
  show: "Show password",
  hide: "Hide password",
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => translationMap[key] ?? key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
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
      email: signInEmailMock,
      social: vi.fn(),
    },
  },
}));

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "collector@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures a rejected sign-in call instead of crashing the page", async () => {
    const networkError = new Error("Network unavailable");
    signInEmailMock.mockRejectedValue(networkError);

    render(
      <SignInForm callbackURL="/en/dashboard" signUpHref="/en/sign-up" forgotPasswordHref="/en/forgot-password" />,
    );

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(translationMap.generic);
    expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.AUTH.SIGNIN_FAILED, {
      locale: "en",
      error_code: "network_error",
    });
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled();
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
