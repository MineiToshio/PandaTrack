import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

const translationMap = {
  eyebrow: "Something went wrong",
  title: "Something broke on our end",
  description: "We couldn't load this page. Try again; if it keeps failing, try again in a moment.",
  retry: "Try again",
  goHome: "Go home",
} as const;

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: keyof typeof translationMap) => {
    if (namespace === "common.error") {
      return translationMap[key];
    }

    return key;
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

// Imported after the mocks so the component picks them up.
import PublicShellError from "../error";

describe("PublicShellError", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it("renders the localized destructive surface as an alert with the retry and go-home actions", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<PublicShellError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: translationMap.title })).toBeTruthy();
    expect(screen.getByText(translationMap.description)).toBeTruthy();

    const goHomeLink = screen.getByRole("link", { name: translationMap.goHome });
    expect(goHomeLink.getAttribute("href")).toBe("/en");
  });

  it("wires the retry action to reset()", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    const reset = vi.fn();
    render(<PublicShellError error={error} reset={reset} />);

    screen.getByRole("button", { name: translationMap.retry }).click();

    expect(reset).toHaveBeenCalledOnce();
  });

  it("captures the error exactly once with the public_shell area tag and the digest", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<PublicShellError error={error} reset={vi.fn()} />);

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      tags: { area: "public_shell" },
      extra: { digest: "abc123" },
    });
  });
});
