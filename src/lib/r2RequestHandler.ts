import { NodeHttpHandler, type NodeHttpHandlerOptions } from "@smithy/node-http-handler";

/**
 * Shared timeout configuration for every R2 (S3-compatible) client in the app.
 *
 * `@aws-sdk/client-s3`'s default request handler (`@smithy/node-http-handler`) leaves both
 * `connectionTimeout` and `requestTimeout` DISABLED (`0`) out of the box, and `requestTimeout` alone
 * only logs a warning on expiry rather than aborting the request unless `throwOnRequestTimeout` is
 * also set. Without this, a hung connection to R2 (store logo or avatar uploads/deletes) blocks the
 * caller indefinitely instead of failing loudly and letting the caller's own error handling and
 * Sentry capture run.
 *
 * Exported as a plain options object, not only through `createR2RequestHandler()`, so tests can
 * assert on the literal values without reaching into `NodeHttpHandler`'s own private, unresolved
 * config promise.
 */
const R2_CONNECTION_TIMEOUT_MS = 3_000;
const R2_REQUEST_TIMEOUT_MS = 8_000;

export const R2_REQUEST_HANDLER_OPTIONS: NodeHttpHandlerOptions = {
  connectionTimeout: R2_CONNECTION_TIMEOUT_MS,
  requestTimeout: R2_REQUEST_TIMEOUT_MS,
  throwOnRequestTimeout: true,
};

export function createR2RequestHandler(): NodeHttpHandler {
  return new NodeHttpHandler(R2_REQUEST_HANDLER_OPTIONS);
}
