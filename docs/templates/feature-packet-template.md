# Feature Packet Template

## 0) Metadata

- Feature ID: `FEAT-XXXX`
- Feature name:
- Owner:
- Status: `Draft | Ready | In Progress | Review | Done`
- Priority: `P0 | P1 | P2`
- Date:
- Dependencies:
- Risk level: `Low | Medium | High`

## 1) Product Requirements

### 1.1 Problem

Describe the user problem this feature solves.

### 1.2 Goal

Define the intended product/business outcome.

### 1.3 Target user

Specify who uses this and under which context.

### 1.4 Scope

- In scope:
- Out of scope:

### 1.5 Primary flow

1.
2.
3.

### 1.6 Edge cases

- Case:
  - Expected behavior:

### 1.7 Success metrics

- Product metric:
- UX metric:
- Guardrail metric:

## 2) Functional Requirements

### 2.1 Functional requirements

- `FR-1`:
- `FR-2`:
- `FR-3`:

### 2.2 Non-functional requirements

- Performance:
- Security:
- Accessibility:
- Observability:

### 2.3 Business rules

- `BR-1`:
- `BR-2`:

### 2.4 State model

- Initial state:
- Allowed transitions:
  - `State A -> State B` when:

## 3) Data Contract (Spec-First)

### 3.1 Inputs

- Field:
  - Type:
  - Required:
  - Validation:
  - Error code/message:

### 3.2 Outputs

- Field:
  - Type:
  - Meaning:

### 3.3 Persistence and data access

- Prisma models affected:
- Query modules affected:
- Atomic write required (`transaction`): `Yes | No`
- Constraints/indexes:

### 3.4 Analytics

- Event (`POSTHOG_EVENTS.*`):
  - Trigger:
  - Required props:

## 4) UX + i18n Checklist

- Affected routes/screens:
- Reused components (`src/components/core`, `src/components/modules`):
- New locale keys:
- Locales completed: `es`, `en`
- UX states: loading, empty, error, success
- Accessibility: labels, keyboard, focus, announcements

## 5) Acceptance Criteria (Testable)

### `AC-1`

- Given:
- When:
- Then:

### `AC-2`

- Given:
- When:
- Then:

### `AC-3` (edge/error)

- Given:
- When:
- Then:

## 6) Test Plan

- Unit tests:
- Integration tests:
- E2E tests (if applicable):
- Regression checks:

## 7) ADR Reference

- Requires ADR: `Yes | No`
- If yes, link to ADR:

## 8) Definition of Done

Reference global DoD and add only feature-specific additions.

- Global DoD link:
- Feature-specific DoD additions:

## 9) AI Prompt Pack Reference

- Implementation prompt link:
- Review prompt link:
- Bugfix prompt link:
- Test-generation prompt link:

## 10) Open Questions

-

## 11) Implementation Slices

Use implementation slices to plan delivery in small end-to-end increments. This section is required.

### Slice 1 - [Short title]

- Goal:
- ## Scope:
- ## Exit criteria:

### Slice 2 - [Short title]

- Goal:
- ## Scope:
- ## Exit criteria:

### Slice 3 - [Short title]

- Goal:
- ## Scope:
- ## Exit criteria:
