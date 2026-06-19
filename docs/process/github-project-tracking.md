# GitHub Project Tracking Runbook

## Purpose

Centralize the minimum information needed to access and operate PandaTrack execution tracking in GitHub.

`docs/product` is the source of truth for product definition.
GitHub Project and its issues are the source of truth for execution status and mirror approved product-doc scope.

## Quick Links

- Repository: https://github.com/MineiToshio/PandaTrack
- Issues: https://github.com/MineiToshio/PandaTrack/issues
- Active Project (feature delivery): https://github.com/users/MineiToshio/projects/4
- Projects (user): https://github.com/users/MineiToshio/projects

## Canonical Mapping

- One `FRD` -> one Epic issue
- One Epic issue -> multiple `Work Order` tickets, each attached as a **sub-issue** of that Epic (GitHub parent/child), not only cross-linked by issue number in the body
- **Sub-issue order under the Epic must match Work Order execution order** (`WO-01` first, then `WO-02`, and so on, including across multiple `Blueprints` in blueprint order). GitHub public issue numbers (`#NN`) are not a reliable sequence indicator. Wrong ordering misleads the Project board, Epic child views, and anyone using “first sub-issue” as the next slice.
- Epic issues should stay lightweight and reference the matching `FRD` and `Work Order` paths instead of duplicating product definition.
- Every Epic/Slice should be added to the GitHub Project board
- New Epics start **open** (issue state) with Project `Status` **`Todo`**. New slices start **open** with Project `Status` **`Backlog`** when their `Work Order` doc is `status: DRAFT`, and are promoted to **`Todo`** when the doc is promoted to `status: ACTIVE` (see `## Readiness rule`). Both rules admit a one-off override if agreed during that creation run.
- Keep issue titles concise and readable.
- Distinguish epic vs slice using `type:*` labels, not title prefixes.
- Automation inputs should use GitHub issue number or full GitHub issue URL.

## Labels

- `type:epic`
- `type:slice`
- `area:store`
- `area:purchase`
- `area:payments`
- `area:shipments`
- `area:dashboard`

Do not use `status:*` labels. Status is tracked only through the GitHub Project `Status` field.

## Board Statuses

- `Backlog` — slice exists in tracking but its `Work Order` doc is still `status: DRAFT`. Not ready to be picked up yet; it still needs an `enrich work order context` pass to become implementation-ready.
- `Todo` — ready to implement. Epics start here by default. Slices land here once their `Work Order` doc has been promoted to `status: ACTIVE`.
- `In Progress` — currently being implemented.
- `Blocked` — cannot progress because of an unresolved external dependency (for example, a required model or API that belongs to a different FRD and has not been implemented yet). Include a brief blocker note in the issue body explaining what is missing and which FRD or work order must deliver it first.
- `Done` — closed and merged.

Current project status source of truth is the GitHub Project `Status` field (`Backlog`, `Todo`, `In Progress`, `Blocked`, `Done`).

## Readiness rule

Readiness (is this slice ready to implement?) is encoded in the `Status` field together with execution state. The mapping between the `Work Order` doc lifecycle and the Project `Status` is:

| `Work Order` doc `status`                     | Project `Status` |
| --------------------------------------------- | ---------------- |
| `DRAFT` (just created, not enriched)          | `Backlog`        |
| `ACTIVE` (enriched, ready for implementation) | `Todo`           |
| — (in implementation)                         | `In Progress`    |
| — (waiting on an external dependency)         | `Blocked`        |
| — (shipped / closed)                          | `Done`           |

Rules:

- `create frd package` must create every slice with Project `Status` = `Backlog`, matching the `DRAFT` default of newly created `Work Order` docs. The Epic itself must be created with `Status` = `Todo` (Epics do not have a `DRAFT`/`ACTIVE` lifecycle; the FRD doc is their source of truth).
- `enrich work order context` must promote the linked slice issue from `Backlog` to `Todo` in the same run that flips the `Work Order` doc `status` from `DRAFT` to `ACTIVE`. This promotion is automatic and happens as part of the same approval, not as a separate step.
- A one-off override is allowed when the user explicitly approves a different initial `Status` during the proposal step of either command.

## Epic Template (Issue)

- Title: `FEAT-XXXX: <FRD title>`
- Must include:
  - `PRD Path`
  - `FRD Path`
  - `Blueprint Path` or `Blueprint Paths`
  - checklist of linked `Work Orders`
  - short status/blocker notes when needed
- Must not include:
  - full duplicated `FRD` content
  - branch-specific URLs as the only way to locate docs

## Ticket Template (Work Order Issue)

- Title: same as the `Work Order` title whenever practical
- Must include:
  - Parent Epic reference
  - `PRD Path`
  - `FRD Path`
  - `Blueprint Path`
  - `Work Order Path`
  - brief execution notes and blockers if needed
- Must not include:
  - full duplicated `Work Order` content

## Path Format

Use repository-relative paths in issue bodies as the canonical doc reference format.

Examples:

- `docs/product/prd-02-collector-app/prd-02-collector-app.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-01-store-persistence-foundation.md`

Optional GitHub links may be added as convenience only when needed, but the path is the durable reference.

## GitHub GraphQL API

The GitHub MCP tools in this workspace operate on **issues** only (open, close, update body, read). They do **not** expose GitHub Projects v2 field updates. Any command that needs to set, change, or verify the **`Status`** column on Project `4` — or add a new issue to the project — must use the GraphQL API directly via `curl`.

### Token

The Personal Access Token (PAT) is **never stored in this repository**. To obtain it at runtime, check in order:

1. **Shell environment** — look for `GITHUB_TOKEN` or `GH_TOKEN` in the current session.
2. **Claude Code MCP config** — the GitHub MCP server entry in `~/.claude/settings.json` (global) or `.claude/settings.json` (project) may include an auth header or a `headersHelper` command. Read that config to locate the credential.
3. **System keychain** — if neither of the above applies, retrieve the PAT from your password manager or system keychain.

Never commit, echo, or paste the raw token value into chat output, repository files, or documentation.

### Endpoint

```
POST https://api.github.com/graphql
Authorization: Bearer <token>
Content-Type: application/json
```

### Stable IDs — Project #4

These IDs are stable. Re-query only if a new `Status` option is added to the project.

| Resource           | ID                               |
| ------------------ | -------------------------------- |
| Project            | `PVT_kwHOAkSmss4BRB1f`           |
| Status field       | `PVTSSF_lAHOAkSmss4BRB1fzg--lrA` |
| Backlog option     | `4baedf6e`                       |
| Todo option        | `4ef2235b`                       |
| In Progress option | `f69e5735`                       |
| Blocked option     | `aee8310f`                       |
| Done option        | `1cd4a97b`                       |

### Common operations

**Resolve the project item ID for an issue**

```bash
curl -s -X POST https://api.github.com/graphql \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { repository(owner: \"MineiToshio\", name: \"PandaTrack\") { issue(number: ISSUE_NUMBER) { projectItems(first: 5) { nodes { id project { number } } } } } }"
  }'
```

Use the `id` from the node where `project.number === 4`.

**Update the Status field**

```bash
curl -s -X POST https://api.github.com/graphql \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { updateProjectV2ItemFieldValue(input: { projectId: \"PVT_kwHOAkSmss4BRB1f\", itemId: \"<ITEM_ID>\", fieldId: \"PVTSSF_lAHOAkSmss4BRB1fzg--lrA\", value: { singleSelectOptionId: \"<OPTION_ID>\" } }) { projectV2Item { id } } }"
  }'
```

Replace `<OPTION_ID>` with the value from the stable IDs table above.

**Get the issue node ID (needed to add an issue to the project)**

```bash
curl -s -X POST https://api.github.com/graphql \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { repository(owner: \"MineiToshio\", name: \"PandaTrack\") { issue(number: ISSUE_NUMBER) { id } } }"
  }'
```

**Add an issue to the project**

```bash
curl -s -X POST https://api.github.com/graphql \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { addProjectV2ItemById(input: { projectId: \"PVT_kwHOAkSmss4BRB1f\", contentId: \"<ISSUE_NODE_ID>\" }) { item { id } } }"
  }'
```

**Verify the current Status of an issue in the project**

```bash
curl -s -X POST https://api.github.com/graphql \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { repository(owner: \"MineiToshio\", name: \"PandaTrack\") { issue(number: ISSUE_NUMBER) { projectItems(first: 5) { nodes { project { number } fieldValues(first: 10) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } } } } } } } } }"
  }'
```

### Error handling

If a mutation returns permission or configuration errors, report the failure as a **Blocked requirement** in the command's final response. Do not claim the command completed successfully when a `Status` update failed. Other parts of the command (issue body updates, doc changes, checklist syncs) may still proceed and be reported as completed independently.

## Security Rules

- Never commit PATs, OAuth tokens, or auth headers to the repository.
- Keep credentials in local environment variables or system keychain only.
