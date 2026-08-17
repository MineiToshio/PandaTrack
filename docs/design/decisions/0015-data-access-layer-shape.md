---
title: ADR 0015 — Data access layer shape (src/queries vs src/lib/data)
date: 2026-07-10
status: accepted (migration completed 2026-07-10)
session: audit-2026-07 batch B9 (docs & rules alignment); migration completed in round-2 wave B2 (R4)
owner: Sergio Minei
trigger: repository audit finding ARCH-6 — two coexisting data-access styles with no recorded direction
updates: .agents/rules/project-structure.mdc, .agents/rules/prisma-data-layer.mdc, docs/development/file-organization.md, docs/development/lib-utilities.md
---

# ADR 0015 — Data access layer shape (`src/queries/` vs `src/lib/data/<domain>/`)

## Update — migration completed (2026-07-10)

The coexistence documented below was resolved by fully migrating `src/queries/` into
`src/lib/data/<domain>/`. **`src/queries/` no longer exists**; there is now a single canonical
data-access shape:

- `src/lib/data/<domain>/` folders holding `*Queries.ts` / `*Mutations.ts` (split by read vs write),
  importing the shared Prisma singleton from `@/lib/prisma` directly at module scope.
- No data-access function takes an injected `db: PrismaClient` parameter anymore. Functions that
  must participate in a caller-owned transaction accept an optional `tx?: Prisma.TransactionClient`
  (see `userSettingsMutations.applyCollectorPreferencesPatch`).

Domains created by the migration: `stores/` (`storeQueries`, `storeMutations`,
`storeGovernanceQueries`, `storeGovernanceMutations`), `user-settings/` (`userSettingsQueries`,
`userSettingsMutations`), `catalog/` (`countryQueries`, `storeProductTypeQueries`), and `auth/`
(`userQueries`, `userMutations`, `accountQueries`, `verificationQueries`, `verificationMutations`),
alongside the pre-existing `orders/`, `deliveries/`, and `dashboard/`.

The historical analysis below is retained for context. Wherever it describes "two coexisting shapes"
or "opportunistic migration", read that as **completed**: Option C bought time; the follow-up
migration (deferred item ARCH-1 / ARCH-3) has since been executed, landing on Option B's end state.

## Context

PandaTrack's data-access code grew in two shapes that both currently ship in `src/`:

1. **`src/queries/*.ts`** — one file per Prisma model (`store.ts`, `account.ts`, `user.ts`, `userSettings.ts`, `country.ts`, `storeProductType.ts`, `storeGovernance.ts`, `verification.ts`). Every function takes an injected `db: PrismaClient` parameter instead of importing the shared singleton. This is the original convention, documented in `.agents/rules/project-structure.mdc` ("Prisma queries: `src/queries/`, one file per model") and used by the store, auth, and settings domains.
2. **`src/lib/data/<domain>/`** — one folder per business domain (`orders/`, `deliveries/`, `dashboard/`, `stores/`), each holding `*Queries.ts` / `*Mutations.ts` files (e.g. `orderQueries.ts`, `orderMutations.ts`, `orderPaymentMutations.ts`, `orderItemMutations.ts`, `orderHistoryMutations.ts`). These import the shared Prisma singleton directly (`import { prisma } from "@/lib/prisma"`) instead of taking it as a parameter, and group both reads and writes for the same domain together. This shape emerged with the orders domain and was reused by deliveries and dashboard.

Both shapes satisfy the project-wide rule that Prisma is only touched from dedicated data modules, never from UI components (`AGENTS.md` §4, `prisma-data-layer.mdc`). Neither was wrong when introduced; the divergence happened because `src/queries/` predates the domain-sized workflows (orders, deliveries, dashboard) that later needed queries and mutations to live together and to compose several models per operation (an order write also touches order items and order history in one transaction, for example).

The audit flagged this as undocumented drift (ARCH-1/ARCH-3, deferred; ARCH-6, this ADR): new contributors and AI agents had no rule telling them which shape to use for a new domain, and `project-structure.mdc` / `docs/development/file-organization.md` only described `src/queries/`, making `src/lib/data/` look unsanctioned even though it is the shape four shipped domains already use.

## Alternatives considered

### A. Migrate everything to `src/queries/` (db-injected, one file per model)

- **Pros**: single convention; `db` injection makes unit testing with a mock/stub client straightforward.
- **Cons**: model-per-file does not group naturally with multi-model domain writes (an order mutation already spans `Order`, `OrderItem`, and `OrderHistory`); would force splitting cohesive domain logic across many small files, or force those files to keep taking `db` as a parameter purely for convention's sake with no current caller that benefits from swapping the client.

### B. Migrate everything to `src/lib/data/<domain>/` (singleton import, folder per domain)

- **Pros**: matches how the newer, larger domains (orders, deliveries, dashboard) actually work — reads and writes for the same domain co-located, direct singleton import avoids threading `db` through every call site.
- **Cons**: a big-bang migration of `src/queries/` (store, auth, settings) is a large, low-value mechanical rewrite with real regression risk (touches auth and settings, both correctness-sensitive) for no behavior change; not worth doing as a side effect of a docs-alignment batch.

### C. Document the coexistence explicitly and fix the direction going forward (this ADR)

- **Pros**: zero migration risk today; gives every future contributor (human or AI) an unambiguous rule for where a *new* domain's data access goes; lets existing code migrate opportunistically instead of blocking on a dedicated rewrite effort.
- **Cons**: the repository keeps two shapes indefinitely unless someone opportunistically migrates `src/queries/` files; a reader unfamiliar with this ADR could still be confused without it.

## Decision

**Adopt Option C.** PandaTrack keeps both shapes, with an explicit canonical direction:

1. **New domains use `src/lib/data/<domain>/`.** Any new business-domain data access (queries and mutations together) is created under `src/lib/data/<domain>/` with `*Queries.ts` / `*Mutations.ts` naming, importing the Prisma singleton from `@/lib/prisma` directly. This is the pattern going forward.
2. **`src/queries/` is maintained, not migrated wholesale.** The existing model-per-file, `db`-injected files under `src/queries/` (store, account, user, userSettings, country, storeProductType, storeGovernance, verification) stay as-is. Do not rewrite them just to match the new shape.
3. **Opportunistic migration.** When a change materially touches a `src/queries/*.ts` file's domain (not a one-line fix), and that domain is growing into a multi-model workflow, move it to `src/lib/data/<domain>/` in that same change instead of adding more model-per-file sprawl. Do not do this as a standalone refactor PR; do it as part of feature work that already touches the area.
4. **No behavior distinction.** Both shapes are equally valid places to read/write Prisma from server actions and Server Components; the choice is purely about file organization, not about correctness, transactions, or authorization. `data-layer-user-id-duplication.mdc` and `prisma-data-layer.mdc` apply identically to both.

## Consequences

### Positive

- New contributors (and AI agents) have one unambiguous rule for new domains: `src/lib/data/<domain>/`.
- No forced, high-risk rewrite of auth/settings/store query files.
- `project-structure.mdc` and `docs/development/file-organization.md` stop under-documenting a shape that four shipped domains already use.

### Negative / limits

- The repository keeps two data-access shapes side by side for the foreseeable future; a reader who does not consult this ADR could still be confused about which one is "the" pattern. Both `project-structure.mdc` and `file-organization.md` link this ADR to mitigate that.
- Opportunistic migration means `src/queries/` may shrink unevenly over time rather than on a fixed schedule. This is accepted: the alternative (a dedicated migration effort) is tracked as a deferred item (see the audit plan's "ARCH-1 / ARCH-3" entry) and is out of scope for a docs-alignment batch.

## References

- `.agents/rules/project-structure.mdc` (Prisma queries section, updated in the same change as this ADR)
- `docs/development/file-organization.md` (updated in the same change as this ADR)
- `.agents/rules/prisma-data-layer.mdc`, `.agents/rules/data-layer-user-id-duplication.mdc`
- Example `src/queries/` files **as they existed when this ADR was written** (the folder was fully migrated and no longer exists — see the update note at the top): `src/queries/store.ts`, `src/queries/account.ts`
- Example `src/lib/data/` domains: `src/lib/data/orders/`, `src/lib/data/deliveries/`, `src/lib/data/dashboard/`
