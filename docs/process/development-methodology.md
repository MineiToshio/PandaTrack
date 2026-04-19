# Development Methodology

## Philosophy

PandaTrack is built with an **AI-first development model**. AI agents handle the full implementation cycle — writing code, tests, documentation, and GitHub tracking. The human role is that of an **orchestrator**: defining product intent, making decisions, reviewing output, and directing the next move.

This distinction matters for how the process is structured. Every artifact in the system is designed to give AI agents enough context to act with precision. Ambiguity at the product level produces poor implementations; clarity at every level of the document hierarchy produces reliable output.

## Methodology Origin

The development process is adapted from the **[8090 methodology](https://www.8090.ai)**, an AI-native SDLC framework built around four modules: Refinery (requirements), Foundry (architecture), Planner (work orders), and Validator (feedback loop).

PandaTrack does not use the 8090 platform. Instead, it takes the core document hierarchy from Refinery and Foundry — Product definition, Feature Requirements, Blueprints, and Work Orders — and implements them as structured markdown files versioned directly in the repository. GitHub handles execution tracking. AI agents handle implementation.

What was not adopted: the Validator module (automated user feedback → ticket pipeline) and any 8090 SaaS tooling.

## Document Hierarchy

Product definition flows through four levels, each more specific than the last:

```
PRD  →  FRD  →  Blueprint  →  Work Order
```

### PRD — Product Release Document

Defines a major product phase or release. Sets business goals, product scope, target users, and guiding principles. Does not describe features in detail.

One PRD may contain multiple FRDs. The PRD is updated only when release-level scope or product positioning changes.

### FRD — Feature Release Definition

Describes one major feature area within a PRD. Contains user stories, functional requirements, business rules, and acceptance criteria. The FRD is the implementation contract: it defines *what* must be true, not *how*.

One FRD maps to one GitHub Epic.

### Blueprint

Breaks an FRD into a specific implementation area with technical structure. Documents runtime components, architecture constraints, data relationships, and the sequence of Work Orders within it. Blueprints stay in `docs/product` and are not tracked as GitHub issues by default.

### Work Order

A granular, executable implementation task. Contains a clear scope (in/out boundaries), requirements, and acceptance tests. Every Work Order is self-contained enough that an AI agent can pick it up and implement it without reading the full FRD.

One Work Order maps to one GitHub Slice (sub-issue of its FRD's Epic).

## Two-Layer Operating Model

The system separates *what to build* from *how far along it is*:

| Layer | Location | Contains |
|---|---|---|
| Product definition | `docs/product/` | PRD, FRD, Blueprint, Work Order |
| Execution status | GitHub Project #4 | Epic/Slice issues, board status, PR linkage |

`docs/product` is the durable source of truth. GitHub reflects the current delivery state. Neither replaces the other. See [`hybrid-product-github-workflow.md`](hybrid-product-github-workflow.md) for the full operating rules.

## Development Loop

A feature moves through this sequence from concept to shipped:

1. **Define** — Write or update the PRD, FRD, Blueprint, and Work Orders in `docs/product`.
2. **Sync** — Create the GitHub Epic (one per FRD) and Slice issues (one per Work Order). Attach slices as sub-issues of the Epic, ordered by Work Order sequence.
3. **Enrich** — Deepen each Work Order with implementation context before execution (data shapes, edge cases, dependency notes).
4. **Implement** — Run the implementation agent (Claude Code or Codex) against a Work Order. The agent reads the FRD and Blueprint for context, executes the Work Order scope, and produces code, tests, i18n keys, analytics events, and documentation updates.
5. **Review** — Run a second-pass review agent focused on bugs, regressions, and rule compliance.
6. **Validate** — Run `npm run type-check`, `npm run lint`, `npm run validate-build`, and relevant tests. Verify against the Definition of Done.
7. **Close** — Update GitHub Project Status. Confirm `docs/product` reflects final shipped behavior.

The loop repeats per Work Order. An FRD is complete when all its Work Orders are `Done`.

## Human Orchestrator Role

The human is responsible for:

- Deciding what to build (product decisions, scope tradeoffs)
- Writing or approving PRDs and FRDs
- Directing which Work Order to execute next
- Reviewing implementation output and catching issues agents miss
- Making judgment calls when requirements are ambiguous

The human does not write implementation code. When a decision must be made mid-implementation, the agent pauses and flags it rather than guessing.

## AI Agent Role

Agents are responsible for:

- Translating Work Orders into working code
- Writing tests, locale keys, analytics events, and error handling
- Updating `docs/product` when behavior deviates from spec or fills a previously undocumented decision
- Keeping GitHub tracking synchronized with implementation reality
- Running and interpreting validation checks

Agents operate from explicit context — the FRD, Blueprint, and Work Order — not from inference about what seems reasonable.

## Related Documents

- [`workflow-ai.md`](workflow-ai.md) — Step-by-step AI workflow from definition to close
- [`hybrid-product-github-workflow.md`](hybrid-product-github-workflow.md) — Full rules for docs + GitHub two-layer model
- [`github-project-tracking.md`](github-project-tracking.md) — GitHub Project runbook, templates, and label system
- [`definition-of-done.md`](definition-of-done.md) — Global DoD checklist for every feature
- [`docs/product/README.md`](../product/README.md) — Document naming, metadata, and lifecycle rules
- [`docs/templates/product-docs-guide.md`](../templates/product-docs-guide.md) — Authoring guide for all product doc types
