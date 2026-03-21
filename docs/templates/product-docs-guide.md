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
