# Mark Ticket Done

Mark one GitHub slice ticket as done and cascade completion status upward through the linked Work Order, Blueprint, FRD, Epic, and PRD when all descendants are complete.

## Inputs

- `slice_issue_number`: GitHub issue number only (example: `74`)
- optional `extra_context`: short notes such as validation comments, PR link, or completion caveats

## Core behavior

- Conversation with the user must be in Spanish.
- This command is an execution/tracking command. The user invoking it is explicit permission to apply the updates immediately.
- Repository: `MineiToshio/PandaTrack`
- GitHub Project is the source of truth for execution progress: `https://github.com/users/MineiToshio/projects/4`

## Scope

This command is only for GitHub slice tickets (`type:slice`).

The command must:

1. mark the target slice ticket as done in GitHub
2. update the linked `Work Order` doc to `DONE`
3. if all sibling `Work Orders` are `DONE`, mark the parent `Blueprint` as done
4. if all sibling `Blueprints` are done, mark the parent `FRD` as done
5. if all sibling `FRDs` are done, mark the parent `PRD` as done
6. if all slice tickets under the parent Epic are done, mark the Epic as done too

Do not mark ancestors as done if any sibling item is still incomplete.

## Required resolution steps

### 1. Resolve the slice ticket

- Use GitHub MCP to read the issue from `MineiToshio/PandaTrack`.
- Accept only the issue number as input.
- Validate the issue has label `type:slice`.
- If the issue is not a slice, stop and say so clearly.

### 2. Resolve linked docs and parent epic

From the slice issue body, extract:

- `Parent Epic`
- `PRD Path`
- `FRD Path`
- `Blueprint Path`
- `Work Order Path`

From the parent epic body, extract:

- all linked Work Order issue numbers from the checklist
- the Epic title for reporting

Read the referenced docs in `docs/product/`.

If any required path or the parent epic reference is missing, stop and report the missing reference instead of guessing.

### 3. Resolve completion state for siblings

Determine whether completion should cascade upward:

- `Work Order` level:
  - always mark the linked `Work Order` doc as `DONE`
- `Blueprint` level:
  - read every `Work Order` listed in the parent `Blueprint` `children`
  - mark the `Blueprint` as done only if every child `Work Order` has `status: DONE` after the target update
- `FRD` level:
  - read every child `Blueprint` listed in the parent `FRD` `children`
  - mark the `FRD` as done only if every child `Blueprint` is done after the target update
- `PRD` level:
  - read every child `FRD` listed in the parent `PRD` `children`
  - mark the `PRD` as done only if every child `FRD` is done after the target update
- `Epic` level:
  - inspect all slice issues linked from the Epic checklist
  - mark the Epic as done only if every linked slice issue is done after the target update

Do not infer sibling relationships from filenames when the parent doc already defines `children`.

## Status update rules

### In GitHub

For the target slice ticket:

- close the issue with completed reason if it is still open
- update GitHub Project `4` `Status` to `Done`

For the parent epic:

- if all linked slice issues are done, close the epic with completed reason if still open
- if all linked slice issues are done, update GitHub Project `4` `Status` to `Done`
- if not all linked slice issues are done, leave the epic open and do not move it to `Done`

Project sync is mandatory. If GitHub MCP does not expose the required project update directly, use another available authenticated GitHub API path. If the repo issue state can be updated but Project `Status` cannot, report that explicitly as blocked/incomplete instead of claiming full success.

Also keep the Epic checklist synchronized:

- change the matching Work Order checkbox to `[x]` for the target slice

### In docs

When updating frontmatter:

- always update `last_updated` to today's date for every doc you change
- preserve existing frontmatter field order whenever practical

Use these lifecycle transitions:

- `Work Order`:
  - set `status: DONE`
- `Blueprint` when all child Work Orders are done:
  - set `status: DONE`
  - set `implementation_status: IMPLEMENTED` if the field exists; add it if missing
- `FRD` when all child Blueprints are done:
  - set `status: DONE`
  - set `implementation_status: IMPLEMENTED`
- `PRD` when all child FRDs are done:
  - set `status: DONE`

If an ancestor is not yet fully complete, leave its current doc status unchanged.

## Guardrails

- Do not create new docs or GitHub issues.
- Do not edit unrelated product docs.
- Do not mark an ancestor done if any descendant remains `PLANNED`, `DRAFT`, `ACTIVE`, or otherwise incomplete.
- Do not treat a closed issue outside the Epic checklist as evidence that the Epic is complete; only evaluate the linked slices in the Epic body.
- If the target slice is already closed, still reconcile doc status, Epic checklist state, and cascade eligibility.

## Final response format

Return in Spanish:

1. `Slice updated`: issue number/title and whether it is now `Done`
2. `Epic updated`: whether the checklist was synced and whether the Epic was also marked `Done`
3. `Docs updated`: each touched `Work Order`, `Blueprint`, `FRD`, or `PRD` path with its resulting status
4. `Cascade result`: concise statement of which levels advanced to done and which did not
5. `Blocked requirements`: only project-sync or reference-resolution blockers

If the command stops early, say exactly what was missing or invalid.
