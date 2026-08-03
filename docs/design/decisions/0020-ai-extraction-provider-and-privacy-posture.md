---
title: ADR 0020 - AI extraction provider, single-pass policy, and privacy posture
date: 2026-07-28
status: accepted
session: order image intake product definition (2026-07-28)
owner: Sergio Minei
trigger: owner-approved feature "Crear desde imagen" introduces the first use of an AI model anywhere in the PandaTrack stack, with one shared API key and no per-user keys
updates: docs/product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md, docs/product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/bp-01-order-image-intake.md, docs/product/prd-02-collector-app/prd-02-collector-app.md, docs/product/glossary.md, docs/product/prd-01-public-landing/frd-04-public-legal-transparency/frd-04-public-legal-transparency.md
---

# ADR 0020 - AI extraction provider, single-pass policy, and privacy posture

## Context

"Crear desde imagen" ([FRD-11](../../product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md)) is the first feature in PandaTrack that calls an AI model. It converts a screenshot (a WhatsApp or Messenger chat, a store email, a web page, a photo of a receipt) into an order draft.

Three constraints shape the decision:

1. **One shared key, no per-user keys.** The owner pays the API bill personally, the app is free, and the monthly spend ceiling for the whole feature is USD 2. A retry loop over five images can outspend a whole month in seconds.
2. **The workload is small and boring.** Reading a screenshot and returning a ten-field JSON object is not a hard reasoning task. At the expected volume (10 to 40 orders a month, two or three photos each) every viable model costs between USD 0.00 and USD 0.10 a month, so price does not decide anything. What decides is accuracy on a compressed WhatsApp screenshot, and how much the model hallucinates when it cannot read a number.
3. **The images contain other people's personal data.** Names, phone numbers, and amounts belonging to sellers who never agreed to anything.

Models evaluated in July 2026: Gemini 3.1 Flash-Lite, Gemini 2.5 Flash-Lite, Claude Haiku 4.5, Qwen3-VL-Flash, GPT-5.6 (Luna / Terra / Sol), GPT-5.4 nano / mini, Claude Fable 5 / Mythos 5, GLM-4.6V-Flash, DeepSeek V4 Flash.

## Decision

**Production engine: Gemini 3.1 Flash-Lite**, called through the **paid tier via Cloud Billing**, in a **single pass**, with the **reasoning level pinned to minimum**, behind a provider-agnostic adapter with exactly one implementation.

Supporting rules that are part of this decision:

- **Never the free AI Studio tier.** On the free tier prompts may be used to train Google's products, and this feature sends private conversations containing third parties' names, phone numbers, and amounts. Avoiding it costs less than a dollar a month. This is a privacy red line, not a cost decision.
- **Single pass, no automatic escalation.** The system never falls back to a more expensive model when confidence is low. Low confidence is surfaced to the user on the review screen instead.
- **Pin the reasoning level to minimum.** Gemini 3 ships with reasoning set high by default and those tokens bill as output. Left unconfigured, a typical two-photo extraction triples from USD 0.0014 to USD 0.0037. This one-line setting is worth more than any quota. The real parameter, verified against the installed `@google/genai` v2 SDK, is `thinkingConfig.thinkingLevel` set to the `ThinkingLevel.MINIMAL` enum member, not the lowercase string literal shown in some prose docs; the legacy `thinkingBudget` field is not used.
- **Zero image retention on PandaTrack's side.** Source images are processed in memory and discarded. Only the extracted JSON is persisted, and only after the user confirms it. Nothing is written to Postgres, to object storage (R2/S3), to disk, to logs, or to monitoring. Client-side canvas processing additionally strips EXIF, including GPS coordinates, so location data never leaves the device. This is absolute **for our own systems**: the client always uploads its own re-encoded output, never the original file, even when re-encoding does not shrink it below the original's byte size, because only the re-encoded output is guaranteed EXIF-free; falling back to the original for a byte-size win would reopen the GPS leak this rule exists to close.
  - **The provider side is not zero retention, and must never be described as such.** Verified 2026-07-29 against Google's official [logs policy](https://ai.google.dev/gemini-api/docs/logs-policy) and [ZDR](https://ai.google.dev/gemini-api/docs/zdr) docs. On the paid tier Google does not use prompts or responses to improve its products (no training), and human review happens only if the project owner opts into sharing datasets for model improvement, which PandaTrack does not. But Google **does** log prompts and responses for a limited period for abuse detection and legal compliance: default retention up to **55 days**, configurable by the project owner to 7, 14, 28, or 55 days from AI Studio. A separate Zero Data Retention option exists but requires requesting approval, and even under it abuse-detection logs are kept for 30 days. Any user-facing or internal statement about this feature must keep the two sides distinct: PandaTrack stores no image; Google keeps a short-lived abuse-detection log.
  - **Recommended configuration:** lower the project's retention window from the 55-day default to **7 days** in AI Studio. It is a one-time setting on the owner's Google Cloud project, costs nothing, and shrinks the only window in which a third party's chat screenshot exists outside the user's device by roughly eight times. Until it is applied, the privacy policy states the 55-day maximum, which is the honest figure for the default.
- **Hard spend guards ship with the engine, not later**: a global monthly cut-off by environment variable (alert USD 4, hard stop USD 5), an independent Google Cloud budget as a second net, per-request size ceilings, a 1 request / 10 s rate limit, and a 30 s timeout with at most one retry on transport errors only. The cut-off is enforced as a reservation: before the provider call, an estimated cost is written as a `PENDING` ledger row inside a transaction holding a Postgres advisory lock on the billing period, checked against the hard stop and the rate limit together with every prior row regardless of status, so a failed but billable request still moves the ceiling and the rate limit, and two concurrent requests can no longer both read the same under-budget total. The call settles that same row to `SUCCEEDED` or `FAILED` with the real tokens and cost under the same lock, and the alert-threshold crossing is evaluated at settlement. Crossing the alert threshold sends an email to the administrator through Resend (`IMAGE_INTAKE_ALERT_EMAIL`, optional); an in-app admin notification is deferred, because the existing notification pipeline is per-collector and preference-gated, with no concept of an admin-targeted broadcast. The hard stop fails closed: an unreadable spend ledger is treated as over budget, never as under it. The same posture extends to settlement itself: if recording a successful extraction's real cost fails, the extraction is rejected and the draft is never handed to the caller, rather than risk an unrecorded charge.
- **The paid tier is enforced, not just documented.** `IMAGE_INTAKE_PAID_TIER_CONFIRMED` must be set to `"true"` before the engine will run at all; this is explicit human confirmation that the key's Google Cloud project has Cloud Billing enabled, so a free-tier key can never process third-party images by accident.
- **Images are data, never instructions.** Text recovered from a source image (a chat screenshot, a receipt, an email) is treated purely as content to summarize. The system prompt is a static constant that interpolates only three Zod-validated values (`baseCurrency`, `now`, `locale`); no string read from an image, and no string typed by a user, is ever interpolated into a prompt or executed. The model's output is validated against a strict Zod schema that rejects unknown properties.
- **The model reports readings, the server does the arithmetic.** Every figure the model returns is the figure as the image shows it, never a computed one, and this is a contract with three parts.
  - **Amounts travel in the currency's major unit, exactly as written** ("S/ 59.90" comes back as `59.90`, decimals included), and the server scales them into the uniform ×100 minor units the money domain stores (`majorAmountToMinorUnits`, applied once in `parseImageIntakeModelResponse`). The alternative, asking the model for minor units, was rejected: it makes every extraction depend on the model multiplying silently and correctly, it is wrong by construction for the zero-decimal currencies (a model that knows JPY has no subunit answers `1200` for ¥1,200, and `1200` minor units is ¥12), and both mistakes produce a valid non-negative integer that no schema and no reviewer can tell from a correct one. A wrong amount that looks normal is the one failure this feature must not have, so the multiplication belongs where it cannot go wrong. The response schema declares every amount as `NUMBER`, never `INTEGER`, for the same reason: an integer field is an instruction to round or to convert.
  - **Currency travels as the ISO 4217 three-letter code**, and a symbol is never the answer. When the model answers with the symbol anyway ("S/" is what a Peruvian chat shows), the server drops it to "no currency read" instead of rejecting the draft, so the collector's base currency is assumed and marked as a guess on the review screen. Discarding a correct reading of the store, the products, and the payments over the currency field, while still spending the photo, is never the better trade.
  - **Provenance is a pair with no third case**: `value` and `source` are both filled or both null, and `"assumed"` describes a value the SERVER filled in by convention, so it is removed from the response schema's `source` enum. The model has nothing to assume; it answers null for anything the images do not show.
- **Plan B is Claude Haiku 4.5** (about USD 0.10 a month), swappable behind the adapter without touching callers. **Qwen3-VL-Flash** is validated free in parallel because it ranks first in Peruvian Spanish on IberBench, but it is not the production engine.

## Alternatives considered

1. **Gemini 2.5 Flash-Lite** (the obvious cheap candidate, about USD 0.01 a month, 85.3% documented accuracy on receipts per Fraunhofer)

- Pros: cheapest, native vision, native structured JSON, strong published accuracy.
- Cons: announced for shutdown on 16 October 2026, with `gemini-3.1-flash-lite` named as its official replacement.
- Why not chosen: building on it would be technical debt from day one.

2. **Claude Haiku 4.5**

- Pros: native vision, mature structured output, no payment friction from Peru, no deprecation.
- Cons: roughly three times the cost of the winner at our volume.
- Why not chosen: kept as plan B. Nothing about it is wrong; it simply costs more for the same job.

3. **Qwen3-VL-Flash**

- Pros: effectively free, ranked first in Peruvian Spanish on IberBench, native vision.
- Cons: weaker structured-output guarantees, payment from Peru not confirmed.
- Why not chosen: not dependable enough as the production path yet. It is validated in parallel at zero cost, and if it wins on the owner's real chats this ADR must be revisited rather than quietly changed.

4. **GPT-5.6 family, Claude Fable 5 / Mythos 5**

- Pros: more capable.
- Cons: 4 to 30 times the price for a task that does not use the extra capability.
- Why not chosen: newer models are more **capable**, not cheaper. For reading a screenshot into ten fields, paying thirty times more buys capacity we do not use.

5. **GPT-5.4 nano / mini**

- Pros: cheap, no payment friction.
- Cons: 54 to 58% accuracy on noisy receipts per Fraunhofer.
- Why not chosen: compressed WhatsApp screenshots are exactly the noisy case.

6. **GLM-4.6V-Flash**

- Pros: free.
- Cons: self-published benchmark only, limited structured output, requires payment without 3DS which risks rejection of Peruvian cards.
- Why not chosen: unverifiable quality plus a payment risk.

7. **DeepSeek V4 Flash**

- Pros: cheap, good structured output.
- Cons: text only, no vision.
- Why not chosen: fails the hard requirement.

8. **Per-user API keys instead of one shared key**

- Pros: perfect cost attribution, no shared liability.
- Cons: unacceptable onboarding friction for a free consumer app.
- Why not chosen: rejected for the current product stage. The usage ledger is shaped per user and per period, so this remains possible later if PandaTrack monetises.

## Consequences

### Positive

- Cost is bounded three ways: by model choice, by hard guards, and by a per-user photo quota, with every realistic scenario landing under USD 0.10 a month against a USD 2 ceiling.
- The provider adapter makes the plan B and the free challenger swappable without touching callers.
- The privacy posture (paid tier, no retention on our side, EXIF stripped, provider named and its real retention window disclosed) is decided once, before the first line of AI code, rather than retrofitted.
- The usage ledger records model, tokens, and real cost per submission, so the 60-day review compares assumptions against reality instead of guesses.

### Negative / tradeoffs

- The choice is not backed by a benchmark of informal WhatsApp Spanish, because none exists. It is confirmed with the owner's real chats during implementation (`OQ-11-02`).
- Pinning to a single small model means genuinely hard screenshots will fail rather than be retried on something stronger. That is deliberate: the review screen catches it, and the user completes by hand.
- A new SDK dependency enters the project; none existed before.
- Gemini billing requires a card through Cloud Billing, which is a small operational friction from Peru.

## Rollout notes

- **Verified 2026-07-28 against Google's official documentation and rate card.** The `@google/genai` v2 SDK's `thinkingConfig.thinkingLevel` (enum `ThinkingLevel.MINIMAL`) is the real reasoning-level parameter; the legacy `thinkingBudget` is not used. The model id `gemini-3.1-flash-lite` is confirmed stable. Paid-tier pricing is confirmed at USD 0.25 per million input tokens and USD 1.50 per million output tokens, matching the figures already used in FRD-11's cost context.
- New environment variables (provider key, paid-tier confirmation flag, model id, alert and cut-off thresholds, alert email) must be added to `.env.example` per `env-example.mdc`: `GEMINI_API_KEY`, `IMAGE_INTAKE_PAID_TIER_CONFIRMED`, `IMAGE_INTAKE_MODEL_ID`, `IMAGE_INTAKE_SPEND_ALERT_USD`, `IMAGE_INTAKE_SPEND_HARD_STOP_USD`, `IMAGE_INTAKE_ALERT_EMAIL`.
- The global cut-off ships in the foundation work order ([WO-01](../../product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/work-orders/wo-01-extraction-engine-and-intake-foundation.md)), not with the user-facing quota, because a shared key with no ceiling must never reach a real user.
- Infrastructure note: PandaTrack runs on Vercel Hobby, which forbids commercial use (charging, advertising, and even donations count). Today it qualifies. Monetisation, not traffic, is what would force a migration to Pro.
- Monitoring: the ledger plus `image_intake_global_budget_blocked` and `image_intake_succeeded` (with the real cost) are the signals to watch. A provider `4xx` is reported to Sentry as a sanitized `GEMINI_REQUEST_REJECTED` (never the SDK's own error, whose message serializes the provider's response body): it means the API refused what we build, so it repeats on every request until the code changes, and it must not wait for a user to report it.
- **Response-schema keyword subset (verified 2026-07-30 against the live endpoint).** `generateContent` accepts only a subset of the OpenAPI schema vocabulary, and a keyword outside it is neither ignored nor reported per field: the endpoint rejects the whole request with an opaque `HTTP 400 INVALID_ARGUMENT` ("Request contains an invalid argument"). The verified subset in use is `type`, `properties`, `items`, `required`, `enum`, `nullable`, `format`. `maxItems` is **rejected**, as a number and as the SDK's decimal-string form alike, and it shipped once on the three array branches of `IMAGE_INTAKE_RESPONSE_SCHEMA`, breaking 100% of extractions. The bounds that protect the system live in the Zod contract (`draftSchema.ts`), which rejects an oversized list after the fact; the schema declaration was only a token-level hint. Note that the SDK's `Schema` type is far wider than what the endpoint accepts, so a keyword type-checking is no evidence at all.
- **Contract verification, of the request AND of the data.** Every provider test uses a double by design, so `npm run test` never calls the API and is structurally blind to a contract mismatch. Two things close that gap: a static guard (`src/test/image-intake-response-schema-guard.test.ts`) that fails in CI on any keyword outside the verified allowlist, on any amount declared as `INTEGER`, and on any `source` enum offering more than `read`; and an opt-in live smoke test (`npm run smoke-image-intake`, `scripts/local/smoke-image-intake.ts`) that sends a few real requests built from the production `buildRequestConfig`, prompt, and model id. The smoke test asserts the FIGURES, not only the shape: it renders synthetic receipts with known amounts and fails loudly when a returned amount is exactly a hundred times off, which is the shape of the unit bug and is invisible to every schema. It costs a few cents and must be run by hand whenever `IMAGE_INTAKE_RESPONSE_SCHEMA`, `buildRequestConfig`, the prompt, the draft contract, or the model id changes.
- **Amount, currency, and provenance contract verified 2026-07-30 against the live endpoint.** With the prompt stating the unit and the ISO rule, `gemini-3.1-flash-lite` returned `59.90` for "Total: S/ 59.90" (stored as `5990`), `30.00` for the deposit (`3000`), `12.50` for shipping (`1250`), `PEN` as a read currency, `1200` for "Total: 1200 JPY" (`120000`, still a whole major amount), and coherent nulls with no provenance for a note that is not a purchase. Before the prompt stated the ISO rule the same model answered `"S/"` and the entire draft was rejected as `INVALID_CURRENCY_CODE`, which reaches the collector as "no entendimos lo que había en las fotos"; before it stated the unit, the same model answered `59` for the same image.
- **A rejected model response is reported.** When the strict draft parse refuses a provider answer, the extraction engine reports it to Sentry (`feature: imageIntake`, `action: invalidModelResponse`) with the sanitized issue list (path plus schema message, never model-written content). This is the one failure nothing else can reconstruct: the images are discarded by design and the response body is never stored, so without the report the only evidence is a collector saying the app did not understand their photos.
- **Public disclosure (2026-07-29).** The privacy policy carries a dedicated "Fotos y procesamiento con IA" / "Photos and AI processing" section that names Google and the Gemini API, states the paid tier and the no-training guarantee, discloses Google's limited abuse-detection log, describes the EXIF/GPS stripping and the 5-minute share-target cache, and tells the third parties who appear in a screenshot how to request deletion. The terms carry an "AI features" section covering fallibility, mandatory user review, and usage limits. If the provider, the tier, or the retention window changes, both documents and their `lastUpdated` line must change in the same release ([FRD-04](../../product/prd-01-public-landing/frd-04-public-legal-transparency/frd-04-public-legal-transparency.md), `BR-04-06`).

## References

- [FRD-11 Order Image Intake](../../product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md)
- [BP-01 Order Image Intake System](../../product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/bp-01-order-image-intake.md)
- [ADR 0021 - Never auto-save extracted data, and the product breakdown rule](0021-no-autosave-and-product-breakdown-rule.md)
