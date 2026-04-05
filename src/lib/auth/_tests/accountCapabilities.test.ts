import { describe, expect, it } from "vitest";
import { deriveAccountCapabilities } from "@/lib/auth/accountCapabilities";

describe("deriveAccountCapabilities", () => {
  it("allows email change only for credential-only accounts", () => {
    expect(deriveAccountCapabilities(["credential"])).toMatchObject({
      canChangeEmail: true,
      canChangePassword: true,
      canSetPassword: false,
    });
  });

  it("blocks email change for Google-only and linked accounts", () => {
    expect(deriveAccountCapabilities(["google"])).toMatchObject({
      canChangeEmail: false,
      canSetPassword: true,
      canChangePassword: false,
    });
    expect(deriveAccountCapabilities(["google", "credential"])).toMatchObject({
      canChangeEmail: false,
      canChangePassword: true,
      canSetPassword: false,
    });
  });
});
