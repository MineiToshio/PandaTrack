---
id: PRODUCT-DOCS
type: INDEX
status: ACTIVE
format: MARKDOWN
convention: "prefix + short number + descriptive slug"
last_updated: 2026-04-04
---

# Product Docs

This folder is the product source of truth for PandaTrack.

It follows a hierarchical 80/90-style documentation model:

- `PRD` defines a durable product surface or line (a public landing, an app), not a temporary phase or a maturity stage like "MVP"
- each `PRD` contains one or more `FRDs`
- each `FRD` contains one or more `Blueprints`
- each `Blueprint` contains its `Work Orders`

## Active Product Tree

PandaTrack is one product with two durable surfaces, one PRD each. They coexist; they are not sequential phases.

- `prd-01-public-landing/`
  - Documents PandaTrack's public-facing surface: the landing, early-interest/waitlist capture, and the public-web foundations.
  - Covers the landing, waitlist capture, analytics, observability, localization, SEO, and legal transparency layers. It began as a pre-release validation surface and remains the public entry point.
- `prd-02-collector-app/`
  - Documents the authenticated collector application. Its current release is an MVP, but the PRD identity is the app, not the MVP stage.
  - Covers account access and recovery, testing baseline, app shell, store domain, and the collector workflow domains that feed the dashboard experience.

## Naming Standard

- `prd-01-public-landing`
- `prd-02-collector-app`
- `frd-01-account-access-and-recovery`
- `frd-04-store-domain`
- `bp-01-collector-workspace-shell`
- `wo-01-auth-core-and-entry-flows`

## Authoring Rules

- Keep documents in Markdown.
- Use consistent YAML frontmatter.
- Use explicit parent-child references in metadata.
- Keep one concept per file.
- Number `Work Orders` locally within each `FRD` or `Blueprint` package instead of using one repo-global running sequence. When citing a blueprint or work order **from another FRD**, qualify it with **FRD-XX**, add the slug when useful, and link to the target file. See **Cross-FRD references** in `docs/templates/product-docs-guide.md`.
- Add `source_features` only as traceability metadata when the doc consolidates one or more GitHub epics.
- Use `status` for document lifecycle only: `DRAFT`, `ACTIVE`, `BLOCKED`, `SUPERSEDED`.
- Use `implementation_status` for delivery reality on `FRD`, `Blueprint`, and `Work Order`: `PLANNED`, `IN_PROGRESS`, `PARTIALLY_IMPLEMENTED`, `IMPLEMENTED`.
- Do not add `implementation_status` to `PRD` by default.
- Keep `Confirmed`, `Open Questions`, and `Out of Scope` clearly separated.
- Keep GitHub execution aligned with these docs, but do not use GitHub as the only product-definition source.

## Related References

- Templates and authoring guide: `docs/templates/`
- Process standards: `docs/process/`
- Reusable technical details: `docs/development/`
