# Documentation Index

**Before creating any new file in this repository**, read [`docs/development/file-organization.md`](development/file-organization.md). It defines where each type of file belongs — both inside `docs/` and inside `src/`.

Use this index to find documentation by domain.

## Product

- `docs/product/README.md`: index for product docs
- `docs/product/README.md`: product-documentation index and hierarchy
- `docs/product/prd-00-pre-release-validation/prd-00-pre-release-validation.md`: pre-release public validation PRD
- `docs/product/prd-01-collector-mvp/prd-01-collector-mvp.md`: collector MVP PRD

## Process

- `docs/process/workflow-ai.md`: delivery workflow using GitHub epics/slices
- `docs/process/hybrid-product-github-workflow.md`: canonical mapping between `docs/product` and GitHub tracking
- `docs/process/definition-of-done.md`: global quality checklist
- `docs/process/review-checklist.md`: review checklist before merge

## Design

- `docs/design/README.md`: design-system entry point and file-selection guide
- `docs/design/visual-foundations.md`: typography, color, spacing, surfaces, radius, shadows, and gradients
- `docs/design/tokens-css.md`: literal CSS-variable contract (mirror of `src/app/globals.css`)
- `docs/design/interface-patterns.md`: layout/shell, hierarchy, tabs, modals, right sidebars, controls, navigation, status patterns, and the Chip-Eyebrow + Top-Accent system
- `docs/design/motion.md`: motion token taxonomy, transform/opacity rule, reduced-motion, View Transitions
- `docs/design/states.md`: cross-cutting empty / loading / error states
- `docs/design/ux-copy.md`: voice, tone-by-context, and in-app copy patterns
- `docs/design/components.md`: component map — what exists, when to use which, and where the canonical code lives
- `docs/design/PLAYBOOK.md`: operational UI-implementation playbook (mandatory pre-implementation workflow + anti-patterns)
- `docs/design/decisions/`: accepted design ADRs (0001–0014)

## Development

- `docs/development/file-organization.md`: where every type of file belongs — `docs/` folder structure and `src/` code placement quick-reference
- `docs/development/i18n.md`: localization setup and conventions
- `docs/development/og-images.md`: OG image conventions
- `docs/development/posthog.md`: analytics implementation notes
- `docs/development/sentry.md`: monitoring implementation notes
- `docs/development/seo.md`: SEO implementation notes
- `docs/development/testing.md`: automated testing strategy for unit, integration, and E2E coverage
- `docs/development/lib-utilities.md`: `src/lib` utilities inventory and responsibilities

## Templates

- `docs/templates/README.md`: templates index
- `docs/templates/product-docs-guide.md`
- `docs/templates/prd-template.md`
- `docs/templates/frd-template.md`
- `docs/templates/blueprint-template.md`
- `docs/templates/work-order-template.md`
- `docs/templates/feature-epic-template.md`
- `docs/templates/adr-template.md`

## Tooling

- `docs/tooling/cursor/commands.md`: Cursor command usage
- `docs/tooling/cursor/hooks.md`: Cursor hooks usage
- `docs/tooling/cursor/rules.md`: Cursor rules index, when each rule must be read, and maintenance expectations
