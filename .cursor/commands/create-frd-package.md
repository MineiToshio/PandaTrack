# Create FRD Package

Create a full FRD package from a target PRD and a raw feature/domain brief.

This command must:

1. clarify the feature thoroughly with the user
2. create the `FRD`
3. create the related `Blueprints`
4. create the related `Work Orders`
5. create or update the matching GitHub Epic and Work Order tickets

The command must follow PandaTrack's hybrid workflow:

- product definition lives in `docs/product`
- execution status lives in GitHub Project `4`

## Inputs

- `prd_reference`: target PRD id, path, or folder
- `feature_brief`: raw description of the FRD/domain to create
- optional `extra_context`: links, screenshots, constraints, deadlines, related issues, technical preferences, or implementation hints

## Core behavior

- Conversation with the user must be in Spanish.
- Generated documentation and GitHub issue content must be in English.
- Do not create or update local docs or GitHub issues until the user gives explicit approval after the proposal phase.
- Treat this command as a combined PM + software architect + senior full-stack planning workflow.
- Prefer smaller, implementation-ready `Work Orders` over broad mixed-scope slices whenever a feature can be split into independently reviewable outcomes.
- Treat this command as the place to define the `FRD`, the `Blueprints`, and the initial `Work Order` split well, but not as the place to fully enrich every `Work Order`.
- Use `enrich work order context` later to turn an individual `Work Order` into an implementation-ready slice with deeper product, UX, technical, security, and QA detail.
- Use the relevant templates in `docs/templates/` as the mandatory base:
  - `docs/templates/frd-template.md`
  - `docs/templates/blueprint-template.md`
  - `docs/templates/work-order-template.md`
- Follow:
  - `docs/process/hybrid-product-github-workflow.md`
  - `docs/process/github-project-tracking.md`
  - `docs/process/workflow-ai.md`
  - `docs/templates/product-docs-guide.md` (**Cross-FRD references**): whenever the new `FRD`, a `Blueprint`, or a `Work Order` mentions another FRD's `BP`/`WO` or `FR-XX-NN`, qualify with **FRD-XX**, include the work-order slug when useful, and add repository-relative Markdown links to the target `.md` files (and heading anchors when they help).

## Planning objective

Produce:

1. one new `FRD` under the specified `PRD`
2. one or more related `Blueprints`
3. one or more `Work Orders` under each `Blueprint`
4. an updated parent `PRD` that reflects the new `FRD`
5. one matching GitHub Epic for the `FRD`
6. one GitHub ticket per `Work Order`

The goal of the `Work Orders` created here is to be well-scoped, well-ordered, and well-justified. They must provide a strong initial execution baseline, but they do not need to contain the full enriched detail that belongs in the later `enrich work order context` workflow.

## Required product-doc structure

The created files must follow the repository's current hierarchy:

```text
docs/product/
  prd-xx-some-scope/
    prd-xx-some-scope.md
    frd-yy-some-domain/
      frd-yy-some-domain.md
      bp-zz-some-blueprint/
        bp-zz-some-blueprint.md
        work-orders/
          wo-aa-some-work-order.md
```

## Discovery standard

Before writing anything, the command must act in three roles:

### 1. Product manager role for the `FRD`

Ask whatever is needed to define:

- problem
- goal
- target user
- scope
- out of scope
- primary flows
- edge cases
- permissions
- data that must exist
- lifecycle or state changes
- success criteria
- analytics expectations
- reminder/notification implications

### 2. Software architect role for the `Blueprints`

Ask whatever is needed to define:

- technical approach
- domain boundaries
- runtime components
- data contracts
- persistence implications
- route/module ownership
- integration points
- failure handling
- architecture constraints
- future extension points
- whether an ADR is needed

### 3. Senior full-stack role for the `Work Orders`

Ask whatever is needed to define:

- a good vertical split
- whether apparently related user actions should actually be separate work orders
- implementation sequencing
- which work orders are strict prerequisites for others
- which work orders can run in parallel after a dependency is finished
- testing boundaries
- validation needs
- i18n impact
- accessibility impact
- analytics and Sentry scope
- atomic write requirements
- likely implementation risks

This role must also classify technical decisions into three buckets:

- decisions that must be resolved now at `FRD` level
- decisions that must be resolved now at `Blueprint` level so the split stays coherent
- decisions that can safely be deferred to later `enrich work order context` runs for individual `Work Orders`

The command must not try to fully resolve all `Work Order`-level implementation details here. Its job is to identify enough structure to create the right slices and to flag which slices will later need deeper enrichment.

## Mandatory clarification rules

Do not create the FRD package until critical ambiguity is resolved.

You must ask follow-up questions in Spanish whenever any of these remain materially unclear:

- what user problem is being solved
- what the feature/domain includes
- what it explicitly excludes
- which routes, modules, or data models are affected
- what states or transitions exist
- whether the feature is public, private, or mixed
- what permissions apply
- how reminders, analytics, or observability should behave
- what edge cases the user may have missed
- whether any architectural or operational decision must already be fixed at `Blueprint` level to avoid a bad `Work Order` split
- whether any details can be intentionally deferred to later `enrich work order context` passes without creating execution chaos

The questions should be grouped into concise but thorough batches.

Do not ask vague filler questions.

## Context-building requirements

Before drafting:

1. Read the target `PRD`.
2. Review nearby `FRDs` under the same `PRD` so the new one fits the existing product map.
3. Inspect the current codebase for implemented behavior that should influence the new documents.
4. Review current GitHub epics and tickets to avoid duplicating existing work.

Before proposing the package, perform an internal gap analysis that identifies:

- what is already defined well enough to shape the `FRD`
- what is already defined well enough to shape the `Blueprints`
- what must be decided now so the `Work Order` split is valid
- what can be intentionally deferred to later `enrich work order context` work on specific `Work Orders`

The target `PRD` must be updated as part of this command when the new `FRD` changes:

- the PRD child list
- the PRD scope summary
- the PRD linked-FRD section
- the workflow priority or product map, when applicable

If the requested FRD overlaps with an existing Epic or existing FRD, ask the user in Spanish whether they want:

- to extend the existing FRD/Epic
- or to create a new one anyway

Mention the existing FRD path and Epic number/title explicitly when asking.

If the requested scope appears too large or too heterogeneous for one FRD, do not force it into a single package.

Instead, tell the user in Spanish that the request should likely be split into multiple FRDs and explain the suggested split clearly.

Signals that should trigger this warning include:

- the request mixes multiple business domains with different state models
- the request would require multiple loosely related blueprints
- the resulting work-order list would be too large or too scattered for one FRD
- the request combines one cross-cutting platform concern with one or more domain concerns that should evolve independently

When this happens, propose the candidate FRD titles and wait for the user to choose the split before writing docs or GitHub issues.

## Drafting rules

### Cross-FRD references

If any drafted text depends on or constrains work owned by **another FRD** (for example dashboard behavior that must match shell navigation built under User Settings), document it using the **Cross-FRD references** rules in `docs/templates/product-docs-guide.md`: qualified **FRD-XX · BP/WO** labels, optional slug, and **clickable repo-relative links** to the owning files. Prefer a **Cross-domain notes** (or similar) section in the consuming FRD when the rule is shared across domains.

### FRD

The `FRD` must:

- use the FRD template
- reflect the target PRD context
- be written as a real product-definition document, not a stub
- include current state when implementation already exists
- separate confirmed decisions from open questions
- include testable acceptance criteria
- include implementation notes or reverse-engineering notes when relevant

### Blueprint

Each `Blueprint` must:

- use the blueprint template
- explain how the feature/domain should be built
- identify runtime components and technical boundaries
- explain architecture decisions and contracts
- reference related files/modules when known
- break down the FRD into a coherent technical design
- include an explicit implementation plan that:
  - lists work orders in recommended execution order
  - identifies prerequisite relationships
  - calls out which work orders can be executed in parallel after their dependencies are complete
- present that implementation plan using Mermaid when it improves clarity, plus a short plain-text sequencing summary so both humans and AI agents can interpret it reliably
- state the technical contracts or boundary decisions that must already be fixed before the downstream `Work Orders` are enriched individually

### Work Order

Each `Work Order` must:

- use the work-order template
- be executable by an AI or human without major ambiguity
- represent a coherent vertical implementation slice
- stay narrow enough that one implementation agent can complete it without mixing multiple loosely related user actions
- avoid splitting tiny technical leftovers into separate tickets
- include:
  - `Summary`
  - `In Scope`
  - `Out of Scope`
  - `Requirements`
  - `Blueprints`
  - `E2E Acceptance Tests`

Each `Work Order` created here should be treated as an initial slice definition, not as a fully enriched implementation brief.

Every `Work Order` created by this command must start with document `status: DRAFT`. Promotion to `ACTIVE` happens later through the `enrich work order context` workflow unless the user explicitly approves a different lifecycle state during this command.

Each proposed `Work Order` must also have an explicit internal rationale covering:

- `Outcome`: what meaningful user or system outcome this slice owns
- `Why separate`: why this should be its own `Work Order` instead of being merged with a sibling
- `Dependencies`: what must land first, if anything
- `Parallelizable after`: what prerequisite unlocks parallel work
- `Needs enrich`: whether later `enrich work order context` work is likely `high`, `medium`, or `low`

## Work Order splitting rules

Split work by coherent outcomes, not by arbitrary technical fragments.

Prefer more, smaller work orders when that improves implementation clarity, sequencing, and parallel execution.

Good `Work Orders`:

- implement one meaningful flow or foundational capability
- can be reviewed independently
- map clearly to a GitHub ticket
- have test implications that are easy to reason about
- are small enough that a single implementation agent can own the slice without juggling multiple unrelated behaviors

Avoid:

- form UI in one work order and validation in another unless they are truly separate deliverables
- one work order only for analytics unless it is a final hardening pass
- tiny leftover work orders that exist only because of file boundaries
- combining multiple independent submission flows into one work order just because they belong to the same domain area
- combining a foundational prerequisite with multiple downstream user flows when the downstream flows could be implemented independently after the foundation lands

When a work order candidate contains two or more user actions that could reasonably be implemented, reviewed, tested, or delegated separately, split them unless a shared implementation contract would become unnaturally fragmented.

Do not create “fake-ready” `Work Orders` that look valid on paper but still hide major ambiguity in what outcome they own. If a candidate `Work Order` cannot be described cleanly in terms of a single coherent outcome plus clear prerequisites, the split is not ready yet.

## Work Order ordering and dependency rules

Work orders must be ordered by recommended implementation sequence, not by brainstorming order.

This means:

- assign `WO-01`, `WO-02`, `WO-03`, etc. in the order the work should ideally be executed
- reset `WO` numbering locally inside each `FRD`/`Blueprint` package instead of continuing a repository-global running sequence
- list work orders inside each blueprint in that same execution order
- ensure prerequisite/foundation work orders come before dependent user-facing slices
- when multiple work orders can start only after one prerequisite is complete, keep the prerequisite first and then note the parallelizable group explicitly in the blueprint implementation plan
- do not create numbering that implies one order while the blueprint text recommends another

If the best split is:

- one foundation slice
- then several independent slices that can run in parallel

the blueprint must say so explicitly in its implementation plan.

When a `Work Order` depends on a still-undefined technical contract, either:

- resolve that contract now in the `Blueprint`, or
- move the `Work Order` split so that the dependency structure remains honest

Do not hide architecture uncertainty inside downstream `Work Orders` if it would distort the split or ordering.

## Proposal and approval phase

Before writing docs or GitHub issues, present the plan in Spanish and wait for explicit approval.

The proposal must include:

- target `PRD`
- whether the target `PRD` will need scope/map updates beyond just adding the new child link
- whether the request should:
  - create a new `FRD`
  - extend an existing `FRD`
  - or be split into multiple new `FRDs`
- proposed `FRD` title or titles
- proposed Epic title using the format `FEAT-XXXX: <FRD title>`
- if reusing an existing FRD, the existing FRD path and related Epic reference
- proposed `Blueprint` titles
- proposed `Work Order` titles in implementation order
- proposed work-order dependency and parallelization plan
- a short `Work Order split rationale` that explains why these slices are the right cut
- which `Work Orders` will likely need deeper follow-up through `enrich work order context`
- whether the command will create a new GitHub Epic or update an existing one
- how many GitHub tickets will be created
- any important split rationale only when it affects the user's decision

Approval must be explicit, for example:

- "sí, créalo"
- "ok, procede"
- "dale, hazlo"
- "aprobado"

If the user changes scope after seeing the proposal, restate the updated full proposal and ask for approval again.

## GitHub creation rules

After approval:

- create or update one GitHub Epic for the `FRD`
- create one GitHub ticket per `Work Order`
- keep the Epic and every Work Order ticket **open** (GitHub issue `state: open`). New issues are created open by default; do not close any of them in this command. If you update or reuse an Epic or slice that is currently closed, **reopen** it so execution tracking starts from an open backlog item
- attach every created Work Order ticket as a **sub-issue** of that Epic (GitHub parent/child relationship), not only via a `Parent Epic: #NN` line in the ticket body
- add sub-issues in **Work Order execution order** (`WO-01`, then `WO-02`, then `WO-03`, and so on across the FRD). When an FRD has multiple `Blueprints`, follow the same order as the blueprint implementation plan and linked work-order lists (typically all `WO`s from `BP-01` in order, then `BP-02`, etc.). **Do not** sort or infer order from public GitHub issue numbers (`#78`, `#81`, …); those reflect creation time, not `WO` sequence, and a wrong sub-issue order breaks Epic views, Project child lists, and planning.
- first child can be added without a position hint; for each additional child, if GitHub returns a priority or placement error, add it immediately after the previous slice using that sibling issue's numeric REST `id` as `after_id`, since `id` is not the same as the public issue number
- after all sub-issues are attached, **verify** with GitHub MCP `issue_read` (`get_sub_issues`) that the returned list order matches `WO-01` through `WO-NN`. If not, use `sub_issue_write` (`reprioritize`) with sibling REST `id` values (`after_id` / `before_id`) until the order matches the Work Order docs
- do not create GitHub issues for `Blueprints`
- add the Epic and every created ticket to GitHub Project `4` in the same execution pass
- set the GitHub Project `4` **Status** field to **`Todo`** on the Epic and on every created ticket (this is independent of issue open/closed). The only exception is when the user explicitly approved a different initial `Status` value during the proposal approval step
- explicitly verify that the Epic and every created ticket are present in GitHub Project `4` before finishing
- explicitly verify that the Epic and every created ticket are **open** and have Project `Status` **`Todo`** (or the user-approved alternative) before finishing
- explicitly verify that the Epic lists every created Work Order ticket as a sub-issue (for example via GitHub MCP `issue_read` with `get_sub_issues`) **and that sub-issues appear in `WO-01`…`WO-NN` order** before finishing

### Epic body

The GitHub Epic must contain only lightweight tracking information:

- Epic title
- `PRD Path`
- `FRD Path`
- `Blueprint Path` or `Blueprint Paths`
- checklist of linked `Work Orders`
- short status/blocker notes when useful

Do not duplicate the full FRD body in GitHub.
Do not use branch-specific GitHub blob URLs as the canonical reference format.
Use repository-relative paths as the durable reference.

## Guardrails

- Do not try to fully enrich every `Work Order` during this command; preserve the separation of responsibilities with `enrich work order context`.
- Do not defer `Blueprint`-level technical contracts that are necessary to produce a sane `Work Order` split.
- Do not force unresolved architecture decisions down into `Work Orders` when they properly belong in the `Blueprint`.
- Do not create `Work Orders` whose only purpose is “leftover technical cleanup” unless that cleanup is itself a coherent hardening or foundation slice.

### Ticket body

Each GitHub ticket must contain only lightweight tracking information:

- Parent Epic reference
- `PRD Path`
- `FRD Path`
- `Blueprint Path`
- `Work Order Path`
- brief execution notes
- blockers if any
- linked PRs if any

Do not duplicate the full Work Order body in GitHub.

### Path format

Use repository-relative paths in Epic and ticket bodies.

Examples:

- `docs/product/prd-01-collector-mvp/prd-01-collector-mvp.md`
- `docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md`
- `docs/product/prd-01-collector-mvp/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md`
- `docs/product/prd-01-collector-mvp/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-01-store-persistence-foundation.md`

Optional GitHub links may be added as convenience only when useful, but the path is the source-of-truth reference.

### GitHub labels and project rules

- Epic title must always include the feature code using the format `FEAT-XXXX: <FRD title>`.
- Epic label: `type:epic`
- Work Order ticket label: `type:slice`
- add area label when inferable
- add both Epic and tickets to GitHub Project `4`
- set Project `Status` to **`Todo`** on the Epic and every slice by default. Do not leave new items as `Done` or `In Progress` unless the user explicitly requested that initial value when they approved the proposal
- keep every Epic and slice **open** (issue state); closing issues is out of scope for this command
- do not treat issue creation as complete until project membership has been confirmed for the Epic and every created ticket
- if any issue cannot be added to Project `4`, cannot be kept or set **open**, or its `Status` cannot be set to the required initial value, report the specific blocked issue numbers in the final response and treat the command as partially complete

## Numbering and naming rules

When creating the new FRD package:

- choose the next correct `FRD` number under the target `PRD`
- choose local `Blueprint` numbering inside that `FRD`, resetting from `BP-01` for each `FRD`
- choose local `Work Order` numbering inside that `Blueprint`
- use descriptive slugs
- preserve the existing naming style in `docs/product`

## Final response format

Return in Spanish:

1. `PRD updated`
2. `FRD created` or `FRD updated`
3. `Blueprints created`
4. `Work Orders created`
5. `GitHub epic`
6. `GitHub tickets`
7. `GitHub project sync`
8. `Docs updated`
9. `Open assumptions`
10. `Follow-up notes`

If creation was blocked before approval or by missing information, say so clearly and summarize what is still needed.

## Quality bar

Before finishing, verify:

- the target PRD was read
- the target PRD was updated to reflect the new or expanded FRD
- the new FRD does not duplicate an existing one unnecessarily
- the command explicitly evaluated whether the request belongs in an existing FRD instead of a new one
- the command explicitly evaluated whether the request should be split into multiple FRDs
- the FRD is dense enough to guide implementation
- the Blueprints are concrete and architecture-aware
- the Work Orders are executable and not too thin
- GitHub Epic/Tickets follow the hybrid workflow instead of duplicating docs
- the GitHub Epic and every created ticket were added to GitHub Project `4`
- the GitHub Epic and every created ticket are **open** and were verified in GitHub Project `4` with initial `Status` **`Todo`** (or the user-approved alternative from the proposal)
- all created items fit the current `docs/product` structure
