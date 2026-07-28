---
title: ADR 0018 — List pagination: user-selectable page size + desktop summary row
date: 2026-07-23
status: accepted
session: app-wide desktop pagination redesign (2026-07-23)
owner: Sergio Minei
trigger: owner-approved redesign of the collector app's three list-pagination surfaces (orders, deliveries, stores) to add a user-selectable page size and unify the desktop layout
updates: docs/product/prd-02-collector-app/frd-04-store-domain/fdd-04-store-domain.md, docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/fdd-05-order-payment-shipment.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md, docs/product/prd-02-collector-app/frd-08-delivery-management/fdd-08-delivery-management.md, docs/design/interface-patterns.md, docs/design/PLAYBOOK.md
supersedes: docs/design/decisions/0001-s2-closure-decisions.md (Decision 9)
---

# ADR 0018 — List pagination: user-selectable page size + desktop summary row

## Context

[ADR 0001](0001-s2-closure-decisions.md) Decision 9 (S2 closure) fixed the collector app's list
pagination as: mobile "Cargar más", desktop a classic numbered paginator, with a fixed page size
per module (`pageSize 20` in the original decision text; shipped as `30` for orders/deliveries via
`ORDER_LIST_PAGE_SIZE` / `DELIVERY_LIST_PAGE_SIZE`, and `10`–`12` for stores via a store-only
`DEFAULT_PUBLIC_STORE_PAGE_SIZE`). Three problems accumulated as the three list modules
(orders, deliveries, stores) matured independently:

1. **Page size was neither unified nor user-controlled.** Each list hard-coded its own constant,
   so a collector with a large, growing collection (the product's core retention case) had no way
   to see more rows per screen, and the three modules disagreed with each other for no
   product reason.
2. **Stores had drifted from the shared pattern.** Orders and deliveries already paired a
   `"Mostrando A–B de N"` summary line with the numbered desktop nav (per the original L062
   pattern), but the stores list's desktop pagination showed numbered pages on **mobile** too and
   carried no summary line — the opposite of the "mobile load-more, desktop numbered" split
   Decision 9 intended, and inconsistent with its own sibling modules.
3. **No canonical desktop layout for a page-size control.** Nothing in `docs/design/` or the
   `ListPagination` component defined where a per-page selector belongs relative to the summary
   and the numbered nav, so adding one to any single module risked three divergent
   one-off placements.

## Decision

Adopt one shared list-pagination contract, owned by the `ListPagination` module and consumed
identically by orders, deliveries, and stores:

1. **User-selectable page size, unified across all three lists.** `PAGE_SIZE_OPTIONS = [10, 25, 50,
100]` and `DEFAULT_PAGE_SIZE = 25` (`src/lib/constants.ts`) replace every module-local page-size
   constant. `ORDER_LIST_PAGE_SIZE`, `DELIVERY_LIST_PAGE_SIZE`, and the stores page-size constant
   are now aliases of `DEFAULT_PAGE_SIZE`, kept only so call sites read domain-appropriately.
2. **One desktop row: summary (left) + controls (right).** The results summary
   (`"Mostrando X–Y de N"`) anchors the left edge; a `Select`-backed per-page control (component
   `PerPageSelect`, never a native `<select>`) plus the numbered page nav sit together on the
   right, in that order. `flex-wrap` is the only safety net for narrow desktop widths (expanded
   sidebar, long summary text) — the control cluster drops to its own line rather than
   overflowing, it never reintroduces a native select or a second summary line.
3. **Mobile stays load-more, standardized across all three.** Summary line + a single "Cargar
   más" button, centered, no numbered pages and no per-page selector. Stores' mobile numbered-page
   affordance is removed; stores adopts the same mobile markup orders and deliveries already used.
4. **New `?perPage=` URL param, omitted at the default.** Present only when it differs from `25`.
   Changing the page size resets the URL to page 1 (a stale `?page=N` at the old size could point
   past the end of the new one). Changing any other filter preserves the current `?perPage=` value.
5. **Dead code removed.** `core/Pagination.tsx` (the old numbered-only primitive) is deleted; every
   consumer now goes through `modules/ListPagination.tsx` (paired with `modules/PerPageSelect.tsx`),
   which owns both the mobile and desktop layouts behind one API.

## Alternatives considered

### A. Keep per-module page-size constants, only add a shared per-page selector UI

- Pros: smaller change; no rename of `ORDER_LIST_PAGE_SIZE` / `DELIVERY_LIST_PAGE_SIZE` semantics.
- Cons: three still-independent defaults (20/30 vs 10/12) with no product reason to differ; a
  shared `PerPageSelect` presenting different "current" values per module while the option list is
  the same is confusing groundwork for the shared component to carry forward.
- Why not chosen: the inconsistency was the actual problem being fixed, not just the missing
  control.

### B. Infinite scroll / virtualized list on desktop instead of numbered pages

- Pros: removes the page-size question entirely; scales better for very large collections.
- Cons: breaks scroll-restoration on back-navigation from a detail view, which Decision 9 already
  rejected for mobile for the same reason; would also require a new interaction pattern most
  collectors don't expect on desktop, where numbered pagination (Stripe, Vercel, GitHub) is the
  norm this product already follows.
- Why not chosen: the scroll-restoration risk and desktop-convention mismatch outweigh the
  scaling benefit; the org already rejected the equivalent mobile pattern in ADR 0001.

### C. Page-size selector on both mobile and desktop

- Pros: full parity between breakpoints.
- Cons: adds a second control to an already-tight mobile action row for a use case (choosing how
  many items load) that is materially less useful on a small viewport where "Cargar más" already
  lets the collector fetch more without picking a number; increases mobile surface area for a
  low-frequency control.
- Why not chosen: mobile's load-more affordance already solves "see more"; a page-size selector
  there duplicates that job without adding value proportional to the added chrome.

## Consequences

### Positive

- One page-size vocabulary (`PAGE_SIZE_OPTIONS` / `DEFAULT_PAGE_SIZE`) that any future list
  (or future FRD) reuses without inventing its own default.
- Stores list now matches its siblings exactly on desktop and mobile, closing the visible
  inconsistency and letting all three FDDs describe pagination with one shared paragraph instead
  of three near-duplicates.
- Collectors with large collections can raise the page size instead of repeatedly paging or
  loading more, directly serving the retention-focused MVP priority (`AGENTS.md` §1).
- `core/Pagination.tsx` removal eliminates a dead, unused primitive from the component catalog.

### Negative / tradeoffs

- `?perPage=` is one more URL param every list-building URL helper (`buildOrderListFilterUrl`,
  the deliveries and stores equivalents) must preserve correctly across filter and page-size
  changes; getting the omit-at-default rule wrong in only one of the three call sites would produce
  visibly inconsistent URLs between modules.
- A larger page size (100) increases the payload and render cost of a single list request; this is
  accepted as a user-chosen tradeoff (the collector opts in), not a default-path regression.
- Existing bookmarked/shared URLs with no `?perPage=` are unaffected (default 25 applies), but any
  external link that assumed the old fixed size (20/30 for orders/deliveries, 10/12 for stores) as
  an implicit contract no longer holds — none was documented as a public contract, so this is not
  considered a breaking change.

## References

- `docs/design/decisions/0001-s2-closure-decisions.md` (Decision 9, superseded by this record)
- `docs/design/interface-patterns.md` (List pagination pattern)
- `docs/design/PLAYBOOK.md` (L062 canonical pattern entry)
- `docs/design/components.md` (`ListPagination`, `PerPageSelect`)
- `src/lib/constants.ts` (`PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`)
- `src/components/modules/ListPagination.tsx`, `src/components/modules/PerPageSelect.tsx`
- `docs/product/prd-02-collector-app/frd-04-store-domain/fdd-04-store-domain.md`
- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/fdd-05-order-payment-shipment.md`
- `docs/product/prd-02-collector-app/frd-08-delivery-management/fdd-08-delivery-management.md`
