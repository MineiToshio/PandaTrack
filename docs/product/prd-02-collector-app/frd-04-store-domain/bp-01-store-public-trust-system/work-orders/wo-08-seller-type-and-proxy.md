---
id: WO-08
type: WORK_ORDER
slug: seller-type-and-proxy
title: Seller Type Rename and Proxy Type
status: ACTIVE
parent: BP-01
source_issue: 123
last_updated: 2026-07-22
implementation_status: IMPLEMENTED
---

# WO-08 Seller Type Rename and Proxy Type

## Summary

Rename the store classification field and generalize it to three seller types. `Store.storeType`
becomes `Store.sellerType`; `enum StoreType` becomes `enum SellerType`; value `BUSINESS` becomes
`RETAILER`; and a new `PROXY` value is added. This disambiguates the classification from the
"Tienda" (`Store`) entity/section and names the seller's role rather than its legal category. A
`PROXY` is a forwarding/intermediary service (e.g. ZenMarket) that buys on a collector's behalf
and is not a direct seller. See ADR 0016 and BP-01.

## In Scope

- Prisma schema rename + hand-written enum migration (`ALTER TYPE … RENAME VALUE 'BUSINESS' TO 'RETAILER'`, `ADD VALUE 'PROXY'`, `RENAME TO "SellerType"`, `ALTER TABLE "store" RENAME COLUMN "storeType" TO "sellerType"`), preserving existing rows.
- Data layer (`storeQueries`, `storeMutations`, `storeGovernanceQueries`, `storeGovernanceMutations`), Zod schemas, create/edit server actions, and the shared `StoreForm` steps updated to `sellerType` / `SellerType`.
- Store create/edit form step 1 reworked into a clean three-way choice (Comercio / Persona / Proxy) with one-line helpers.
- PROXY behavior gating: no product types, null `hasStock` / `receivesOrders`; keeps logo, import countries, contact channels, addresses, reviews; always public.
- Public detail: PROXY renders its logo (like a retailer) and shows a "Proxy" badge near the name.
- i18n labels (es Comercio / Persona / Proxy; en Retailer / Individual / Proxy), form helper copy, and the proxy badge string.

## Out of Scope

- Assigning existing stores to `PROXY` (data curation; the owner sets ZenMarket to `PROXY` separately after the migration).
- Any change to moderation, governance, reviews, or ordering flows beyond the field rename.

## Requirements

- `FR-04-02`: Three seller types on `Store.sellerType` (`RETAILER`, `PERSON`, `PROXY`).
- `FR-04-38`: PROXY has no catalog; the form hides product types and stock / pre-order controls and the write paths normalize them away.
- `FR-04-39`: PROXY renders its logo and shows a "Proxy" badge; keeps import countries, contacts, addresses, reviews.

Relevant business rules:

- `BR-04-17`: `sellerType` and country are immutable through edit / change-request flows; seller-type disputes go through the report flow.

Relevant acceptance signals:

- `AC-04-18`: Proxy store saves with no catalog and keeps contact info.
- `AC-04-19`: Proxy store detail shows its logo and a "Proxy" badge, no catalog/stock sections.
- Existing `BUSINESS` rows migrate to `RETAILER` in place with no data loss.

## Notes

- Prisma cannot auto-detect enum/column renames, so the migration uses the hand-written-SQL fallback of `prisma-migration-workflow.mdc` (`prisma migrate deploy`, then `prisma generate`).
- GitHub tracking: this work order needs a corresponding sub-issue under BP-01 (`source_issue: 123`); create it and keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`.
