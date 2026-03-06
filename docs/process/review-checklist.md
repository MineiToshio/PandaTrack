# Review Checklist

Use this checklist for AI-assisted or manual review before merging feature changes.

## Severity-first findings

- [ ] Are there functional bugs in the main flow?
- [ ] Are there regressions in existing behavior?
- [ ] Are business rules implemented correctly?

## Architecture and code quality

- [ ] Does code follow the project structure conventions?
- [ ] Are Server Components used by default where possible?
- [ ] Is client-only logic isolated behind minimal `"use client"` boundaries?
- [ ] Is data access outside UI components?
- [ ] Is Prisma accessed only through `src/lib/prisma.ts` and dedicated data/query modules?

## i18n and UX

- [ ] Any hardcoded user-facing strings in TS/TSX?
- [ ] Are `es` and `en` locale keys complete and aligned?
- [ ] Are loading/empty/error/success states present where needed?
- [ ] Is responsive behavior acceptable on mobile/tablet/desktop?

## Accessibility

- [ ] Keyboard interaction works
- [ ] Focus states are visible
- [ ] Form controls and icon-only buttons have labels
- [ ] Important status messages are announced when relevant

## Analytics and observability

- [ ] Key clicks/actions are tracked
- [ ] Event names come from `POSTHOG_EVENTS`
- [ ] Unexpected errors are captured once (avoid noisy duplicates)
- [ ] No sensitive payload is exposed in logs/errors

## Tests and validation

- [ ] Unit/integration/E2E coverage matches feature risk
- [ ] Edge/error tests exist for critical rules
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Build for affected scope passes

## Final documentation check

- [ ] Feature Packet is updated to match implementation
- [ ] ADR added/updated if an architectural decision was made
- [ ] Known limitations and follow-ups are explicit
