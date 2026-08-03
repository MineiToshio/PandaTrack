import { z } from "zod";
import { majorAmountToMinorUnits } from "@/lib/money/majorAmountToMinorUnits";
import {
  MAX_GROUPS_PER_ORDER,
  MAX_INTAKE_WARNINGS,
  MAX_PARSEABLE_PRODUCTS_PER_DRAFT,
  MAX_PAYMENTS_PER_ORDER,
  MAX_PRODUCT_TYPE_KEY_LENGTH,
  MAX_PRODUCTS_PER_GROUP,
  MAX_REFERENCE_URL_LENGTH,
  MAX_STORE_CANDIDATES,
} from "./constants";

/**
 * Provenance wrapper for every scalar the extraction engine returns. `source` distinguishes text
 * the model actually read from a value it filled in by convention (for example the base currency
 * when none was stated), so the review screen can decide what needs a second look. The invariant
 * is enforced by `fieldSchema`: `value` and `source` are null together or populated together.
 */
export type Field<T> = { value: T | null; source: "read" | "assumed" | null };

const FIELD_SOURCES = ["read", "assumed"] as const;

// The intermediate cast works around a TypeScript inference limit: `z.object()` cannot resolve a
// generic inner schema's output type through `.nullable()` inside a mapped shape, so it silently
// drops the `value` key from the inferred type. `Field<T>` is already hand-authored above, so the
// cast only restates a shape this function's own runtime logic guarantees.
function fieldSchema<T>(innerSchema: z.ZodType<T>): z.ZodType<Field<T>> {
  const shapeSchema = z
    .object({
      value: innerSchema.nullable(),
      source: z.enum(FIELD_SOURCES).nullable(),
    })
    .strict() as unknown as z.ZodType<Field<T>>;

  return shapeSchema.refine((field) => (field.value === null) === (field.source === null), {
    message: "FIELD_VALUE_SOURCE_MISMATCH",
  });
}

// ISO 4217 alphabetic code shape only; catalog membership is a caller concern (see
// `isAllowedCollectorBaseCurrency`), not something this contract enforces.
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

// Calendar-shape check only (rejects "2026-13-40"); it does not reject valid-looking but
// non-existent dates like "2026-02-30", which the order domain's own date coercion will catch.
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const storeFieldNameSchema = fieldSchema(z.string().min(1));
const storeFieldPhoneSchema = fieldSchema(z.string().min(1));
const currencyFieldSchema = fieldSchema(z.string().regex(CURRENCY_CODE_PATTERN, { message: "INVALID_CURRENCY_CODE" }));
const isoDateFieldSchema = fieldSchema(z.string().regex(ISO_DATE_PATTERN, { message: "INVALID_ISO_DATE" }));
/**
 * Every amount in this contract is an integer of ×100 minor units, the single unit the whole money
 * domain stores and computes in (`MINOR_UNITS_PER_MAJOR`, `src/lib/currency.ts`), for every
 * currency including the zero-decimal ones. `59.90` is `5990` here, and `1200` JPY is `120000`.
 *
 * The model does NOT answer in this unit: it reports the amount as the image shows it, in the
 * currency's major unit, and `parseImageIntakeModelResponse` is what converts. Nothing else in this
 * feature is allowed to interpret a raw model amount, because an integer in the wrong unit passes
 * every check in this file and lands a 59.90 order in the database as 0.59.
 */
const minorUnitsFieldSchema = fieldSchema(z.number().int().min(0));

// Minimal on purpose: the review screen's disambiguation list only ever needs an id to submit and
// a name to display, so the candidate shape never needs to carry more than that.
const storeCandidateSchema = z
  .object({
    storeId: z.string(),
    name: z.string(),
  })
  .strict();

const storeSchema = z
  .object({
    matchedStoreId: z.string().nullable(),
    name: storeFieldNameSchema,
    phone: storeFieldPhoneSchema,
    candidates: z.array(storeCandidateSchema).max(MAX_STORE_CANDIDATES),
  })
  .strict();

const EXTRACTED_GROUP_REASONS = ["split", "sealed", "not-nameable", "open-range"] as const;
const PRICE_SPLIT_KINDS = ["explicit-unit", "divided-lot", "none"] as const;

/** The two schemes a captured link may use. Anything else is not a link a person can safely open. */
const REFERENCE_URL_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * A web address read out of a source image, and nothing else.
 *
 * The scheme is checked by parsing rather than by pattern, so the verdict is the URL parser's own:
 * `javascript:`, `data:`, `file:`, and every other scheme are refused, and a value that is not a URL
 * at all never reaches the review screen as something a person could click. The length bound is
 * declared before the parse so a pathological string is rejected without being parsed at all.
 *
 * This value stays untrusted for its whole life. It is never interpolated into a prompt, never
 * fetched, and never handed to a router that could prefetch it: the review screen renders it as a
 * plain anchor the collector may choose to open.
 */
const referenceUrlSchema = z
  .string()
  .max(MAX_REFERENCE_URL_LENGTH, { message: "REFERENCE_URL_TOO_LONG" })
  .refine(
    (value) => {
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        return false;
      }
      return REFERENCE_URL_PROTOCOLS.has(parsed.protocol);
    },
    { message: "REFERENCE_URL_NOT_A_WEB_LINK" },
  );

const extractedProductSchema = z
  .object({
    name: z.string().min(1),
    // Integer ×100 minor units, like every other amount here; `minorUnitsFieldSchema` above says why
    // the model never writes that unit itself. It is a price per unit because quantity is always 1
    // by design: partial arrival tracking needs one row per unit, so the deterministic breakdown
    // engine expands a lot phrase into several single-unit products instead of this contract ever
    // carrying a quantity field.
    unitPrice: z.number().int().min(0).nullable(),
    /**
     * Catalog category the model inferred for this product, always a suggestion.
     *
     * A plain nullable string rather than a `Field<T>`, and deliberately so. `Field` exists to
     * separate text that was genuinely read from a value filled in by convention, so the review
     * screen can decide what needs a second look. A category is never read: no chat says
     * "productTypeKey: manga", it is always inferred from the product's own name, so the `source`
     * discriminator would be a constant carrying no information. Worse, it would be a constant the
     * model writes: a response claiming `source: "read"` would make the review screen render an
     * inferred category as plain, uneditable text, which is exactly the failure this feature must
     * not have. The name of the field carries the provenance instead, the UI marks it as a
     * suggestion unconditionally, and there is no per-response value that can weaken that.
     *
     * Membership in the live catalog is NOT checked here: only the length is. A key the catalog does
     * not back is dropped server-side (`withValidatedSuggestedCategories`) rather than failing the
     * parse, because rejecting the draft over a suggestion would throw away a whole correct reading
     * of the collector's photos.
     */
    suggestedProductTypeKey: z.string().max(MAX_PRODUCT_TYPE_KEY_LENGTH).nullable().default(null),
    /**
     * The link the product was identified by, when the buyer sent one instead of a name.
     *
     * Capture only. Nothing in this codebase fetches it, and nothing persists it: an order has no
     * field for a reference link, so the collector names the product on the review screen and that
     * name is what gets saved. The link's job is finished the moment it has shown the collector what
     * they are naming.
     */
    referenceUrl: referenceUrlSchema.nullable().default(null),
  })
  .strict();

const extractedGroupSchema = z
  .object({
    // Quoted verbatim in the review chip so the user can trace the number back to the source text.
    sourcePhrase: z.string().min(1),
    reason: z.enum(EXTRACTED_GROUP_REASONS),
    doubtful: z.boolean(),
    priceSplit: z.enum(PRICE_SPLIT_KINDS),
    products: z.array(extractedProductSchema).max(MAX_PRODUCTS_PER_GROUP),
  })
  .strict();

const paymentSchema = z
  .object({
    amount: minorUnitsFieldSchema,
    paidAt: isoDateFieldSchema,
  })
  .strict();

// Shape kept intentionally minimal: this is the expected delivery window and cost read from the
// source text, not a real shipment. The save path maps `expectedFrom`/`expectedTo` onto the
// order's own expected-delivery fields; `cost` has no counterpart on the order, and no delivery
// record is created from a draft, since a delivery represents a shipment that was actually
// dispatched (see `mapDraftToOrderCreate.ts`).
const deliverySchema = z
  .object({
    expectedFrom: isoDateFieldSchema,
    expectedTo: isoDateFieldSchema,
    cost: minorUnitsFieldSchema,
  })
  .strict();

const INTAKE_WARNING_CODES = [
  "product-ceiling-exceeded",
  "unreadable-region",
  "audio-present",
  "price-split-uneven",
  // The model's own way of saying "these images are not a purchase" instead of returning an empty
  // shell that reads like a failed extraction. It is a self-report, so nothing downstream decides
  // anything on it alone: the server reaches that verdict from the draft's own contents.
  "no-order-found",
  // The model's own way of saying "these images are more than one purchase", raised so a submission
  // that mixes two unrelated orders is refused instead of being silently fused into one plausible
  // draft.
  //
  // Unlike `no-order-found`, this one is NOT re-derived server-side, and the difference is not an
  // oversight. An empty draft is a deterministic fact about its own contents (no products, no total,
  // no store, no payment), so the server can and does reach that verdict on its own. "These are two
  // different purchases" is semantic: the only evidence lives in the images, which the server never
  // reads, and a fused draft looks exactly like a correct one from the outside. So this warning is
  // load-bearing on its own, and the guarantee it carries is the model's, not ours: a model that
  // fuses two orders without warning produces a mixed draft the collector has to catch on the
  // review screen.
  "multiple-orders-detected",
] as const;

const intakeWarningSchema = z
  .object({
    code: z.enum(INTAKE_WARNING_CODES),
    detail: z.string().nullable(),
  })
  .strict();

/** Raised by the whole-draft check below when the groups together carry more products than allowed. */
const PRODUCT_CEILING_ISSUE_MESSAGE = "PRODUCT_CEILING_EXCEEDED";

/**
 * Every collection in this contract is bounded. Two different callers parse against this schema,
 * an extraction response and, later, the reviewed draft the client posts back to be saved, and
 * neither is trusted input. The save path opens one database write per payment and per product, so
 * an unbounded list here would let a single accepted draft turn into an unbounded amount of work
 * with no rate limit standing between it and the database.
 *
 * The per-array bounds cannot express the one that actually matters, since the product ceiling is a
 * sum across groups rather than a length, so it is checked over the whole object instead.
 */
export const imageIntakeDraftSchema = z
  .object({
    store: storeSchema,
    currency: currencyFieldSchema,
    orderDate: isoDateFieldSchema,
    totalCost: minorUnitsFieldSchema,
    groups: z.array(extractedGroupSchema).max(MAX_GROUPS_PER_ORDER),
    payments: z.array(paymentSchema).max(MAX_PAYMENTS_PER_ORDER),
    delivery: deliverySchema.nullable(),
    warnings: z.array(intakeWarningSchema).max(MAX_INTAKE_WARNINGS),
  })
  .strict()
  .superRefine((draft, ctx) => {
    const productCount = draft.groups.reduce((sum, group) => sum + group.products.length, 0);
    if (productCount > MAX_PARSEABLE_PRODUCTS_PER_DRAFT) {
      ctx.addIssue({ code: "custom", path: ["groups"], message: PRODUCT_CEILING_ISSUE_MESSAGE });
    }
  });

export type StoreCandidate = z.infer<typeof storeCandidateSchema>;
export type ExtractedProduct = z.infer<typeof extractedProductSchema>;
export type ExtractedGroup = z.infer<typeof extractedGroupSchema>;
export type ExtractedGroupReason = (typeof EXTRACTED_GROUP_REASONS)[number];
export type PriceSplitKind = (typeof PRICE_SPLIT_KINDS)[number];
export type IntakeWarningCode = (typeof INTAKE_WARNING_CODES)[number];
export type IntakeWarning = z.infer<typeof intakeWarningSchema>;
export type ImageIntakeDraft = z.infer<typeof imageIntakeDraftSchema>;

/**
 * Typed validation failure for a rejected draft. Carries sanitised issue summaries (path plus
 * message) instead of the raw candidate payload, so a malformed or adversarial provider response
 * never leaks into logs or error surfaces verbatim.
 */
export class ImageIntakeDraftValidationError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(issues: { path: string; message: string }[]) {
    super("IMAGE_INTAKE_DRAFT_INVALID");
    this.name = "ImageIntakeDraftValidationError";
    this.issues = issues;
  }
}

export type ParseImageIntakeDraftResult =
  { ok: true; draft: ImageIntakeDraft } | { ok: false; error: ImageIntakeDraftValidationError };

/** Renders a Zod issue path as `groups[0].sourcePhrase` instead of the flatter `groups.0.sourcePhrase`. */
function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    const key = String(segment);
    return acc ? `${acc}.${key}` : key;
  }, "");
}

/**
 * Validates a draft against the contract. Rejects unknown properties (via `.strict()` on every
 * object in the schema) so a manipulated or hallucinated payload cannot smuggle extra fields past
 * the boundary.
 *
 * Amounts must already be integer ×100 minor units here, which is what makes this the right parser
 * for the reviewed draft the client posts back and the WRONG one for a raw extraction response:
 * the model answers in major units, so a raw response has to go through
 * `parseImageIntakeModelResponse` instead.
 */
export function parseImageIntakeDraft(value: unknown): ParseImageIntakeDraftResult {
  const parsed = imageIntakeDraftSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = formatIssuePath(issue.path);
      // Zod's own message for an unrecognized-keys issue interpolates the offending key names
      // verbatim (`Unrecognized key: "..."`). Those names are model-controlled: an extraction
      // engine response is untrusted input, so nothing it wrote is allowed to ride along into an
      // error surface unmodified. Only the parent path and a count survive here.
      if (issue.code === "unrecognized_keys") {
        return { path, message: `unrecognized keys (${issue.keys.length}) at ${path || "root"}` };
      }
      return { path, message: issue.message };
    });
    return { ok: false, error: new ImageIntakeDraftValidationError(issues) };
  }
  return { ok: true, draft: parsed.data };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Scales one raw amount from the major unit the model reports into ×100 minor units. Anything that
 * is not a finite number is left exactly as it arrived (JSON's `1e400` parses to `Infinity`), so
 * the strict parse is what reports it, with the field's real path, instead of this converting an
 * unusable value into a plausible-looking one.
 */
function scaleMajorAmount(value: unknown): unknown {
  return typeof value === "number" && Number.isFinite(value) ? majorAmountToMinorUnits(value) : value;
}

/** Rescales the `value` of one `Field<number>`, leaving its provenance and any other shape alone. */
function scaleAmountField(field: unknown): unknown {
  if (!isRecord(field)) {
    return field;
  }
  return { ...field, value: scaleMajorAmount(field.value) };
}

function scaleProductAmounts(product: unknown): unknown {
  if (!isRecord(product)) {
    return product;
  }
  return { ...product, unitPrice: scaleMajorAmount(product.unitPrice) };
}

function scaleGroupAmounts(group: unknown): unknown {
  if (!isRecord(group) || !Array.isArray(group.products)) {
    return group;
  }
  return { ...group, products: group.products.map(scaleProductAmounts) };
}

function scaleDeliveryAmounts(delivery: unknown): unknown {
  if (!isRecord(delivery)) {
    return delivery;
  }
  return { ...delivery, cost: scaleAmountField(delivery.cost) };
}

/**
 * Salvages the currency field when the model answers with the symbol it read rather than with the
 * ISO code the contract requires.
 *
 * A Peruvian chat says "S/", and a model that echoes it fails `CURRENCY_CODE_PATTERN`, which
 * rejects the ENTIRE draft: a correct reading of the store, the products, the total, and the
 * payments is thrown away, the collector is told their photos were not understood, and the photo is
 * spent all the same. That trade is never worth it. So an unusable code becomes "no currency was
 * read", which is a case this feature already handles well: `withResolvedCurrency` fills the
 * collector's own base currency and marks it assumed, and the review screen shows it as a guess to
 * correct. Casing is normalised first ("pen" is the same code as "PEN"), which is a reading of what
 * the model wrote, not a guess at what it meant: a symbol is never mapped to a code here, because
 * "$" alone genuinely does not identify a currency.
 *
 * The prompt states the ISO rule (see the currency section); this is the net under it.
 */
function normalizeCurrencyField(currency: unknown): unknown {
  if (!isRecord(currency) || typeof currency.value !== "string") {
    return currency;
  }
  const code = currency.value.trim().toUpperCase();
  return CURRENCY_CODE_PATTERN.test(code) ? { ...currency, value: code } : { value: null, source: null };
}

/**
 * Normalises a raw extraction response into the units and shapes the draft contract requires:
 * every major-unit amount scaled into ×100 minor units, and a currency the model wrote as a symbol
 * dropped rather than allowed to invalidate the whole reading. Structural only, so a response of
 * any other shape reaches the parse exactly as the model wrote it.
 */
function normalizeModelResponse(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return {
    ...value,
    currency: normalizeCurrencyField(value.currency),
    totalCost: scaleAmountField(value.totalCost),
    payments: Array.isArray(value.payments)
      ? value.payments.map((payment) =>
          isRecord(payment) ? { ...payment, amount: scaleAmountField(payment.amount) } : payment,
        )
      : value.payments,
    delivery: scaleDeliveryAmounts(value.delivery),
    groups: Array.isArray(value.groups) ? value.groups.map(scaleGroupAmounts) : value.groups,
  };
}

/**
 * Validates a raw extraction response and hands back a draft in the domain's own money unit. The
 * ONLY function allowed to turn a provider response into an `ImageIntakeDraft`: a response parsed
 * anywhere else would be a hundred times too small, with nothing downstream able to notice.
 *
 * The amount unit contract it implements: the model reports each amount EXACTLY as the image shows
 * it, in the currency's major unit and as a plain decimal ("S/ 59.90" comes back as `59.9`), and
 * this server does the only arithmetic there is, the uniform ×100 into minor units.
 *
 * The alternative (asking the model for minor units) was rejected on purpose. It makes every
 * extraction depend on the model performing arithmetic silently and correctly, and it gets the
 * zero-decimal currencies wrong by construction: a model that knows JPY has no subunit answers
 * `1200` for ¥1,200 whatever the instruction says, and `1200` minor units is ¥12. Both mistakes
 * produce a perfectly valid non-negative integer, so no schema and no reviewer can tell a right
 * answer from one that is a hundred times off. Moving the multiplication here removes the whole
 * failure class: the model reports a reading, the server computes.
 */
export function parseImageIntakeModelResponse(value: unknown): ParseImageIntakeDraftResult {
  return parseImageIntakeDraft(normalizeModelResponse(value));
}
