import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMAGE_INTAKE_LOG_PREFIX,
  countPartialResponseShape,
  reportImageIntakeFailure,
} from "../diagnostics";

vi.mock("@sentry/nextjs", () => ({
  withScope: (run: (scope: unknown) => void) => {
    run({ setTag: vi.fn(), setContext: vi.fn() });
  },
  captureMessage: vi.fn(),
}));

const BASE = {
  stage: "provider" as const,
  code: "GEMINI_RESPONSE_TRUNCATED",
  reportedAs: "response-too-long",
  model: "gemini-3.1-flash-lite",
  imageCount: 2,
  imageBytes: 320_000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reportImageIntakeFailure", () => {
  it("writes exactly one greppable line carrying every present field", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    reportImageIntakeFailure({ ...BASE, outputTokens: 32000, maxOutputTokens: 32000, productsEmitted: 412 });

    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line.startsWith(`${IMAGE_INTAKE_LOG_PREFIX} failure `)).toBe(true);
    expect(line).toContain("code=GEMINI_RESPONSE_TRUNCATED");
    expect(line).toContain("reportedAs=response-too-long");
    expect(line).toContain("outputTokens=32000");
    expect(line).toContain("productsEmitted=412");
  });

  it("omits absent fields instead of printing null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    reportImageIntakeFailure({ ...BASE, thoughtsTokens: null, productsEmitted: undefined });

    const line = warn.mock.calls[0][0] as string;
    expect(line).not.toContain("thoughtsTokens");
    expect(line).not.toContain("productsEmitted");
    expect(line).not.toContain("null");
  });

  it("never leaks the internal capture flag into the line", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    reportImageIntakeFailure({ ...BASE, captureToSentry: false });

    expect(warn.mock.calls[0][0]).not.toContain("captureToSentry");
  });

  it("still logs, and never throws, when the reporting itself fails", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("stdout gone");
    });

    // The reporter runs on paths that are already failing; it must never convert a handled outcome
    // into an unhandled exception.
    expect(() => reportImageIntakeFailure(BASE)).not.toThrow();
  });
});

describe("countPartialResponseShape", () => {
  it("counts one entry per object of each kind", () => {
    const partial =
      '{"groups":[{"sourcePhrase":"a","products":[{"name":"x","unitPrice":10},{"name":"y","unitPrice":20}]},' +
      '{"sourcePhrase":"b","products":[{"name":"z","unitPrice":30}]}],"payments":[{"paidAt":"2026-01-01"}]';

    expect(countPartialResponseShape(partial)).toEqual({
      partialChars: partial.length,
      groupsEmitted: 2,
      productsEmitted: 3,
      paymentsEmitted: 1,
    });
  });

  it("counts a repetition loop as the large product count it is", () => {
    // The signal the truncation diagnosis rests on: hundreds of products from a couple of chat
    // screenshots is a looping model, not an enormous order, and only the count can tell them apart.
    const looped = '{"groups":[{"sourcePhrase":"a","products":[' + '{"name":"x","unitPrice":1},'.repeat(400);

    expect(countPartialResponseShape(looped).productsEmitted).toBe(400);
    expect(countPartialResponseShape(looped).groupsEmitted).toBe(1);
  });

  it("reads nothing out of the values, so no content can reach a log", () => {
    const secretish = '{"groups":[{"sourcePhrase":"+51 999 888 777 Juan","products":[{"name":"Nendoroid","unitPrice":245}]}]';
    const shape = countPartialResponseShape(secretish);

    expect(Object.values(shape).every((value) => typeof value === "number")).toBe(true);
  });

  it("handles an empty body without inventing counts", () => {
    expect(countPartialResponseShape("")).toEqual({
      partialChars: 0,
      groupsEmitted: 0,
      productsEmitted: 0,
      paymentsEmitted: 0,
    });
  });
});
