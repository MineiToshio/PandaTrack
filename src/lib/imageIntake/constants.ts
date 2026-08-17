/**
 * Shared constants for the order image intake domain: client image pipeline, server upload
 * validation, and the draft/breakdown contracts. Centralised here so the client compression step
 * and the server validator can never silently drift from each other's limits.
 */

/** One submission is a single order's worth of source photos, not a bulk-import tool. */
export const MAX_IMAGES_PER_SUBMISSION = 20;

/**
 * Per-file ceiling on the PREPARED upload, enforced again server-side against tampering.
 *
 * It is not a limit on the photo a collector attaches, and must never be applied to one. The source
 * is deliberately unbounded in bytes: preparation normalises it to `INTAKE_TARGET_MAX_WIDTH` and
 * re-encodes it, which is what decides the size of the upload, and a full-resolution phone
 * screenshot (routinely several megabytes, and nothing its owner can change) comes out of that step
 * an order of magnitude smaller. Checking this against the source refused the single most ordinary
 * input this feature has, before the step that would have made it fit ever ran.
 */
export const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Whole-submission ceiling on the PREPARED upload, on the same terms as `MAX_IMAGE_FILE_BYTES`.
 * Kept under Vercel's 4 MB Server Action body limit (itself lowered from 6 MB, see
 * `next.config.ts`) so a maxed-out photo count never produces a raw 413 with no readable error.
 */
export const MAX_SUBMISSION_TOTAL_BYTES = 3.5 * 1024 * 1024;

/** Below this, the source is more likely a thumbnail or an icon than a legible receipt. */
export const MIN_IMAGE_DIMENSION = 200;

/** Upper bound on decoded width; guards `sharp.metadata()` against a decompression-bomb file. */
export const MAX_IMAGE_WIDTH = 4000;

/** Upper bound on decoded height; tall chat screenshots stay well under this. */
export const MAX_IMAGE_HEIGHT = 8000;

/**
 * Ceiling on products a single extraction may produce. Above this the draft stops with an
 * explicit "ceiling exceeded" outcome instead of a silently truncated list.
 */
export const MAX_PRODUCTS_PER_ORDER = 200;

/**
 * Ceiling on groups in one draft. A group is the phrase a set of products was read from, and the
 * smallest useful group carries one product, so a draft can never need more groups than the
 * product ceiling allows products.
 */
export const MAX_GROUPS_PER_ORDER = MAX_PRODUCTS_PER_ORDER;

/** Ceiling on products inside one group: a single phrase may legitimately account for the whole order. */
export const MAX_PRODUCTS_PER_GROUP = MAX_PRODUCTS_PER_ORDER;

/**
 * How far past the product ceiling a draft may still be parsed before the schema rejects it.
 *
 * Rejecting at exactly the ceiling would be self-defeating: a source listing more products than an
 * order can hold is a case the user is meant to see explained, with the real count quoted back to
 * them so they can decide how to split the purchase, and a draft rejected at parse time carries no
 * count to quote. Parsing a bounded overshoot keeps that explanation reachable while still refusing
 * the unbounded lists that would turn one accepted draft into unbounded database work.
 */
export const MAX_PARSEABLE_PRODUCTS_PER_DRAFT = MAX_PRODUCTS_PER_ORDER * 2;

/**
 * Ceiling on payments in one draft. A real pre-order is a deposit plus instalments; sixty covers
 * five years of monthly instalments on one order, which is far beyond anything a collector tracks
 * in practice. The bound exists because the save path opens one write per payment, so an unbounded
 * list turns a single accepted draft into an unbounded amount of database work.
 */
export const MAX_PAYMENTS_PER_ORDER = 60;

/**
 * Ceiling on warnings in one draft. There are only a handful of warning codes and the deterministic
 * breakdown adds at most one per group, so this is a structural bound against a repeated-warning
 * flood rather than a product limit.
 */
export const MAX_INTAKE_WARNINGS = MAX_GROUPS_PER_ORDER + 10;

/**
 * Ceiling on store disambiguation candidates. The server replaces this list with its own matches
 * before the draft reaches the review screen, so anything the model puts here is untrusted filler
 * that only needs a sane bound.
 */
export const MAX_STORE_CANDIDATES = 20;

/**
 * Ceiling on a suggested category key. Mirrors the bound `orderItemRowSchema.productTypeKey`
 * already enforces on the write side, so a suggestion can never be longer than the column it would
 * eventually land in. Catalog membership is a separate, server-side check: see
 * `withValidatedSuggestedCategories`.
 */
export const MAX_PRODUCT_TYPE_KEY_LENGTH = 64;

/**
 * Ceiling on a reference link captured from a source image. 2048 characters is the conservative
 * limit browsers, proxies, and access logs have long agreed on for a URL, so anything longer is far
 * more likely a mis-read wall of text than a link somebody actually sent in a chat.
 */
export const MAX_REFERENCE_URL_LENGTH = 2048;

/**
 * Ceiling on catalog categories interpolated into one extraction prompt. The catalog is read live
 * and grows with every admin approval, so the prompt needs a bound of its own: input tokens are
 * billed per request, and an unbounded list would let the catalog's size decide what a request costs.
 */
export const MAX_PROMPT_PRODUCT_CATEGORIES = 200;

/** Ceiling on one category label inside the prompt. A longer label is truncated, never rejected. */
export const MAX_PROMPT_CATEGORY_LABEL_LENGTH = 80;

/**
 * Hard ceiling on the output tokens one extraction request may bill, set on the request itself and
 * reused as the reservation's worst-case output estimate.
 *
 * Budget for the worst realistic draft this feature accepts, 200 products (`MAX_PRODUCTS_PER_ORDER`)
 * in the most expensive arrangement, one product per group:
 *
 * - product object: a name up to ~120 characters (~40 tokens) plus keys, price, and punctuation
 *   (~12 tokens) is ~52 tokens.
 * - group wrapper: a verbatim source phrase up to ~160 characters (~55 tokens) plus the three
 *   enum/boolean fields and structure (~25 tokens) is ~80 tokens.
 * - 200 groups of one product each: 200 x (80 + 52) = 26,400 tokens.
 * - a full payments list at `MAX_PAYMENTS_PER_ORDER`: 60 x ~35 = 2,100 tokens.
 * - header fields (store, candidates, currency, order date, total, delivery, warnings): ~600 tokens.
 *
 * That is ~29,100 tokens, rounded up to 32,000 for margin. The provider counts reasoning tokens
 * against this same ceiling, which the pinned minimal reasoning level keeps negligible.
 *
 * At the published output rate this ceiling caps one request's output charge at roughly five cents,
 * which is what makes the global spend cut-off a real ceiling: without it, a single pathological
 * image could bill orders of magnitude more than any reservation held against it.
 */
export const IMAGE_INTAKE_MAX_OUTPUT_TOKENS = 32_000;

/**
 * Billable attempts one collector may start in a calendar day (UTC), counting every ledger row of
 * the day whatever its outcome.
 *
 * Distinct from `DAILY_PHOTO_CAP` on purpose. Photos are a product allowance and a provider failure
 * gives them back, because a failure the collector did not cause must not cost them anything. But a
 * request that failed was still sent, and may still have been billed, so an attempt that returns
 * its photos must still consume something, otherwise a deterministic failure is free to repeat
 * forever and can drain the shared global ceiling for the whole product.
 *
 * Three times the daily photo cap: a collector who spends their whole daily photo allowance one
 * photo at a time uses ten attempts and still has twenty left for legitimate retries after provider
 * failures, while the abuse loop is cut by more than two orders of magnitude.
 */
export const DAILY_ATTEMPT_CAP = 30;

/** MIME types accepted from the client upload surface and the share-target route. */
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Target max width for the compressed image the extraction engine actually receives. */
export const INTAKE_TARGET_MAX_WIDTH = 1080;

/**
 * Target max height per segment. A source taller than this is split into overlapping segments
 * rather than downscaled, so small text in a long chat screenshot stays legible.
 */
export const INTAKE_TARGET_MAX_HEIGHT = 2400;

/** WebP encode quality when the browser's canvas encoder supports WebP output. */
export const INTAKE_WEBP_QUALITY = 0.85;

/**
 * Encode qualities the preparation step may fall back to, in order, when a submission prepared at
 * `INTAKE_WEBP_QUALITY` does not fit in one request.
 *
 * The alternative to this ladder is refusing the submission outright, so the comparison to make is
 * not "0.85 versus 0.78" but "0.78 versus not being read at all". It exists because the single-pass
 * contract (`FR-11-20`) leaves no other way out: the images are read as ONE conversation, so a
 * submission that does not fit cannot be split across requests without splitting the conversation
 * with it, which is a different and worse product.
 *
 * Only quality moves. Dimensions never do, at any rung, because downscaling degrades text
 * recognition between 7 and 16 times more than compression does (`FR-11-14`) and text is the whole
 * point of the read.
 *
 * The floor is measured, not guessed. On a 1080px chat screenshot the ladder buys almost nothing
 * (79 KB at 0.85, 61 KB at 0.70) because flat text regions hold few bits to give up; on a
 * photographic product page it buys a third (310 KB to 197 KB). The bits therefore come out of
 * gradients and photography, which is not what the model is reading, and stay in the text, which is.
 * That asymmetry is what makes the floor safe, and it is also why the ladder is short: below 0.70
 * there is little left to win and ringing starts appearing around glyphs.
 */
export const INTAKE_WEBP_QUALITY_LADDER = [INTAKE_WEBP_QUALITY, 0.78, 0.7] as const;

/** JPEG encode quality fallback when WebP encoding is unavailable (see canvasEncoding.ts). */
export const INTAKE_JPEG_QUALITY = 0.9;

/** Overlap between consecutive segments of a split screenshot, so no line of text is cut in half. */
export const INTAKE_SEGMENT_OVERLAP_RATIO = 0.1;

/**
 * Photos a collector may spend on AI reading per calendar month, before any per-user override.
 * The bag is an abuse ceiling, not a savings lever: what protects the budget is the global spend
 * cut-off and the per-request limits, so this number is set where it stops burst abuse without
 * ever being the thing a normal collector notices.
 *
 * Pasted text costs nothing and the manual form is always unlimited; only photos spend the bag.
 */
export const DEFAULT_MONTHLY_PHOTO_QUOTA = 20;

/** Anti-burst guard on top of the monthly bag: photos a collector may spend in one calendar day (UTC). */
export const DAILY_PHOTO_CAP = 10;

/**
 * Ceiling on the per-user override an administrator may grant, so a typo in the console cannot
 * hand out an effectively infinite bag. Lives here, next to the other quota figures, rather than
 * in the mutation module: the override form validates against it on the client too.
 */
export const MAX_MONTHLY_PHOTO_LIMIT_OVERRIDE = 1000;
