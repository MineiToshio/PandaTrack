import {
  ApiError,
  FinishReason,
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type GenerateContentConfig,
  type Schema,
} from "@google/genai";
import { IMAGE_INTAKE_MAX_OUTPUT_TOKENS } from "./constants";
import { countPartialResponseShape } from "./diagnostics";
import { buildSystemPrompt } from "./prompt";
import {
  HTTP_SERVER_ERROR_STATUS_MIN,
  ProviderRequestError,
  ProviderTransportError,
  type ExtractionContext,
  type ExtractionProvider,
  type ImagePart,
  type ProviderRequestOptions,
  type ProviderResponse,
  type ProviderUsage,
} from "./extractionEngine";

/** Default production model; overridable per ADR 0020's plan-B swap-out path. */
const DEFAULT_MODEL_ID = "gemini-3.1-flash-lite";

/**
 * Minimum reasoning level, per ADR 0020: unpinned, this model triples output token cost. The
 * installed `@google/genai` v2.13.0 types this field as the `ThinkingLevel` enum (values in
 * upper snake case, matching Google API enum convention), not the lowercase string literal
 * sometimes shown in prose docs, so the enum member is used here to stay type-correct against the
 * real SDK surface.
 */
const THINKING_LEVEL_MINIMAL = ThinkingLevel.MINIMAL;

/**
 * Node/undici syscall codes that mean the request never reached a responding server. Classified
 * by code rather than by message text: the SDK's `ApiError` message serializes the server's own
 * error body, which can contain words like "network" lifted from content the model read out of a
 * source image, so a message-substring test would let an attacker turn a non-retryable 4xx into a
 * retried (and double-billed) request.
 */
const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
]);

/**
 * The two 4xx statuses that are NOT a defect of ours.
 *
 * Everything else in the 4xx range means the API refused what we sent and will refuse it
 * identically forever, which is why a 4xx is normally non-retryable and is reported to the
 * collector as something only a code change can fix. These two are the opposite: `429` is the
 * provider's own rate limit or a momentarily exhausted quota, and `408` is a request the provider
 * itself gave up on. Both describe this instant rather than this request, both clear on their own,
 * and a retry is exactly the right response to them.
 *
 * Classifying them as permanent was wrong twice over: it burned the submission on the first refusal
 * instead of retrying it, and it told the collector that retrying could not help and that we had
 * been notified of a bug that does not exist.
 */
const RETRYABLE_CLIENT_ERROR_STATUSES = new Set([408, 429]);

/**
 * The model id this provider will actually call. Exported because the caller needs the same id
 * before the call happens: the spend ledger's reservation row is written against it, and a second,
 * independently resolved copy in the caller would silently mis-attribute spend the moment
 * `IMAGE_INTAKE_MODEL_ID` or the default changes.
 */
export function resolveImageIntakeModelId(): string {
  return process.env.IMAGE_INTAKE_MODEL_ID ?? DEFAULT_MODEL_ID;
}

/**
 * `source` offers "read" alone, while the draft contract's own `Field<T>` also allows "assumed".
 * The asymmetry is the point: "assumed" describes a value this SERVER filled in by convention
 * (`withResolvedCurrency` marks the collector's base currency that way), and the model has no such
 * value to report, since it is told to answer null for anything the images do not show. Leaving
 * "assumed" in the enum would let a hallucinated provenance render an invented amount as a normal
 * reading on the review screen, so it is removed from the response schema and the case becomes
 * structurally impossible rather than merely forbidden by the prompt.
 */
const FIELD_SOURCE_VALUES = ["read"];

/**
 * Every amount is declared as a plain NUMBER, never an INTEGER, and that is the whole amount unit
 * contract on the wire: the model reports the amount exactly as the image shows it, in the
 * currency's major unit, decimals included ("S/ 59.90" is `59.9`), and the server scales it into
 * minor units in `parseImageIntakeModelResponse`. INTEGER here would force the model to round or to
 * multiply, and either one produces a valid-looking number nobody can audit afterwards.
 */
const AMOUNT_TYPE = Type.NUMBER;

/**
 * The Gemini `Schema` mirror of `imageIntakeDraftSchema` (`draftSchema.ts`). Hand-written rather
 * than derived, because the two representations (Zod, OpenAPI-subset `Schema`) are structurally
 * different enough that a generic converter would need its own test surface for one call site.
 * Keep this in lockstep with `draftSchema.ts` by hand; a mismatch fails loudly as a schema
 * validation rejection in `extractionEngine.ts`, never as a silent data loss.
 *
 * Only the keyword subset this endpoint actually accepts may appear anywhere in this tree: `type`,
 * `properties`, `items`, `required`, `enum`, `nullable`, `format`. Anything outside it is rejected
 * with an opaque HTTP 400 that names no field, so a single stray keyword breaks every extraction,
 * not the branch that carries it. `maxItems` is the one this feature already paid for: it was
 * declared on the three array branches as a token-level optimisation (asking the model to stop
 * before writing a list Zod would reject anyway) and it made 100% of requests fail. It must not
 * come back, as a number or as the SDK's decimal string. The bounds that actually protect us live
 * in `draftSchema.ts`, which rejects an oversized list after the fact; losing an optimisation hint
 * costs tokens, losing the request costs the whole feature. Enforced by
 * `src/test/image-intake-response-schema-guard.test.ts` and verified end to end against the live
 * API by `npm run smoke-image-intake`.
 */
const fieldSchema = (innerType: Type, innerFormat?: string): Schema => ({
  type: Type.OBJECT,
  properties: {
    value: { type: innerType, format: innerFormat, nullable: true },
    source: { type: Type.STRING, enum: FIELD_SOURCE_VALUES, nullable: true },
  },
  required: ["value", "source"],
});

const storeCandidateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    storeId: { type: Type.STRING },
    name: { type: Type.STRING },
  },
  required: ["storeId", "name"],
};

const storeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    matchedStoreId: { type: Type.STRING, nullable: true },
    name: fieldSchema(Type.STRING),
    phone: fieldSchema(Type.STRING),
    candidates: { type: Type.ARRAY, items: storeCandidateSchema },
  },
  required: ["matchedStoreId", "name", "phone", "candidates"],
};

/**
 * `suggestedProductTypeKey` is declared as a plain nullable string rather than as an `enum` of the
 * live catalog keys, and that is a decision rather than an omission.
 *
 * An enum would be strictly better on paper: the model could not emit a key the catalog does not
 * have. But it would have to be built per request (the catalog is read live), and a nullable enum is
 * not verifiably supported by the OpenAPI subset this endpoint accepts, since a strict reading
 * requires `null` to be a member of the enum list itself. Getting that wrong does not degrade the
 * category, it makes every extraction request fail with a 400, which is the whole feature. The
 * safety this enum would buy is already guaranteed on our own side and cannot be weakened by the
 * model: `withValidatedSuggestedCategories` drops any key the live catalog does not back before the
 * draft leaves the server. So the enum is only a token-level optimisation, and it stays unadopted
 * until someone can verify the accepted shape against the real API with a key in hand: pass the
 * request's category keys down here, and declare `enum: [...keys]` on this property.
 */
const extractedProductSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    unitPrice: { type: AMOUNT_TYPE, nullable: true },
    suggestedProductTypeKey: { type: Type.STRING, nullable: true },
    referenceUrl: { type: Type.STRING, nullable: true },
  },
  required: ["name", "unitPrice", "suggestedProductTypeKey", "referenceUrl"],
};

const extractedGroupSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sourcePhrase: { type: Type.STRING },
    reason: { type: Type.STRING, enum: ["split", "sealed", "not-nameable", "open-range"] },
    doubtful: { type: Type.BOOLEAN },
    priceSplit: { type: Type.STRING, enum: ["explicit-unit", "divided-lot", "none"] },
    products: { type: Type.ARRAY, items: extractedProductSchema },
  },
  required: ["sourcePhrase", "reason", "doubtful", "priceSplit", "products"],
};

const paymentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    amount: fieldSchema(AMOUNT_TYPE),
    paidAt: fieldSchema(Type.STRING, "date"),
  },
  required: ["amount", "paidAt"],
};

const deliverySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    expectedFrom: fieldSchema(Type.STRING, "date"),
    expectedTo: fieldSchema(Type.STRING, "date"),
    cost: fieldSchema(AMOUNT_TYPE),
  },
  required: ["expectedFrom", "expectedTo", "cost"],
};

const intakeWarningSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    code: {
      type: Type.STRING,
      enum: [
        "product-ceiling-exceeded",
        "unreadable-region",
        "audio-present",
        "price-split-uneven",
        "no-order-found",
        "multiple-orders-detected",
      ],
    },
    detail: { type: Type.STRING, nullable: true },
  },
  required: ["code", "detail"],
};

/** The complete response schema handed to `responseSchema`, mirroring `imageIntakeDraftSchema`. */
export const IMAGE_INTAKE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    store: storeSchema,
    currency: fieldSchema(Type.STRING),
    orderDate: fieldSchema(Type.STRING, "date"),
    totalCost: fieldSchema(AMOUNT_TYPE),
    groups: { type: Type.ARRAY, items: extractedGroupSchema },
    payments: { type: Type.ARRAY, items: paymentSchema },
    delivery: { ...deliverySchema, nullable: true },
    warnings: { type: Type.ARRAY, items: intakeWarningSchema },
  },
  required: ["store", "currency", "orderDate", "totalCost", "groups", "payments", "delivery", "warnings"],
};

/**
 * Pure, network-free config builder so guard tests can assert on the real request shape (in
 * particular the pinned thinking level and the output ceiling) without importing the SDK client or
 * touching the network. The abort signal travels inside the request config because that is where
 * `@google/genai` v2.13 accepts it (`GenerateContentConfig.abortSignal`).
 *
 * `maxOutputTokens` is what makes the spend reservation honest. Output tokens are the expensive
 * side of this model's rate card, and an image carrying an enormous list could otherwise generate
 * far more of them than any pre-call estimate could hold, so the ceiling the ledger reserves
 * against is also the ceiling the provider is allowed to bill.
 */
export function buildRequestConfig(options?: ProviderRequestOptions): GenerateContentConfig {
  return {
    responseMimeType: "application/json",
    responseSchema: IMAGE_INTAKE_RESPONSE_SCHEMA,
    thinkingConfig: { thinkingLevel: THINKING_LEVEL_MINIMAL },
    maxOutputTokens: IMAGE_INTAKE_MAX_OUTPUT_TOKENS,
    abortSignal: options?.signal,
  };
}

/**
 * Refuses to run on the free AI Studio tier. Per ADR 0020 this is a privacy red line, not a cost
 * decision: free-tier prompts may be used to train Google's products, and this feature sends
 * private conversations containing third parties' names, phone numbers, and amounts.
 */
export function assertPaidTierConfirmed(): void {
  if (process.env.IMAGE_INTAKE_PAID_TIER_CONFIRMED !== "true") {
    throw new Error(
      'IMAGE_INTAKE_PAID_TIER_CONFIRMED must be "true" to run image intake extraction: the free tier ' +
        "is a privacy red line, prompts may train on third-party personal data.",
    );
  }
}

/**
 * Refuses to run outside a server environment. This is a manual `typeof window` check rather
 * than a module-level `import "server-only"`: the bare `server-only` specifier is resolved by
 * Next.js's own bundler aliasing, which Vitest's Vite-based transform does not have, so importing
 * it here would make this module (and its directly-tested pure exports, `buildRequestConfig` and
 * `assertPaidTierConfirmed`) unloadable from a test. Next's build already refuses to bundle the
 * `@google/genai` Node client into a client component, so this check is defense in depth, not the
 * only barrier.
 */
function assertServerEnvironment(): void {
  if (typeof window !== "undefined") {
    throw new Error("geminiProvider must never run in a browser environment: it holds the shared API key.");
  }
}

function toInlineImagePart(image: ImagePart): { inlineData: { data: string; mimeType: string } } {
  const base64 = typeof image.data === "string" ? image.data : image.data.toString("base64");
  return { inlineData: { data: base64, mimeType: image.mimeType } };
}

function readErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** True only for a failure that never got an HTTP answer from the API. */
function isNetworkFailure(error: unknown): boolean {
  const directCode = readErrorCode(error);
  if (directCode !== null && NETWORK_ERROR_CODES.has(directCode)) {
    return true;
  }

  // undici reports a connection-level failure as a `TypeError` whose `cause` carries the syscall
  // code. A `TypeError` raised anywhere in the fetch layer means no response was ever received,
  // so it is retryable even when the cause is not one of the codes listed above.
  if (error instanceof TypeError) {
    const causeCode = readErrorCode((error as { cause?: unknown }).cause);
    return causeCode === null || NETWORK_ERROR_CODES.has(causeCode);
  }

  return false;
}

/**
 * Maps anything the SDK throws onto one of the engine's two sanitized error classes. Retryability
 * is decided by class and HTTP status only: a 4xx is never a transport failure, so a rejected or
 * malformed request fails once instead of being retried at full price.
 *
 * Deliberately reports nothing to Sentry itself: the module's own invariant is one event per
 * failure (see `diagnostics.ts`), and the caller (`extractOrderFromImagesAction`) already sends
 * the single rich event once it has assembled the full diagnostic, `httpStatus` included. Reporting
 * here as well produced two events for the same failure, one of them missing the token counts and
 * partial-response shape only the caller has.
 */
function classifyProviderError(error: unknown, usage: ProviderUsage | null): Error {
  if (error instanceof ProviderTransportError || error instanceof ProviderRequestError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status >= HTTP_SERVER_ERROR_STATUS_MIN) {
      return new ProviderTransportError({ reason: "server-error", status: error.status, usage });
    }

    // Rate-limited or abandoned by the provider: transient, self-clearing, and retryable, so it is
    // a transport failure despite being a 4xx. Reported as `overloaded` rather than `server-error`
    // so the diagnostics can tell "Google was busy" apart from "Google broke", which are the same
    // remedy for the collector but different answers to "is this us?".
    if (RETRYABLE_CLIENT_ERROR_STATUSES.has(error.status)) {
      return new ProviderTransportError({ reason: "overloaded", status: error.status, usage });
    }

    // Any other 4xx means the API refused what we sent, so it is a defect of ours that will repeat
    // on every request until someone changes the code. The sanitized error is what the caller
    // reports, never the SDK's own `ApiError`, whose message serializes the provider's response
    // body and can echo text the model read out of a source image.
    return new ProviderRequestError({
      code: "GEMINI_REQUEST_REJECTED",
      kind: "rejected",
      status: error.status,
      usage,
    });
  }

  if (isNetworkFailure(error)) {
    return new ProviderTransportError({ reason: "network", usage });
  }

  // Anything left is unexpected (an SDK bug, a programming error here). Still not reported here:
  // the caller's single event covers this kind exactly like every other, `httpStatus: null` since
  // none was ever received.
  return new ProviderRequestError({ code: "GEMINI_UNEXPECTED_ERROR", kind: "unexpected", usage });
}

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!cachedClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set: image intake extraction cannot run without it.");
    }
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

/**
 * Production `ExtractionProvider` implementation for Gemini 3.1 Flash-Lite (ADR 0020). The only
 * class in the codebase allowed to call the Gemini SDK for order extraction.
 */
export class GeminiExtractionProvider implements ExtractionProvider {
  async generateDraft(
    images: ImagePart[],
    context: ExtractionContext,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResponse> {
    assertServerEnvironment();
    // Checked before the client is built and before any request is prepared: the free tier is a
    // privacy red line, so nothing about this call may exist if it is not explicitly confirmed.
    assertPaidTierConfirmed();

    const modelId = resolveImageIntakeModelId();
    const client = getClient();
    const systemPrompt = buildSystemPrompt(context);

    let response;
    try {
      response = await client.models.generateContent({
        model: modelId,
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt }, ...images.map(toInlineImagePart)],
          },
        ],
        config: buildRequestConfig(options),
      });
    } catch (error) {
      throw classifyProviderError(error, null);
    }

    // A body Google produced is billable even when it is unusable, so the token counts travel
    // with the error and the ledger settles the reservation at the real cost.
    const usage: ProviderUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      // Recorded for diagnosis only, never added to the cost: see `ProviderUsage.thoughtsTokens`.
      thoughtsTokens: response.usageMetadata?.thoughtsTokenCount ?? null,
      totalTokens: response.usageMetadata?.totalTokenCount ?? null,
    };

    // A response cut short at the output ceiling is billable and structurally unusable: whatever
    // JSON it contains is truncated mid-document. It is classified before the body is even looked
    // at, so it can never be mistaken for a valid draft, and it is a request error rather than a
    // transport one so the engine does not retry it at full price.
    if (response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS) {
      // The partial body is measured, never kept. Its shape (how many groups, products and payments
      // the model got through before running out of room) is what tells a genuinely enormous order
      // apart from a model that repeated itself, and neither is visible from the token total alone.
      // See `countPartialResponseShape` for why counting schema key names carries no content.
      const shape = countPartialResponseShape(response.text ?? "");
      throw new ProviderRequestError({ code: "GEMINI_RESPONSE_TRUNCATED", kind: "truncated", usage, shape });
    }

    const rawText = response.text;
    if (!rawText) {
      throw new ProviderRequestError({ code: "GEMINI_EMPTY_RESPONSE", kind: "empty", usage });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch {
      // A response that claims application/json but fails to parse is a malformed model
      // response, not a transport failure: the engine must not retry this.
      throw new ProviderRequestError({
        code: "GEMINI_RESPONSE_NOT_JSON",
        kind: "not-json",
        usage,
        shape: countPartialResponseShape(rawText),
      });
    }

    return { raw, usage };
  }
}
