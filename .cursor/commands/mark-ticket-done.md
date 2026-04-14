# Mark Ticket Done

Mark one GitHub slice ticket as done and reconcile implementation completion through the linked `Work Order`, `Blueprint`, `FRD`, and `Epic`.

## Inputs

- `slice_issue_number`: GitHub issue number only (example: `74`)
- optional `extra_context`: short notes such as validation comments, PR link, or completion caveats

## Core behavior

- Conversation with the user must be in Spanish.
- This command is an execution/tracking command. The user invoking it is explicit permission to apply the updates immediately.
- Repository: `MineiToshio/PandaTrack`
- GitHub Project is the source of truth for execution progress: `https://github.com/users/MineiToshio/projects/4`
- `docs/product` remains the source of truth for product definition.

## Scope

This command is only for GitHub slice tickets (`type:slice`).

The command must:

1. mark the target slice ticket as done in GitHub
2. update the linked `Work Order` doc to `implementation_status: IMPLEMENTED`
3. if all sibling `Work Orders` are `IMPLEMENTED`, mark the parent `Blueprint` `implementation_status: IMPLEMENTED`
4. if all sibling `Blueprints` are `IMPLEMENTED`, mark the parent `FRD` `implementation_status: IMPLEMENTED`
5. if all slice tickets under the parent Epic are done, mark the Epic as done too

Do not mark ancestors as done if any sibling item is still incomplete.

## Required resolution steps

### 1. Resolve the slice ticket

- Read the issue from `MineiToshio/PandaTrack` using GitHub MCP or the GitHub REST/GraphQL API (issue details and labels).
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

- all linked `Work Order` issue numbers from the checklist
- the Epic title for reporting

Read the referenced docs in `docs/product/`.

If any required path or the parent epic reference is missing, stop and report the missing reference instead of guessing.

### 3. Resolve completion state for siblings

Determine whether completion should cascade upward:

- `Work Order` level:
  - always mark the linked `Work Order` doc as `implementation_status: IMPLEMENTED`
- `Blueprint` level:
  - read every `Work Order` listed in the parent `Blueprint` `children`
  - mark the `Blueprint` as implemented only if every child `Work Order` has `implementation_status: IMPLEMENTED` after the target update
- `FRD` level:
  - read every child `Blueprint` listed in the parent `FRD` `children`
  - mark the `FRD` as implemented only if every child `Blueprint` has `implementation_status: IMPLEMENTED` after the target update
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

#### GitHub Project `4` status: use the GraphQL API (not MCP)

The GitHub MCP available in this workspace does **not** implement GitHub Projects v2 field updates. **Do not rely on MCP** to move `Status` to `Done`.

Agents must use the **GitHub GraphQL API** over HTTPS:

- Endpoint: `POST https://api.github.com/graphql`
- Header: `Authorization: Bearer <PAT>`. Read the PAT from the **shell environment** the agent uses when running `curl` (for example `GITHUB_TOKEN`, `GH_TOKEN`, or any other variable you already keep in your shell profile so it is available in the terminal session). Do **not** paste the token into chat or echo it in command output.
- The PAT must be allowed to edit the user project (Projects scope / permissions as required by GitHub for `MineiToshio` project number `4`).

**Minimal flow:**

1. Resolve `projectId`, the `Status` field id, and the `Done` option id:

   ```graphql
   query {
     user(login: "MineiToshio") {
       projectV2(number: 4) {
         id
         field(name: "Status") {
           ... on ProjectV2SingleSelectField {
             id
             options {
               id
               name
             }
           }
         }
       }
     }
   }
   ```

2. Resolve the `ProjectV2Item` id for the target issue (match `content { ... on Issue { number } }`).

3. Set status to `Done`:

   ```graphql
   mutation {
     updateProjectV2ItemFieldValue(
       input: {
         projectId: "<from step 1>"
         itemId: "<from step 2>"
         fieldId: "<Status field id from step 1>"
         value: { singleSelectOptionId: "<Done option id from step 1>" }
       }
     ) {
       projectV2Item {
         id
       }
     }
   }
   ```

If GraphQL returns permission or configuration errors, report **Blocked requirements** for Project sync and do not claim full success. Issue close and Epic body updates may still proceed when they succeed independently.

Also keep the Epic checklist synchronized:

- change the matching Work Order checkbox to `[x]` for the target slice

### In docs

When updating frontmatter:

- always update `last_updated` to today's date for every doc you change
- preserve existing frontmatter field order whenever practical

Use these lifecycle transitions:

- `Work Order`:
  - keep `status: ACTIVE` when the doc remains the current source of truth
  - set `implementation_status: IMPLEMENTED`
- `Blueprint` when all child Work Orders are done:
  - keep `status: ACTIVE` when the doc remains current
  - set `implementation_status: IMPLEMENTED` if the field exists; add it if missing
- `FRD` when all child Blueprints are done:
  - keep `status: ACTIVE` when the doc remains current
  - set `implementation_status: IMPLEMENTED`

Do not use `status: DONE` in product docs to represent implementation completion. If an ancestor is not yet fully complete, leave its current doc `implementation_status` unchanged.

## Guardrails

- Do not create new docs or GitHub issues.
- Do not edit unrelated product docs.
- Do not mark an ancestor implemented if any descendant remains `PLANNED`, `IN_PROGRESS`, `PARTIALLY_IMPLEMENTED`, `DRAFT`, or otherwise incomplete.
- Do not treat a closed issue outside the Epic checklist as evidence that the Epic is complete; only evaluate the linked slices in the Epic body.
- If the target slice is already closed, still reconcile doc status, Epic checklist state, and cascade eligibility.

## Final response format

Return in Spanish:

1. `Slice updated`: issue number/title and whether it is now `Done`
2. `Epic updated`: whether the checklist was synced and whether the Epic was also marked `Done`
3. `Docs updated`: each touched `Work Order`, `Blueprint`, or `FRD` path with its resulting `status` and `implementation_status`
4. `Cascade result`: concise statement of which levels advanced to `IMPLEMENTED` and which did not
5. `Blocked requirements`: only project-sync or reference-resolution blockers

If the command stops early, say exactly what was missing or invalid.
