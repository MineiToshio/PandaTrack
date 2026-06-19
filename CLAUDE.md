@AGENTS.md
@docs/tooling/agents/rules.md

<!--
  Always-on rule baseline. These rule files are marked `alwaysApply: true` and are
  auto-loaded into every Claude Code session via the @-imports below — the equivalent
  of how Cursor used to inject `alwaysApply` rules. Codex receives this same baseline
  from AGENTS.md (it does not read these @-imports). Glob-scoped rules are injected
  per-file at edit time by .claude/hooks/pre-code-edit.mjs, so they are NOT listed here.
  To stop always-loading a rule, remove its line here AND set `alwaysApply: false` in
  the rule file's frontmatter.
-->

@.agents/rules/coding-standards.mdc
@.agents/rules/english-code-only.mdc
@.agents/rules/docs-and-standards.mdc
@.agents/rules/validation-checklist.mdc
@.agents/rules/testing-strategy.mdc
@.agents/rules/github-tracking-sync.mdc
@.agents/rules/adr-decision-records.mdc
@.agents/rules/design-system-playbook.mdc
@.agents/rules/theme-light-dark.mdc
@.agents/rules/responsive-design.mdc
@.agents/rules/optimistic-client-updates.mdc
@.agents/rules/modal-canonical-pattern.mdc
@.agents/rules/ui-libs-policy.mdc
@.agents/rules/icons.mdc
@.agents/rules/next-intl-translation-apis.mdc
@.agents/rules/prisma-migration-workflow.mdc
