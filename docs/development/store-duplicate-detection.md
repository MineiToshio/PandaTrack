# Store duplicate detection (create-store flow)

This document describes how similar-store detection works during store creation: the **blur** flow (suggestions when leaving the name field) and the **submit** flow (confirmation modal before creating when similar stores exist in the same country).

## Purpose

- Help the user avoid creating duplicate stores by showing existing stores with similar names.
- Blur: lightweight suggestions by name only, inline under the input.
- Submit: strict check by name + country and a minimum similarity threshold; if matches exist, a modal asks the user to confirm or cancel.

## Flow overview

| Moment     | Trigger                    | Data used                | Threshold / filter                     | UI                                         |
| ---------- | -------------------------- | ------------------------ | -------------------------------------- | ------------------------------------------ |
| **Blur**   | Name input loses focus     | Name only                | Any score &gt; 0, top 5, all countries | Inline box under name input                |
| **Submit** | User clicks "Create store" | Name + country from form | Same country, similarity ≥ 70%, top 5  | Modal overlay; "Create anyway" or "Cancel" |

## 1. Blur flow (name suggestions)

**When:** The user leaves the store-name input (blur).

**Steps:**

1. `CreateStoreForm` → `handleNameBlur()` calls `fetchCandidates(nameValue)`.
2. If the trimmed name has fewer than 2 characters (`MIN_QUERY_LENGTH`), candidates are cleared and no request is made.
3. Server action `getDuplicateCandidates(nameQuery)` is called → `findDuplicateCandidates(prisma, nameQuery, limit)`.
4. **Query:** All stores are considered (no country filter). For each store, `getDuplicateMatchScore(query, store.name)` is computed. Stores with score &gt; 0 are kept, sorted by score (desc), then by normalized name; top 5 are returned.
5. Results are stored in `duplicateCandidates` state. If there are candidates, PostHog event `store_duplicate_suggestions_shown` is sent.
6. **UI:** If `duplicateCandidates.length > 0` and the confirm modal is not open (`!showConfirmDuplicate`), an inline box is rendered under the name input with title "Stores with similar names", short description, and `DuplicateCandidatesList` (each item links to the store profile in a new tab). Changing the name input clears `duplicateCandidates`.

**Entry points:**

- Component: `src/app/[locale]/(app)/stores/new/_components/CreateStoreForm.tsx` (`handleNameBlur`, `fetchCandidates`, inline `duplicate-suggestions` block).
- Server action: `src/app/[locale]/(app)/stores/new/_actions/getDuplicateCandidates.ts` → `getDuplicateCandidates`.
- Query: `src/queries/store.ts` → `findDuplicateCandidates`.
- Scoring: `src/lib/store/duplicateMatch.ts` → `getDuplicateMatchScore`, `normalizeStoreName`.

**Constants:** `MIN_QUERY_LENGTH = 2` (CreateStoreForm). `DEFAULT_LIMIT = 5` (getDuplicateCandidates).

## 2. Submit flow (same-country similar names)

**When:** The user submits the create-store form (clicks "Create store").

**Steps:**

1. `handleFormSubmit` → `handleSubmit(formData)`. Name and `countryCode` are read from form data.
2. Server action `getDuplicateCandidatesForSubmit(nameQuery, countryCode)` is called → `findDuplicateCandidatesInCountry(prisma, nameQuery, countryCode, limit, SIMILARITY_THRESHOLD_PERCENT)`.
3. **Query:** Only stores with `countryCode` equal to the form’s country are fetched. For each, `getSimilarityPercent(query, store.name)` is computed (0–100). Stores with similarity ≥ `SIMILARITY_THRESHOLD_PERCENT` (70) are kept, sorted by similarity (desc), then by normalized name; top 5 are returned.
4. If the result list is not empty:
   - That list is set as `duplicateCandidates`, `showConfirmDuplicate` is set to `true`, and `formData` is stored in `pendingFormDataRef`.
   - PostHog event `store_duplicate_submit_modal_shown` is sent (with `candidate_count`, `name_query`, `country_code`).
   - The function returns without calling `formAction`; the form is not submitted yet.
5. If the result list is empty, `formAction(formData)` is called and the store is created (subject to normal validation).
6. **Modal UI:** When `showConfirmDuplicate` is true, a modal is shown (overlay + centered dialog). It displays:
   - Title and description including the similarity threshold (e.g. "at least 70% similarity").
   - `DuplicateCandidatesList` for the submit candidates (same country).
   - Buttons: "Create anyway" and "Cancel".
7. **Create anyway:** `handleConfirmCreateAnyway()` runs `formAction(pendingFormDataRef.current)` and closes the modal.
8. **Cancel:** `handleCancelDuplicateConfirm()` closes the modal and clears `pendingFormDataRef`; no submit.

**Entry points:**

- Component: `CreateStoreForm.tsx` (`handleSubmit`, `handleConfirmCreateAnyway`, `handleCancelDuplicateConfirm`, modal block).
- Server action: `getDuplicateCandidates.ts` → `getDuplicateCandidatesForSubmit`.
- Query: `store.ts` → `findDuplicateCandidatesInCountry`.
- Scoring / threshold: `duplicateMatch.ts` → `getSimilarityPercent`, `SIMILARITY_THRESHOLD_PERCENT` (70).

**Constants:** `SIMILARITY_THRESHOLD_PERCENT = 70` in `src/lib/store/duplicateMatch.ts`. Same-country filter and this threshold ensure we only warn when there are similar stores in the **selected country**; same name in different countries does not trigger the modal.

## Similarity scoring

- **Raw score:** `getDuplicateMatchScore(query, candidateName)` in `duplicateMatch.ts` uses:
  - Normalized names (lowercase, trim, collapse spaces, strip diacritics).
  - Exact match bonus (400), substring bonus (150) only when the contained string has length ≥ 2 (avoids matching a store named "l" when the query is "lang-en"), token overlap (40 per token, +120 if all query tokens match), and generic-term rules (e.g. "store" alone does not match everything).
- **Percentage:** `getSimilarityPercent(query, candidateName)` maps that score to 0–100 (score / 500 capped at 100). Used only for the submit flow and the 70% threshold.
- **Threshold:** Submit flow uses `SIMILARITY_THRESHOLD_PERCENT = 70`. To change when the modal appears, change this constant and the copy in i18n (`duplicate.submitModalDescription` with `{percent}`).

## i18n keys

- **Blur (inline):** `stores.duplicate.suggestionsTitle`, `stores.duplicate.suggestionsDescription`.
- **Submit (modal):** `stores.duplicate.submitModalTitle`, `stores.duplicate.submitModalDescription` (with `{percent}`), `stores.duplicate.confirmCreate`, `stores.duplicate.cancel`.

## Analytics

- Blur: `POSTHOG_EVENTS.STORE.DUPLICATE_SUGGESTIONS_SHOWN` when the inline suggestions are shown (`candidate_count`, `name_query`).
- Submit: `POSTHOG_EVENTS.STORE.DUPLICATE_SUBMIT_MODAL_SHOWN` when the modal is shown (`candidate_count`, `name_query`, `country_code`).

## Summary

- **Blur:** Name-only suggestions, all countries, any positive score, top 5, inline under the name field.
- **Submit:** Name + country; only stores in the same country with name similarity ≥ 70%; top 5; modal to confirm or cancel; "Create anyway" submits the form, "Cancel" closes without creating.
