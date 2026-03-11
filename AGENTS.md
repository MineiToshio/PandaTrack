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
3. `.cursor/rules/*.mdc`
4. `docs/` (all documentation files in this folder)

If still ambiguous, choose the smallest safe change and note assumptions.

### Feature planning source

- Feature planning source of truth is GitHub Project: `https://github.com/users/MineiToshio/projects/4`.
- Epic and slice issues in GitHub are canonical for feature scope/status.

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
- Follow project structure rules in `.cursor/rules/project-structure.mdc`.
- Keep shared utilities in `src/lib`, shared hooks in `src/hooks`, shared types in `src/types`.
- Place page-scoped code in route-level `_components`, `_utils`, `_hooks`, `_actions`, `_types`, `_schemas`.

### Styling, semantics, and themes

- Use semantic HTML (`button`, `nav`, `main`, `section`, etc.).
- Use `cn()` from `@/lib/styles` for class composition.
- Use theme-aware semantic tokens, not hardcoded light/dark colors.
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
- Keep GitHub epic/slice issues synchronized with implemented behavior; if implementation changes feature scope, update the corresponding epic/slice issue in the same change.

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

Before finalizing changes, run relevant checks:

1. `npm run type-check`
2. `npm run lint`
3. `npm run validate-build` (local validation: generates Prisma client and builds Next.js without applying migrations; use this instead of `npm run build` for agent/local checks)

Use `npm run build` only when simulating or executing the full deploy pipeline (e.g. Vercel); it includes `prisma migrate deploy` and requires a database that accepts migrations.

If a command cannot be run, state it explicitly and why.

## 9) Agent behavior expectations

- Make minimal, targeted changes that solve the request.
- Preserve existing conventions and file organization.
- Do not introduce unrelated refactors.
- Document assumptions when requirements are incomplete.
- Prefer small, reviewable diffs.

## 10) Anti-patterns to avoid

- Hardcoded user-facing strings in TS/TSX
- Theme-blind colors (`#fff`, `text-white`, etc.) in app UI
- Prisma calls directly from React components
- Repeated inline PostHog event strings
- Large client components when server components would work
- New folders/files that duplicate an existing pattern
