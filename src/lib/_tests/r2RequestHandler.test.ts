import { NodeHttpHandler } from "@smithy/node-http-handler";
import { describe, expect, it } from "vitest";
import { createR2RequestHandler, R2_REQUEST_HANDLER_OPTIONS } from "../r2RequestHandler";

/**
 * `@smithy/node-http-handler`'s own defaults leave `connectionTimeout` and `requestTimeout`
 * DISABLED (0), and `requestTimeout` alone only warns on expiry unless `throwOnRequestTimeout` is
 * also set. `NodeHttpHandler` resolves its options into a private, asynchronously-populated config
 * that is not reachable without an actual request, so this asserts on the real options object every
 * R2 client is constructed with instead.
 */
describe("createR2RequestHandler", () => {
  it("returns a real NodeHttpHandler instance", () => {
    expect(createR2RequestHandler()).toBeInstanceOf(NodeHttpHandler);
  });

  it("sets a connection timeout, so a stalled TCP handshake to R2 does not hang forever", () => {
    expect(R2_REQUEST_HANDLER_OPTIONS.connectionTimeout).toBeGreaterThan(0);
  });

  it("sets a request timeout that actually aborts the request, not just warns", () => {
    expect(R2_REQUEST_HANDLER_OPTIONS.requestTimeout).toBeGreaterThan(0);
    // The SDK's own default only logs a warning when requestTimeout elapses; without this flag the
    // request keeps running instead of failing, which defeats the timeout entirely.
    expect(R2_REQUEST_HANDLER_OPTIONS.throwOnRequestTimeout).toBe(true);
  });
});
