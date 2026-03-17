# Hybrid Product + GitHub Workflow

## Purpose

Define the operating model PandaTrack uses to combine deep product documentation in the repository with lightweight execution tracking in GitHub.

## Source of Truth by Layer

### Product-definition source of truth

`docs/product/`

This is where PandaTrack keeps:

- `PRD`
- `FRD`
- `Blueprint`
- `Work Order`

These files define the product, requirements, architecture, and execution intent in a structured 80/90-style format.

### Execution-status source of truth

GitHub Issues + GitHub Project

This is where PandaTrack keeps:

- work status
- prioritization
- in-progress tracking
- blockers
- PR linkage

GitHub does not replace the product-definition documents.

## Canonical Mapping

### In `docs/product`

- `PRD` lives only in `docs/product`
- `FRD` lives only in `docs/product`
- `Blueprint` lives only in `docs/product`
- `Work Order` lives only in `docs/product`

### In GitHub

- one `FRD` -> one Epic issue
- one `Work Order` -> one ticket (slice/sub-issue or normal implementation issue)
- `Blueprint` is not created as a GitHub issue by default
- `PRD` is not created as a GitHub issue

## Why this split exists

- `docs/product` stores durable context for humans and AI
- GitHub stores lightweight execution state
- this prevents the same requirements and technical design from being duplicated in issue bodies

## GitHub Epic Rules

Each Epic should represent one `FRD`.

### Epic title

Use the same domain title as the `FRD` whenever practical.

Examples:

- `Store Domain`
- `Account Access and Recovery`
- `Collector App Shell and Dashboard-first Navigation`

### Epic body should stay lightweight

An Epic should contain:

- Epic title
- repo path to the parent `PRD`
- repo path to the matching `FRD`
- repo paths to related `Blueprints`
- checklist of related `Work Orders`
- current status notes or blockers when useful

An Epic should not duplicate the full `FRD` body.

Use repository paths as the canonical reference format in GitHub, not branch-specific GitHub blob URLs.

Examples:

- `PRD Path: docs/product/prd-01-collector-mvp/prd-01-collector-mvp.md`
- `FRD Path: docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md`

Optional clickable GitHub links may be added as convenience only when they point to a currently valid branch, but the path remains the source-of-truth reference.

## GitHub Ticket Rules

Each GitHub ticket should represent one `Work Order`.

### Ticket title

Use the same title as the `Work Order` whenever practical.

Examples:

- `Store Persistence Foundation`
- `Route Protection and Verification Lifecycle`
- `Critical E2E Workflow Baseline`

### Ticket body should stay lightweight

A ticket should contain:

- repo path to the parent `PRD`
- repo path to the parent `FRD`
- repo path to the parent `Blueprint`
- repo path to the matching `Work Order`
- brief execution notes
- blockers if any
- linked PRs if any

A ticket should not duplicate the full `Work Order` content.

## Required Relationship Rules

- Every GitHub Epic must point to exactly one `FRD`.
- Every GitHub ticket must point to exactly one `Work Order`.
- Every `Work Order` should be traceable back to one `FRD` through its `Blueprint`.
- Status changes happen in GitHub, not by renaming files in `docs/product`.
- GitHub should store doc references primarily as repo paths so issue bodies remain branch-agnostic.
- If a user instruction changes scope, requirements, architecture, or execution definition during implementation, update the appropriate doc in `docs/product` first and then sync GitHub tracking to match.

## Recommended Status Workflow

### In docs

- use document status for lifecycle meaning such as `DRAFT`, `ACTIVE`, `DONE`, or `SUPERSEDED`
- do not use file renames to represent day-to-day execution status

### In GitHub

- use the GitHub Project `Status` field for execution progress
- examples: `Todo`, `In Progress`, `Done`

## Practical Daily Workflow

1. Create or update the `PRD`, `FRD`, `Blueprint`, and `Work Order` in `docs/product`.
2. Create or update the matching GitHub Epic from the `FRD`.
3. Create or update the matching GitHub tickets from the `Work Orders`.
4. Work from GitHub for daily focus and progress tracking.
5. Return to `docs/product` only when requirements, architecture, or execution definition changes.

## Change-precedence During Implementation

When implementation uncovers new decisions or the user changes direction mid-stream:

1. update the relevant source-of-truth doc first
2. then update the GitHub Epic or ticket to reflect the new state

Use this rule:

- update the `Work Order` when the execution slice changes
- update the `Blueprint` when technical approach or boundaries change
- update the `FRD` when requirements or business rules change
- update the `PRD` only when release-level scope or product positioning changes

## Anti-patterns to Avoid

- copying the full FRD body into the Epic
- copying the full Work Order body into the ticket
- using GitHub as the only source of product definition
- using `docs/product` as a kanban board
- creating GitHub issues for `Blueprints` by default

## Related Documents

- `docs/product/README.md`
- `docs/process/workflow-ai.md`
- `docs/process/github-project-tracking.md`
- `docs/process/definition-of-done.md`
