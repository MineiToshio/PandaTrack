import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssetRemotePatterns } from "../assetRemotePatterns";

const PRODUCTION_LOGO_URL = "https://assets.pandatrack.app/store-logos/store-id.webp?v=51f5e703ca19";
const DEV_LOGO_URL = "https://pub-0123456789abcdef.r2.dev/store-logos/store-id.webp?v=7156be40bd2d";

function isOptimizable(patterns: ReturnType<typeof getAssetRemotePatterns>, assetUrl: string): boolean {
  return hasRemoteMatch([], patterns, new URL(assetUrl));
}

describe("getAssetRemotePatterns", () => {
  it("lets next/image optimize a logo served from a custom asset domain", () => {
    const patterns = getAssetRemotePatterns("https://assets.pandatrack.app");

    expect(isOptimizable(patterns, PRODUCTION_LOGO_URL)).toBe(true);
  });

  it("accepts the production base even when it is configured as a bare host", () => {
    expect(isOptimizable(getAssetRemotePatterns("assets.pandatrack.app"), PRODUCTION_LOGO_URL)).toBe(true);
  });

  it("keeps the bucket's r2.dev URL optimizable whatever the configured base is", () => {
    expect(isOptimizable(getAssetRemotePatterns("https://assets.pandatrack.app"), DEV_LOGO_URL)).toBe(true);
    expect(isOptimizable(getAssetRemotePatterns(undefined), DEV_LOGO_URL)).toBe(true);
  });

  it("does not open the optimizer to hosts other than the configured one", () => {
    const patterns = getAssetRemotePatterns("https://assets.pandatrack.app");

    expect(isOptimizable(patterns, "https://evil.example.com/logo.webp")).toBe(false);
    expect(isOptimizable(patterns, "https://other.pandatrack.app/logo.webp")).toBe(false);
  });

  it("ignores a missing, blank or malformed base instead of throwing at config load", () => {
    expect(getAssetRemotePatterns(undefined)).toEqual([{ protocol: "https", hostname: "*.r2.dev" }]);
    expect(getAssetRemotePatterns("   ")).toEqual([{ protocol: "https", hostname: "*.r2.dev" }]);
    expect(getAssetRemotePatterns("not a url")).toEqual([{ protocol: "https", hostname: "*.r2.dev" }]);
    expect(getAssetRemotePatterns("ftp://assets.pandatrack.app")).toEqual([
      { protocol: "https", hostname: "*.r2.dev" },
    ]);
  });
});

describe("next.config.ts image remotePatterns", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts every logo URL the upload builds from ASSETS_PUBLIC_BASE_URL", async () => {
    vi.stubEnv("ASSETS_PUBLIC_BASE_URL", "assets.pandatrack.app");
    vi.resetModules();

    const { default: nextConfig } = await import("../../../../next.config");
    const remotePatterns = nextConfig.images?.remotePatterns ?? [];

    expect(hasRemoteMatch([], remotePatterns, new URL(PRODUCTION_LOGO_URL))).toBe(true);
  });
});
