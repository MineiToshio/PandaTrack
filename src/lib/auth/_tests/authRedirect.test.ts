import {
  AUTH_RETURN_TO_PARAM,
  buildAuthAlternativeHref,
  buildVerificationConfirmHref,
  buildVerificationStatusHref,
  getLocaleSegment,
  resolveAuthCallbackURL,
} from "@/lib/auth/authRedirect";
import { describe, expect, it } from "vitest";

describe("authRedirect", () => {
  describe("getLocaleSegment", () => {
    it("returns the locale when the pathname starts with a supported locale", () => {
      expect(getLocaleSegment("/en/dashboard")).toBe("en");
      expect(getLocaleSegment("/es")).toBe("es");
    });

    it("returns null for non-localized paths", () => {
      expect(getLocaleSegment("/dashboard")).toBeNull();
      expect(getLocaleSegment("/fr/dashboard")).toBeNull();
    });
  });

  describe("resolveAuthCallbackURL", () => {
    it("falls back to the localized dashboard for missing or unsafe return targets", () => {
      expect(resolveAuthCallbackURL("en")).toBe("/en/dashboard");
      expect(resolveAuthCallbackURL("en", "https://malicious.example")).toBe("/en/dashboard");
      expect(resolveAuthCallbackURL("en", "//malicious.example")).toBe("/en/dashboard");
      expect(resolveAuthCallbackURL("en", "/en/sign-in")).toBe("/en/dashboard");
    });

    it("keeps safe in-app targets and localizes root paths", () => {
      expect(resolveAuthCallbackURL("es", "/payments?tab=upcoming")).toBe("/es/payments?tab=upcoming");
      expect(resolveAuthCallbackURL("en", "/")).toBe("/en");
    });

    it("normalizes cross-locale private targets back to the active locale dashboard", () => {
      expect(resolveAuthCallbackURL("es", "/en/dashboard?tab=summary")).toBe("/es/dashboard?tab=summary");
    });
  });

  describe("link builders", () => {
    it("omits the returnTo parameter when the default dashboard callback is used", () => {
      expect(buildAuthAlternativeHref("/sign-up", "en")).toBe("/en/sign-up");
    });

    it("adds a sanitized returnTo parameter for non-default callbacks", () => {
      const href = buildAuthAlternativeHref("/sign-in", "es", "/payments?tab=upcoming");
      const parsedHref = new URL(href, "https://pandatrack.local");

      expect(parsedHref.pathname).toBe("/es/sign-in");
      expect(parsedHref.searchParams.get(AUTH_RETURN_TO_PARAM)).toBe("/es/payments?tab=upcoming");
    });

    it("builds verification status and confirm links with sanitized callbacks", () => {
      const statusHref = new URL(buildVerificationStatusHref("en", "/es/shipments"), "https://pandatrack.local");
      const confirmHref = new URL(
        buildVerificationConfirmHref("en", "token-123", "/sign-in"),
        "https://pandatrack.local",
      );

      expect(statusHref.pathname).toBe("/en/verify-email");
      expect(statusHref.searchParams.get(AUTH_RETURN_TO_PARAM)).toBe("/en/dashboard");
      expect(confirmHref.pathname).toBe("/en/verify-email/confirm");
      expect(confirmHref.searchParams.get("token")).toBe("token-123");
      expect(confirmHref.searchParams.get(AUTH_RETURN_TO_PARAM)).toBe("/en/dashboard");
    });
  });
});
