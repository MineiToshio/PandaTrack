# Create Feature Epic And Slices

Create a GitHub epic and its slice sub-issues from a raw feature idea. The command must remove ambiguity first, then produce a complete planning package in GitHub.

## Inputs

- `feature_brief`: raw feature description, notes, or goals from the user
- optional `extra_context`: constraints, deadlines, screenshots, links, related issues, or technical preferences

## Core behavior

- Conversation with the user must be in Spanish.
- Generated GitHub issue content must be in English.
- Do not write to GitHub or local product docs until the user approves the proposed epic/slice plan.
- Do not assume missing product or technical details when they materially affect scope, architecture, integrations, or acceptance criteria.
- Use `docs/templates/feature-epic-template.md` as the mandatory base for the epic body.
- GitHub Project is the source of truth: `https://github.com/users/MineiToshio/projects/4`
- Repository: `MineiToshio/PandaTrack`

## Planning objective

Produce:

1. One epic issue with complete requirements and acceptance criteria.
2. Multiple slice sub-issues under that epic.
3. Updated product docs in `docs/product`, especially `docs/product/overview.md`, so the repository keeps a product-level summary of what PandaTrack now includes.
4. Slices that are:
   - small and reviewable
   - independently testable
   - end-to-end meaningful, not partial technical leftovers
   - usually scoped to roughly one small implementation pass, around 200 lines of code when reasonable

## Existing project patterns to follow

Use current GitHub planning issues in `MineiToshio/PandaTrack` as style reference, especially recent epics and slices such as auth and account recovery.

Observed conventions worth keeping:

- epic title format uses `FEAT-XXXX: <feature name>`
- epic body is long-form and spec-first
- slices use concise action-oriented titles without FEAT prefix
- slices usually include `Goal`, `Scope`, and `Exit criteria`
- slices reference the parent epic explicitly
- cross-cutting concerns like analytics, Sentry, and validation may be grouped into one final slice when they form a coherent quality pass

Observed issues to avoid repeating:

- do not paste noisy placeholder fields such as repeated empty `Source packet path`, `Priority`, or `Status` blocks
- do not leave malformed headings or copied markdown fragments from another document
- do not create slice bodies so thin that they only mirror the title
- do not create an observability-only slice unless it is a meaningful final hardening pass for the feature

## Mandatory planning rules

### 1. Discovery before drafting

Before creating anything, inspect the user input and identify ambiguity, missing decisions, or hidden complexity.

You must ask follow-up questions in Spanish when any of these are unclear:

- target user and use case
- exact problem being solved
- in-scope vs out-of-scope behavior
- primary flow and edge cases
- data that must be stored or updated
- integrations or third-party services involved
- permission/auth requirements
- locale/i18n impact
- failure handling expectations
- analytics expectations
- observability needs
- success criteria

If the feature mentions an external service but not which one, ask explicitly which service should be used.

If the user gives an incomplete idea, ask only the minimum set of high-value questions needed to make the scope buildable. Group related questions into a concise batch.

Do not draft the epic or slices until the critical ambiguities are resolved.

Also, before assuming a new epic is needed, inspect existing GitHub epics for overlap.

If the requested feature appears to belong to an existing epic, do not create a new epic immediately. Instead, ask the user in Spanish which path they want:

- update the existing epic and adjust its slices
- create a new epic anyway

When asking, mention the related epic number and title explicitly.

### 2. Think beyond the user prompt

Act as a product-minded software architect.

Even if the user does not mention them, consider whether the feature should include:

- validation rules
- state transitions
- permissions and authorization checks
- loading/empty/error/success states
- analytics events in PostHog
- unexpected error capture in Sentry
- transactional or atomic writes
- admin/backoffice implications
- email/notification side effects
- migration or schema changes
- accessibility requirements
- testability and rollout risk

If any of these affect scope, include them in the epic and slices. If they need a product decision, ask first.

### 3. Use PandaTrack conventions

Follow repository rules:

- Epic label: `type:epic`
- Slice label: `type:slice`
- Add area label when inferable: `area:store`, `area:purchase`, `area:payments`, `area:shipments`, `area:dashboard`
- Use GitHub Project `Status` as status source of truth
- Keep all user-facing copy out of code and localized in `es` and `en`
- Centralize analytics event names in `POSTHOG_EVENTS`
- Avoid noisy Sentry capture; capture unexpected failures with useful context only
- Keep `docs/product` updated at product-summary level, not implementation-detail level
- Never modify closed slices; create a new slice instead
- Reopen a closed epic if new scope is added to it

### 4. Slice design rules

Every slice must represent a coherent vertical increment.

Good slice characteristics:

- user can exercise the behavior end-to-end
- acceptance criteria are testable
- analytics and error handling are included when they belong to that increment
- no slice exists only for a tiny UI tweak, error string, or instrumentation fragment

Avoid bad slice splits such as:

- form UI in one slice and validation in another
- success path in one slice and error state in another
- main feature in one slice and analytics-only wiring in another

Prefer splits like:

- create/manage entity flow
- list/detail/status view
- payment or shipment state transition flow
- admin configuration flow
- observability and analytics only when attached to a functional slice or when a cross-cutting platform slice is truly justified

If a feature is too small to justify multiple slices, create the minimum viable number of slices without forcing fragmentation.

## Execution steps

### 1. Read planning sources

Before drafting:

- read `docs/templates/feature-epic-template.md`
- follow `docs/process/workflow-ai.md`
- follow `docs/process/github-project-tracking.md`
- apply relevant repository guidance for PostHog and Sentry

### 2. Run discovery

- Extract explicit facts from the user brief.
- List implicit assumptions that need confirmation.
- Check whether the request overlaps meaningfully with an existing epic in GitHub.
- Ask the user focused questions in Spanish.
- Wait for answers when critical information is missing.

### 3. Build the planning contract

Once the feature is clear, define internally:

- problem
- goal
- target user
- scope
- primary flow
- edge cases
- functional requirements
- non-functional requirements
- business rules
- state model
- data contract
- analytics plan
- observability plan
- acceptance criteria
- test plan

### 4. Propose the planning split and ask for approval

Before creating or updating anything in GitHub, send the user a short planning summary in Spanish and wait for approval.

The summary must be concise and decision-oriented. Do not dump full specs. Include:

- whether you propose:
  - creating one new epic
  - creating multiple new epics
  - updating one or more existing epics
  - combining an existing epic update with new epics
- the proposed epic titles only
- for each epic, the number of slices you expect
- for each epic, list the slice titles only
- when relevant, which existing epic would be reused or expanded
- any important scope split rationale only if it affects the user's decision

Example shape:

- `Epic 1`: `<title>` - `3` slices
  - `<slice title 1>`
  - `<slice title 2>`
  - `<slice title 3>`
- `Epic 2`: `<title>` - `5` slices
  - `<slice title 1>`
  - `<slice title 2>`
- Existing epic to update: `#43 FEAT-0008: ...` - add `2` slices
  - `<slice title 1>`
  - `<slice title 2>`

Then ask the user for explicit approval before continuing.

If the user wants changes to the split, adjust the proposal first and ask again if needed.

### 5. Draft the epic

If the user confirmed that a new epic is needed, create the epic issue in GitHub using the feature epic template as the structure.

Requirements:

- infer the next feature ID from existing FEAT issues when the user does not provide one
- Title format: `FEAT-XXXX: <feature name>`
- Use concise, concrete English
- Fill every relevant section of the template
- Do not leave placeholder bullets when the answer is known
- If a section is not applicable, say so briefly instead of leaving it blank
- Include PostHog events in section `3.4 Analytics` when relevant
- Include Sentry/observability notes in non-functional requirements and test plan when relevant
- In `11) Implementation Slices`, list the planned slices by title

If existing feature numbering cannot be determined safely, use a temporary placeholder such as `FEAT-TBD`.

If the user chose to extend an existing epic instead of creating a new one:

- update that epic body to reflect the new scope
- update or add slices as needed
- keep the epic internally consistent after the change
- avoid duplicating scope across multiple epics
- if the epic is currently closed/done, move it back to an active status such as `In Progress` or `Todo` before adding new work
- do not edit closed slice issues; add new slice issues for the newly added scope

### 6. Design slices

Create slice sub-issues under the epic.

For each slice:

- use a concise issue title, usually without the feature ID prefix
- start the body with `Parent Epic: #<number>`
- keep the scope tight and functional
- describe the user-visible or system-visible outcome
- structure the body with:
  - `Goal`
  - `Scope`
  - `Exit criteria`
  - optional `Validation notes`
  - optional `Progress notes`
- include clear in-scope and out-of-scope boundaries
- include acceptance criteria
- include validation notes
- include analytics/error-handling work when it belongs to that slice
- mention affected routes/modules/data boundaries when useful

Each slice should be small enough for a focused implementation pass, but large enough to be demoable or verifiable on its own.

### 7. Update product documentation in-repo

After the feature scope is clear, update `docs/product/overview.md`.

Requirements for the overview update:

- write at product level, not as an engineering changelog
- summarize what PandaTrack now does for users
- fold the new feature into the product story in plain language
- keep the document unified; do not append random ticket-style notes
- reflect both already-shipped and currently-planned product capabilities when they materially shape the product understanding

Also review nearby producßt docs and update them only if the new feature materially changes.

Make only product-facing updates there. Do not dump technical implementation notes into product docs.

### 8. GitHub creation

Use GitHub MCP to:

- create the epic issue when a new epic is required
- or update the existing epic when the user chose that route
- create each slice issue
- link slices as sub-issues of the epic
- apply labels
- add the issues to the active GitHub Project when possible

Status handling rules:

- if an epic was previously `Done` and new scope is added, change it back to an active project status before finishing
- if an existing slice is closed, leave it untouched even when the new work is closely related
- represent any newly requested work as a new slice issue instead of reopening or rewriting a closed slice

If GitHub creation cannot be completed, return the drafted epic and slice content in the chat instead of stopping silently.

### 9. Sync with existing GitHub planning

Before finishing, inspect existing epic issues in GitHub Project and ensure the local product docs remain aligned with the actual feature set already tracked there.

At minimum:

- use current epic issues as the source for the current product capabilities snapshot
- avoid documenting a feature in `docs/product` as shipped if GitHub planning clearly shows it is only planned
- if the new feature changes product positioning or current-state summary, reflect that in `docs/product/overview.md`

### 10. Final response format

Return in Spanish:

1. `Epic created`: epic number/title or draft-only notice
2. `Slices created`: numbered list with issue numbers/titles or draft-only notice
3. `Docs updated`: which `docs/product` files were updated
4. `Open assumptions`: only unresolved non-blocking assumptions
5. `Planning notes`: only important scope or architecture decisions that shaped the split

If an existing epic was reused, say `Epic updated` instead of `Epic created`.

## Quality bar

Reject weak planning. Before creating issues, verify:

- the epic is testable and not vague
- slices do not overlap
- slices are not partial/incomplete user flows
- analytics are not forgotten for meaningful interactions
- Sentry is considered for unexpected failures only
- acceptance criteria can be executed by a human reviewer
- the split respects PandaTrack priorities when tradeoffs are needed
