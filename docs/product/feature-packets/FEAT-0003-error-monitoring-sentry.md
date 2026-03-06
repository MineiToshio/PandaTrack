# Feature Packet - FEAT-0003 Error Monitoring (Sentry)

## 0) Metadata
- Feature ID: `FEAT-0003`
- Feature name: Sentry error monitoring baseline
- Owner: Engineering
- Status: `Done` (retroactive documentation)
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: `@sentry/nextjs`, Next.js instrumentation hooks
- Risk level: `Medium`

## 1) Product Requirements
### 1.1 Problem
Unexpected runtime errors can silently break experience and reduce trust without actionable diagnostics.

### 1.2 Goal
Capture runtime exceptions across client, server, edge, and global error boundaries.

### 1.3 Scope
- In scope:
  - Sentry initialization for client/server/edge
  - Request error capture via instrumentation
  - Global error boundary exception capture
- Out of scope:
  - Alert routing/playbooks
  - Full issue triage workflow documentation

## 2) Functional Requirements
- `FR-1`: Sentry initializes on client, server, and edge runtimes.
- `FR-2`: Request-level errors are captured via `onRequestError`.
- `FR-3`: Global App Router errors are captured in `global-error.tsx`.
- `FR-4`: Monitoring is non-blocking for user interaction flow.

## 3) Data Contract (Spec-First)
### 3.1 Inputs
- Error object from runtime boundaries or caught exceptions
- Runtime context: client/server/edge

### 3.2 Outputs
- Sentry events with stack traces and runtime metadata

### 3.3 Persistence and data access
- Persistence target: Sentry project
- Local persistence: none

## 4) UX + i18n Checklist
- On global error, default Next.js error UI is rendered
- No locale-sensitive copy added in monitoring code

## 5) Acceptance Criteria (Testable)
- `AC-1`: Client-side unhandled exceptions are visible in Sentry.
- `AC-2`: Server runtime exceptions are visible in Sentry.
- `AC-3`: Edge runtime exceptions are visible in Sentry.
- `AC-4`: Global App Router errors are captured through `global-error.tsx`.

## 6) Test Plan
- Integration: trigger controlled errors in client/server and verify Sentry capture
- Regression: ensure no duplicate manual captures for same boundary event

## 7) ADR Reference
- Requires ADR: `No`

## 8) Definition of Done
- Global DoD link: `docs/process/definition-of-done.md`
- Feature-specific DoD additions:
  - Monitoring enabled in all required runtimes

## 9) Open Questions
- Should `sendDefaultPii` remain enabled in production?
- Should DSN move fully to environment variables for all Sentry files?
