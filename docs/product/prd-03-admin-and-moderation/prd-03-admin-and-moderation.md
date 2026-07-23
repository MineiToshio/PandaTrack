---
id: PRD-03
type: PRD
slug: admin-and-moderation
title: PandaTrack Admin and Moderation
status: DRAFT
parent: null
children:
  - FRD-01
  - FRD-02
last_updated: 2026-07-22
source_features: []
---

# PRD-03 PandaTrack Admin and Moderation

## Purpose

Define PandaTrack's private administration and moderation surface: the "Private Admin App" named in the product architecture, distinct from the public landing (PRD-01) and the authenticated collector app (PRD-02).

This PRD exists because the collector app already records community governance data (store reports, store change requests, store product-type requests) but has no actor, role, or surface that resolves it. Community submission is built; moderation is not. This PRD defines the platform that grants and enforces the admin role, the accountability trail for privileged actions, and the console where a moderator reviews everything that needs attention.

This is the durable identity of the admin surface. Its current release is intentionally minimal (a single administrator, the owner, plus inline controls and one moderation inbox), but "minimal" is a maturity stage, not the product's name: the same PRD-03 will evolve into a fuller moderation console and multi-moderator operation without changing its identity.

## Product Summary

PandaTrack Admin and Moderation is the privileged surface that lets a trusted administrator keep the public store layer trustworthy.

It has two complementary facets:

- Inline privileged controls that an administrator sees while using the normal collector app (approve a store, remove a store, resolve a report, apply or reject a community change request, approve a product-type request). These controls live in the collector app UI and are owned by PRD-02 (FRD-04); this PRD owns the role that unlocks them and the audit trail that records them.
- A dedicated admin space at `/[locale]/admin` where the administrator sees, in one place, everything pending moderation and moves from there to act.

The surface is embedded in the same repository and deployment as the rest of PandaTrack. It is not a separate application or repository. It is localized with the same i18n system as the collector app so that administrators and future moderators can operate in Spanish or English.

## History and Context

The store domain (PRD-02, FRD-04) shipped the "citizen" half of governance: any authenticated collector can create a store, report a store, propose changes to an approved store as a diff-based change request, and suggest a new product type. Every one of those records has a lifecycle with terminal states (`APPROVED`, `REJECTED`, `FLAGGED`, `REVIEWED`, `DISMISSED`) defined in the schema.

None of those terminal transitions is reachable today. There is no role in the database (admin identity is a transitional environment allowlist), no privileged route, and no mutation that resolves a report, applies a change request, or approves a pending store. FRD-04 records an explicit open question about the store lifecycle beyond creation, and PRD-02 deliberately deferred the "full moderation backoffice" as out of scope. PRD-03 is where that deferred capability now lives, cut to a minimal but real first release.

A key product decision shapes this PRD: pending stores stay publicly visible. Approval gates search-engine indexing and trust signals, not in-app visibility. This is intentional, to prevent duplicate store creation (two collectors creating the same store because they cannot see each other's pending one). Because unmoderated stores are therefore live the moment they are created, this PRD treats a working removal (takedown) as a first-release requirement, not a later refinement.

## Problem

Without an administration and moderation surface:

- pending, duplicate, spam, or abusive stores are publicly visible with no way to remove them
- community reports accumulate with no way to review, resolve, or dismiss them
- community change requests to approved stores are captured but never applied, so public data cannot improve in a governed way
- suggested product types are collected but never authored into the shared catalog
- there is no accountable record of who took which privileged action and when
- there is no path to add moderators later, in more than one language, without reworking the foundation

## Product Goal

Deliver a minimal but real administration surface that lets a trusted administrator:

- be granted and recognized as an administrator through a durable role stored in the database
- exercise privileged store-moderation actions safely, always authorized on the server
- see everything that needs moderation in one place and act on it
- leave an accountable trail for every privileged action
- operate the surface in Spanish or English, with a clean path to localized moderators later

Success means the public store layer can be kept trustworthy by one administrator today, with the platform ready to grow into a fuller console and a small moderation team without a rewrite.

## Target Users

### Primary user

The administrator (initially the product owner):

- a single trusted operator who curates the public store layer
- creates stores that are trusted immediately and edits any store directly
- needs to clear pending stores, reports, and change requests quickly, without hunting store by store
- values a short, low-friction review loop over a heavy console

### Secondary user (future)

Localized moderators:

- trusted operators added as the product grows
- may specialize by content language or market (for example, a Spanish-speaking moderator for LATAM stores)
- need the console in their own interface language and, eventually, a way to see only the subset of content relevant to them

This PRD is designed for a single administrator now while explicitly not foreclosing the secondary user.

## Product Principles

- Trust the server, never the client: privileged controls are convenience; every privileged mutation authorizes the role on the server.
- One authority for "who is an administrator": the role lives in the database; the environment allowlist is retired once the role exists.
- Keep the review loop short: inline actions do the work; the admin space is the inbox that routes to them.
- Accountability by default: privileged actions are recorded, referencing the affected record rather than copying its sensitive content.
- Visible now, moderated fast: pending content stays public to prevent duplicates, so removal must be immediate and real.
- Localized from day one: no hardcoded copy; the admin surface goes through the same i18n system as the rest of the product.
- Minimal now, not narrow forever: ship the smallest real capability, but choose data shapes that let the console, multi-moderator operation, and localized routing grow without rework.

## Scope

### In scope

- A durable administrator role stored in the database, enforced on the server on every privileged action
- A one-time bootstrap that grants the first administrator and the retirement of the `ADMIN_EMAILS` environment allowlist
- An append-only audit log of privileged actions (actor, action, target, timestamp, reason), referencing records rather than snapshotting their sensitive content
- A localized admin space at `/[locale]/admin`, gated by the administrator role, with its own shell
- A first-release moderation inbox: a single prioritized list of everything pending (pending stores, open reports, pending change requests, pending product-type requests) that links to where the administrator acts
- An audit log viewer inside the admin space
- The i18n foundation for the admin surface, with a clean path to localized moderators and future content-language routing

### Out of scope

- The inline store-moderation controls and store lifecycle transitions themselves (approve, remove, resolve report, apply or reject change request, approve product type); these are owned by PRD-02 (FRD-04) and consume this PRD's role and audit platform
- The rejection notification to a store creator; owned by PRD-02 (FRD-09)
- The full segmented moderation console with per-queue tabs, filters, bulk actions, and enriched detail (a later release of FRD-02)
- Moderator specialization scopes, assignment between moderators, and content-language queue routing (data shapes are prepared, the surface is not built)
- Serving the admin surface from a separate subdomain (`admin.pandatrack.app`) or a separate application or repository
- Impersonation and ban management surfaces (the underlying auth plugin may provide them, but no UI is built)
- Review takedown tooling, staged-logo application, and duplicate-store merge (tracked for later)

## Core User Flows

### Become and be recognized as an administrator

1. The first administrator is granted by a one-time bootstrap that sets the role in the database.
2. After bootstrap, the environment allowlist is retired, leaving the database role as the single authority.
3. On every request to a privileged route or action, the server verifies the role before proceeding.

### Clear the moderation inbox

1. The administrator opens `/[locale]/admin`.
2. The inbox shows everything pending in one prioritized list: pending stores, open reports, pending change requests, and pending product-type requests.
3. The administrator opens an item and is routed to the place where they act (typically the store, with inline controls).
4. The administrator acts; the item leaves the inbox; the action is recorded in the audit log.

### Act inline while browsing

1. While using the collector app, the administrator sees privileged controls where the content is (owned by PRD-02, FRD-04).
2. The administrator approves or removes a store, resolves a report, applies or rejects a change request, or approves a product type.
3. Each action authorizes the role on the server and writes an audit entry through this PRD's platform.

### Review accountability

1. The administrator opens the audit log viewer in the admin space.
2. The administrator sees who did what, to which record, when, and why.

## Core Product Entities

- `User` (extended with a moderation `role`, plus the auth-plugin fields for future ban and impersonation)
- `AdminAuditLog` (new: append-only record of privileged actions)
- `Store`, `StoreReport`, `StoreChangeRequest`, `StoreProductTypeRequest` (existing governance entities this surface reads and routes to; their transitions are owned by PRD-02, FRD-04)

## Relationship to PRD-02 (Collector App)

PRD-03 is the platform and the surface; PRD-02 (FRD-04) owns the store lifecycle transitions and their inline controls. One administrator outcome can therefore span both PRDs: approving a store is triggered by an inline control (PRD-02, FRD-04), routed to from the moderation inbox (PRD-03, FRD-02), gated by the role and recorded by the audit log (PRD-03, FRD-01).

Sequencing follows the dependency, not the PRD number: PRD-03's role and audit foundation (FRD-01) must land before PRD-02's inline moderation actions can ship. Cross-references between the two PRDs use the qualified `PRD-0X · FRD-0Y` form with repository-relative links.

## Release-Level Success Criteria

- An administrator is recognized through a database role, and the environment allowlist is no longer the source of truth.
- Every privileged action is refused for non-administrators at the server, not only hidden in the UI.
- An administrator can clear a pending store, a report, a change request, and a product-type request through the surface.
- A removed store disappears from public search and direct access while its collector orders still render a clear tombstone.
- Every privileged action leaves an accountable audit entry.
- The admin surface renders in Spanish and English with no hardcoded copy.
- Adding a second administrator or a new interface language requires no schema or architecture rework.

## Risks

- Role bootstrap done wrong could lock the owner out of administration; the first-release plan must prove the grant before retiring the allowlist.
- Privileged endpoints (role change, future impersonation, future ban) are account-takeover grade and must be treated as a threat surface, defaulting every user to the non-privileged role.
- Applying a community change request against stale data could overwrite newer values; the applying action (owned by PRD-02, FRD-04) must re-derive at approval time.
- Sensitive moderation data (raw report text, reporter identity) must not leak to non-administrators; admin reads must use a server-only path, not the public read model.
- Keeping pending stores public means abuse is live before review, so removal quality and speed matter more than queue sophistication.
- Overbuilding the console for a single administrator would waste effort; the first release must stay a minimal inbox.

## Linked FRDs

- `docs/product/prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md`
- `docs/product/prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md`
