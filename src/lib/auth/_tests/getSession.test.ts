import { beforeEach, describe, expect, it, vi } from "vitest";

const { authGetSessionMock, requestHeaders } = vi.hoisted(() => ({
  authGetSessionMock: vi.fn(),
  requestHeaders: new Headers({ cookie: "better-auth.session_token=abc" }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: authGetSessionMock,
    },
  },
}));

import { getSession } from "../auth-server";

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A refresh from a Server Component moves the database expiry but cannot rewrite the cookie, so
  // the cookie would lapse on its original date and sign the collector out.
  it("reads the session without refreshing it", async () => {
    authGetSessionMock.mockResolvedValue(null);

    await getSession();

    expect(authGetSessionMock).toHaveBeenCalledWith({
      headers: requestHeaders,
      query: { disableRefresh: true },
    });
  });
});
