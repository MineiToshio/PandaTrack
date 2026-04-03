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
- If the referenced Work Order is also linked to GitHub tracking, keep GitHub issue content aligned after doc approval when practical.
- Before asking any clarification questions, provide a concise Spanish summary of what the target `Work Order` does today so the user has shared context for the discovery conversation.
- Treat implementation-critical undefined decisions as blockers, not as minor omissions. If a missing technical or operational decision would likely cause rework during implementation, the command must surface it explicitly before docs are approved.

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
- include a short explanation of why each question matters when useful
- include concrete options whenever you can propose them
- include a recommended option first when one seems clearly preferable
- avoid vague filler questions

For each important question, prefer this structure:

1. the decision to make
2. 2 to 4 concrete options
3. your recommended option with a short rationale
4. the tradeoff or consequence of the choice

If the answer can be inferred confidently from existing docs or current implementation, do not ask. Instead, state the inferred assumption and ask for confirmation only if the risk of being wrong is meaningful.

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

2. `Open decisions`
- the unresolved decisions grouped by role
- explicitly separate `implementation-critical decisions still undefined` from lower-risk open questions

3. `Recommended decisions`
- your recommended answers for each major unresolved area

4. `Planned doc updates`
- what would change in the `Work Order`
- what would need to change in the parent `Blueprint`
- what would need to change in the parent `FRD`
- what would need to change in the parent `PRD`
- whether linked GitHub tracking should be updated too

5. `Approval gate`
- ask the user to confirm whether to apply the proposed decisions
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

## Final response format

If still in discovery and waiting on user answers, return in Spanish:

1. `Work Order summary`
2. `Work Order analyzed`
3. `Questions by role`
4. `Why these matter`
5. `Next step`

If approval was given and docs were updated, return in Spanish:

1. `Docs updated`
2. `Decision summary`
3. `What changed upward`
4. `Remaining open items`
5. `GitHub sync`

If the command stops early, say exactly what reference or decision is missing.
