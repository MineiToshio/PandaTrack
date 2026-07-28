import { describe, expect, it } from "vitest";
import { decideAdminGrant, resolveBootstrapEmail } from "../adminBootstrap";

describe("resolveBootstrapEmail", () => {
  it("normalizes a valid CLI email to trimmed lowercase", () => {
    expect(resolveBootstrapEmail("  Owner@Example.COM  ", undefined)).toBe("owner@example.com");
  });

  it("falls back to the environment value when no CLI argument is given", () => {
    expect(resolveBootstrapEmail(undefined, "env@example.com")).toBe("env@example.com");
  });

  it("prefers the CLI argument over the environment value", () => {
    expect(resolveBootstrapEmail("cli@example.com", "env@example.com")).toBe("cli@example.com");
  });

  it("throws when neither source provides a value", () => {
    expect(() => resolveBootstrapEmail(undefined, undefined)).toThrow(/valid admin email is required/i);
  });

  it("throws for a malformed email", () => {
    expect(() => resolveBootstrapEmail("not-an-email", undefined)).toThrow(/valid admin email is required/i);
  });
});

describe("decideAdminGrant", () => {
  it("grants admin to a default user account", () => {
    expect(decideAdminGrant("user")).toEqual({ kind: "grant", role: "admin" });
  });

  it("is a no-op when the account already has the admin role", () => {
    expect(decideAdminGrant("admin")).toEqual({ kind: "noop", role: "admin" });
  });

  it("is a no-op that preserves a multi-role value already granting admin", () => {
    expect(decideAdminGrant("moderator,admin")).toEqual({ kind: "noop", role: "moderator,admin" });
  });

  it("grants admin when the role is null or empty", () => {
    expect(decideAdminGrant(null)).toEqual({ kind: "grant", role: "admin" });
    expect(decideAdminGrant(undefined)).toEqual({ kind: "grant", role: "admin" });
    expect(decideAdminGrant("")).toEqual({ kind: "grant", role: "admin" });
  });

  it("uses membership, not substring: administrator still needs the grant", () => {
    expect(decideAdminGrant("administrator")).toEqual({ kind: "grant", role: "admin" });
  });
});
