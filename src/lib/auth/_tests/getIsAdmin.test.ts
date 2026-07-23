import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { getIsAdmin } from "../auth-server";

function sessionWithRole(role: unknown) {
  return { user: { id: "user-1", email: "owner@example.com", role } };
}

describe("getIsAdmin", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("grants admin for the admin role", () => {
    expect(getIsAdmin(sessionWithRole("admin"))).toBe(true);
  });

  it("grants admin for a multi-role value that includes admin", () => {
    expect(getIsAdmin(sessionWithRole("moderator,admin"))).toBe(true);
  });

  it("refuses a plain user role", () => {
    expect(getIsAdmin(sessionWithRole("user"))).toBe(false);
  });

  it("uses membership, not substring: a role of administrator is refused", () => {
    expect(getIsAdmin(sessionWithRole("administrator"))).toBe(false);
  });

  it("refuses when there is no session", () => {
    expect(getIsAdmin(null)).toBe(false);
  });

  it("refuses when the role is missing", () => {
    expect(getIsAdmin(sessionWithRole(undefined))).toBe(false);
  });

  // The allowlist is retired: the database role is the single authority (BR-01-01).
  it("no longer consults ADMIN_EMAILS: a listed email without the admin role is refused", () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    expect(getIsAdmin(sessionWithRole("user"))).toBe(false);
  });

  it("no longer consults ADMIN_EMAILS: the admin role alone grants access with the allowlist unset", () => {
    expect(process.env.ADMIN_EMAILS).toBeUndefined();
    expect(getIsAdmin(sessionWithRole("admin"))).toBe(true);
  });

  // Store auto-approval and direct edit both branch on this single boolean, so an admin-role session
  // resolving to true is the unit-level guarantee that both behaviors keep working after the cutover.
  it("resolves the admin-role session to the true gate that both admin behaviors read", () => {
    expect(getIsAdmin(sessionWithRole("admin"))).toBe(true);
  });
});
