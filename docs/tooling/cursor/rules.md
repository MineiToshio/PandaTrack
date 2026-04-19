# Cursor Rules Index

This document is the operational index for `.cursor/rules/*.mdc`.

Use it to decide which repository rules must be read before implementing, reviewing, or documenting a change.

Even though the files live under `.cursor/rules/`, these rules apply to any AI agent working in this repository, not only Cursor.

## Source of truth

- `.cursor/rules/*.mdc` is the source of truth for these repository implementation rules.
- This document is the navigation and reinforcement layer for those rules.
- If this document and a rule file ever diverge, follow the `.mdc` file and update this document in the same change.

## Required workflow for AI agents

Before implementing a task:

1. Read this document and identify the rules that match the requested work.
2. Read every matching `.cursor/rules/*.mdc` file before writing code.
3. Apply those rules during implementation, review, and validation.
4. If a rule is added, removed, renamed, or materially changed, update this document in the same change.

## Always-read baseline rules

Read these on every implementation because they define project-wide defaults:

- `adr-decision-records.mdc`: Read when evaluating whether the change creates or updates a cross-feature architectural decision.
- `data-layer-user-id-duplication.mdc`: Read when adding child Prisma models or writing query/mutation functions that operate on child records. It defines when to duplicate `userId` on child records for authorization and query efficiency.
- `coding-standards.mdc`: Read for every coding task. It defines core implementation behavior, English-only code, Server Actions preference, reuse expectations, and general coding discipline.
- `docs-and-standards.mdc`: Read for every non-trivial change. It defines when to update `docs/`, when to create or extend rules, and how to keep documentation aligned with implementation.
- `github-tracking-sync.mdc`: Read when the task maps to a product doc, work order, epic, or slice. It defines how implementation must stay aligned with `docs/product` and mirrored GitHub tracking, including Epic sub-issue order matching Work Order sequence.
- `icons.mdc`: Read whenever icons are added or changed.
- `next-intl-translation-apis.mdc`: Read whenever translations are used or touched in React or server-side framework code.
- `optimistic-client-updates.mdc`: Read whenever a Client Component dispatches a mutation that affects state the user is observing. It requires applying the change locally in parallel with the Server Action and reverting on failure, so the user gets immediate feedback without a second server fetch.
- `testing-strategy.mdc`: Read for every change to decide required unit, integration, and E2E coverage.
- `theme-light-dark.mdc`: Read whenever UI, styling, or visual assets are changed so both themes are handled.
- `validation-checklist.mdc`: Read before finalizing any implementation to run the required checks in the correct order.

## Scenario-based rules

### Documentation and architecture

- `adr-decision-records.mdc`: Use when the change introduces a lasting architectural decision, tradeoff, or new cross-feature pattern.
- `product-doc-cross-frd-references.mdc`: Use when creating or editing `docs/product` text that cites another FRD's blueprint, work order, or `FR-XX-NN` requirement; also applies to **Create FRD Package** and **Enrich Work Order Context** command runs.
- `docs-and-standards.mdc`: Use when behavior, architecture, `src/lib`, database shape, reusable process knowledge, or undocumented product decisions change. It requires proactive `docs/product` updates in the same change when shipped behavior is new, changed, or previously undocumented, and requires documentation paths to stay repository-relative instead of machine-specific absolute paths.
- `quality-docs-cleanup.mdc`: Use when adding comments, JSDoc, utilities, cleanup, or lint-related exceptions.
- **`docs/development/file-organization.md`** (not a cursor rule — a reference doc): Read before creating any new file, whether code or documentation. It defines which subfolder of `docs/` and `src/` each file type belongs in, the promotion rule, and common placement mistakes to avoid.

### Core coding and language

- `coding-standards.mdc`: Use on any code change.
- `english-code-only.mdc`: Use whenever editing code, comments, tests, logs, or developer-facing strings.
- `typescript-practices.mdc`: Use whenever editing TypeScript types, function signatures, or shared data contracts.

### React, Next.js, and frontend structure

- **`docs/design/README.md`** (not a cursor rule — a reference doc): **Read before any UI implementation.** It is the source of truth for the design system and contains a file selection guide: open `visual-foundations.md` for colors, typography, spacing, surfaces; open `interface-patterns.md` for layout, tabs, modals, sidebars, states, status chips, responsive; open `ux-copy.md` for any user-facing string. If a change introduces a new reusable visual rule, update the matching file in `docs/design/` in the same change.
- `react-next-components.mdc`: Use when creating or refactoring React components, pages, layouts, hooks, client boundaries, or component composition. It also reinforces subtree reuse before creating parallel route-local components, and defines when loading UI, skeletons, and `next/dynamic` are appropriate (avoid fake client fallbacks for SSR-delivered UI).
- `project-structure.mdc`: Use when deciding where files should live or when adding new route-level or shared modules, including `_components/share/` folders for route-subtree reuse and promotion from child pages when reuse appears.
- `role-frontend-development.mdc`: Use when designing component APIs, extracting hooks, splitting components, or making maintainability decisions in frontend code.
- `role-ui-ux-design.mdc`: Use when making layout, hierarchy, spacing, interaction, or flow decisions. Requires consulting `docs/design/README.md` and the relevant file in `docs/design/` before introducing or changing reusable interface patterns.
- `ui-visual-consistency.mdc`: Use when adding or changing back/up navigation, form footer links that navigate away, or any control that must match an existing visual pattern in the same app area.
- `responsive-design.mdc`: Use whenever UI can be affected by viewport changes, especially navigation, headers, cards, tables, forms, and dense layouts.
- `tailwind-semantic-html.mdc`: Use whenever editing JSX or CSS classes so semantic elements and `cn()` are applied correctly.
- `theme-light-dark.mdc`: Use for any UI or styling change that could break theme support.
- `icons.mdc`: Use when adding or changing visual icons.
- `optimistic-client-updates.mdc`: Use whenever a Client Component mutation updates visible state (lists, summaries, notes, toggles, reorders). Requires applying the change locally in parallel with the Server Action and reverting on failure — never waiting for a refetch to update the UI.

### Accessibility and copy

- `role-accessibility.mdc`: Use when building or changing forms, dialogs, navigation, focus behavior, status feedback, images, or any interactive UI.
- `role-copywriting-marketing.mdc`: Use when writing or editing user-facing copy such as landing text, CTAs, emails, empty states, and notifications.
- `next-intl-translation-apis.mdc`: Use when wiring translation APIs into components or framework functions.
- `english-code-only.mdc`: Use alongside copy work to keep code in English while keeping user-facing text in locale files.

### Data, backend, integrations, and environment

- `role-full-stack-development.mdc`: Use when implementing server actions, route handlers, auth, integrations, persistence, or full-stack flows.
- `prisma-data-layer.mdc`: Use when touching Prisma usage, repositories, query modules, or database access patterns.
- `data-layer-user-id-duplication.mdc`: Use when adding new child Prisma models or writing mutations that operate on child records where authorization may require ownership verification.
- `prisma-migration-workflow.mdc`: Use when changing `prisma/schema.prisma`, migrations, or database rollout flow.
- `error-handling-validation.mdc`: Use when adding validation, boundary parsing, error handling, or safe logging.
- `sentry-error-handling.mdc`: Use when capturing unexpected errors or adjusting monitoring behavior.
- `env-example.mdc`: Use whenever a new environment variable is introduced or required.

### Analytics and tracking

- `posthog-events.mdc`: Use whenever a meaningful user interaction is added or changed and event tracking may be needed.
- `github-tracking-sync.mdc`: Use when implementation affects approved product behavior, acceptance criteria, or epic/slice tracking.

### Testing and validation

- `testing-strategy.mdc`: Use to decide what automated tests are needed and which existing tests must be updated.
- `validation-checklist.mdc`: Use before finalizing so the correct validation commands are run.

## Rule inventory

| Rule file                              | Primary purpose                                                      | Read when                                                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adr-decision-records.mdc`             | ADR creation/update criteria                                         | Architecture or recurring technical decisions change                                                                                                                                     |
| `coding-standards.mdc`                 | Core coding conventions and implementation defaults                  | Any code is written or changed                                                                                                                                                           |
| `data-layer-user-id-duplication.mdc`   | When to duplicate `userId` on child records for auth and performance | Adding child Prisma models or writing child record mutations                                                                                                                             |
| `docs-and-standards.mdc`               | Documentation and rule maintenance policy                            | Behavior, docs, standards, or undocumented product decisions change; keep documentation paths repository-relative                                                                        |
| `english-code-only.mdc`                | English-only code and developer text                                 | Editing code, comments, tests, logs, or messages                                                                                                                                         |
| `env-example.mdc`                      | `.env.example` synchronization                                       | New env vars are introduced or required                                                                                                                                                  |
| `error-handling-validation.mdc`        | Zod, expected errors, and logging guidance                           | Validation, parsing, or error handling changes                                                                                                                                           |
| `github-tracking-sync.mdc`             | Sync docs/product with GitHub; Epic sub-issues follow `WO-01`… order | Work orders, epics, or scope are involved                                                                                                                                                |
| `icons.mdc`                            | Approved icon sources                                                | Icons are added or changed                                                                                                                                                               |
| `next-intl-translation-apis.mdc`       | next-intl API selection rules                                        | Translations are used in React or framework code                                                                                                                                         |
| `optimistic-client-updates.mdc`        | Client mutations update local state in parallel with the server      | Any Client Component mutation that affects state the user is observing                                                                                                                   |
| `posthog-events.mdc`                   | Event naming and tracking expectations                               | Meaningful user interactions change                                                                                                                                                      |
| `product-doc-cross-frd-references.mdc` | Cross-FRD citations in product docs                                  | Editing `docs/product` with references across FRDs; Create FRD Package / Enrich Work Order Context                                                                                       |
| `prisma-data-layer.mdc`                | Prisma data access boundaries                                        | Prisma, queries, repositories, or DB access change                                                                                                                                       |
| `prisma-migration-workflow.mdc`        | Schema and migration workflow                                        | Prisma schema or migrations change                                                                                                                                                       |
| `project-structure.mdc`                | File placement and project organization                              | New files/folders are added or moved, including route-subtree shared component placement                                                                                                 |
| `quality-docs-cleanup.mdc`             | Comments, cleanup, lint discipline                                   | Cleanup, JSDoc, comments, or lint exceptions are involved                                                                                                                                |
| `react-next-components.mdc`            | React/Next components; loading UI and `dynamic` vs SSR               | Components, layouts, pages, hooks, client boundaries, skeletons, or `next/dynamic`                                                                                                       |
| `responsive-design.mdc`                | Responsive layout behavior                                           | UI changes must work across breakpoints                                                                                                                                                  |
| `role-accessibility.mdc`               | Accessibility review mindset                                         | Interactive UI, forms, dialogs, nav, or feedback change                                                                                                                                  |
| `role-copywriting-marketing.mdc`       | Conversion-focused user-facing copy                                  | Landing, CTA, email, notification, or product copy changes                                                                                                                               |
| `role-frontend-development.mdc`        | Senior frontend implementation mindset                               | Frontend architecture or component design decisions are needed                                                                                                                           |
| `role-full-stack-development.mdc`      | Senior full-stack implementation mindset                             | Backend, data, auth, or integration work is involved                                                                                                                                     |
| `role-ui-ux-design.mdc`                | UI/UX design decision support                                        | Layout, spacing, visual hierarchy, or user flow changes; consult `docs/design/README.md` and the relevant file in `docs/design/` for reusable UI standards and semantic design variables |
| `ui-visual-consistency.mdc`            | Shared navigation and control styling                                | Back/up links, consistent link-as-button patterns, avoiding one-off chrome styles                                                                                                        |
| `sentry-error-handling.mdc`            | Sentry capture strategy                                              | Monitoring or exception capture changes                                                                                                                                                  |
| `tailwind-semantic-html.mdc`           | Tailwind composition and semantic HTML                               | JSX or CSS classes change                                                                                                                                                                |
| `testing-strategy.mdc`                 | Risk-based test decisions                                            | Any behavior changes                                                                                                                                                                     |
| `theme-light-dark.mdc`                 | Light/dark theme support                                             | Visual or styling changes                                                                                                                                                                |
| `typescript-practices.mdc`             | TypeScript typing conventions                                        | TypeScript code or shared types change                                                                                                                                                   |
| `validation-checklist.mdc`             | Final validation commands                                            | Final verification before completion                                                                                                                                                     |

## Tooling references

For Claude Code configuration (entry point, commands symlink, hooks wiring, permissions, MCP servers) see `docs/tooling/claude/setup.md`.

## Maintenance requirement

Update this document in the same change when any of the following happens:

- A new file is added under `.cursor/rules/`
- A rule file is removed or renamed
- A rule scope changes materially
- A new workflow requires agents to consult a different rule set

Do not leave this index stale. If the rules change, this document must change too.
