# Definition of Done

This is the global DoD baseline for PandaTrack.
Every feature must satisfy this checklist before being marked `Done`.

## Engineering quality

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Build for the affected scope passes
- [ ] Required unit/integration/E2E tests for the change are added or explicitly not needed by risk
- [ ] No dead code, unused imports, or commented-out obsolete code

## Product behavior

- [ ] All acceptance criteria in the Epic issue are validated
- [ ] Happy path is verified
- [ ] Edge/error paths are verified
- [ ] No known regressions in adjacent workflows

## UX, i18n, and accessibility

- [ ] No hardcoded user-facing copy in components
- [ ] Locale keys exist in `es` and `en`
- [ ] Loading, empty, error, and success states are handled
- [ ] Keyboard navigation works for interactive elements
- [ ] Visible focus and proper labels are present

## Data and reliability

- [ ] Input validation is applied at boundaries (Zod)
- [ ] Expected errors are handled with clear UX behavior
- [ ] Unexpected errors are observable in Sentry
- [ ] Multi-step writes use transactions when atomicity is required

## Analytics and observability

- [ ] Meaningful interactions are tracked
- [ ] Events use centralized `POSTHOG_EVENTS`
- [ ] Event props are minimal and useful for analysis

## Documentation and delivery

- [ ] Epic and slice issues reflect final shipped behavior
- [ ] ADR is added/updated when architecture decisions changed
- [ ] Follow-ups and known limitations are documented
