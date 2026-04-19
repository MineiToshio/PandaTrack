# Enrich Work Order Context

Clarify, pressure-test, and enrich one existing Work Order so it becomes implementation-ready with stronger product, UX, technical, security, and testing context.

This command is a two-phase workflow:

1. discovery and clarification with the user
2. synchronized doc updates after explicit user approval

The command must treat the referenced `Work Order` as the entry point, but it must update parent docs upward when the clarified decisions change higher-level definition.

## Inputs

- `work_order_reference`: Work Order path, Work Order id, GitHub slice issue number, or GitHub slice URL
- optional `extra_context`: constraints, screenshots, rough ideas, implementation intent, deadlines, or known concerns

## Core behavior

- Conversation with the user must be in Spanish.
- Generated documentation updates must be in English.
- Do not update any doc until the user explicitly approves the proposed decisions.
- Treat this command as a structured discovery workflow, not as immediate drafting.
- Repository docs remain the source of truth for product definition.
- When approved edits mention another FRD's blueprints, work orders, or functional requirements, apply **Cross-FRD references** from `docs/templates/product-docs-guide.md` (qualified **FRD-XX**, links to target `.md` files, optional slug and heading anchors).
- If the referenced Work Order is also linked to GitHub tracking, keep GitHub issue content aligned after doc approval when practical.
- Before asking any clarification questions, provide a concise Spanish summary of what the target `Work Order` does today so the user has shared context for the discovery conversation.
- Treat implementation-critical undefined decisions as blockers, not as minor omissions. If a missing technical or operational decision would likely cause rework during implementation, the command must surface it explicitly before docs are approved.
- Treat established repository conventions as already-made decisions. Any question that is already answered by `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`, `docs/tooling/cursor/rules.md`, `docs/design/`, `docs/development/`, applicable ADRs under `docs/` or skills under `.agents/skills/` must not be asked. Instead, surface the applicable convention inline as an inferred assumption and cite the owning file.

## Planning objective

Produce an implementation-ready definition package centered on one existing `Work Order` by:

1. identifying missing or ambiguous decisions
2. asking high-value questions grouped by role
3. proposing concrete options and recommendations for each question
4. capturing the resulting decisions clearly
5. updating the target `Work Order`
6. propagating necessary changes upward to the parent `Blueprint`, `FRD`, and `PRD`
7. keeping related GitHub tracking aligned when the linked issue content becomes stale relative to the docs
8. identifying implementation-critical undefined decisions before they become execution risk

## Resolution requirements

Before asking questions or drafting changes, resolve the target context in this order:

0. resolve repository conventions (always first)
- read `AGENTS.md` and `CLAUDE.md` to capture mandatory baseline behavior
- open `docs/tooling/cursor/rules.md` and identify every rule family that could apply to the target `Work Order` based on its scope (frontend, data, auth, i18n, analytics, error handling, design, accessibility, testing, migrations, env vars, optimistic updates, icons, theming, etc.)
- read each matching `.cursor/rules/*.mdc` file fully enough to know what it already mandates
- scan `docs/design/README.md` and `docs/development/` for any doc that already owns the decision (file placement, lib inventory, schema, i18n, og images, etc.)
- scan `docs/` for existing ADRs that already settle a relevant decision
- record the resulting list of binding conventions so they can be reused in the `Convention-driven assumptions` section of the proposal, and so no question is asked about a decision that is already defined

1. resolve the target `Work Order`
- If the input is a path, read that file directly.
- If the input is a `WO-XX` id, locate the matching file under `docs/product/`.
- If the input is a GitHub slice issue number or issue URL:
  - read the issue from `MineiToshio/PandaTrack`
  - extract the linked `Work Order Path`
  - stop and report the missing reference if the issue does not include it

2. resolve the parent chain
- read the parent `Blueprint`
- read the parent `FRD`
- read the parent `PRD`

3. resolve nearby context
- read sibling `Work Orders` under the same `Blueprint`
- review any repo docs directly linked from the target `Work Order`, `Blueprint`, or `FRD`
- inspect relevant implementation files in the current codebase when existing behavior may affect the questions or updates

4. resolve execution context when available
- if the `Work Order` has a `source_issue` or the input came from GitHub, read the linked slice issue
- read the parent Epic when needed to understand current tracking wording and linked scope

5. resolve role-specific implementation context
- inspect the relevant code paths from each applicable role perspective, not only as a generic reader
- when the slice touches infrastructure, storage, uploads, integrations, queues, auth, observability, cron, email, payments, or other operational concerns, inspect those boundaries explicitly
- when helpful and available, delegate bounded investigations to subagents by role and have them report:
  - decisions already defined
  - high-risk gaps
  - recommended questions
  - recommended decisions
  - risks if left undefined
- the main agent remains responsible for synthesis and must not simply forward raw subagent output

6. resolve external pattern context when it would materially improve discovery quality
- when the slice involves non-trivial UX patterns, file/media handling, storage/infrastructure choices, security-sensitive flows, or other areas where established practice matters, research current patterns from high-quality sources
- use that research to improve the quality of questions and recommendations, not to replace the repository source of truth

Do not guess missing parent references when the docs already define them.

Before starting the question phase, synthesize the resolved context into a short Spanish pre-brief that explains:

- the main goal of the target `Work Order`
- the user-facing or system behavior it is meant to add
- the most important in-scope vs out-of-scope boundary
- any obvious dependency on sibling `Work Orders` when that context helps the user understand the slice

Before asking questions, produce an internal role-by-role gap analysis that identifies:

- what is already clearly defined
- what is partially defined
- what is undefined but implementation-critical
- which undefined items must be asked before the `Work Order` can be considered implementation-ready

## Decisions governed by existing conventions

Before building the question list, filter out every candidate question whose answer is already defined by a repository convention. For each filtered item, produce a one-line inferred assumption that:

- states the concrete decision being applied (in product/system terms, not just the category)
- cites the owning file by repository-relative path (for example `AGENTS.md §4`, `.cursor/rules/next-intl-translation-apis.mdc`, `.cursor/rules/optimistic-client-updates.mdc`, `docs/design/interface-patterns.md`, `docs/development/database-schema.md`)

Typical categories that must not become questions because existing conventions already define them:

- file placement and route-level folder naming (`project-structure.mdc`, `docs/development/file-organization.md`)
- Server Actions vs Route Handlers (`coding-standards.mdc`)
- reuse of `src/components/core` / `src/components/modules` before new components (`coding-standards.mdc`, `react-next-components.mdc`)
- Prisma client usage and data-access boundaries (`prisma-data-layer.mdc`, `data-layer-user-id-duplication.mdc`)
- Prisma migrations workflow (`prisma-migration-workflow.mdc`)
- validation with Zod at boundaries and expected-vs-unexpected error handling (`error-handling-validation.mdc`, `sentry-error-handling.mdc`)
- next-intl API selection in React vs framework functions (`next-intl-translation-apis.mdc`)
- user-facing copy living in `src/i18n/locales/**` instead of hardcoded strings (`english-code-only.mdc`, `coding-standards.mdc`)
- PostHog event naming and attachment patterns (`posthog-events.mdc`)
- optimistic client updates for user-visible mutations (`optimistic-client-updates.mdc`)
- theme-aware design tokens, semantic HTML, `cn()` usage (`theme-light-dark.mdc`, `tailwind-semantic-html.mdc`, `ui-visual-consistency.mdc`)
- responsive behavior expectations (`responsive-design.mdc`)
- accessibility baseline for forms, dialogs, nav, focus, status (`role-accessibility.mdc`)
- icon sources (`icons.mdc`)
- testing scope defaults (`testing-strategy.mdc`, `validation-checklist.mdc`)
- environment variable registration (`env-example.mdc`)
- cross-FRD reference format (`product-doc-cross-frd-references.mdc`, `docs/templates/product-docs-guide.md`)
- GitHub tracking sync expectations (`github-tracking-sync.mdc`)

Only ask about these categories when the `Work Order` presents a concrete case that the convention does not cover, and state explicitly why the convention is insufficient.

## Discovery roles

During clarification, the command must actively switch between these roles and ask only high-signal questions.

### 1. Product strategy role

Ask about product-definition gaps such as:

- user problem and expected outcome
- business goal and why this slice matters now
- exact scope boundaries
- explicit out-of-scope items
- states, transitions, and lifecycle rules
- permissions and actor differences
- edge cases and exception handling
- success criteria and failure criteria
- analytics expectations
- notification or reminder implications
- rollout constraints or sequencing dependencies

### 2. UX/UI role

Ask about design-definition gaps such as:

- entry points and navigation expectations
- information hierarchy
- form structure and field priorities
- layout expectations across mobile, tablet, and desktop
- empty, loading, success, and error states
- validation visibility and timing
- interaction density and complexity tolerance
- discoverability of advanced actions
- accessibility-sensitive interaction choices
- whether multiple UI patterns are acceptable and which one is preferred

### 3. Senior full-stack engineering role

Ask about implementation-definition gaps such as:

- affected routes, modules, and runtime boundaries
- server vs client responsibilities
- required persistence changes
- data shape and validation rules
- integration points with existing queries, actions, and components
- migration needs
- observability and instrumentation requirements
- performance expectations
- concurrency or transaction requirements
- backward compatibility considerations
- dependencies on sibling work

This role must also actively pressure-test implementation-critical operational details such as:

- external service/provider choice
- storage or infrastructure destination
- bucket/container/prefix/folder structure
- object key or file naming conventions
- input vs output format decisions
- size limits, retention rules, and cleanup strategy
- synchronous vs asynchronous processing boundaries
- retry, failure, and recovery behavior
- cache/CDN implications when relevant
- whether the current `Blueprint` should be updated with a technical contract before implementation begins

### 4. Security and abuse-prevention role

Ask about risk-definition gaps such as:

- authentication and authorization expectations
- abuse scenarios
- spam, rate-limit, or replay concerns
- sensitive data exposure risks
- moderation-sensitive payload handling
- auditability requirements
- trust boundaries for user-submitted content
- file upload or URL-input risks when applicable
- denial-of-service or enumeration risks
- privacy implications and data retention expectations

### 5. QA and acceptance role

Ask about verification-definition gaps such as:

- unit, integration, and E2E expectations
- critical acceptance paths
- regression-sensitive areas
- locale coverage expectations
- accessibility verification expectations
- analytics verification expectations
- negative-path and edge-case coverage
- what must be proven before the slice is considered implementation-ready

## Question quality rules

Questions must:

- be written in Spanish
- be grouped by role in concise batches
- focus only on materially missing decisions
- be self-contained: the user must be able to answer the question without opening another doc, issue, or code file
- include a short explanation of why each question matters when useful
- include concrete options whenever you can propose them
- include a recommended option first when one seems clearly preferable
- avoid vague filler questions

### Context requirements for every question

Each question must be **self-contained**: a reader who has never opened the referenced docs or code should still understand exactly what is being decided, why it matters, and what each option means. At minimum:

- state the concrete product or system behavior the decision affects, in plain language, not just the abstract category
- when the question touches existing code, name the specific file, route, component, action, table, or field involved and summarize in one line what it currently does
- when the question depends on another doc (another `Work Order`, `Blueprint`, `FRD`, `PRD`, ADR, design doc, or GitHub issue), do not reference it by id alone; include a short inline paraphrase of the relevant part (1–3 sentences) so the user does not have to open it to understand the question
- when the question references a sibling slice or prior decision, summarize what that slice or decision actually did and how it affects this one
- when the question uses a domain term that is not yet defined in the current `Work Order`, define it briefly inline the first time it appears in the question batch
- when proposing options, describe each option in product/user-visible terms, not only in technical shorthand; include the concrete consequence of choosing it
- always cite sources with a repository-relative path alongside the code, not only an id, so the user can trace it if they want to

#### Self-containment test (must pass for every question)

Before including a question in the final batch, verify all of the following:

1. the question names the exact object of the decision (screen, action, field, table, state, copy key, etc.), not just a category
2. every doc reference has an inline paraphrase of the relevant part and a repository-relative path
3. every code reference has an inline one-line description of the current behavior plus the path
4. every domain term is defined inline at first use
5. each option is described in user-visible or behavior-visible terms, followed by its consequence

If any check fails, rewrite the question until all pass or drop it.

#### Forbidden question shapes

These shapes are never acceptable on their own and must be rewritten before being shown to the user. The examples below are written in English for documentation purposes; when the command runs, the actual wording is produced in Spanish, but the same forbidden patterns apply:

- `How do we handle X per WO-03?`
- `Review what FRD-04 defined and decide.`
- `Same as BP-02, what applies here?`
- `See issue #123 for context.`
- `Do we follow the standard project pattern?` (must state what the pattern is)
- `What stack do we use for this?` (stack is already fixed in `AGENTS.md §3`)

#### Rewrite example

The example below is written in English; at runtime the Spanish labels `Context / Decision / Options / Consequence / Recommended` are used instead.

Bad (bare reference, no context):

> Per WO-03, how do we handle order state here?

Good (self-contained, paraphrased, with paths and options):

> **Context.** `WO-03` (`docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-03-...md`) defined three order states: `DRAFT`, `ACTIVE`, `ARCHIVED`, where `ACTIVE` enables payments and shipments. This slice adds the cancel action from the order detail view.
> **Decision.** Should cancellation produce a new terminal `CANCELLED` state, or reuse `ARCHIVED` with a reason?
> **Options.**
> - A. New terminal `CANCELLED` state (blocks payments/shipments; requires migration and its own badge in the list). *Recommended* for UI and reporting clarity.
> - B. Reuse `ARCHIVED` with `cancellationReason` (no enum migration, but mixes cancellations with historical archives in the list).
> **Consequence.** Choosing A requires updating `prisma/schema.prisma`, the list table, and filters; choosing B requires adjusting only queries and copy.

If a question cannot be made self-contained without becoming too long, split it into a short context paragraph followed by the actual decision question.

### Question structure

For each important question, prefer this structure:

1. a short **Context** line or short paragraph that grounds the decision in the current product/system state and paraphrases any external references inline
2. the decision to make, stated as a single concrete question
3. 2 to 4 concrete options, each with a one-line product-level description and its consequence
4. your recommended option with a short rationale
5. the tradeoff or consequence of the choice

If the answer can be inferred confidently from existing docs or current implementation, do not ask. Instead, state the inferred assumption with the same level of inline context described above and ask for confirmation only if the risk of being wrong is meaningful.

## Required areas to pressure-test

The command must explicitly pressure-test whether the current `Work Order` is sufficiently clear about:

- user-facing flows
- permissions and role-based behavior
- state transitions
- data persistence and schema impact
- validation and error handling
- localization impact
- accessibility impact
- analytics and Sentry impact
- moderation or operations impact
- security and abuse handling
- testing scope
- implementation sequencing
- dependencies on other slices
- whether the `Work Order` is too broad or should be split

The command must not stop at generic categories. It must also identify the specific missing decisions underneath them.

For example, if the slice touches uploads, storage, media, or external services, the command must explicitly pressure-test:

- chosen provider/service
- why that provider fits the current architecture
- exact storage location strategy
- exact key/path/naming convention
- file lifecycle and overwrite/versioning behavior
- input constraints
- output constraints
- processing location and timing
- user feedback when processing fails
- operational or cost risks

If the slice touches any of the following domains, the senior full-stack role must produce a mini operational spec before discovery can be considered complete:

- file upload or media handling
- external storage
- third-party integrations
- payments
- auth/security boundaries
- background jobs or cron
- observability/monitoring
- email delivery
- scheduled or asynchronous processing

If the command concludes the target `Work Order` is too large, too cross-cutting, or too ambiguous to implement safely as a single slice, it must say so clearly in Spanish and propose a better split before editing docs.

## Proposal phase

After discovery and before any file edits, return a proposal in Spanish with:

1. `Current understanding`
- concise restatement of the Work Order goal and what seems missing today

2. `Convention-driven assumptions (not asked)`
- decisions inferred from `AGENTS.md`, `CLAUDE.md`, matching `.cursor/rules/*.mdc`, `docs/design/`, `docs/development/`, or applicable ADRs
- one line per assumption with the applied convention and the owning file path
- the user can still override any assumption, but these are not phrased as open questions

3. `Open decisions`
- the unresolved decisions grouped by role
- explicitly separate `implementation-critical decisions still undefined` from lower-risk open questions

4. `Recommended decisions`
- your recommended answers for each major unresolved area

5. `Planned doc updates`
- what would change in the `Work Order`
- what would need to change in the parent `Blueprint`
- what would need to change in the parent `FRD`
- what would need to change in the parent `PRD`
- whether linked GitHub tracking should be updated too

6. `Approval gate`
- ask the user to confirm whether to apply the proposed decisions and the convention-driven assumptions
- do not ask for approval until all implementation-critical undefined decisions are either resolved or explicitly deferred by the user

Do not edit docs before this approval.

## Update phase

Once the user explicitly approves the proposal, apply the decisions to the docs using the smallest coherent set of edits.

### Work Order update requirements

Update the target `Work Order` so it becomes materially more implementation-ready.

When this command updates the target `Work Order` after user approval, set its document `status` to `ACTIVE` as part of the same edit unless the user explicitly instructs a different lifecycle state.

Expand it as needed with concrete, testable content. When helpful, add sections beyond the template, such as:

- `Assumptions`
- `UX Notes`
- `Technical Notes`
- `Security Notes`
- `Observability Notes`
- `Dependencies`
- `Open Questions` only if the user explicitly wants some decisions deferred

The updated `Work Order` should reduce ambiguity for implementation, not just become longer.

### Cross-FRD reference hygiene

Any new or updated sentence that points at **another FRD** must not rely on bare `WO-NN` or `BP-NN` alone. Use **FRD-XX · WO-NN** / **FRD-XX · BP-NN**, add the slug when it helps, and link to the concrete markdown path (see `docs/templates/product-docs-guide.md`, **Cross-FRD references**).

### Upward sync requirements

Update parent docs only when the approved decisions change their rightful source-of-truth layer:

- update the `Blueprint` when architecture, boundaries, runtime components, contracts, extension points, or technical decisions changed
- update the `FRD` when requirements, business rules, user flows, scope boundaries, or acceptance criteria changed
- update the `PRD` when release-level scope, product map, prioritization, or high-level positioning changed

Do not push details upward unnecessarily.

### GitHub sync requirements

If the `Work Order` is linked to a slice issue and the approved doc changes materially affect the issue body, add a concise sync update to GitHub or update the issue body when practical with available tools.

If the required GitHub Project or issue-body sync cannot be completed with available tools, report that explicitly.

## Guardrails

- Do not invent decisions that the user explicitly wants to decide later.
- Do not widen scope casually just because a related concern exists.
- Do not add implementation details to the `PRD` that belong in lower layers.
- Do not add product requirements to the `Blueprint` when they belong in the `FRD`.
- Do not leave critical ambiguity unresolved while pretending the `Work Order` is implementation-ready.
- Do not overwrite existing intent in docs without reconciling it explicitly.
- Do not treat infrastructure, storage, naming, error-recovery, or observability choices as “implementation details” when they are necessary to prevent downstream execution chaos; surface them during discovery at the correct doc layer.
- Do not ask the user about any decision already defined by `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`, `docs/tooling/cursor/rules.md`, `docs/design/`, `docs/development/`, or an applicable ADR. Apply the rule, state it as an inferred assumption with the owning file path, and move on.
- Do not use bare document or code references in questions. Every `WO-NN`, `BP-NN`, `FRD-XX`, ADR id, issue number, or file path must be accompanied by an inline paraphrase of the relevant content so the question is self-contained.

## Final response format

If still in discovery and waiting on user answers, return in Spanish:

1. `Work Order summary`
2. `Work Order analyzed`
3. `Convention-driven assumptions (not asked)`
4. `Questions by role`
5. `Why these matter`
6. `Next step`

If approval was given and docs were updated, return in Spanish:

1. `Docs updated`
2. `Decision summary`
3. `What changed upward`
4. `Remaining open items`
5. `GitHub sync`

If the command stops early, say exactly what reference or decision is missing.
