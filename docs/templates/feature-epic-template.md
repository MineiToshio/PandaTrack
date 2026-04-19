# Feature Epic Template

Use this template as the lightweight GitHub Epic body that mirrors one `FRD`.

This Epic is an execution-tracking artifact, not the source of truth for product requirements. Keep requirements, business rules, architecture, and detailed acceptance criteria in `docs/product`.

## Metadata

- Epic title: `FEAT-XXXX: <FRD title>`
- Epic label: `type:epic`
- Project URL: `https://github.com/users/MineiToshio/projects/4`
- Status source: GitHub Project `Status` field (`Backlog | Todo | In Progress | Blocked | Done`). Epics default to `Todo` at creation; slices default to `Backlog` while their `Work Order` doc is `DRAFT` and move to `Todo` once promoted to `ACTIVE`. See `docs/process/github-project-tracking.md` → **Readiness rule**.
- Area label: `area:<domain>` when inferable
- Owner:

## Linked Product Docs

- `PRD Path:` `docs/product/.../prd-xx-....md`
- `FRD Path:` `docs/product/.../frd-xx-.../frd-xx-....md`
- `Blueprint Paths:`
  - `docs/product/.../bp-xx-.../bp-xx-....md`
  - `docs/product/.../bp-yy-.../bp-yy-....md`

Rules:

- Every Epic must point to exactly one `FRD`.
- Use repository-relative paths as the canonical references.
- Do not paste the full `FRD` body into the Epic.

## FRD Summary

Keep this brief and decision-oriented.

- Problem summary:
- Execution goal:
- Current scope note:

Optional:

- Main dependency:
- Main risk:

## Work Order Checklist

List every linked `Work Order` ticket under this Epic.

- [ ] `#<issue-number> <work order title>`
- [ ] `#<issue-number> <work order title>`
- [ ] `#<issue-number> <work order title>`

Rules:

- Use one GitHub ticket per `Work Order`.
- Ticket title should match the `Work Order` title whenever practical.
- Keep the checklist synchronized as tickets are created, renamed, or completed.

## Execution Notes

Use this section for lightweight operational context only.

- Current status:
- Active focus:
- Blockers:
- Related PRs:

## Scope Changes

Record only high-signal changes that affect execution tracking.

- Date:
  - Change:
  - Source-of-truth doc updated:

Rules:

- Update `docs/product` first when scope, requirements, or architecture changes.
- Then update this Epic so GitHub reflects the latest approved state.

## Completion Rule

This Epic is ready for `Done` when:

- every linked `Work Order` ticket is complete
- the Epic checklist is fully checked
- the GitHub Project `Status` is updated to `Done`

Do not use this Epic body as a running spec, kanban, or substitute for `PRD`/`FRD`/`Blueprint`/`Work Order` documents.
