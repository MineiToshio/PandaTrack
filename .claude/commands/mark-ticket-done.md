# Mark Ticket Done

Mark one GitHub slice ticket as done and reconcile implementation completion through the linked `Work Order`, `Blueprint`, `FRD`, and `Epic`.

## Inputs

- `slice_issue_reference`: the GitHub issue number (example: `74`), a `#NN` reference (example: `#74`), or the full issue URL (example: `https://github.com/MineiToshio/PandaTrack/issues/74`). Normalize any accepted form to the bare issue number before Step 1.
- optional `extra_context`: short notes such as validation comments, PR link, or completion caveats

## Core behavior

- Conversation with the user must be in Spanish.
- Generated content (doc edits, issue updates, checklist text) must be in English and must not contain em dashes.
- This command is an execution/tracking command. The user invoking it is explicit permission to apply the updates immediately, with one exception: the Project `Status` confirmation gate in Step 3.
- Repository: `MineiToshio/PandaTrack`
- GitHub Project is the source of truth for execution progress: `https://github.com/users/MineiToshio/projects/4`
- `docs/product` remains the source of truth for product definition.
- Lifecycle position: `create-frd-package` (doc `DRAFT` / Project `Backlog`) -> `enrich-work-order-context` (doc `ACTIVE` / Project `Todo`) -> `implement-feature-slice` (`implementation_status: IN_PROGRESS` / Project `In Progress`) -> `mark-ticket-done` (`implementation_status: IMPLEMENTED` / Project `Done`).
- GitHub tooling: use the **GitHub MCP** server when available; otherwise fall back to the `gh` CLI or the GitHub REST/GraphQL API. This fallback applies to **both reads and writes** (issue reads, issue close, Epic close, checklist body edits, Project field mutations).
- All writes must be **state-convergent (idempotent)**: before every write, compare the current state with the target state and skip the write when they already match. Re-running this command on a fully processed ticket must produce zero writes, including zero `last_updated` changes.

## Scope

This command is only for GitHub slice tickets (`type:slice`).

The command must:

1. mark the target slice ticket as done in GitHub
2. update the linked `Work Order` doc to `implementation_status: IMPLEMENTED`
3. if all sibling `Work Orders` are `IMPLEMENTED`, mark the parent `Blueprint` `implementation_status: IMPLEMENTED`
4. if all sibling `Blueprints` are `IMPLEMENTED`, mark the parent `FRD` `implementation_status: IMPLEMENTED`
5. if all slice sub-issues under the parent Epic are closed, mark the Epic as done too

## Assumed doc schema

The cascade relies on this frontmatter schema:

- every `Work Order`, `Blueprint`, and `FRD` carries `implementation_status`
- every `Blueprint` and `FRD` defines its direct descendants in a `children` array
- every `Work Order` created through the current workflow carries `source_issue` with its GitHub issue number

Schema gaps are never resolved by silent judgment:

- if a parent `Blueprint` or `FRD` has no `children` array, stop the cascade at that level and report it as a blocked requirement
- if a sibling `Work Order` or `Blueprint` lacks `implementation_status`, do not treat it as complete or incomplete; stop the cascade at that level and report it as a blocked requirement

## Steps

### 1. Normalize input and resolve the slice ticket

- Normalize `slice_issue_reference` to the bare issue number (strip the `#`, or extract the trailing number from an issue URL).
- Read the issue from `MineiToshio/PandaTrack` (GitHub MCP `issue_read` when available; otherwise `gh` / REST / GraphQL).
- Validate the issue has label `type:slice`.
- If the issue is not a slice, stop and say so clearly.

### 2. Resolve linked docs and parent Epic

From the slice issue body, extract:

- `Parent Epic`
- `PRD Path`
- `FRD Path`
- `Blueprint Path`
- `Work Order Path`

From the parent Epic, read:

- the Epic body checklist of linked `Work Orders`
- the Epic's GitHub **sub-issues** (GitHub MCP `issue_read` with `get_sub_issues`, or the REST equivalent)
- the Epic title for reporting

Read the referenced docs in `docs/product/`.

Link verification: the resolved `Work Order` doc's `source_issue` frontmatter must match the input issue number. On mismatch, stop and report it as a reference-resolution blocker instead of updating the wrong doc.

If any required path or the parent Epic reference is missing, stop and report the missing reference instead of guessing.

### 3. Read the current Project Status and gate the transition

- Read the slice's current GitHub Project `4` `Status` before writing anything.
- If the current `Status` is already `Done`, the Project write in Step 5 becomes a skip (report it as skipped).
- If the current `Status` is `Blocked`, or anything other than `In Progress` or `Done`, pause and ask the user in Spanish for explicit confirmation before moving it to `Done`. Do not perform any write until the user confirms.

### 4. Verify a write path before touching docs

Before editing any doc frontmatter, confirm that at least one GitHub write path (MCP, `gh` CLI, or REST/GraphQL) is actually usable. If no GitHub write path exists, stop **before** editing docs so `docs/product` and GitHub never diverge, and report every pending update as a blocked requirement.

### 5. Apply GitHub writes in canonical order

Apply writes in exactly this order, skipping any write whose target state already holds:

1. **Close the slice issue**: `issue_write` with `method: update`, `state: closed`, and `state_reason: completed` (or the `gh` / REST equivalent) when the slice is still open. If the issue is already closed, skip this write but still reconcile everything else.
2. **Slice Project Status**: update GitHub Project `4` field `Status` to `Done` via GraphQL. This is separate from the issue's open/closed state.
3. **Epic checklist sync**: change the matching `Work Order` checkbox to `[x]` for the target slice. Match checklist entries by the slice's **issue number**, which is the only Epic-unique key (`WO-XX` ids repeat across `Blueprints`). If no unambiguous match exists, do not guess; report it as a blocked requirement.
4. **Epic completion evaluation**: re-read the Epic's sub-issues (`get_sub_issues`) and reconcile them with the body checklist. The **issue closed-state is authoritative**; checkbox state is presentation only.
   - repair stale checkboxes (checked-but-open or unchecked-but-closed) as part of this sync
   - if an open sub-issue is missing from the checklist, do **not** close the Epic; report the divergence as a blocked requirement
   - closed issues that are neither sub-issues nor checklist entries are not evidence of Epic completion
5. **Epic close and Epic Project Status**: only when every sub-issue is closed and the reconciliation above found no divergence, close the Epic as completed (`state: closed`, `state_reason: completed`) if it is still open, and update its Project `4` `Status` to `Done`. Otherwise leave the Epic open and its Project item unchanged.

For token retrieval, stable IDs, and `curl` patterns to update the Project `4` `Status` field, see `docs/process/github-project-tracking.md` (GitHub GraphQL API section).

### 6. Update docs frontmatter and cascade upward

Update order: `Work Order`, then `Blueprint`, then `FRD`.

- `Work Order`: set `implementation_status: IMPLEMENTED`; keep `status: ACTIVE` when the doc remains the current source of truth.
- After writing the target `Work Order`, **re-read every sibling from its file on disk** before any ancestor decision. Never evaluate the cascade from in-memory or pre-write state.
- `Blueprint`: read every `Work Order` listed in the parent `Blueprint` `children`; set `implementation_status: IMPLEMENTED` (add the field if missing on this target doc) only if every child `Work Order` is `IMPLEMENTED` after the re-read. Keep `status: ACTIVE` when the doc remains current.
- `FRD`: read every child `Blueprint` listed in the parent `FRD` `children`; set `implementation_status: IMPLEMENTED` only if every child `Blueprint` is `IMPLEMENTED` after the re-read. Keep `status: ACTIVE` when the doc remains current.
- Do not infer sibling relationships from filenames when the parent doc already defines `children`.
- Preserve existing frontmatter field order whenever practical.
- Update `last_updated` to today's date **only on docs whose content actually changes in this run**. A no-op re-run must not touch `last_updated` on any doc.
- Do not use `status: DONE` in product docs to represent implementation completion.

## Guardrails

- **Completeness rule (single authoritative statement)**: never mark an ancestor (`Blueprint`, `FRD`, or Epic) complete while any descendant is incomplete. A doc descendant is incomplete when its `implementation_status` is `PLANNED`, `IN_PROGRESS`, `PARTIALLY_IMPLEMENTED`, or missing. An Epic descendant is incomplete when its slice sub-issue is open. If an ancestor is not yet fully complete, leave its current `implementation_status` unchanged.
- Doc `status` (`DRAFT`, `ACTIVE`) is an **independent lifecycle axis** and never gates the cascade. A sibling with `status: DRAFT` and `implementation_status: IMPLEMENTED` counts as implemented.
- Do not create new docs or GitHub issues.
- Do not edit unrelated product docs. Reading sibling frontmatter and repairing Epic checklist state are within this command's scope; editing sibling doc content is not.
- If the target slice is already closed, still reconcile doc status, Epic checklist state, and cascade eligibility (all writes remain state-convergent).
- Any failed write, at any point in the sequence, is a blocked requirement. Continue with writes that do not depend on the failed one, skip writes that do, and report the exact resulting state.

## Output format

Return in Spanish:

1. `Slice updated`: issue number/title and whether it is now `Done`
2. `Epic updated`: whether the checklist was synced (including repaired checkboxes) and whether the Epic was also marked `Done`
3. `Docs updated`: each touched `Work Order`, `Blueprint`, or `FRD` path with its resulting `status` and `implementation_status`
4. `Cascade result`: concise statement of which levels advanced to `IMPLEMENTED` and which did not
5. `Write ledger`: every attempted write from Steps 5 and 6, each listed as `applied`, `failed`, or `skipped (already in target state)`
6. `Blocked requirements`: any failed mutation (GitHub or docs), reference-resolution blocker, checklist/sub-issue divergence, or missing frontmatter field

If the command stops early, say exactly what was missing or invalid.
