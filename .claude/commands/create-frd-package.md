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
- Default to **vertical slices**: every `Work Order` delivers an end-to-end outcome (schema when relevant + server actions + UI + tests + analytics) that is demo-able and testable on its own. Splitting a single user-visible outcome into a paired "backend Work Order" plus a "frontend Work Order" is **forbidden**.
- The only non-vertical slice allowed is an initial **foundation `Work Order`** that groups exclusively the artifacts shared by two or more later slices (see `## Work Order splitting rules`).
- Default to **one `Blueprint` per `FRD`**. Two is exceptional, three is rare. Whenever the natural proposal contains two or more `Blueprints`, the command must ask the user before proceeding whether to split the feature into multiple `FRDs` instead.
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

- a good vertical split where every non-foundation slice owns an end-to-end outcome with its own tests and PostHog events
- whether a single foundation `Work Order` is justified by shared schema/enums/validators/helpers, or whether nothing is genuinely shared and the foundation would be artificial
- whether apparently related user actions should actually be separate work orders (for example create vs edit, or detail view vs detail actions)
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
  - names the foundation `Work Order` explicitly when one exists, and states which downstream vertical slices depend on it
- present that implementation plan using Mermaid when it improves clarity, plus a short plain-text sequencing summary so both humans and AI agents can interpret it reliably
- state the technical contracts or boundary decisions that must already be fixed before the downstream `Work Orders` are enriched individually

`Blueprints` must be cut by product sub-domain or work area, never by technical layer. It is forbidden to create one `Blueprint` that owns "all backend work" and another that owns "all frontend work" for the same feature. If the feature genuinely has two sub-domains with very different technical contexts, two `Blueprints` are allowed; if it has three, it must be justified explicitly. Beyond that, the command must propose splitting the feature into multiple `FRDs` instead of adding more `Blueprints`.

### Work Order

Each `Work Order` must:

- use the work-order template
- be executable by an AI or human without major ambiguity
- represent a coherent vertical implementation slice that delivers an end-to-end outcome (schema when relevant + server actions + UI + tests + analytics)
- stay narrow enough that one implementation agent can complete it without mixing multiple loosely related user actions
- avoid splitting tiny technical leftovers into separate tickets
- include:
  - `Summary`
  - `In Scope`
  - `Out of Scope`
  - `Requirements`
  - `Blueprints`
  - `E2E Acceptance Tests`
- explicitly include, unless the slice is the foundation `Work Order` described in `## Work Order splitting rules`:
  - automated tests of the type that applies to the slice (unit, integration, or E2E, per `.agents/rules/testing-strategy.mdc` and `.agents/rules/validation-checklist.mdc`); at minimum one E2E acceptance path
  - PostHog analytics events for the user-visible actions the slice introduces, following `.agents/rules/posthog-events.mdc`

Each `Work Order` created here should be treated as an initial slice definition, not as a fully enriched implementation brief.

Every `Work Order` created by this command must start with document `status: DRAFT`. Promotion to `ACTIVE` happens later through the `enrich work order context` workflow unless the user explicitly approves a different lifecycle state during this command.

Each proposed `Work Order` must also have an explicit internal rationale covering:

- `Outcome`: what meaningful user or system outcome this slice owns
- `Why separate`: why this should be its own `Work Order` instead of being merged with a sibling
- `Dependencies`: what must land first, if anything
- `Parallelizable after`: what prerequisite unlocks parallel work
- `Needs enrich`: whether later `enrich work order context` work is likely `high`, `medium`, or `low`

## Work Order splitting rules

Split work by coherent **vertical outcomes**, not by arbitrary technical fragments and never by technical layer.

Prefer more, smaller work orders when that improves implementation clarity, sequencing, and parallel execution.

### Vertical slice rule

Every `Work Order` that is not the foundation slice must be a vertical slice that:

- owns an end-to-end user-visible or system-visible outcome
- includes the schema changes (if any specific to this flow), server actions, UI, automated tests, and PostHog events for that outcome
- can be demoed and tested end-to-end when it closes, without waiting for any sibling slice

It is **forbidden** to split a single outcome into a paired "backend Work Order" and "frontend Work Order". If two slices can only be validated together, they are not two slices — they are one.

### Foundation Work Order (WO-01 when used)

When two or more later slices share the same schema, enums, validation, or domain helpers, a single foundation `Work Order` is allowed at the top of the `Blueprint`. It is typically numbered `WO-01`.

The foundation `Work Order` may contain:

- Prisma schema changes and the matching migration
- shared enums
- shared Zod schemas
- shared domain helpers (totals, derived status, formatters, etc.)
- unit tests for those helpers
- server actions that are genuinely consumed by two or more later slices (for example a shared catalog read)

The foundation `Work Order` must **not** contain:

- any UI, including "shared" components
- server actions specific to a single downstream flow
- pages or routes

Precedence rule: if an artifact is used by more than one later `Work Order`, it belongs in the foundation; if it is used by a single flow, it belongs in that flow's vertical slice.

The foundation `Work Order` is the only slice exempt from the "must include an E2E acceptance path" rule. It is validated with unit tests because by design it ships no UI. This exemption must be stated in the foundation slice itself.

Do not create a foundation `Work Order` when there is nothing genuinely shared. An artificial foundation is worse than no foundation.

### Canonical split pattern (reference)

The recommended pattern for most domain features with CRUD and list surfaces is the following ordered sequence. Not every feature needs all steps — drop the ones that do not apply — but the order should hold:

1. **Foundation** — schema, enums, shared Zod schemas, shared helpers, unit tests. Only when something is truly shared.
2. **Create** — the primary creation flow, end-to-end. Placed first among vertical slices because nothing else has data to operate on without it.
3. **Detail (read-only)** — single-record view, read-only.
4. **Detail actions** — actions that operate on an existing record from the detail view (for example: add payments, add notes, change status). Separate from the read-only detail slice.
5. **Edit** — editing the existing record's core data. Separate from create, even when the form is partially shared, because the invariants and discard-changes flow are different.
6. **List** — listing of records with baseline data.
7. **Filters** — list filtering, when the filter surface is non-trivial. May be folded into the list slice when filters are just one or two basic chips.
8. **Hardening / extras (optional)** — overdue signals, metrics, edge cases, polish, and small items that surfaced during implementation. Only when there is a coherent cluster of leftovers worth one slice; do not create a final slice only to host analytics cleanup.

Every slice in this pattern (except the foundation) must include automated tests of the type that applies to the slice and PostHog events for its user-visible actions. This is non-negotiable.

### Good vs bad slices

Good `Work Orders`:

- implement one meaningful vertical flow end-to-end, or the foundation capability shared by later flows
- can be reviewed independently
- map clearly to a GitHub ticket
- have test implications that are easy to reason about
- are small enough that a single implementation agent can own the slice without juggling multiple unrelated behaviors
- ship tests and analytics as part of the same slice, not as a later pass

Avoid:

- a "backend Work Order" paired with a "frontend Work Order" for the same user outcome
- form UI in one work order and validation in another
- one work order only for analytics or only for tests
- tiny leftover work orders that exist only because of file boundaries
- combining multiple independent user flows (for example create and edit, or detail view and detail actions) into one work order just because they belong to the same domain area
- combining a foundational prerequisite with multiple downstream user flows when the downstream flows could be implemented independently after the foundation lands

When a work order candidate contains two or more user actions that could reasonably be implemented, reviewed, tested, or delegated separately, split them unless a shared implementation contract would become unnaturally fragmented.

Do not create "fake-ready" `Work Orders` that look valid on paper but still hide major ambiguity in what outcome they own. If a candidate `Work Order` cannot be described cleanly in terms of a single coherent outcome plus clear prerequisites, the split is not ready yet.

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
- proposed `Work Order` titles in implementation order, clearly marking the foundation slice (if any) and labeling every other slice as a vertical end-to-end outcome
- proposed work-order dependency and parallelization plan
- a short `Work Order split rationale` that explains why these slices are the right vertical cut and, when a foundation slice exists, what is shared between the later slices that justifies it
- which `Work Orders` will likely need deeper follow-up through `enrich work order context`
- whether the command will create a new GitHub Epic or update an existing one
- how many GitHub tickets will be created
- any important split rationale only when it affects the user's decision

### Blueprint-count confirmation

Whenever the natural proposal contains **two or more `Blueprints` under a single `FRD`**, the command must pause before approval and ask the user in Spanish, in plain terms, whether the feature should instead be split into multiple `FRDs` (one `Blueprint` each). The prompt must:

- state how many `Blueprints` were proposed and their titles
- explain briefly why each one was cut as its own `Blueprint` instead of a standalone `FRD`
- offer the alternative split into multiple `FRDs`, naming the candidate `FRD` titles
- wait for an explicit user decision before continuing

Only after the user chooses (keep multiple `Blueprints` in one `FRD`, or split into multiple `FRDs`) may the command move on to the final approval gate. If the user chooses to split, restate the full proposal under the new shape before asking for approval.

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
- immediately after each Work Order ticket is created, **write its GitHub issue number into the frontmatter of the matching `Work Order` `.md` file as `source_issue: <issue-number>`** (number only, no `#`, no URL). Do this as part of the same execution pass — do not defer it to a later command
- keep the Epic and every Work Order ticket **open** (GitHub issue `state: open`). New issues are created open by default; do not close any of them in this command. If you update or reuse an Epic or slice that is currently closed, **reopen** it so execution tracking starts from an open item
- attach every created Work Order ticket as a **sub-issue** of that Epic (GitHub parent/child relationship), not only via a `Parent Epic: #NN` line in the ticket body
- add sub-issues in **Work Order execution order** (`WO-01`, then `WO-02`, then `WO-03`, and so on across the FRD). When an FRD has multiple `Blueprints`, follow the same order as the blueprint implementation plan and linked work-order lists (typically all `WO`s from `BP-01` in order, then `BP-02`, etc.). **Do not** sort or infer order from public GitHub issue numbers (`#78`, `#81`, …); those reflect creation time, not `WO` sequence, and a wrong sub-issue order breaks Epic views, Project child lists, and planning.
- first child can be added without a position hint; for each additional child, if GitHub returns a priority or placement error, add it immediately after the previous slice using that sibling issue's numeric REST `id` as `after_id`, since `id` is not the same as the public issue number
- after all sub-issues are attached, **verify** with GitHub MCP `issue_read` (`get_sub_issues`) that the returned list order matches `WO-01` through `WO-NN`. If not, use `sub_issue_write` (`reprioritize`) with sibling REST `id` values (`after_id` / `before_id`) until the order matches the Work Order docs
- do not create GitHub issues for `Blueprints`
- add the Epic and every created ticket to GitHub Project `4` in the same execution pass
- set the GitHub Project `4` **Status** field as follows (this is independent of issue open/closed):
  - Epic → **`Todo`**
  - every created Work Order ticket → **`Backlog`** (matches the `status: DRAFT` default of a newly created `Work Order` doc; promotion to `Todo` happens later through `enrich work order context`). See `docs/process/github-project-tracking.md` → **Readiness rule**.
  - The only exception is when the user explicitly approved a different initial `Status` value during the proposal approval step.
  - For token retrieval, stable IDs, and `curl` patterns to set these Status fields, see `docs/process/github-project-tracking.md` → **GitHub GraphQL API**.
- explicitly verify that the Epic and every created ticket are present in GitHub Project `4` before finishing
- explicitly verify that the Epic and every created ticket are **open** and have the correct Project `Status` (Epic = `Todo`, every slice = `Backlog`, or the user-approved alternative) before finishing
- explicitly verify that the Epic lists every created Work Order ticket as a sub-issue (for example via GitHub MCP `issue_read` with `get_sub_issues`) **and that sub-issues appear in `WO-01`…`WO-NN` order** before finishing
- explicitly verify that every created `Work Order` `.md` file has its `source_issue` frontmatter field populated with the numeric id of the matching GitHub ticket before finishing

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
- Do not create `Work Orders` whose only purpose is "leftover technical cleanup" unless that cleanup is itself a coherent hardening or foundation slice.
- Do not split a single user outcome into a paired "backend Work Order" + "frontend Work Order". Vertical slicing is mandatory.
- Do not cut `Blueprints` by technical layer (backend vs frontend). `Blueprints` are cut by sub-domain or work area.
- Do not propose two or more `Blueprints` under a single `FRD` without running the blueprint-count confirmation with the user and documenting the answer.
- Do not create a foundation `Work Order` unless at least two later slices share the artifacts it hosts. If nothing is truly shared, the foundation is artificial and must be removed from the plan.
- Do not ship a vertical `Work Order` without its tests and PostHog events as part of the same slice. Tests and analytics are not a later pass.
- Do not finish the GitHub creation pass without writing `source_issue` back into each created `Work Order` `.md` file.

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

- `docs/product/prd-02-collector-app/prd-02-collector-app.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-01-store-persistence-foundation.md`

Optional GitHub links may be added as convenience only when useful, but the path is the source-of-truth reference.

### GitHub labels and project rules

- Epic title must always include the feature code using the format `FEAT-XXXX: <FRD title>`.
- Epic label: `type:epic`
- Work Order ticket label: `type:slice`
- add area label when inferable
- add both Epic and tickets to GitHub Project `4`
- set Project `Status` by default: **`Todo`** on the Epic and **`Backlog`** on every created slice (see `docs/process/github-project-tracking.md` → **Readiness rule**). Do not leave new items as `Done` or `In Progress`, and do not set slices to `Todo` at creation time unless the user explicitly requested that initial value when they approved the proposal.
- keep every Epic and slice **open** (issue state); closing issues is out of scope for this command
- do not treat issue creation as complete until project membership has been confirmed for the Epic and every created ticket
- if any issue cannot be added to Project `4`, cannot be kept or set **open**, or its `Status` cannot be set to the required initial value (`Todo` for the Epic, `Backlog` for each slice), report the specific blocked issue numbers in the final response and treat the command as partially complete

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
- when the proposal contained two or more `Blueprints` under one `FRD`, the blueprint-count confirmation was run with the user and the chosen shape is documented in the final package
- the FRD is dense enough to guide implementation
- the Blueprints are concrete and architecture-aware, cut by sub-domain and never by technical layer
- the Work Orders are executable and not too thin, and each one (except the foundation slice, if any) is a vertical end-to-end outcome that includes its tests and PostHog events
- when a foundation `Work Order` exists, it is genuinely shared by two or more later slices, ships no UI, and is clearly referenced from its `Blueprint`'s implementation plan
- GitHub Epic/Tickets follow the hybrid workflow instead of duplicating docs
- the GitHub Epic and every created ticket were added to GitHub Project `4`
- the GitHub Epic and every created ticket are **open** and were verified in GitHub Project `4` with the correct initial `Status` (Epic = **`Todo`**, every slice = **`Backlog`**, or the user-approved alternative from the proposal)
- every created `Work Order` `.md` file has `source_issue: <issue-number>` populated in its frontmatter matching the GitHub ticket that was created for it
- all created items fit the current `docs/product` structure
