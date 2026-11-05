import { describe, expect, it } from "vitest";
import { getSentryTracesSampleRate } from "@/lib/constants";

describe("Sentry trace sampling", () => {
  it("samples production traces at ten percent and other environments at full rate", () => {
    expect(getSentryTracesSampleRate("production")).toBe(0.1);
    expect(getSentryTracesSampleRate("preview")).toBe(1);
    expect(getSentryTracesSampleRate("development")).toBe(1);
  });
});
