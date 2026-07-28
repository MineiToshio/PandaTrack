---
title: ADR 0016 — Seller type (storeType → sellerType) with three roles (Retailer / Person / Proxy)
date: 2026-07-22
status: accepted
session: store-domain seller-type refactor (2026-07-22)
owner: Sergio Minei
trigger: owner-approved domain-model change — the store classification field was ambiguous against the "Tienda" entity/section, and the two-type model (BUSINESS / PERSON) could not represent an intermediary/proxy seller
updates: docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md, docs/product/prd-02-collector-app/frd-04-store-domain/fdd-04-store-domain.md, docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md (+ work orders), docs/product/glossary.md
---

# ADR 0016 — Seller type with three roles (Retailer / Person / Proxy)

## Context

`Store` (the "Tiendas" section) classified its seller with a field named `storeType` (Prisma
`enum StoreType { BUSINESS | PERSON }`). Two problems:

1. **Naming collision.** `storeType` / "store type" reads as a property of the `Store` entity
   and the "Tienda" section, when it actually classifies the _seller_. This blurred the entity
   with its classification in code, copy, and docs.
2. **Too coarse a taxonomy.** `BUSINESS` conflated "a shop that sells its own stock" with "any
   commercial actor". A **proxy / forwarding service** (e.g. ZenMarket) is also a business, but
   it does **not** sell its own catalog — it buys on the collector's behalf. Modeling it as
   `BUSINESS` would wrongly attach a catalog (product types, stock, pre-orders) to it and give
   collectors no signal that the store is an intermediary.

## Decision

Rename and generalize the classification to a **seller type**:

- Field `Store.storeType` → `Store.sellerType`; `enum StoreType` → `enum SellerType`.
- Value `BUSINESS` → `RETAILER`; add new value `PROXY`. Final: `SellerType { RETAILER | PERSON | PROXY }`.
- Semantics — name the seller's **role**, not a legal category:
  - `RETAILER` (es "Comercio") — a business that sells its own products; full catalog + logo + contact info.
  - `PERSON` (es "Persona", en "Individual") — an individual reseller; catalog, no public contact info, may be private.
  - `PROXY` (es/en "Proxy") — a forwarding/intermediary service that buys on your behalf; **no catalog** (no product types, null `hasStock` / `receivesOrders`), keeps logo + import countries + contact channels + addresses + reviews, always public, and is badged "Proxy" on the detail page.

Rationale: the field classifies presentation/behavior, not legal status; `BUSINESS` was too broad
because a proxy is also a business; naming the _role_ (retailer / person / proxy) rather than the
_category_ keeps the taxonomy extensible; and separating "seller type" from the "Tienda" entity
removes the Store-entity/section collision.

## Migration

Prisma cannot auto-detect enum-value or column renames (it would `DROP`+`CREATE` and lose rows),
so the change ships as a hand-written migration per `prisma-migration-workflow.mdc`:

```sql
ALTER TYPE "StoreType" RENAME VALUE 'BUSINESS' TO 'RETAILER';
ALTER TYPE "StoreType" ADD VALUE 'PROXY';
ALTER TYPE "StoreType" RENAME TO "SellerType";
ALTER TABLE "store" RENAME COLUMN "storeType" TO "sellerType";
```

Applied with `prisma migrate deploy` (not `migrate dev`), then `prisma generate`. Existing rows are
preserved in place — the former `BUSINESS` stores become `RETAILER` automatically.

## Consequences

- Behavior gating lives in the create action, the governance edit mutation, the shared `StoreForm`,
  and the `getStoreBySlug` payload assembly. Logo/contact/address exposure keys on
  `sellerType !== "PERSON"` (i.e. `RETAILER` and `PROXY`); catalog fields key on `sellerType !== "PROXY"`.
- The seller type stays **immutable** through edit / change-request flows (`BR-04-17`); disputes go
  through the report flow.
- Product docs and the glossary adopt the seller-type vocabulary; see FRD-04 (`FR-04-38` / `FR-04-39`,
  `AC-04-18` / `AC-04-19`), FDD-04 (form step 1 three-way choice, proxy gating, proxy badge), BP-01,
  and WO-08.
- Relates to [ADR 0009](0009-private-person-stores.md) (the `isPrivate` flag remains `PERSON`-only).
