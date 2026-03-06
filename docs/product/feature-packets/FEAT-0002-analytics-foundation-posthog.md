# Feature Packet - FEAT-0002 Analytics Foundation (PostHog)

## 0) Metadata
- Feature ID: `FEAT-0002`
- Feature name: Analytics foundation with PostHog
- Owner: Product + Engineering
- Status: `Done` (retroactive documentation)
- Priority: `P0`
- Date: `2026-03-06`
- Dependencies: `posthog-js`, `posthog-node`, `POSTHOG_EVENTS`
- Risk level: `Medium`

## 1) Product Requirements
### 1.1 Problem
The team needs reliable visibility into landing engagement and waitlist conversion behavior.

### 1.2 Goal
Track meaningful user interactions and waitlist outcomes using a centralized, consistent event model.

### 1.3 Scope
- In scope:
  - Client-side event capture for CTA clicks and interaction events
  - Server-side event capture for waitlist success/failure
  - Shared event naming via `POSTHOG_EVENTS`
- Out of scope:
  - Advanced funnel dashboards and product analytics for the private app

## 2) Functional Requirements
- `FR-1`: Client initializes PostHog once and captures clickable interactions via `data-ph-event`.
- `FR-2`: Event names are centralized in `src/lib/constants.ts` (`POSTHOG_EVENTS`).
- `FR-3`: Server captures waitlist success/failure with useful properties.
- `FR-4`: Waitlist success identifies users by email for segmentation.

## 3) Data Contract (Spec-First)
### 3.1 Inputs
- Event name: `string` (must come from `POSTHOG_EVENTS`)
- Event props: `Record<string, unknown>` (JSON serializable)
- Distinct ID (server waitlist): email string

### 3.2 Outputs
- PostHog event ingestion payloads (client + server)

### 3.3 Persistence and data access
- Persistence target: PostHog cloud
- Local persistence: none

### 3.4 Analytics events
- Landing: hero, banner, header, mobile menu, FAQ, social links
- Waitlist: submitted, success, failed, share interactions

## 4) UX + i18n Checklist
- No user-visible copy dependency
- Instrumentation must not block UX flow

## 5) Acceptance Criteria (Testable)
- `AC-1`: Meaningful landing CTA interactions produce corresponding events.
- `AC-2`: Valid waitlist submit captures `waitlist_submitted` client event.
- `AC-3`: Successful server submit captures `waitlist_success` and identify call.
- `AC-4`: Failed server submit captures `waitlist_failed`.

## 6) Test Plan
- Unit: `serializePosthogProps` and data-attribute generation behavior
- Integration: waitlist server action captures expected events
- Regression: no hardcoded event names outside constants map

## 7) ADR Reference
- Requires ADR: `No`

## 8) Definition of Done
- Global DoD link: `docs/process/definition-of-done.md`
- Feature-specific DoD additions:
  - All new event names centralized in `POSTHOG_EVENTS`
  - Critical flow events validated in dev

## 9) Open Questions
- Should we add a strict event schema per event name to enforce property consistency?
