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

## Writing rules

- Write all product docs in English.
- Separate `Confirmed` decisions from `Open Questions`.
- Use stable terminology across all documents.
- Keep requirements testable when possible.
- Avoid mixing high-level strategy with task-level execution.
- When reverse engineering from code, say so explicitly and cite the current implementation layer.
- Keep GitHub epic/slice mapping visible in `source_features` or in dedicated sections when the doc consolidates historical work.

## Recommended statuses

- `DRAFT`
- `ACTIVE`
- `PLANNED`
- `DONE`
- `BLOCKED`
- `SUPERSEDED`
