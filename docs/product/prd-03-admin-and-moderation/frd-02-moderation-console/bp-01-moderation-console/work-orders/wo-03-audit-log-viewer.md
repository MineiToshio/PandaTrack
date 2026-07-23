---
id: WO-03
type: WORK_ORDER
slug: audit-log-viewer
title: Audit Log Viewer
status: DRAFT
parent: BP-01
source_issue: 130
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-03 Audit Log Viewer

## Summary

Vertical slice that adds the audit log viewer to the admin space: a read-only table over `AdminAuditLog` (PRD-03, FRD-01), newest first, showing actor, action, target, timestamp, and reason, with baseline pagination so it stays usable as entries accumulate.

## In Scope

- A read view over `AdminAuditLog` using the read helpers from PRD-03 (FRD-01), newest first.
- Columns: actor, action, target type and id, UTC timestamp, reason when present.
- Baseline pagination or a recent-window view.
- Localized copy in the `admin` namespace.
- Analytics for opening the audit viewer.
- E2E for the viewer.

## Out of Scope

- Any mutation of audit entries (they are append-only).
- Advanced filtering, export, and tamper-evidence (later).
- The inbox (`WO-02`).

## Requirements

- `FR-02-11`: List `AdminAuditLog` entries newest first with actor, action, target, timestamp, and reason.
- `FR-02-12`: Support baseline pagination or a simple recent-window view.
- `FR-02-03`: Localize the viewer through the `admin` namespace.
- `FR-02-13`: Emit analytics for opening the viewer.

Relevant business rules:

- `BR-02-01`: Copy lives in the `admin` namespace.

Relevant acceptance criteria:

- `AC-02-05` Audit log viewer.

## Blueprints

- `BP-01` runtime component coverage: routing and gating layer (the `/audit` route inside the admin group), console UI layer, verification layer. Depends on `WO-01` (shell) and PRD-03 (FRD-01) · `WO-01` (`AdminAuditLog` and read helpers).

## E2E Acceptance Tests

- With existing audit entries, the viewer lists them newest first with actor, action, target, timestamp, and reason when present (`AC-02-05`).
- Pagination or the recent-window view keeps the viewer usable with many entries.
- The viewer renders from the `admin` namespace in both languages.
