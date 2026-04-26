# Definition of Done

This is the global DoD baseline for PandaTrack.
Every feature must satisfy this checklist before being marked `Done`.

## Engineering quality

- [ ] Full standard validation passes (`npm run test`, `npm run type-check`, `npm run lint`, `npm run validate-build`)
- [ ] Required unit/integration/E2E tests for the change are added or explicitly not needed by risk
- [ ] No dead code, unused imports, or commented-out obsolete code

## Product behavior

- [ ] All acceptance criteria in the source docs are validated, with mirrored GitHub issues kept in sync
- [ ] Happy path is verified
- [ ] Edge/error paths are verified
- [ ] No known regressions in adjacent workflows

## UX, i18n, and accessibility

- [ ] No hardcoded user-facing copy in components
- [ ] Locale keys exist in `es` and `en`
- [ ] Loading, empty, error, and success states are handled
- [ ] User-triggered mutations provide immediate visible feedback without depending on a full route refresh when local reconciliation is feasible
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

- [ ] `docs/product` reflects final shipped behavior
- [ ] Mirrored GitHub epic/slice issues stay aligned with the source docs
- [ ] Mirrored GitHub epic/slice issues state unit, integration, and E2E expectations explicitly when needed
- [ ] ADR is added/updated when architecture decisions changed
- [ ] Follow-ups and known limitations are documented
