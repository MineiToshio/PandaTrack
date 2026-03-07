# Templates

Use these templates to keep feature delivery consistent when working with AI coding agents.

## Suggested usage order

1. `feature-epic-template.md` (Epic issue body content in GitHub)
2. `adr-template.md` (only when architecture decisions are needed)
3. `prompt-pack-template.md` (execution prompts for Codex/Cursor)
4. Reference global DoD from `docs/process/definition-of-done.md`

## Recommended flow

1. Create an Epic issue in GitHub Project and use the Feature Epic template as the epic body.
2. Define functional and non-functional requirements in that epic.
3. Freeze data contract and acceptance criteria in the epic.
4. Create slice sub-issues (`type:slice`) as separate tickets under the epic.
5. Track execution status in GitHub Project `Status` field, then validate against DoD before closing.
