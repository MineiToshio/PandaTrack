---
id: WO-03
type: WORK_ORDER
slug: profile-basics-username-name-and-avatar
title: Profile Basics: Username, Name, and Avatar
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-14
implementation_status: IMPLEMENTED
---

# WO-03 Profile Basics: Username, Name, and Avatar

## Summary

Implement the `Profile` section of settings for username editing, display-name editing, and profile-image management using the agreed validation and upload patterns.

This slice must keep `username`, `display name`, and `avatar` as separate save flows while ensuring successful profile changes are reflected immediately in both settings UI and the shell identity surface without a full page refresh.

## In Scope

- username field with helper rules text
- inline format validation and availability state with debounce-backed availability checks
- dedicated username save flow
- display-name editing with reserved-name and blocked-token validation
- profile-image display, hover affordance, replace/remove flow, and crop-confirm reuse
- profile-image persistence to `user-images`
- immediate client-side refresh of avatar and username across settings and shell identity surfaces after successful saves

## Out of Scope

- account email changes
- password changes or password setup
- country/currency/product-type preferences
- budget controls

## Requirements

- `FR-07-04` through `FR-07-13`
- `FR-07-33`
- `BR-07-02`
- `BR-07-09` through `BR-07-12`
- `BR-07-18`

## Blueprints

- `BP-01` username-edit contract
- `BP-01` avatar contract

## Assumptions

- `WO-01` lands first so username persistence, normalization, and reserved-name contracts already exist before this slice ships.
- `WO-02` provides the shared shell identity surface that consumes the updated username and avatar values from this slice.
- `display name` is not a unique identifier and remains independent from username and email.
- Removing an avatar always returns the user to the username-initial fallback, even when the previous effective image came from Google.
- Google-provided avatar removal is allowed in MVP and simply clears `User.image`.

## UX Notes

- The `Profile` section exposes three independent save flows:
  - username save flow
  - display-name save flow
  - avatar upload/replace/remove flow (upload and replace persist when the user confirms in the crop modal; there is no separate “save photo” control after cropping)
- Username field helper text should state the 7-day change limit up front so users understand the rule before editing.
- Display name and username: validation and save/server errors render **below** the input (never above the label). For username, order under the control is: **live feedback** (checking, available, format/taken hints) **first**, then **submit-only or server errors** (for example rate limit, unauthorized, generic save failure) **second**, then the save button — see `docs/design/interface-patterns.md` — _Success vs. Error Feedback Placement_. Avoid a second muted line that repeats the rate-limit story when the save already failed; one clear error message is enough.
- Username format validation should run immediately while the user types.
- Username availability should run only after the value is format-valid, using the existing shared debounce pattern when available, or a `300 ms` debounce otherwise.
- Username save must revalidate format, blocked-token rules, and uniqueness on the server even if client-side feedback already passed.
- Display name should remain a single free-form field that allows spaces and normal person-name punctuation without splitting into separate first-name/last-name inputs.
- Successful username changes must update the visible shell identity label immediately in the same client session without a full page refresh.
- Successful avatar uploads, replacements, and removals must update both the settings preview and the shell identity avatar immediately in the same client session without a full page refresh.
- Avatar remove should remain a first-class action even when the current effective image originated from Google.
- Removing a profile photo requires an explicit confirmation in a modal (copy explains the effect and that the exact image cannot be restored; a new upload remains possible). There is no second remove control outside the avatar field.
- **Success feedback uses toast notifications.** When a save completes successfully (username saved, display name saved, avatar uploaded, avatar removed), a transient toast appears confirming the action. Validation errors and field-level errors remain inline next to the field. This separation keeps the form clean and avoids layout shifts from success copy appearing inside the form body. See `docs/design/interface-patterns.md` — _Toast Notifications_.

## Technical Notes

- Reuse the existing store-logo crop-and-confirm pipeline as much as possible instead of creating a second bespoke image flow.
- If the current crop and processing helpers live in store-scoped folders, extract the reusable parts into shared modules before wiring avatar uploads.
- Avatar uploads follow the same accepted image-type and crop-confirm interaction pattern as store logos, but use a source-file limit of up to `10 MB`.
- The persisted Cloudflare R2 object key for a user-managed avatar must be `user-images/{userId}.webp`.
- `User.image` remains the effective avatar URL:
  - provider-hosted URLs may be the initial value
  - after a successful upload or replacement, it points to the R2 asset URL
  - after a successful remove, it becomes `null`
- Replacing an avatar should overwrite the current effective asset rather than creating versioned per-upload keys in MVP.
- Client-side shell refresh should update only the affected identity UI state and must not rely on a full page reload.

## Security Notes

- Enforce a server-side rate limit of **one successful username change per user per seven days**, aligned with `BR-07-18` and `FR-07-33`, rejecting additional attempts before persistence and without relying on client-only checks.
- Username validation must enforce the existing username format contract, reserved-name list, PandaTrack brand protections, blocked-token filtering, and case-insensitive uniqueness at save time.
- Display-name validation must apply `trim`, a maximum length of `50` characters, and the same reserved-name, PandaTrack brand, and blocked-token protections used for username, while remaining more permissive about spaces and punctuation.
- Display-name filtering must avoid broad substring false positives and should operate on normalized explicit tokens the same way username filtering does.
- Avatar management must not accept remote URL input or act on arbitrary storage keys; it operates only on the authenticated user's effective avatar state.
- Avatar remove must clear `User.image` regardless of whether the prior image was provider-hosted or user-uploaded.

## Observability Notes

- Capture unexpected failures during username save, display-name save, avatar upload/replace, and avatar remove with Sentry.
- If avatar removal clears `User.image` successfully but R2 object deletion fails, keep the visible avatar state removed, report the storage cleanup failure to Sentry, and treat the orphaned object as follow-up operational cleanup rather than reverting the user-facing change.
- If avatar upload or replacement fails after the user confirms crop, keep the previously effective avatar unchanged and return a recoverable error state in the UI.

## Dependencies

- username persistence and validation contracts from `WO-01`
- shell identity refresh surface from `WO-02`
- Better Auth user hydration for initial `name` and `image`
- shared image-processing and crop-confirm pattern currently used by store logos

## Testing Notes

- Prove the username change rate limit: a second successful change within seven days is rejected with a clear error.
- Add coverage for username format feedback, debounce-backed availability checks, and server-side revalidation on save.
- Add coverage for display-name validation, including trim behavior, maximum length, reserved-name rejection, PandaTrack brand rejection, and blocked-token rejection.
- Prove that a successful username save updates the visible shell identity label without a full page refresh.
- Prove that successful avatar upload, replacement, and removal update both the settings preview and the shell identity avatar without a full page refresh.
- Prove that removing a provider-hosted avatar clears `User.image` and falls back to the username initial.
- Prove that removing a user-uploaded avatar clears `User.image`, attempts R2 cleanup, and still falls back to the username initial even if storage deletion fails.
- Prove that a failed avatar upload or replacement keeps the previous effective avatar intact.

## E2E Acceptance Tests

- User can update display name successfully.
- Username field shows invalid-state feedback for malformed input.
- Username field shows taken-state feedback when another user already owns the same normalized value.
- User can upload, crop and confirm (persisting immediately), replace, and remove a profile image using the shared image flow.
- Successful username changes are reflected immediately in the shell identity surface without a full page refresh.
- Successful avatar uploads and replacements are reflected immediately in both settings and the shell identity surface without a full page refresh.
- Removing a Google-provided avatar falls back to the username initial.
- Removing a user-uploaded avatar falls back to the username initial even when R2 cleanup fails.
- A second username change within seven days of a successful change is blocked with a clear error (`AC-07-13`).
