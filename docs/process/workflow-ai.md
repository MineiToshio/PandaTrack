# AI Workflow

This workflow is optimized for building features with Codex and Cursor using a single Feature Packet.

## 1) Plan in one document

1. Create a new feature folder: `docs/features/FEAT-XXXX-feature-name/`
2. Add `feature-packet.md` from the template in `docs/templates/feature-packet-template.md`
3. Complete the packet sections in this order:
   - Product Requirements
   - Functional Requirements
   - Data Contract
   - Acceptance Criteria
   - Test Plan

## 2) Prepare execution prompts

1. Create `prompts.md` in the same feature folder
2. Start from `docs/templates/prompt-pack-template.md`
3. Fill feature-specific context, constraints, and expected output

## 3) Implement with AI agents

1. Run implementation prompt (Codex or Cursor)
2. Keep changes minimal and scoped to the feature
3. Re-run with focused prompts for missing pieces (tests, i18n, analytics, accessibility)

## 4) Review with a second pass

1. Run review prompt with strict bug/regression focus
2. Fix findings by severity order
3. Re-run review prompt until no high-severity issues remain

## 5) Validate and close

1. Run required checks:
   - `npm run type-check`
   - `npm run lint`
   - Build for affected scope (or full build when needed)
2. Validate DoD in `docs/process/definition-of-done.md`
3. Update Feature Packet status to `Done`

## Rules for consistency

- Use one Feature Packet per feature (do not split into standalone PRD/FRD files).
- Keep user-facing copy in locale JSON files only.
- Keep Prisma access out of UI components.
- Keep analytics event names centralized.
- Prefer small, reviewable diffs over broad refactors.
