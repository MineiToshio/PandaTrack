# Prompt Pack Template

## 1) Implementation Prompt

Objective: Implement `FEAT-XXXX` using the linked feature packet.

Constraints:

- Keep changes minimal and reviewable.
- Prefer Server Components unless client behavior is required.
- No hardcoded user-facing copy; use locale files (`es`, `en`).
- Reuse existing components in `src/components/core` and `src/components/modules`.
- Keep data access out of UI components.
- Use Zod at external input boundaries.
- Use centralized analytics events in `POSTHOG_EVENTS`.

Deliverables:

1. File-level plan.
2. Implementation.
3. Test updates.
4. Risk and follow-up notes.

## 2) Review Prompt

Review the changes for `FEAT-XXXX` with priority on:

- Functional bugs and regressions
- Architecture/rules violations
- Missing i18n coverage
- Accessibility gaps
- Analytics gaps
- Missing or weak tests

Output format:

- Findings sorted by severity
- File + line
- Concrete fix proposal

## 3) Bugfix Prompt

Fix bug: `[bug summary]`.

Requirements:

- Identify root cause.
- Apply minimal fix.
- Add/adjust tests proving failure-before and pass-after.
- Note impact on analytics/monitoring if relevant.

## 4) Test Generation Prompt

Generate tests for `FEAT-XXXX` covering:

- Core happy path
- Error/edge cases
- Business rules
- Regression-sensitive behavior

Constraints:

- Keep tests deterministic.
- Avoid implementation-detail assertions when possible.
- Prefer readable test names and arrange-act-assert structure.
