# Sentry Implementation Notes

## Purpose

Technical reference for error monitoring setup in PandaTrack.

## Current architecture

- Client init: `src/instrumentation-client.ts`
- Server init: `sentry.server.config.ts`
- Edge init: `sentry.edge.config.ts`
- Runtime registration: `src/instrumentation.ts`
- Global error boundary capture: `src/app/global-error.tsx`

## Capture points

- Runtime request errors via `onRequestError`
- Global App Router errors via `Sentry.captureException(error)`
- Additional targeted catches in server actions when needed

## Guardrails

- Avoid duplicate captures for the same failure path.
- Do not include secrets or sensitive payloads in context.
- Capture unexpected errors; handle expected validation errors without noisy reporting.

## Open hardening items

- Move DSN and sensitive options fully to environment variables if not already externalized.
- Review `sendDefaultPii` and sampling rates for production policy.
