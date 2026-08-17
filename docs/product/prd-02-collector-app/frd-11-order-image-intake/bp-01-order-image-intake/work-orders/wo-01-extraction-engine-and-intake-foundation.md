---
id: WO-01
type: WORK_ORDER
slug: extraction-engine-and-intake-foundation
title: Extraction Engine and Intake Foundation
status: ACTIVE
parent: BP-01
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-30
---

# WO-01 Extraction Engine and Intake Foundation

## Summary

Build everything the image-intake feature needs that is not a screen: the AI extraction adapter and its prompt, the extracted-draft contract with per-field provenance, the deterministic breakdown and price-split engine, the client image pipeline, the server-side upload validator, and the spend guards with their usage ledger.

This is the **foundation slice**. It ships no UI, no route, and no page. It is validated with unit tests only, and it is explicitly exempt from the "must include an E2E acceptance path" rule for that reason.

It is justified as a foundation because WO-02, WO-06, and WO-07 all consume the same engine, the same draft contract, the same image pipeline, and the same ledger.

## In Scope

### Extraction engine

- Provider SDK dependency and client for **Gemini 3.1 Flash-Lite**, called through the paid tier (Cloud Billing), with the reasoning level pinned to minimum and structured JSON output bound to the draft schema.
- `extract(images, context) => ImageIntakeDraft` boundary in `src/lib/imageIntake/extractionEngine.ts`. Callers never see provider types. Every failure mode is a typed `ExtractionOutcome`, including `ledger-error`: if settling a successful extraction's real cost fails, `extract` rejects and the draft is never returned to the caller, so a draft is never handed out without its cost durably recorded (fail closed, not just at the pre-call budget check).
- System prompt with the Peruvian collector glossary (`cancelado`, `adelanto` / `a cuenta`, `35 c/u`, `pack chase`, `separo` / `apartado`), the breakdown-rule instructions, the currency rule, the relative-date rule, and the explicit instruction to return `null` rather than fill a field. The prompt is a static constant that interpolates only Zod-validated `baseCurrency`, `now`, and `locale`; text read from a source image is treated as data, never as an instruction (prompt-injection boundary), and the model's raw response is validated with a strict Zod schema that rejects unknown properties.
- **Addition, delivered after the slice**: extraction also suggests a catalog category per product and captures a product's reference link (`FR-11-90` through `FR-11-96`). The prompt's dynamic values now include the live active catalog as `key: label` pairs, validated by the same Zod context schema (keys against the catalog key shape, labels flattened to a single line and truncated), so the allowed set is never hardcoded. `suggestedProductTypeKey` and `referenceUrl` join the draft contract as plain nullable product fields with a default of `null`, so a model that omits either one costs the collector nothing; the reference link is validated by parsing, accepting only `http` and `https` and refusing every other scheme. `withValidatedSuggestedCategories` (`src/lib/imageIntake/suggestedCategory.ts`) drops any suggestion the live active catalog does not back, which is what keeps a single invented key from making the order write refuse the whole purchase. The Gemini response schema declares both fields as nullable strings rather than as a dynamic `enum`: see the note in `geminiProvider.ts` for why, and for how to adopt the enum once the accepted shape can be verified against the real API.
- Environment variables added to `.env.example`: `GEMINI_API_KEY`, `IMAGE_INTAKE_PAID_TIER_CONFIRMED` (the engine refuses to run unless this is exactly `"true"`, forcing explicit confirmation that the key's project has Cloud Billing enabled), `IMAGE_INTAKE_MODEL_ID` (default `gemini-3.1-flash-lite`), `IMAGE_INTAKE_SPEND_ALERT_USD` (default 4), `IMAGE_INTAKE_SPEND_HARD_STOP_USD` (default 5), and `IMAGE_INTAKE_ALERT_EMAIL` (optional).

### Draft contract

- Zod schema in `src/lib/imageIntake/draftSchema.ts` implementing the shape documented in BP-01 Contracts, including the `Field<T> = { value, source: "read" | "assumed" | null }` provenance wrapper. `delivery` ships as the minimal owner-confirmed shape `{ expectedFrom: Field<ISODate>, expectedTo: Field<ISODate>, cost: Field<MinorUnits> } | null` (`OQ-11-08`); it still needs revalidation against **FRD-08** before WO-02 is enriched.
- **Amount, currency, and provenance contract with the model** (`FR-11-24a`, `FR-11-24b`, `FR-11-31a`, `BR-11-23`). The draft stores amounts as integer ×100 minor units, but the model answers in the currency's major unit exactly as the image writes it, so `parseImageIntakeModelResponse` is the single boundary that converts (`majorAmountToMinorUnits`, `src/lib/money/`) and it is the only function allowed to turn a provider response into a draft; `parseImageIntakeDraft` keeps parsing the already-converted draft the review screen posts back. The same boundary normalises the currency and drops a symbol answer to "not read" rather than letting it invalidate a correct reading. The Gemini response schema declares every amount as `NUMBER` (never `INTEGER`, which would ask the model to round or convert) and offers `read` as the only `source`, so a model-emitted `assumed` is structurally impossible. The prompt carries the matching sections: "Amounts", "How a group reports the price it read" (the divided-lot convention the breakdown engine depends on, which the prompt previously never stated), "Every value you report carries its provenance", and the ISO-code rule in "Currency".
- **Diagnostics for a rejected response** (`FR-11-24c`). When the strict parse refuses a provider answer, `extract` reports it to Sentry with `feature: imageIntake` / `action: invalidModelResponse` and the sanitized issue list (path plus schema message; `parseImageIntakeDraft` already replaces the one Zod message that would echo model-written key names with a count). Without it the failure is unreconstructable: the images are discarded by design and the response body is never stored.
- Mapping helper (`src/lib/imageIntake/mapDraftToOrderCreate.ts`) from a confirmed draft to `orderCreateSchema` / `orderPaymentCreateSchema` inputs. The mapper is built here; it is called from WO-02. `delivery.cost` has no counterpart in `orderCreateSchema` and is intentionally left unmapped by this helper, since it belongs to the separate delivery creation call WO-02's review screen makes after the order exists.

### Deterministic breakdown engine

- `src/lib/imageIntake/breakdown.ts`: quantity normalisation to 1, closed-range expansion guard, the 200-product ceiling with an explicit stop (never silent truncation), and price distribution (explicit unit price as-is; lot total by integer division with the remainder to the first products; no price means all null).
- **Divided-lot convention.** `extractedProductSchema` has no separate "lot total" field, so for a `divided-lot` group the prompt instructs the model to write the group's total on the first non-null `unitPrice` in source order and leave the rest `null` (the prompt shipped without that instruction and it was added later, with the amount contract); `breakdown.ts` reads the first non-null `unitPrice` as the lot total (tolerating a model that repeats the total on every product instead of just the first) and distributes it with integer division, remainder to the first products.
- Zero-decimal currency handling (`CLP`, `JPY`, `KRW`): distribute on the major unit before multiplying by 100. The same currencies are why the model reports the amount as written instead of converting: it knows JPY has no subunit, so a model asked for minor units answers `1200` for ¥1,200 and the order lands as ¥12.
- Invariant: the order total is never modified by the split.

### Client image pipeline

- `src/lib/images/compressForIntake.ts`: WebP `q0.85` with JPEG `q0.90` fallback, cap `1080x2400`, never upscale, never downscale below native width, split screenshots taller than `2400px` with 10% overlap, and always return the re-encoded output, never the original file, flagging `recompressedLarger` (informational only) when recompression does not reduce the byte size.
- `src/lib/images/canvasEncoding.ts`: real encoder-support detection (`encodeCanvasToBlob` returns `{ blob, mimeType }`, verifying the encoder's actual output type rather than trusting the requested one).
- **Fix the pre-existing production bug** in `src/lib/images/getProcessedImageBlob.ts`, which called `canvas.toBlob(cb, "image/webp")` without checking support and silently returned a PNG on Safari (iPhone and Mac), so avatars and store logos were stored as PNGs with a `.webp` extension. Fixed: `getProcessedImageBlob` now returns `{ blob, mimeType }` (real detected type, WebP or JPEG fallback) instead of a bare blob. Its only caller, `StoreLogoField` (`src/app/[locale]/(app)/stores/_components/share/StoreLogoField/StoreLogoField.tsx`), was updated to derive the upload extension from the returned `mimeType` instead of assuming `.webp`.

### Server-side validation and limits

- `src/lib/imageIntake/validateUpload.ts` using `sharp.metadata()`, against the prepared upload it receives (never the attached source, see `FR-11-17c`): 1 to 20 images, 2 MB per file, 3.5 MB total, real type from header bytes, dimensions between `200x200` and `4000x8000`, decodability, and an explicit `empty-submission` code for a zero-image submission. Validate and measure only, never re-encode.
- `src/lib/imageIntake/clientPrecheck.ts`: two pure, client-safe prechecks (no `sharp`, no server-only API), reusing the subset of `validateUpload.ts`'s error codes each can detect without decoding. It exists for WO-02's earliest-possible feedback and is not a security boundary; the server always re-validates.
  - `precheckAttachedPhotos`, run on the photos as attached: image **count** only (`empty-submission`, `too-many-images`). Byte size is deliberately absent, per `FR-11-17c`.
  - `precheckPreparedSegments`, run on the segments preparation produced: count plus per-file and total byte size (`file-too-large`, `submission-too-large`). Segments are what gets uploaded, and one tall screenshot can become several of them.
- Lower `experimental.serverActions.bodySizeLimit` in `next.config.ts` from `6mb` to `4mb`.
- Do not put `image/heic` in any file input `accept` attribute (documented constraint consumed by WO-02).

### Spend guards and ledger

- Prisma model `ImageIntakeUsage` (reservation-then-settlement ledger; `ImageIntakeUsageStatus` gained `PENDING`) with the fields listed in BP-01, plus the migrations (`20260729023335_create_image_intake_usage_ledger` and `20260729025957_add_image_intake_pending_status`). `userId` is duplicated onto the row per `data-layer-user-id-duplication.mdc`.
- `src/lib/data/imageIntake/imageIntakeMutations.ts` (`reserveImageIntakeUsage` / `settleImageIntakeUsage`, per ADR 0015) plus `spendGuard.ts`, which builds the ledger-backed `SpendGuard` the extraction engine's contract requires. There is no separate `imageIntakeQueries.ts`: its reads now live inside the mutation transactions.
- **Reserve, then settle, under a lock.** `assertCanSpend` (called `spendGuard.assertCanSpend()`) writes a `PENDING` row with an estimated cost (image count × ~1,120 input tokens plus ~500 output tokens) inside a transaction that first takes a Postgres advisory lock on the billing period, checking the hard stop and the 1-request/10-second rate limit against every prior row regardless of status (`PENDING` and `FAILED` rows count exactly like `SUCCEEDED` ones, closing the TOCTOU race where concurrent requests could each read the same under-budget total and all pass). `recordUsage` / `recordFailure` settle that same row to `SUCCEEDED` or `FAILED` with the real tokens and cost, exactly one update per row, so the ledger is no longer strictly append-only. The alert-threshold crossing is evaluated at settlement, under the same lock. A `PENDING` row that is never settled (a killed process) keeps counting at its estimate forever, which is the safe direction for a liability ceiling.
- Global monthly spend cut-off driven by environment variables: alert at USD 4, hard stop at USD 5. Crossing the alert threshold sends an email to the administrator through Resend (`IMAGE_INTAKE_ALERT_EMAIL`, optional; unset means the crossing is only logged). An in-app admin notification is deferred: the existing `src/lib/notifications/` pipeline is per-collector and preference-gated, with no concept of an admin-targeted broadcast, and adding one is out of this slice's scope. The hard stop fails closed: an unreadable ledger throws a `budget-blocked` refusal rather than being treated as under budget, and the same fail-closed rule covers settlement itself (see the `ledger-error` outcome above): a failed successful-settlement rejects the extraction rather than hand out an unrecorded charge.
- Per-request ceilings, a 1 request / 10 s rate limit, a 30 s timeout with at most one retry on transport errors only.
- Zero image retention: buffers are processed in memory and discarded.

## Out of Scope

- Any UI, page, route, or component, including "shared" components.
- The user-facing photo bag, the passive counter, the overflow interruption, the exhausted state, `ImageIntakePeriod`, and `User.aiMonthlyPhotoLimit` (all WO-07).
- The share-target route handler (WO-06).
- The review screen and the save action (WO-02).
- Split and merge on the review screen's draft (WO-03).
- Store matching (WO-04).

## Requirements

- `FR-11-13`, `FR-11-14`, `FR-11-15`, `FR-11-16`: client image pipeline.
- `FR-11-17`, `FR-11-18`, `FR-11-19`: server validation and request ceilings.
- `FR-11-20`, `FR-11-21`, `FR-11-22`: engine, paid tier, zero retention.
- `FR-11-23`, `FR-11-24`, `FR-11-25`, `FR-11-26`, `FR-11-28`: draft contract, provenance, glossary, dates, audio.
- `FR-11-29`, `FR-11-31`, `FR-11-32`: currency rule inside the contract (the "ask the user first" gate in `FR-11-30` is WO-02).
- `FR-11-33` through `FR-11-44`: the breakdown rule and price distribution.
- `FR-11-81`, `FR-11-82`, `FR-11-83`, `FR-11-84`, `FR-11-85`, `FR-11-86`, `FR-11-87`: spend guards.
- Business rules `BR-11-02`, `BR-11-03`, `BR-11-04`, `BR-11-05`, `BR-11-11`, `BR-11-12`, `BR-11-13`, `BR-11-14`.
- Decisions: [ADR 0020](../../../../../design/decisions/0020-ai-extraction-provider-and-privacy-posture.md) and [ADR 0021](../../../../../design/decisions/0021-no-autosave-and-product-breakdown-rule.md).

## Blueprints

- [BP-01](../bp-01-order-image-intake.md): Runtime Components (Client, Server, Persistence), Architecture Decisions 1, 2, 3, 5, 6, Contracts (extracted draft, engine boundary, quota boundary).

## Acceptance Tests

This slice ships no UI, so it is validated by unit and integration tests instead of an E2E path.

- Breakdown: "del 42 al 46" yields 5 products of quantity 1; "del 42 en adelante" yields 1 doubtful product; "Pack Tokyo Revengers 1 y 2 sellado" yields 1; "el pack chase de Gojo" yields 2; "pack de 5 chibis sorpresa" yields 1.
- Price split: 10000 across 3 yields 3334, 3333, 3333 and sums exactly; 23700 across 5 yields 4740 each; a zero-decimal currency produces amounts the order validator accepts; a source with no price yields all-null unit prices.
- Ceiling: a draft implying 240 products stops with the ceiling outcome and produces no truncated list.
- Provenance: a source with no stated currency returns the base currency with `source: "assumed"`; a source stating "USD" returns `USD` with `source: "read"`.
- Pipeline: a `1080x2400` input keeps its native width; a `1080x4800` input yields two segments with overlap; an input narrower than `1080px` is not upscaled; a low-colour PNG that grows on recompression still returns the re-encoded output, flagged `recompressedLarger`, never the original.
- Encoder detection: with WebP encoding unavailable, the pipeline returns a JPEG and never a PNG mislabelled as WebP.
- Validation: a file whose header bytes do not match an accepted type is rejected regardless of its declared MIME type; an empty submission is rejected with `empty-submission`; `clientPrecheck.ts` flags the same count/size codes as the server before a single byte uploads.
- Spend guards: with the ledger over the hard stop, `extract` refuses before any provider call; two concurrent submissions cannot both read the same under-budget total and both pass; a failed but billable request still moves the ceiling and the rate limit; a transport error retries at most once; a non-transport error does not retry; a failed settlement of a successful extraction rejects with `ledger-error` rather than returning the draft.
- Ledger: a submission reserves one `PENDING` row with an estimated cost before the provider call, and a successful extraction settles that same row to `SUCCEEDED` with the real model, tokens, and integer micro-dollar cost.
- Config guard: `next.config.ts` caps the Server Action `bodySizeLimit` at exactly `4mb`, and `.env.example` documents every image intake env var with no `NEXT_PUBLIC_` Gemini variable.
- Response-schema guard: the Gemini response schema uses only keywords verified against the live endpoint (`type`, `properties`, `items`, `required`, `enum`, `nullable`, `format`), checked recursively over the whole tree. Anything else is rejected by the API with an opaque `400` that kills every extraction, so this is a CI guard, not a style rule. Because every provider test uses a double and can never see a contract mismatch, the guard is paired with an opt-in live smoke test (`npm run smoke-image-intake`) that sends a few real requests built from the production request config, prompt, and model id. The guard also pins the amount type (`NUMBER`, never `INTEGER`) and the single-value `source` enum, and the smoke test asserts the figures that come back against synthetic receipts with known amounts, naming a hundred-times error as a scale violation. Run it by hand whenever the schema, the request config, the prompt, the draft contract, or the model changes.
- Provider failure classification: a `5xx`, a timeout, and a network failure stay retryable and keep the copy that offers a retry; a `4xx` maps to its own non-retryable code with copy that does not promise one, is countable under its own `failure_code`, and reaches Sentry sanitized, carrying no provider-supplied text (`FR-11-87a`).

## Analytics

Analytics for this slice are limited to the ledger and to `image_intake_global_budget_blocked` (`FR-11-88`), because there is no user-visible action yet. The remaining events are introduced by the slices that own their actions.
