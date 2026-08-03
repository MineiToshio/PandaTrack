---
id: WO-06
type: WORK_ORDER
slug: share-to-panda-share-target
title: "Compartir a Panda: Share Target and iOS Shortcut"
status: ACTIVE
parent: BP-01
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-29
---

# WO-06 Compartir a Panda: Share Target and iOS Shortcut

## Summary

Let the user share a screenshot straight from WhatsApp (or any app) into PandaTrack and land on "Revisa y confirma" with the extraction already running.

This is the single highest-value slice in the FRD by taps saved. The seven taps it removes are pure navigation that happens **outside** the app, where no internal optimisation can reach them. Without it, the feature ships with the exact flow it was meant to delete.

## In Scope

- **Android**: declare `share_target` in `src/app/manifest.ts` so PandaTrack appears in the share sheet for images (`POST`, `multipart/form-data`).
- **Route handler** at `src/app/api/orders/image-intake/share/route.ts`, following the precedent of `src/app/api/notifications/dispatch/route.ts`, receiving the multipart payload.
- **Hand-off to the client pipeline**: the service worker intercepts the share `POST`, stashes the file under a short-lived key, and redirects to the intake landing page, which reads the stash and runs the normal compress-and-upload path. This exists because Android posts the original, uncompressed file, which can breach the 4.5 MB request ceiling on its own. Close `OQ-11-05` against the shipped service worker before implementation begins.
- **Direct landing**: the app opens straight on the processing screen with upload and extraction already triggered, then on "Revisa y confirma". It must not land on a screen asking the user to confirm that they want to upload what they just shared.
- **Expired-session resume**: if the session is gone when the share arrives, the payload stays in the short-lived stash, the user is redirected to sign-in, and the flow resumes afterwards with the image intact. The `better-auth` session is already long-lived, so this is an infrequent edge, but losing the user's screenshot is not an acceptable failure.
- **iOS**: a documented Shortcut that uploads the image and posts to the same endpoint, with the one-time installation handled by an onboarding step. The absence of a native iOS share target is stated honestly to the user rather than hidden.
- **PWA install prompt** in onboarding, since the Android share target requires the PWA to be installed.
- The share path enforces the same validation, the same guards, and the same review screen as the in-app path.
- Analytics: share-target arrival, plus the standard `image_intake_submitted` / `image_intake_succeeded` events with the entry source recorded.

## Out of Scope

- Any change to the review screen itself (WO-02).
- Sharing text or URLs. Only images are accepted in this slice; text intake exists in the engine contract but has no share entry yet.
- The Buzón Panda (Telegram bot and email inbox), which is out of scope for the whole FRD.
- Web Push behaviour changes.

## Requirements

- `FR-11-64` through `FR-11-68`.
- `FR-11-19` (the request ceiling, which is what forces the hand-off design).
- Acceptance criteria `AC-11-22`, `AC-11-23`, `AC-11-24`.
- Open question that must be closed before enrichment: `OQ-11-05`.
- Cross-FRD: PWA installability and the service worker are owned by **FRD-09** ([`frd-09-reminders-and-notifications.md`](../../../frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md)); authentication and the session lifetime are owned by **FRD-01** ([`frd-01-account-access-and-recovery.md`](../../../frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md)).

## Blueprints

- [BP-01](../bp-01-order-image-intake.md): Architecture Decisions 7, 8, 9, Runtime Components (Server), Risks (Vercel request ceiling, iOS coverage).

## E2E Acceptance Tests

- With the PWA installed on Android, PandaTrack appears in the share sheet for an image; sharing lands directly on the processing screen with extraction already running and then on "Revisa y confirma", for four taps in total.
- Sharing a large uncompressed screenshot succeeds: the file is compressed on the client before the upload and the request stays under the ceiling.
- Sharing with an expired session redirects to sign-in and, after signing in, resumes on the processing screen with the shared image intact.
- The documented iOS Shortcut posts to the same endpoint and reaches the same review screen with the same result.
- A share that fails validation shows PandaTrack's own readable error, not a raw platform error.
- The share path consumes quota and writes a ledger row exactly like the in-app path, with the entry source distinguishable in the ledger.

## Implementation Notes

- **The route handler lives under `/api`, not at a root `/share-target` path.** `SHARE_TARGET_ACTION_PATH` (`src/lib/pwa/shareStash.ts`) resolves to `/api/orders/image-intake/share`. A root-level static segment would collide with the `[locale]` segment that owns every other path in the app, so the manifest's `share_target.action` and the route handler at `src/app/api/orders/image-intake/share/route.ts` both point at the `/api` path instead.
- **The route handler is a fallback, not the normal path.** The share POST is meant to be answered by the service worker (`public/sw.js`), which intercepts it before it reaches the network. The route handler only runs when no worker is controlling the request (not installed, or mid-update); its one job is turning what would otherwise be a raw platform 404 into a redirect to the intake screen with a readable error, and it deliberately never reads the request body.
- **The stash is Cache Storage, not `sessionStorage` or memory.** The worker answers the POST and a different document (after the redirect) reads it, and the payload is binary, so `src/lib/pwa/shareStash.ts` writes the shared files into a dedicated Cache Storage bucket (`panda-share-stash`) plus a JSON index, and every constant is mirrored as a literal in `public/sw.js` (plain JS, served as a static asset, cannot import the module); `shareStash.test.ts` fails if the two sides drift.
- **The stash TTL is 5 minutes, not the originally proposed longer window.** `SHARE_STASH_TTL_MS` covers a slow device finishing the immediate redirect, not a detour through sign-in: a stash older than the current session's start is refused on pickup regardless of TTL (see the next point), so a long TTL bought nothing except letting an abandoned share sit in Cache Storage longer.
- **Expired-session resume works differently than `OQ-11-05`'s original proposal.** A stash written _before_ the current session started is refused (`identity-changed`), not resumed, because a worker cannot read the session cookie and so cannot attribute a stash to a signer: on a shared device, resuming across a sign-in would let the next person who signs in pick up screenshots that were never theirs. The user experience is the same "attach again" prompt either way, but `AC-11-23`'s "resumes with the shared image intact" is only true within one already-authenticated session, not across an expired-session detour.
- **Analytics**: `image_intake_share_target_received` (`POSTHOG_EVENTS.IMAGE_INTAKE.SHARE_TARGET_RECEIVED`) and `image_intake_share_resumed_after_auth` fire from the intake screen on pickup; the entry source travels through `IMAGE_INTAKE_ENTRY_SOURCE_FIELD` into `ImageIntakeUsage.entrySource` (`IN_APP` / `SHARE`).
- **The stash has a proactive sweep on top of the reactive ones.** Every existing clear path (pickup, the intake screen's own mount-time sweep, a new share overwriting the bucket, sign-out, a hand-off failure) depends on something happening afterwards. A share where the browser is killed, the JS bundle fails to load, or the app is closed mid-redirect reaches none of them, so the file would otherwise sit in Cache Storage on disk with nothing scheduled to reclaim it. Two lifecycle-driven sweeps close that gap: `public/sw.js` drops an expired stash on its own `activate` (fresh install and every version bump, independent of any document loading), and `registerServiceWorker` (`src/lib/pwa/registerServiceWorker.ts`) kicks off `sweepExpiredShareStash` on every app start regardless of which screen the user lands on. `periodicSync` was considered and deliberately not used: it needs a separate, revocable permission grant, has no guaranteed interval, and is not implemented in Safari, so it would add real complexity on top of two sweeps that already cover the gap.
