import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

import { AdminAccessError, requireAdmin } from "../auth-server";

function sessionWithRole(role: string | null | undefined) {
  return {
    session: { id: "session-1", userId: "user-1" },
    user: { id: "user-1", email: "admin@example.com", role },
  };
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the resolved session for an admin user", async () => {
    const session = sessionWithRole("admin");
    getSessionMock.mockResolvedValue(session);

    await expect(requireAdmin()).resolves.toBe(session);
  });

  it("grants access when admin is one of several comma-separated roles", async () => {
    const session = sessionWithRole("moderator,admin");
    getSessionMock.mockResolvedValue(session);

    await expect(requireAdmin()).resolves.toBe(session);
  });

  it("refuses a non-admin user before any work runs", async () => {
    getSessionMock.mockResolvedValue(sessionWithRole("user"));

    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessError);
  });

  it("refuses when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessError);
  });

  it("uses membership, not substring: a role of administrator is refused", async () => {
    getSessionMock.mockResolvedValue(sessionWithRole("administrator"));

    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessError);
  });

  it("refuses when the role is missing", async () => {
    getSessionMock.mockResolvedValue(sessionWithRole(undefined));

    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminAccessError);
  });
});
