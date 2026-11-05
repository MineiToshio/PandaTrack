/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSentryTracesSampleRate } from "@/lib/constants";

const { initMock } = vi.hoisted(() => ({ initMock: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({
  init: initMock,
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
  captureRouterTransitionStart: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: { init: vi.fn(), capture: vi.fn() } }));

const CONFIGS = [
  { name: "server", load: () => import("../../sentry.server.config") },
  { name: "edge", load: () => import("../../sentry.edge.config") },
  { name: "client", load: () => import("../instrumentation-client") },
];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe("Sentry trace sampling", () => {
  it("samples production traces at ten percent and other environments at full rate", () => {
    expect(getSentryTracesSampleRate("production")).toBe(0.1);
    expect(getSentryTracesSampleRate("preview")).toBe(1);
    expect(getSentryTracesSampleRate("development")).toBe(1);
  });

  describe.each([
    { environment: "production", rate: 0.1 },
    { environment: "preview", rate: 1 },
    { environment: "development", rate: 1 },
  ])("$environment runtime configuration", ({ environment, rate }) => {
    it.each(CONFIGS)("passes the expected rate to Sentry.init in $name", async ({ load }) => {
      vi.stubEnv("VERCEL_ENV", environment);
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", environment);
      vi.stubEnv("NODE_ENV", "production");
      await load();
      expect(initMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ environment, tracesSampleRate: rate }),
      );
    });
  });
});
