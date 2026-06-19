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
- Cross-FRD citations (one FRD pointing at another FRD's `BP`/`WO`/requirements) must stay unambiguous: qualify with **FRD-XX**, link to the target markdown file, and follow `docs/templates/product-docs-guide.md` (**Cross-FRD references**).

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

Use the matching feature code plus the `FRD` title.

Format:

- `FEAT-XXXX: <FRD title>`

Examples:

- `FEAT-0012: Store Domain`
- `FEAT-0008: Account Access and Recovery`
- `FEAT-0011: Collector App Shell and Dashboard-first Navigation`

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

- `PRD Path: docs/product/prd-02-collector-app/prd-02-collector-app.md`
- `FRD Path: docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md`

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
- Every GitHub Work Order ticket must be attached as a **sub-issue** of its Epic (GitHub parent/child). A line such as `Parent Epic: #NN` in the body is not enough on its own; the Epic must actually list the ticket under Sub-issues so hierarchy and rollups stay correct in GitHub and on the Project board.
- Sub-issues under an Epic must be ordered to match **`WO-01`, `WO-02`, …** as defined in `docs/product` (cross-blueprint order follows the FRD or blueprint implementation plan). Do not use GitHub issue number order as a proxy for Work Order order.
- Every `Work Order` should be traceable back to one `FRD` through its `Blueprint`.
- Status changes happen in GitHub, not by renaming files in `docs/product`.
- GitHub should store doc references primarily as repo paths so issue bodies remain branch-agnostic.
- If a user instruction changes scope, requirements, architecture, or execution definition during implementation, update the appropriate doc in `docs/product` first and then sync GitHub tracking to match.

## Recommended Status Workflow

### In docs

- use document `status` for lifecycle meaning such as `DRAFT`, `ACTIVE`, `BLOCKED`, or `SUPERSEDED`
- use `implementation_status` for implementation reality such as `PLANNED`, `IN_PROGRESS`, `PARTIALLY_IMPLEMENTED`, or `IMPLEMENTED`
- do not use file renames to represent day-to-day execution status

### In GitHub

- use the GitHub Project `Status` field for execution progress and readiness
- valid statuses: `Backlog`, `Todo`, `In Progress`, `Blocked`, `Done`
- use `Backlog` for slices whose `Work Order` doc is still `status: DRAFT` (freshly created, not yet enriched). `Backlog` means "exists but not ready to pick up"
- use `Todo` for slices whose `Work Order` doc is `status: ACTIVE` (enriched and ready to implement), and for Epics by default
- use `Blocked` when a slice cannot progress because of an unresolved external dependency (for example, a required model or API that belongs to a different FRD and has not been implemented yet); include a brief blocker note in the issue body explaining what is missing and which FRD or work order must deliver it first
- when an Epic and its Work Order tickets are first created (for example from the Create FRD Package flow): every issue must be **open**, the Epic must have Project `Status` **`Todo`**, and every created slice must have Project `Status` **`Backlog`** (matching the `DRAFT` default of newly created `Work Order` docs) unless the team explicitly agreed a different initial value for that batch
- `enrich work order context` promotes the linked slice issue from `Backlog` to `Todo` in the same run that flips the `Work Order` doc from `DRAFT` to `ACTIVE`
- do not create or leave new tracking issues **closed** or with Project `Status` **`Done`** as the default for untouched backlog work
- see `docs/process/github-project-tracking.md` → **Readiness rule** for the full mapping

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
