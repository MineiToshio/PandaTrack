import { NextRequest, NextResponse } from "next/server";
import proxy from "@/proxy";
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

  it("lets public routes continue through i18n routing without checking auth", async () => {
    const request = new NextRequest("https://pandatrack.app/en/sign-in");

    const response = proxy(request);

    expect(getSessionCookieMock).not.toHaveBeenCalled();
    expect(handleI18nRoutingMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });
});
