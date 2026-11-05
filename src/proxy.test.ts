import { NextRequest, NextResponse } from "next/server";
import proxy, { config } from "@/proxy";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleI18nRoutingMock, getSessionCookieMock } = vi.hoisted(() => ({
  handleI18nRoutingMock: vi.fn(),
  getSessionCookieMock: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => handleI18nRoutingMock),
}));

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: getSessionCookieMock,
}));

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleI18nRoutingMock.mockReturnValue(NextResponse.next());
  });

  it.each(["/xx", "/xx/privacy", "/xx/terms", "/unsupported/privacy?from=test", "/apiculture"])(
    "redirects invalid public locale prefixes before rendering: %s",
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: `https://pandatrack.app${path}` })).toBe(true);
      const response = proxy(new NextRequest(`https://pandatrack.app${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://pandatrack.app/es");
      expect(handleI18nRoutingMock).not.toHaveBeenCalled();
      expect(getSessionCookieMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/api/privacy",
    "/api/auth/get-session",
    "/api/notifications/dispatch",
    "/_next/static/chunk.js",
    "/ingest",
    "/ingest/batch",
    "/monitoring",
    "/apple-icon",
    "/dev-global-error",
    "/icon.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/xx/algo",
  ])("keeps unrelated routes outside the proxy matcher: %s", (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `https://pandatrack.app${path}` })).toBe(false);
  });

  it("redirects unauthenticated requests for private localized routes to sign-in with a returnTo param", async () => {
    getSessionCookieMock.mockReturnValueOnce(null);

    const response = proxy(new NextRequest("https://pandatrack.app/es/dashboard?tab=overview"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://pandatrack.app/es/sign-in?returnTo=%2Fes%2Fdashboard%3Ftab%3Doverview",
    );
    expect(handleI18nRoutingMock).not.toHaveBeenCalled();
  });

  it("lets authenticated private requests continue through i18n routing", async () => {
    getSessionCookieMock.mockReturnValueOnce("session-token");
    const request = new NextRequest("https://pandatrack.app/en/dashboard");

    const response = proxy(request);

    expect(getSessionCookieMock).toHaveBeenCalledWith(request.headers);
    expect(handleI18nRoutingMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it("redirects authenticated requests for the localized home to the dashboard", async () => {
    getSessionCookieMock.mockReturnValueOnce("session-token");
    const request = new NextRequest("https://pandatrack.app/es");

    const response = proxy(request);

    expect(getSessionCookieMock).toHaveBeenCalledWith(request.headers);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://pandatrack.app/es/dashboard");
    expect(handleI18nRoutingMock).not.toHaveBeenCalled();
  });

  it("lets unauthenticated requests for the localized home continue to the landing", async () => {
    getSessionCookieMock.mockReturnValueOnce(null);
    const request = new NextRequest("https://pandatrack.app/en");

    const response = proxy(request);

    expect(getSessionCookieMock).toHaveBeenCalledWith(request.headers);
    expect(handleI18nRoutingMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it("lets public routes continue through i18n routing without checking auth", async () => {
    const request = new NextRequest("https://pandatrack.app/en/sign-in");

    const response = proxy(request);

    expect(getSessionCookieMock).not.toHaveBeenCalled();
    expect(handleI18nRoutingMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });
});
