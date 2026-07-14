import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureUserLocaleIfUnsetMock, captureExceptionMock } = vi.hoisted(() => ({
  captureUserLocaleIfUnsetMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/data/auth/userMutations", () => ({
  captureUserLocaleIfUnset: captureUserLocaleIfUnsetMock,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { captureBrowsingLocaleOnSignIn, resolveBrowsingLocale } from "../authLocaleCapture";

beforeEach(() => {
  vi.clearAllMocks();
  captureUserLocaleIfUnsetMock.mockResolvedValue(undefined);
});

describe("resolveBrowsingLocale", () => {
  it("reads the locale prefix of the sign-in callback URL from the request body", () => {
    expect(resolveBrowsingLocale({ bodyCallbackURL: "/en/dashboard" })).toBe("en");
  });

  it("reads the locale prefix of an absolute callback URL", () => {
    expect(resolveBrowsingLocale({ bodyCallbackURL: "https://pandatrack.app/en/orders?page=2" })).toBe("en");
  });

  it("reads the callback URL from the query string when the body carries none", () => {
    expect(resolveBrowsingLocale({ queryCallbackURL: "/en/settings" })).toBe("en");
  });

  it("falls back to the redirect location, which is how the OAuth callback carries the locale", () => {
    expect(resolveBrowsingLocale({ redirectLocation: "https://pandatrack.app/en/dashboard" })).toBe("en");
  });

  it("prefers the callback URL over the cookie", () => {
    expect(resolveBrowsingLocale({ bodyCallbackURL: "/en/dashboard", cookieHeader: "NEXT_LOCALE=es" })).toBe("en");
  });

  it("falls back to the NEXT_LOCALE cookie when no callback URL carries a locale", () => {
    expect(resolveBrowsingLocale({ cookieHeader: "theme=dark; NEXT_LOCALE=en; other=1" })).toBe("en");
  });

  it("ignores a callback URL with no locale prefix", () => {
    expect(resolveBrowsingLocale({ bodyCallbackURL: "/dashboard", cookieHeader: "NEXT_LOCALE=en" })).toBe("en");
  });

  it("ignores an unsupported locale in the callback URL and in the cookie", () => {
    expect(resolveBrowsingLocale({ bodyCallbackURL: "/fr/dashboard", cookieHeader: "NEXT_LOCALE=fr" })).toBe("es");
  });

  it("ignores a non-string callback URL", () => {
    expect(resolveBrowsingLocale({ bodyCallbackURL: { path: "/en" } })).toBe("es");
  });

  it("falls back to the default locale when no signal is present", () => {
    expect(resolveBrowsingLocale({})).toBe("es");
  });
});

describe("captureBrowsingLocaleOnSignIn", () => {
  it("stores the resolved browsing locale only when none is stored yet", async () => {
    await captureBrowsingLocaleOnSignIn("user-1", { bodyCallbackURL: "/en/dashboard" });

    expect(captureUserLocaleIfUnsetMock).toHaveBeenCalledWith("user-1", "en");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("never propagates a persistence failure and reports it once", async () => {
    captureUserLocaleIfUnsetMock.mockRejectedValueOnce(new Error("db down"));

    await expect(captureBrowsingLocaleOnSignIn("user-1", {})).resolves.toBeUndefined();

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});
