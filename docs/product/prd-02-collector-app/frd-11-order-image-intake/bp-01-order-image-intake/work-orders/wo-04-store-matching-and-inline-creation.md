---
id: WO-04
type: WORK_ORDER
slug: store-matching-and-inline-creation
title: Store Matching, Disambiguation, and Inline Creation
status: ACTIVE
parent: BP-01
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-28
---

# WO-04 Store Matching, Disambiguation, and Inline Creation

## Summary

Make the store step disappear when the app can be certain, ask honestly when it cannot, and let a brand-new account register its first order without creating a store by hand first.

This is what makes the "No necesitas crear la tienda antes." promise on the selector card true.

## In Scope

- Promote the store-resolution pattern that today exists only as a script-local function inside `scripts/local/migrate-pedidos/chat-load.ts` into a shared data-layer helper under `src/lib/data/stores/`, reusing `normalizeStoreName` from `src/lib/store/duplicateMatch.ts`. Resolve `OQ-11-04` as part of this slice.
- Phone-number matching with normalisation, resolving `OQ-11-03` (whether the association lives on the existing store contact-channel records or in a dedicated table) before implementation begins.
- **Exact match**: the store step collapses to an attribute row showing the matched store, with a "Cambiar" link. No step, no selection, no confirmation.
- **Several candidates**: a disambiguator with **no preselection**, plus an explicit "Ninguna, crear una nueva" option. Preselecting invites blind acceptance and is forbidden.
- **No match**: inline store creation inside the review screen, with the name and phone prefilled from the extraction, without leaving the screen. The created store goes through the standard store-creation path so a non-admin creator produces a `PENDING` store exactly as the manual flow does.
- **Learning**: a confirmed or corrected phone-to-store association is remembered, so a later intake from the same number matches exactly instead of asking again.
- Duplicate protection: the inline creation must not bypass the duplicate detection that protects the store layer.
- Analytics for the three outcomes (exact match, disambiguation shown, inline creation), named per BP-01.

## Out of Scope

- Any change to store moderation, the store detail page, or the store listing.
- Changing the manual order form's store field.
- Editing an existing store from the review screen.

## Requirements

- `FR-11-59` through `FR-11-63`.
- Acceptance criterion `AC-11-19`.
- Open questions that must be closed before enrichment: `OQ-11-03`, `OQ-11-04`.
- Cross-FRD: the `Store` entity, the creation path, the `PENDING` default for non-admin creators, and duplicate prevention are owned by **FRD-04** ([`frd-04-store-domain.md`](../../../frd-04-store-domain/frd-04-store-domain.md)), specifically **FRD-04** · [BP-01 · WO-03 _store-creation-and-duplicate-prevention_](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-03-store-creation-and-duplicate-prevention.md) (`FR-04-06` through `FR-04-10`). A store created inline must be indistinguishable from one created through that flow.

## Blueprints

- [BP-01](../bp-01-order-image-intake.md): Architecture Decision 12, Risks (duplicate stores).

## E2E Acceptance Tests

- With exactly one store whose stored phone matches the extracted one, the review screen shows the store as an attribute row with "Cambiar" and no selection step.
- With several candidate stores, the disambiguator renders with nothing preselected, and the CTA cannot proceed until the user picks one.
- With no candidate, the inline creation card is offered prefilled; creating from it produces a store with the same moderation status and duplicate protection as the manual store-creation flow, and the user never leaves the review screen.
- After confirming a store for a given phone number, a second intake from the same number matches exactly and shows the attribute row.
- Correcting a wrong match through "Cambiar" updates the remembered association, so the next intake from that number matches the corrected store.
- A store name written differently across two chats resolves to the same store rather than creating a duplicate.

## Implementation Notes

- `src/lib/data/stores/storeMatchingQueries.ts`: `findStoreMatchesForIntake(userId, { name, phone })` promotes the `resolveStore` pattern from `chat-load.ts` (`OQ-11-04`) without editing the script. A store is `certain` on a single distinct match by phone, by name, or by both; `ambiguous` on two or more, ordered (phone-matched first, then a store the caller has ordered from before, then alphabetically, never preselected); `unknown` otherwise.
- Phone normalisation (`normalizePhoneDigits` / `phoneDigitsMatch`, same file): strips everything but digits, then compares the shorter digit string as a suffix of the longer one. No country calling-code catalog is assumed, so an optional international prefix on either side never blocks a match.
- `OQ-11-03` resolved: the association lives on the existing `StoreContactChannel` model (`PHONE`/`WHATSAPP` rows), matched against orderable stores only (the same catalog `getOrderableStores` exposes). No dedicated table was added.
- `src/lib/data/stores/storeMatchingMutations.ts`: `createStoreFromIntake` calls the existing `createStore` mutation (FRD-04 · WO-03) with `sellerType: "PERSON"` and `isPrivate: true` (the draft carries no seller-type signal yet, mirroring the script's default for an informal reseller) and status `PENDING` for a non-admin / `APPROVED` for an admin, exactly like the manual form. `recordConfirmedStoreMatch` implements the "Learning" requirement by adding a private `PHONE` channel to the store the user actively confirmed; it never edits another store.
- `src/app/[locale]/(app)/orders/_actions/imageIntakeStoreActions.ts`: `createStoreFromIntakeAction` guards inline creation with the same `findDuplicateCandidatesInCountry` check the manual store form shows before submit, satisfying "must not bypass duplicate protection" from `In Scope`; a `possible-duplicate` response must be re-submitted with `confirmDuplicate: true` to proceed. `confirmStoreMatchAction` records a "Cambiar" correction or an ambiguous pick.
- `src/app/[locale]/(app)/orders/new/image/_components/StoreResolutionSection.tsx` renders the three shapes from FDD §2.5 and owns all of the interaction state (which shape shows, an in-flight "Cambiar", the inline creation form); its public interface with `IntakeReviewScreen` stayed unchanged (`store` in, `storeId` out).
