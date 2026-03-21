---
id: PRODUCT-DOCS
type: INDEX
status: ACTIVE
format: MARKDOWN
convention: "prefix + short number + descriptive slug"
last_updated: 2026-03-16
---

# Product Docs

This folder is the product source of truth for PandaTrack.

It follows a hierarchical 80/90-style documentation model:

- `PRD` defines the product or release
- each `PRD` contains one or more `FRDs`
- each `FRD` contains one or more `Blueprints`
- each `Blueprint` contains its `Work Orders`

## Active Product Tree

- `prd-00-pre-release-validation/`
  - Documents the public pre-release phase used to validate demand, collect waitlist interest, and establish public-web foundations.
  - Covers the landing, waitlist capture, analytics, observability, localization, SEO, and legal transparency layers that shipped before the collector workspace.
- `prd-01-collector-mvp/`
  - Documents the authenticated collector product.
  - Covers account access and recovery, testing baseline, app shell, store domain, and draft collector workflow domains that feed the later dashboard experience.

## Naming Standard

- `prd-00-pre-release-validation`
- `prd-01-collector-mvp`
- `frd-01-account-access-and-recovery`
- `frd-04-store-domain`
- `bp-01-collector-workspace-shell`
- `wo-01-auth-core-and-entry-flows`

## Authoring Rules

- Keep documents in Markdown.
- Use consistent YAML frontmatter.
- Use explicit parent-child references in metadata.
- Keep one concept per file.
- Add `source_features` only as traceability metadata when the doc consolidates one or more GitHub epics.
- Add `implementation_status` when code exists and the doc is partially reverse-engineered from the repository.
- Keep `Confirmed`, `Open Questions`, and `Out of Scope` clearly separated.
- Keep GitHub execution aligned with these docs, but do not use GitHub as the only product-definition source.

## Related References

- Templates and authoring guide: `docs/templates/`
- Process standards: `docs/process/`
- Reusable technical details: `docs/development/`
