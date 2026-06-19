# AGENTS.md - PandaTrack

This file defines how coding agents should work in this repository.

## 1) Product mission and scope

PandaTrack helps collectors organize purchases, pre-orders, payments, and shipments in one place.

Current product priority is the MVP workflow:

1. Store discovery and trust signals
2. Purchase and item tracking
3. Pre-order payment tracking (paid vs remaining)
4. Shipment tracking (including split shipments)
5. Dashboard clarity (status, upcoming payments, totals)

Use this priority order when making tradeoffs.

## 2) Source of truth

When instructions conflict, use this order:

1. User request
2. This `AGENTS.md`
3. `.agents/rules/*.mdc`
4. `docs/` (all documentation files in this folder)

If still ambiguous, choose the smallest safe change and note assumptions.

### AI rule enforcement

- `.agents/rules/*.mdc` is the source of truth for these repository implementation rules. The folder is named `.agents/` to be agent-neutral (it is not specific to any one tool).
- These rules apply to any AI agent working in this repository, including Claude Code, Codex, or any other implementation agent.
- `docs/tooling/agents/rules.md` is the required index for identifying which rule files must be read for a given task.
- Before implementing, reviewing, or validating a change, any AI agent must first consult `docs/tooling/agents/rules.md`, identify the matching rules, then read the corresponding `.agents/rules/*.mdc` files.
- Treat the matching rules as mandatory implementation constraints, not optional guidance. The implementation must satisfy both the user request and the applicable repository rules.
- Re-check the matching rules when the task expands in scope (for example UI plus backend, or implementation plus docs/testing).
- If any file under `.agents/rules/` is added, removed, renamed, or materially changed, update `docs/tooling/agents/rules.md` in the same change so the rule index stays accurate.

### Product and execution source of truth

- `docs/product` is the source of truth for product definition, scope, requirements, and acceptance criteria.
- GitHub Project `4` and its issues are the source of truth for execution status and delivery tracking.
- GitHub epic and slice issues must mirror the approved docs, not define product scope on their own.

## 3) Stack and architecture

- Next.js App Router (`src/app`)
- TypeScript
- Tailwind CSS v4
- next-intl for localization
- Prisma + Postgres (Neon)
- PostHog analytics
- Sentry error monitoring

Product architecture:

- Public Landing App
- Private Admin App (content/config management)

## 4) Implementation rules

### Language and copy

- Keep all code identifiers, comments, logs, and developer-facing strings in English.
- Never hardcode user-facing copy in components.
- Put locale-dependent content in `src/i18n/locales/{locale}/*.json`.
- Do not reference planning artifacts in source comments (no `FEAT-*`, `epic`, `slice`, ticket IDs, or issue URLs in code comments/JSDoc).

### React and Next.js

- Prefer Server Components by default.
- Add `"use client"` only for interactivity, browser APIs, or hooks that require it.
- Keep client boundaries minimal but coherent (feature-level, not page-wide when avoidable).
- Avoid inline multi-step logic in JSX handlers. Use named `handle*` functions.

### Reuse and structure

- Reuse components from `src/components/core` and `src/components/modules` before adding new ones.
- Follow project structure rules in `.agents/rules/project-structure.mdc`.
- Keep shared utilities in `src/lib`, shared hooks in `src/hooks`, shared types in `src/types`.
- Place page-scoped code in route-level `_components`, `_utils`, `_hooks`, `_actions`, `_types`, `_schemas`.

### Styling, semantics, and themes

- Use semantic HTML (`button`, `nav`, `main`, `section`, etc.).
- Use `cn()` from `@/lib/styles` for class composition.
- Use theme-aware semantic design variables, not hardcoded light/dark colors.
- Treat `docs/design/README.md` and the files in `docs/design/` as the source of truth for typography, color, spacing, radius, surfaces, and shared UI hierarchy decisions. Review the relevant design doc before introducing or changing reusable interface patterns. The folder also holds the operational `docs/design/PLAYBOOK.md` (mandatory pre-implementation workflow + anti-patterns), `docs/design/components.md` (component map), and `docs/design/decisions/` (accepted design ADRs).
- Validate responsive behavior across mobile/tablet/desktop. No overlap or accidental overflow.

### Accessibility

- Ensure keyboard usability and visible focus.
- Provide labels for form controls and icon-only actions.
- Ensure meaningful images have `alt`.
- Ensure status/feedback messages can be announced when relevant.

### Analytics

- Track meaningful clickable interactions (CTA, nav, form actions, toggles).
- Centralize event names in `POSTHOG_EVENTS` (`src/lib/constants.ts`).
- Prefer declarative `data-ph-event`/`data-ph-props` for simple clicks.

### Data and backend

- Do not instantiate Prisma client outside `src/lib/prisma.ts`.
- Keep data access in dedicated query/data modules, not directly in UI components.
- Validate external input with Zod at boundaries.
- Use transactions for atomic multi-step writes.

### Error handling and monitoring

- Handle expected errors gracefully.
- Capture unexpected errors with Sentry, without duplicate noisy reporting.
- Do not expose secrets or sensitive payloads in logs/errors.

### Docs and standards

- Update `docs/` only when a change adds reusable architecture/process knowledge.
- Prefer updating existing rules/docs instead of creating duplicates.
- In repository files and docs, use repository-relative paths or plain repo paths. Do not use machine-specific absolute filesystem paths.
- Keep GitHub epic/slice issues synchronized with implemented behavior; if implementation changes feature scope, update the corresponding epic/slice issue in the same change.
- Any user-requested product change, behavior change, UX change, flow change, copy change, or newly introduced requirement must trigger a documentation alignment review against `docs/product` in the same change.
- Agents must not wait for an explicit follow-up request to update product docs. If the implemented behavior is new, differs from the current docs, or fills a previously undocumented product decision, the agent must update the owning product doc proactively.
- The minimum expectation is to update the nearest owning product doc (`Work Order`, `Blueprint`, `FRD`, or `PRD`). If the change affects more than one product level, update every affected level in the same change.

## 5) i18n and locale routing

- Supported locales are `es` (default) and `en`.
- Keep next-intl config aligned with:
  - `src/i18n/routing.ts`
  - `src/i18n/request.ts`
  - `src/proxy.ts`
- In React components, use next-intl hooks (`useTranslations`, `useLocale`, `useMessages`).
- Use `getTranslations` only in non-React or framework functions (e.g., metadata generation).

## 6) OG image conventions

For OG image work:

- Use per-segment `opengraph-image.tsx` files under `src/app/[locale]/...`.
- Use shared template `src/components/modules/OgImageTemplate.tsx`.
- Use helpers in `src/lib/og.ts` for fonts and localized copy.
- Keep OG copy in locale namespaces (`ogEyebrow`, `ogHeadline`, `ogSubline`).

## 7) Naming and code quality

- Naming:
  - files/functions/variables: `camelCase`
  - components/types/classes: `PascalCase`
  - constants: `UPPER_SNAKE_CASE`
- Avoid magic numbers and repeated literals. Promote shared constants to `src/lib/constants.ts`.
- Prefer `unknown` over `any`.
- Keep comments focused on "why", not "what".
- Remove unused code/imports and commented dead code.

## 8) Commands and validation checklist

Before finalizing changes, always evaluate validation scope based on risk and run the relevant checks for the files and behavior you touched.

Use this default policy:

1. **Docs/process/rules-only changes** (`.md`, `.mdc`, hook docs, repo process docs`)
   No app validation commands are required.
2. **Trivial low-risk content/presentational changes**
   Examples: copy-only changes, translation text updates, spacing tweaks, color swaps, non-structural class changes, or static markup adjustments with no logic, routing, data, config, or contract impact.
   Run the narrowest relevant check for the edited code files, usually `npm run lint` for TS/TSX/JS/JSX changes. Add manual verification when presentation is the main risk.
3. **Behavioral or medium/high-risk changes**
   Run the full standard validation sequence:
   1. `npm run test`
   2. `npm run type-check`
   3. `npm run lint`
   4. `npm run validate-build`

Treat a change as **full-validation required** when it affects logic, reusable component APIs, routing, async behavior, server/client boundaries, data access, Prisma, validation schemas, config, dependencies, build behavior, or any critical workflow.

Run `npm run test:e2e` whenever the affected workflow already has Playwright coverage, or when the change touches a critical user flow whose real behavior depends on routing, browser state, redirects, form submission, or cross-page transitions.

At minimum, if the repo already has a matching spec for the affected area (for example `e2e/auth.spec.ts` for auth flows or `e2e/landing.spec.ts` for landing flows), run that spec before finalizing.

Use `npm run build` only when simulating or executing the full deploy pipeline (e.g. Vercel); it includes `prisma migrate deploy` and requires a database that accepts migrations.

If a command cannot be run, state it explicitly and why.

## 9) Agent behavior expectations

- Make minimal, targeted changes that solve the request.
- Preserve existing conventions and file organization.
- Do not introduce unrelated refactors.
- Document assumptions when requirements are incomplete.
- Prefer small, reviewable diffs.
- Start each implementation by identifying the applicable repository rules through `docs/tooling/agents/rules.md` and enforcing them throughout the change.
- When multiple rule files apply, satisfy all of them together and resolve ambiguity using the source-of-truth order above.
- Do not finalize work until the relevant rule-driven requirements for implementation, docs, tests, accessibility, theming, analytics, and validation have been checked according to the task scope and risk level.
- For UI work, ensure the result aligns with `docs/design/README.md` and the relevant file in `docs/design/`; if the implementation introduces a reusable visual rule not captured there, update the matching design document in the same change.
- Treat documentation alignment as part of implementation completion, not as optional follow-up work. A task that changes product behavior is incomplete until the affected `docs/product` source-of-truth files have been reviewed and updated when needed.

## 10) Anti-patterns to avoid

- Hardcoded user-facing strings in TS/TSX
- Theme-blind colors (`#fff`, `text-white`, etc.) in app UI
- Prisma calls directly from React components
- Repeated inline PostHog event strings
- Large client components when server components would work
- New folders/files that duplicate an existing pattern

## 11) Agent hooks

Hooks run automatically during the agent loop to enforce formatting, block sensitive file reads, and require approval for destructive commands.

Key points:

- Scripts live in `.claude/hooks/` — **single source of truth** for hook logic.
- Claude Code reads `.claude/settings.json` to wire these scripts into its agent loop. Codex does not run hooks.
- Do not duplicate hook logic. If you add or change a hook, update the script in `.claude/hooks/`, register it in `.claude/settings.json`, and update `docs/tooling/agents/hooks.md`.

See `docs/tooling/agents/hooks.md` for the full reference (configured hooks, payload format, and how to add new ones).

## 12) Command-file enforcement for Codex

When the user references a file under `.claude/commands/*.md`, treat that file as an execution contract, not as optional context.

Required behavior:

- If the user includes text on the same line as the referenced command file, interpret that text as the command input payload automatically.
- Do not require the user to restate the command instructions in natural language when the command file and its inputs are already provided.
- Default to the simplest invocation model: command file reference plus positional input values.
- Treat the referenced command file as the active execution authority for that turn.
- Command-file workflow takes priority over generic skill workflows or default process habits that would otherwise delay implementation.
- Do not pause for unrelated brainstorming, spec-writing, or approval gates when executing a command file unless:
  - the user explicitly asks for that extra phase, or
  - the command reaches a decision with non-obvious destructive or scope-expanding consequences.
- Skills may still be used to help complete the command, but they must not override, replace, or slow the command's required workflow.
- Each command should be treated as self-contained: follow its own steps, scope boundaries, validation rules, tracking rules, and output contract independently of other skill-level process defaults.
- Follow the command file `Steps` section as mandatory workflow unless it conflicts with a direct user instruction.
- Read the command file completely enough to identify any `Output`, `Output format`, `Return`, or equivalent response-shape section.
- Treat the command file response-shape section as mandatory final response contract.
- Match the requested output structure, section names, ordering, and formatting as closely as the command specifies.
- Do not replace the required final output with only a GitHub comment or only an implementation summary.
- If a command requires external state updates (for example GitHub Project `Status` changes) and the available tools do not support that operation directly, report that explicitly as a blocked requirement in the final response.
- When possible, still complete all remaining command steps that are supported by available tools.

Input interpretation rules:

- Parse the referenced command file first, then map the inline user text to the command `Inputs` section by position and format.
- Accept either raw values or URLs when the command input description allows them.
- If optional extra context is provided after the required input, treat it as additional command context without requiring a special wrapper.
- Only ask the user for clarification when the provided inline input cannot be mapped safely to the command `Inputs` section.
- If the command defines no explicit response-shape section, return a concise result summary plus any validation or blocker information required by the command steps.
