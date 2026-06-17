# File Organization

Read this document before creating any new file in the repository. It defines where each type of file belongs so agents and contributors place things consistently the first time.

For the full detail on code file placement rules, read `.cursor/rules/project-structure.mdc`. This document is the quick-reference companion — it covers both `docs/` and `src/` so the right destination is clear regardless of what kind of work is being done.

---

## `docs/` folder structure

| Folder              | What goes here                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design/`      | Design system decisions: visual language, interface patterns, UX copy, and any reusable visual or interaction rule. One focused file per topic.                                                                                                                                                                                                                                                         |
| `docs/development/` | Technical implementation notes for specific domains or cross-cutting concerns (auth, i18n, analytics, testing, database schema, lib utilities, OG images, etc.). One file per topic.                                                                                                                                                                                                                    |
| `docs/process/`     | Workflow, delivery, review, and quality standards (definition of done, review checklist, GitHub workflow, AI delivery process).                                                                                                                                                                                                                                                                         |
| `docs/product/`     | Product definition: PRDs, FRDs, Blueprints, and Work Orders in their canonical hierarchy. See `docs/templates/product-docs-guide.md` for structure and naming rules. A UI-bearing FRD also keeps its durable design record directly inside the FRD folder: `fdd-XX-<slug>.md` (mirrors the FRD filename) + a self-contained `prototype/<slug>.html` — see `.cursor/rules/frd-design-documentation.mdc`. |
| `docs/templates/`   | Blank templates only. No implementation content here.                                                                                                                                                                                                                                                                                                                                                   |
| `docs/tooling/`     | Docs about the tooling layer: Cursor rules index, hooks, commands.                                                                                                                                                                                                                                                                                                                                      |

### Before adding a new file to `docs/`

1. Check whether the content belongs in an **existing file** in the right folder. Prefer extending over creating.
2. If a new file is needed, place it in the folder whose description above matches the content.
3. After creating a new file, add it to `docs/README.md` under the correct section.
4. If the file is in `docs/design/`, also update `docs/design/README.md` with the entry and its file-selection criteria.

---

## `src/` code file placement — quick reference

Read `.cursor/rules/project-structure.mdc` for the full rules. The most common decisions:

### Routes and pages

- All authenticated app routes: `src/app/[locale]/(app)/`
- All public/landing routes: `src/app/[locale]/(landing)/`
- Edit route convention: `/resource/[id]/edit` — not `/resource/edit/[id]`

### Components

| Scope                                                 | Location                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| App-wide, simple, highly reusable                     | `src/components/core/`                                        |
| App-wide, complex, multi-component                    | `src/components/modules/`                                     |
| Specific to one page                                  | `_components/` next to the owning `page.tsx`                  |
| Shared across sibling pages in the same route subtree | `_components/share/` inside the nearest common parent segment |

Single-file component → flat file. Multi-file component (has co-located hooks, utils, tests) → folder with the same name as the main file. Never use `index.tsx`.

### Page-level folders (siblings of `_components/`)

`_actions/` · `_hooks/` · `_utils/` · `_types/` · `_schemas/`

Use the smallest valid scope: component-level first, then page-level, then app-level.

### Shared utilities and lib

- Shared utilities: `src/lib/` (group related files in a domain subfolder when there are two or more)
- Global hooks: `src/hooks/`
- Global types: `src/types/`
- Prisma queries: `src/queries/` (one file per model)
- i18n locale files: `src/i18n/locales/{locale}/`

### Promotion rule

When code that lived in one place starts being used in a second place, move it to the nearest shared scope in the same change. Do not leave one copy in each location.

---

## Common mistakes to avoid

- Creating a new component in `src/components/core/` when a route-level `_components/` file would do.
- Creating a new `docs/development/` file when the content belongs in an existing file there.
- Creating a `docs/design/` file without updating `docs/design/README.md`.
- Using `index.tsx` instead of naming the main file after the folder.
- Adding a route at `/resource/edit/[id]` instead of `/resource/[id]/edit`.
- Creating a new `src/lib/` file in a category that already has a domain subfolder.
