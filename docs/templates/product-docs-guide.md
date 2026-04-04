# Product Docs Guide

This guide defines how PandaTrack product documents should be created.

## Goal

Make product docs easy for both humans and AI systems to read, navigate, and reuse.

## Format

- Use `Markdown`
- Use YAML frontmatter at the top of every file
- Keep one concept per file
- Use explicit IDs and parent-child links

## Required hierarchy

```text
docs/product/
  prd-00-some-phase/
    prd-00-some-phase.md
    frd-01-some-domain/
      frd-01-some-domain.md
      bp-01-some-blueprint/
        bp-01-some-blueprint.md
        work-orders/
          wo-01-some-work-order.md
```

## Naming convention

- prefix by type
- short number
- descriptive slug
- number PRDs by product phase, not only by implementation order
- number FRDs within each PRD according to the product map for that phase
- keep blueprint and work-order numbering local to their parent folder when that improves readability

Examples:

- `prd-00-pre-release-validation`
- `prd-01-collector-mvp`
- `frd-01-account-access-and-recovery`
- `frd-04-store-domain`
- `bp-01-store-public-trust-system`
- `wo-01-store-persistence-foundation`

## Cross-FRD references

**Cross-FRD** means one product document cites a requirement, blueprint, work order, or behavior that **belongs to a different FRD** under the same PRD (or another PRD). Readers cannot infer the target from a bare `WO-06` or `BP-01`, because those numbers reset per FRD.

### Identifier semantics

- **`FR-XX-NN`**: functional requirement `NN` in **FRD-XX**. The middle segment is the FRD id, so this form is **unique within a PRD** without extra context.
- **`BP-NN` and `WO-NN`**: blueprint and work-order numbers are **local** to their FRD (and usually to one blueprint tree). **FRD-07 · WO-06** and **FRD-04 · WO-06** are different files.

### How to write references

- **Inside the same FRD** (same `frd-XX-...` folder): you may use `BP-01`, `WO-06`, or `FR-XX-NN` when the surrounding heading or path already makes the FRD obvious.
- **Across FRDs**: always qualify the owning FRD and point to the **exact markdown file**:
  - write **FRD-XX · BP-NN** or **FRD-XX · WO-NN**;
  - add the work-order **slug** (from the filename) when it helps disambiguation;
  - use a **repository-relative Markdown link** to the target `.md` so GitHub, editors, and exports resolve unambiguously;
  - when useful, add a **heading anchor** (for example `#functional-requirements`, `#cross-domain-notes`) so the reader lands near the right paragraph.

Prefer a short **Cross-domain notes** (or equivalent) section in an FRD when a dependency spans FRDs, and link to it from the consuming doc.

### GitHub and Cursor commands

Authoring flows such as **Create FRD Package** and **Enrich Work Order Context** must apply these rules whenever new or updated text mentions another FRD's blueprints, work orders, or functional requirements.

## Required frontmatter fields

### For all files

- `id`
- `type`
- `slug`
- `title`
- `status`
- `parent`
- `last_updated`

### When applicable

- `children`
- `source_features`
- `implementation_status`

## Status semantics

- `status` means document lifecycle, not daily execution progress.
- Use `status` to answer whether the document is still the current approved source of truth.
- Use `implementation_status` to answer whether the described capability is planned, partially built, in progress, or implemented.
- Keep daily execution tracking in GitHub Project `Status`, not in `docs/product`.

### `status`

- `DRAFT`: the document is still being defined or reviewed
- `ACTIVE`: the document is current and valid
- `BLOCKED`: the document is current, but progress is blocked by a dependency or decision
- `SUPERSEDED`: the document has been replaced by a newer source of truth

Avoid using `DONE` as the primary meaning for product-doc lifecycle. A shipped feature can still have `status: ACTIVE` when the document remains current.

### `implementation_status`

- `PLANNED`: not implemented yet
- `IN_PROGRESS`: implementation has started but is not complete
- `PARTIALLY_IMPLEMENTED`: some meaningful subset exists, but the document scope is not fully delivered
- `IMPLEMENTED`: the described scope is fully implemented

### Type guidance

- `PRD`: use `status`; do not add `implementation_status` by default
- `FRD`: use both `status` and `implementation_status`
- `Blueprint`: use both `status` and `implementation_status`
- `Work Order`: use both `status` and `implementation_status`

## Writing rules

- Write all product docs in English.
- Separate `Confirmed` decisions from `Open Questions`.
- Use stable terminology across all documents.
- Keep requirements testable when possible.
- Avoid mixing high-level strategy with task-level execution.
- When reverse engineering from code, say so explicitly and cite the current implementation layer.
- Treat `source_features` as traceability only, not as a source of authority for scope or behavior.
- Keep GitHub epic/slice mapping visible in `source_features` or in dedicated sections when the doc consolidates historical work.

## Recommended status values

- `DRAFT`
- `ACTIVE`
- `BLOCKED`
- `SUPERSEDED`

## Recommended implementation status values

- `PLANNED`
- `IN_PROGRESS`
- `PARTIALLY_IMPLEMENTED`
- `IMPLEMENTED`
