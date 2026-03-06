# Feature Packet - FEAT-0001 Pre-release Landing and Waitlist Capture

## 0) Metadata

- Feature ID: `FEAT-0001`
- Feature name: Pre-release landing and waitlist capture
- Owner: Product + Engineering
- Status: `Done` (retroactive documentation)
- Priority: `P0`
- Date: `2026-03-05`
- Dependencies: `next-intl`, `PostHog`, `Kit API`, optional `Google Apps Script`
- Risk level: `Medium`

## Lifecycle note

- This packet documents the pre-release waitlist phase.
- It is expected to be superseded for CTA/auth entry behavior by `FEAT-0008-auth-core-authorization-verify-email.md` when auth-first landing CTAs are shipped.

## 1) Product Requirements

### 1.1 Problem

Before the main app is ready, PandaTrack needs a credible pre-release presence to explain the value proposition and capture early-interest user data in a structured way.

### 1.2 Goal

Use a public landing page to convert visitors into waitlist subscribers, while collecting enough data to validate demand and prepare launch communications.

### 1.3 Target user

Collectors who buy across multiple stores/channels and experience tracking/payment uncertainty.

### 1.4 Scope

- In scope:
  - Public landing with product narrative and trust-building sections
  - Waitlist form with required email and optional name/comment
  - Locale support (`es`, `en`)
  - Event tracking for meaningful interactions and waitlist outcomes
  - Subscriber creation in Kit and optional row append to Google Sheet
- Out of scope:
  - Authenticated product workflows (stores, purchases, payments, shipments)
  - Post-launch positioning for a fully available app
  - In-app dashboard functionality

### 1.5 Primary flow

1. Visitor lands on `/[locale]` and sees product value sections (hero, user fit, features, FAQ).
2. Visitor clicks CTA and submits waitlist form.
3. System validates input, creates/updates subscriber, tracks events, and shows success share state.

### 1.6 Edge cases

- Case: invalid or empty email
  - Expected behavior: form-level validation error; no submit request.
- Case: external provider failure (Kit)
  - Expected behavior: return generic submit error state and track failure event.
- Case: locale tagging failure after successful signup
  - Expected behavior: do not block signup success; log server error.
- Case: Google Sheet append failure
  - Expected behavior: do not block signup success; log server error.

### 1.7 Success metrics

- Product metric: waitlist signup conversion rate (visitor -> `waitlist_success`).
- UX metric: successful form completion rate among users who start form submission.
- Guardrail metric: waitlist failure rate (`waitlist_failed` / `waitlist_submitted`) under agreed threshold.

## 2) Functional Requirements

### 2.1 Functional requirements

- `FR-1`: Landing page must render key pre-release sections in order: hero, user fit, features, banner, FAQs, waitlist, footer.
- `FR-2`: Waitlist form must require a valid email and allow optional name/comment.
- `FR-3`: On valid submit, system must create/update subscriber in Kit.
- `FR-4`: On valid submit, system must attempt locale tag when locale and tag mapping are available.
- `FR-5`: On successful submit, UI must switch from form to share state.
- `FR-6`: System must track waitlist submit/success/failure analytics events.
- `FR-7`: System must append successful submissions to Google Sheet when webhook URL is configured.

### 2.2 Non-functional requirements

- Performance: landing should remain lightweight and responsive across mobile/tablet/desktop.
- Security: API keys remain server-side; client receives no secrets.
- Accessibility: form labels, error announcement, keyboard support, and semantic sections are required.
- Observability: failures are logged and major actions are tracked in PostHog.

### 2.3 Business rules

- `BR-1`: `email` is required and must pass email format validation.
- `BR-2`: `name` and `comment` are optional and may be empty.
- `BR-3`: Locale tag assignment is best-effort and must not fail the signup.
- `BR-4`: Google Sheet append is best-effort and must not fail the signup.
- `BR-5`: Waitlist signup result state must be one of: success, submit error, or field errors.

### 2.4 State model

- Initial state: `idle`
- Allowed transitions:
  - `idle -> validating` when user submits form.
  - `validating -> field_error` when local/server validation fails.
  - `validating -> submitting` when payload is valid.
  - `submitting -> success` when subscriber creation succeeds.
  - `submitting -> submit_error` when subscriber creation fails.

## 3) Data Contract (Spec-First)

### 3.1 Inputs

- Field: `email`
  - Type: `string`
  - Required: `Yes`
  - Validation: non-empty + valid email (`emailRequired`, `emailInvalid`)
  - Error code/message: `emailRequired`, `emailInvalid`
- Field: `name`
  - Type: `string | undefined`
  - Required: `No`
  - Validation: trimmed; empty -> `undefined`
  - Error code/message: none
- Field: `comment`
  - Type: `string | undefined`
  - Required: `No`
  - Validation: trimmed; empty -> `undefined`
  - Error code/message: none
- Field: `locale`
  - Type: `"es" | "en" | ""`
  - Required: hidden form field, best-effort
  - Validation: accepted only if in supported locales
  - Error code/message: ignored when invalid

### 3.2 Outputs

- Output: `SubmitWaitlistResult`
  - Type: `{ success: true } | { success: false; error: string } | { success: false; fieldErrors: Record<string, string[]> }`
  - Meaning: drives waitlist UI state (success vs recoverable error states)

### 3.3 Persistence and data access

- Prisma models affected: none
- Query modules affected: none
- Atomic write required (`transaction`): `No`
- External writes:
  - Kit subscriber create/update (primary)
  - Kit locale tag (best-effort)
  - Google Sheet append (best-effort)
- Constraints/indexes:
  - Kit handles subscriber upsert by email

### 3.4 Analytics

- Event (`POSTHOG_EVENTS.LANDING.HERO_CTA_CLICKED`): hero waitlist CTA click
- Event (`POSTHOG_EVENTS.LANDING.BANNER_CTA_CLICKED`): mid-page CTA click
- Event (`POSTHOG_EVENTS.LANDING.HEADER_CTA_CLICKED`): header CTA click
- Event (`POSTHOG_EVENTS.LANDING.WAITLIST.SUBMITTED`): valid client submit intent
- Event (`POSTHOG_EVENTS.LANDING.WAITLIST.SUCCESS`): server-side successful signup
- Event (`POSTHOG_EVENTS.LANDING.WAITLIST.FAILED`): server-side failed signup
- Event (`POSTHOG_EVENTS.LANDING.WAITLIST.SHARE_*`): share and copy actions
- Event (`POSTHOG_EVENTS.LANDING.FAQ_ITEM_TOGGLED`): FAQ engagement

## 4) UX + i18n Checklist

- Affected routes/screens:
  - `src/app/[locale]/(landing)/page.tsx`
  - `src/app/[locale]/(landing)/_components/*`
- Reused components:
  - `Button`, `Input`, `Textarea`, `Heading`, `Typography`, `FaqAccordion`
- Locale keys:
  - `src/i18n/locales/es/landing.json`
  - `src/i18n/locales/en/landing.json`
- Locales completed: `es`, `en`
- UX states: loading/pending, field validation error, submit error, success/share
- Accessibility: labels, `aria-invalid`, `role="alert"`, semantic sections and headings

## 5) Acceptance Criteria (Testable)

### `AC-1`

- Given a user on `/es` or `/en`
- When the landing page loads
- Then hero, user fit, features, FAQ, waitlist, and footer sections are visible and navigable.

### `AC-2`

- Given a user submits the waitlist form with invalid email
- When submit is attempted
- Then the form shows a localized email validation error and does not call successful submission flow.

### `AC-3`

- Given a user submits the form with a valid email
- When Kit subscriber creation succeeds
- Then the UI shows success/share state and records `waitlist_success`.

### `AC-4`

- Given locale tagging or Google Sheet append fails after a successful Kit subscriber creation
- When post-submit side effects run
- Then signup still returns success and non-blocking errors are logged.

### `AC-5`

- Given Kit subscriber creation fails
- When submit is processed
- Then the UI shows a generic localized error and records `waitlist_failed`.

## 6) Test Plan

- Unit tests:
  - `waitlistSchema` validation behavior
  - `submitWaitlist` result mapping for success and failure branches
- Integration tests:
  - server action integration with mocked Kit/PostHog/Google Sheet services
- E2E tests (if applicable):
  - landing submit happy path
  - invalid email path
  - provider failure path
- Regression checks:
  - CTA links still scroll to `#waitlist`
  - locale routing and localized copy remain intact

Current status note: automated tests for this feature are not yet documented in this packet and should be added in a follow-up.

## 7) ADR Reference

- Requires ADR: `No`
- Rationale: implementation introduces integrations and flow logic but no new cross-feature architecture rule.

## 8) Definition of Done

- Global DoD link: `docs/process/definition-of-done.md`
- Feature-specific DoD additions:
  - Waitlist data must be capturable even during pre-release phase.
  - Failure in secondary sinks (tagging/sheet append) must not block successful signup.

## 9) AI Prompt Pack Reference

- Implementation prompt link: `docs/templates/prompt-pack-template.md`
- Review prompt link: `docs/templates/prompt-pack-template.md`
- Bugfix prompt link: `docs/templates/prompt-pack-template.md`
- Test-generation prompt link: `docs/templates/prompt-pack-template.md`

## 10) Open Questions

- When the full app is launched, should this landing keep the waitlist flow, switch to direct signup, or split by route?
- Should we persist waitlist entries in first-party database (Prisma) in addition to external sinks?
- What is the final conversion KPI target for this pre-release phase?
