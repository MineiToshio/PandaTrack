---
id: WO-03
type: WORK_ORDER
slug: audit-log-viewer
title: Audit Log Viewer
status: ACTIVE
parent: BP-01
source_issue: 130
implementation_status: IN_PROGRESS
last_updated: 2026-07-23
---

# WO-03 Audit Log Viewer

## Summary

Vertical slice that replaces the honest stub at `/[locale]/admin/audit` with the real audit log viewer: a read-only, server-rendered table over `AdminAuditLog` (PRD-03, FRD-01), newest first, showing actor, action, target, timestamp, and reason, with baseline offset pagination so it stays usable as entries accumulate. The route, gating (`requireAdmin()`), `admin` namespace, and `ROUTES.adminAudit` already exist from `WO-01`; the read helper `listAuditEntries` already exists from PRD-03 (FRD-01). This slice adds the presentation, one small read extension (actor join), the analytics island, and its tests.

## In Scope

- A read view over `AdminAuditLog` using `listAuditEntries` from `src/lib/data/admin/adminAuditQueries.ts`, newest first (`createdAt desc, id desc`), rendered as a semantic `<table>` inside a horizontally scrollable container.
- Columns in this order: Cuando (timestamp), Admin (actor), Accion (action key), Objetivo (target), Motivo (reason when present).
- Actor display: extend the `listAuditEntries` select to join the actor and show `username`, with `name` as the cell `title`. The actor relation is `onDelete: Restrict`, so the actor always exists (no null case).
- Timestamp display: render in UTC with a visible `UTC` label and `tabular-nums`, via a dedicated instant formatter (`Intl.DateTimeFormat(locale, { timeZone: "UTC", ... })`). Do not use the `src/lib/domainDate.ts` helpers: those are for calendar-day domain dates, not for a true instant.
- Target display (v1): the localized `targetType` label (Tienda / Reporte / Solicitud de cambio / Tipo de producto) plus the `targetId` in mono, truncated, with the full id in the cell `title`. Target-name resolution is deferred (see Out of Scope).
- Action display: the raw stable action key in mono (for example `store.remove`), with a localized `title` describing it. The 10-key vocabulary already lives in `src/lib/data/admin/adminAuditVocabulary.ts`. Two of those keys, `store.flag` and `store.unflag`, are retired from writing (PRD-02, FRD-04 `FR-04-43`): nothing emits them anymore, but historical rows carry them and `auditActionTitleKey` resolves with no fallback, so both must stay in the vocabulary and in `audit.action.*` in both locales or the viewer breaks on those rows (`BR-01-05`).
- Baseline pagination: a Server Component that reads `?page=N` from `searchParams` and does page replacement (not accumulation) via `listAuditEntries` (`DEFAULT_AUDIT_LOG_PAGE_SIZE = 25`). Controls: "Mas antiguos" (next, older page; disabled on the last page) and "Mas recientes" (previous, newer page; disabled on page 1).
- Empty state when there are no entries: an `EmptyState` card (icon `ScrollText`) with copy distinct from the "coming soon" placeholder.
- Localized copy in the `admin` namespace, Spanish default and English available, no hardcoded strings.
- Analytics for opening the viewer: `POSTHOG_EVENTS.ADMIN.AUDIT_VIEWED = "admin_audit_viewed"`, fired once on mount from a tiny client island, mirroring `AdminSpaceEnteredCapture`.
- E2E for the viewer plus a unit test for the instant formatter and row formatting.

## Out of Scope

- Any mutation of audit entries (they are append-only).
- Target-name resolution (joining `targetId` to a human-readable name per target type); v1 shows the target type label plus the id.
- Fully localized action-key labels (v1 keeps the raw key in mono with a localized `title`).
- Advanced filtering, export, and tamper-evidence (later).
- The inbox (`WO-02`).

## Requirements

- `FR-02-11`: List `AdminAuditLog` entries newest first with actor, action, target, UTC timestamp, and reason. In v1 the target is presented as the localized target type plus the id; the timestamp is shown in UTC with a visible label.
- `FR-02-12`: Support baseline offset pagination (page replacement via `?page=N`), keeping the viewer usable as entries accumulate.
- `FR-02-03`: Localize the viewer through the `admin` namespace.
- `FR-02-13`: Emit analytics for opening the viewer (`admin_audit_viewed`).

Relevant business rules:

- `BR-02-01`: Copy lives in the `admin` namespace.

Relevant acceptance criteria:

- `AC-02-05` Audit log viewer.

## Assumptions

- Server Component by default; only the analytics capture is a client island, mirroring `src/app/[locale]/(app)/admin/_components/AdminSpaceEnteredCapture.tsx` (`react-next-components.mdc`, `coding-standards.mdc`).
- No Prisma in components; the read comes only from `listAuditEntries` in `src/lib/data/admin/adminAuditQueries.ts` (`prisma-data-layer.mdc`, `AGENTS.md §4`).
- Copy in the `admin` namespace via `getTranslations` on the server page and metadata (`useTranslations` only if a client subcomponent needs it) (`next-intl-translation-apis.mdc`, `english-code-only.mdc`).
- No optimistic updates: the viewer is read-only (`optimistic-client-updates.mdc` does not apply).
- `"—"` is the only allowed em dash, used solely as the null placeholder for an absent reason (`AGENTS.md §4`, `em-dash-copy-guard`).
- `robots: noindex` stays on the route metadata (already present).

## UX Notes

- Column order matches the FDD (`#audit`): Cuando, Admin, Accion, Objetivo, Motivo. The table uses proper header cells (`<th scope="col">`), the timestamp column uses `tabular-nums`, and the whole table scrolls horizontally inside its own container so the page body never scrolls sideways on narrow viewports (FDD-02 §2.5 and §Responsive).
- Theme-aware tokens via `cn()`: warm surface header, `--border` separators, `--text-muted/secondary/primary`, matching the prototype `table.audit` (`theme-light-dark.mdc`, `ui-visual-consistency.mdc`). Icons from lucide: `ScrollText` (heading/empty) and `History` ("Mas antiguos") (`icons.mdc`).
- Pagination controls sit below the table; "Mas antiguos" advances to older entries, "Mas recientes" returns toward the newest, each disabled at its boundary.

## Technical Notes

- Extend `AUDIT_ENTRY_SELECT` in `src/lib/data/admin/adminAuditQueries.ts` with `actor: { select: { username: true, name: true } }` so the viewer renders the actor without a second read. This is the only data-layer change; the ordering, offset pagination, and page-shape stay as-is.
- Add a dedicated instant formatter (module-local or in a small helper) that formats a true `Date` in UTC. Do not route audit instants through `src/lib/domainDate.ts`, whose helpers are for UTC-midnight calendar-day domain values and whose own docs explicitly exclude audit-log instants.
- The page reads `searchParams.page`, calls `listAuditEntries({ page })`, and renders page N; navigation between pages is plain links that set `?page=N` (server round-trip, no client list state).
- Route, gating, and `ROUTES.adminAudit` already exist (`WO-01`); this slice only swaps the stub body in `src/app/[locale]/(app)/admin/audit/page.tsx` and adds the table and analytics island under the admin `_components`.

## Observability Notes

- Add `AUDIT_VIEWED: "admin_audit_viewed"` to the `POSTHOG_EVENTS.ADMIN` group in `src/lib/constants.ts` and fire it once on mount from a new client island (for example `AuditViewedCapture`), consistent with the space-entered capture pattern. Opening the viewer is a view, so it is captured client-side.

## Dependencies

- `WO-01` (admin shell, `requireAdmin()` gating, `admin` namespace, `ROUTES.adminAudit`): implemented.
- PRD-03 (FRD-01) read helper `listAuditEntries` and the `AdminAuditLog` model: implemented.
- Audit entries are written by the PRD-02, FRD-04 moderation actions (`WO-09`), which supply the rows the viewer lists.

## Blueprints

- `BP-01` runtime component coverage: routing and gating layer (the `/audit` route inside the admin group), console UI layer (the read-only audit table), verification layer. Depends on `WO-01` (shell) and PRD-03 (FRD-01) · `WO-01` (`AdminAuditLog` and read helpers, including the actor join added here).

## Testing

- New E2E `e2e/audit-log-viewer.spec.ts` reusing `signInAsAdmin` / `skipUnlessAdminEnv` from `e2e/_helpers/auth`. Assert: column headers render from the `admin` namespace in both locales; when entries exist, they list newest first; when none exist, the empty state shows. Graceful degradation: if the admin environment has no seeded `AdminAuditLog` rows, assert structure and both-language rendering and treat the with-entries assertion as conditional (or seed rows in setup).
- Unit test for the UTC instant formatter and the row formatting (target type label plus truncated id, reason placeholder).
- Behavioral slice (routing, data access, server boundary): run the full validation sequence (`test`, `type-check`, `lint`, `validate-build`) plus the new E2E.

## E2E Acceptance Tests

- With existing audit entries, the viewer lists them newest first with actor (username), action key, target (type label plus id), UTC timestamp, and reason when present (`AC-02-05`).
- Offset pagination via `?page=N` keeps the viewer usable with many entries: "Mas antiguos" and "Mas recientes" move between pages and disable at their boundaries.
- With no audit entries, the viewer shows its empty state.
- The viewer renders from the `admin` namespace in both languages.
