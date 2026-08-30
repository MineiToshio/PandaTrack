import * as Sentry from "@sentry/nextjs";
import { fireEvent, render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignUpForm from "@/app/[locale]/(auth)/_components/SignUpForm";
import { POSTHOG_EVENTS } from "@/lib/constants";

const { captureExceptionMock, posthogCaptureMock, signUpEmailMock, routerPushMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  signUpEmailMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

const translationMap: Record<string, string> = {
  title: "Create your account",
  subtitle: "Start tracking your orders",
  submit: "Sign up",
  email: "Email",
  emailPlaceholder: "you@example.com",
  password: "Password",
  passwordHelp: "At least 8 characters.",
  footPrefix: "Already have an account?",
  footLink: "Sign in",
  divider: "or",
  googleButton: "Continue with Google",
  userAlreadyExists: "An account with this email already exists.",
  generic: "Something went wrong. Please try again.",
  show: "Show password",
  hide: "Hide password",
  terms: "I agree to the terms and privacy policy",
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => {
    const translator = (key: string) => translationMap[key] ?? key;
    translator.rich = (key: string) => translationMap[key] ?? key;
    return translator;
  },
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
    signUp: {
      email: signUpEmailMock,
    },
    signIn: {
      social: vi.fn(),
    },
  },
}));

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "collector@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
}

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures a rejected sign-up call instead of crashing the page", async () => {
    const networkError = new Error("Network unavailable");
    signUpEmailMock.mockRejectedValue(networkError);

    render(<SignUpForm callbackURL="/en/dashboard" signInHref="/en/sign-in" />);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(translationMap.generic);
    expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.AUTH.SIGNUP_FAILED, {
      locale: "en",
      error_code: "network_error",
    });
    expect(screen.getByRole("button", { name: "Sign up" })).not.toBeDisabled();
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("still shows the existing-account message on a normal API refusal", async () => {
    signUpEmailMock.mockResolvedValue({
      data: null,
      error: { code: "USER_ALREADY_EXISTS", message: "raw message" },
    });

    render(<SignUpForm callbackURL="/en/dashboard" signInHref="/en/sign-in" />);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(translationMap.userAlreadyExists);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
