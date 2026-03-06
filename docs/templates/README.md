# Templates

Use these templates to keep feature delivery consistent when working with AI coding agents.

## Suggested usage order

1. `feature-packet-template.md` (single source for a feature)
2. `adr-template.md` (only when architecture decisions are needed)
3. `prompt-pack-template.md` (execution prompts for Codex/Cursor)
4. Reference global DoD from `docs/process/definition-of-done.md`

## Recommended flow

1. Define product scope and outcomes in the Feature Packet.
2. Define functional and non-functional requirements in the same packet.
3. Freeze data contract and acceptance criteria.
4. Add implementation/review prompts for AI agents.
5. Validate against the DoD before closing the feature.
