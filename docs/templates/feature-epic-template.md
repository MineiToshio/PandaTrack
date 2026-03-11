# Feature Epic Template

Use this template as the Epic issue body in GitHub Project (source of truth), not as a local tracking file.

## 0) Metadata

- Feature ID: `FEAT-XXXX`
- Feature name:
- Owner:
- Epic issue title: `FEAT-XXXX: <feature name>`
- Epic issue label: `type:epic`
- Project URL: `https://github.com/users/MineiToshio/projects/4`
- Status source: GitHub Project `Status` field (`Todo | In Progress | Done`)
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

- Unit tests: required / not required + short reason
- Integration tests: required / not required + short reason
- E2E tests (if applicable): required / not required + short reason
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

## 11) Implementation Slices (GitHub sub-issues)

Slices are separate GitHub sub-issues (tickets) under this epic, not inline tracking blocks in the template.

Each slice should be created as:

- Issue label: `type:slice`
- Title: concise and descriptive (no prefixes required)
- Parent: this epic issue
- Status source: GitHub Project `Status` field (`Todo | In Progress | Done`)

### Planned slices

1. [Short slice title]
2. [Short slice title]
3. [Short slice title]

### Slice ticket references

- Slice 1 issue: `#`
- Slice 2 issue: `#`
- Slice 3 issue: `#`

Notes:

- Keep this section focused on slice definitions and references.
- Keep ongoing execution/progress updates in each slice ticket, not in this template.
- Put volatile technical details in PR descriptions, commit history, or `docs/development/*` when reusable.
