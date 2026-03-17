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
- Use the relevant templates in `docs/templates/` as the mandatory base:
  - `docs/templates/frd-template.md`
  - `docs/templates/blueprint-template.md`
  - `docs/templates/work-order-template.md`
- Follow:
  - `docs/process/hybrid-product-github-workflow.md`
  - `docs/process/github-project-tracking.md`
  - `docs/process/workflow-ai.md`

## Planning objective

Produce:

1. one new `FRD` under the specified `PRD`
2. one or more related `Blueprints`
3. one or more `Work Orders` under each `Blueprint`
4. an updated parent `PRD` that reflects the new `FRD`
5. one matching GitHub Epic for the `FRD`
6. one GitHub ticket per `Work Order`

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
- implementation sequencing
- testing boundaries
- validation needs
- i18n impact
- accessibility impact
- analytics and Sentry scope
- atomic write requirements
- likely implementation risks

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

The questions should be grouped into concise but thorough batches.

Do not ask vague filler questions.

## Context-building requirements

Before drafting:

1. Read the target `PRD`.
2. Review nearby `FRDs` under the same `PRD` so the new one fits the existing product map.
3. Inspect the current codebase for implemented behavior that should influence the new documents.
4. Review current GitHub epics and tickets to avoid duplicating existing work.

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

### Work Order

Each `Work Order` must:

- use the work-order template
- be executable by an AI or human without major ambiguity
- represent a coherent vertical implementation slice
- avoid splitting tiny technical leftovers into separate tickets
- include:
  - `Summary`
  - `In Scope`
  - `Out of Scope`
  - `Requirements`
  - `Blueprints`
  - `E2E Acceptance Tests`

## Work Order splitting rules

Split work by coherent outcomes, not by arbitrary technical fragments.

Good `Work Orders`:

- implement one meaningful flow or foundational capability
- can be reviewed independently
- map clearly to a GitHub ticket
- have test implications that are easy to reason about

Avoid:

- form UI in one work order and validation in another unless they are truly separate deliverables
- one work order only for analytics unless it is a final hardening pass
- tiny leftover work orders that exist only because of file boundaries

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
- if reusing an existing FRD, the existing FRD path and related Epic reference
- proposed `Blueprint` titles
- proposed `Work Order` titles
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
- do not create GitHub issues for `Blueprints`

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

- Epic label: `type:epic`
- Work Order ticket label: `type:slice`
- add area label when inferable
- add both Epic and tickets to GitHub Project `4`
- set initial `Status` to `Todo` unless the user requested another starting state

## Numbering and naming rules

When creating the new FRD package:

- choose the next correct `FRD` number under the target `PRD`
- choose local `Blueprint` numbering inside that `FRD`
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
7. `Docs updated`
8. `Open assumptions`
9. `Follow-up notes`

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
- all created items fit the current `docs/product` structure
