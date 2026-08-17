import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getPostHogClientMock,
  captureMock,
  shutdownMock,
  getCollectorPreferencesSnapshotMock,
  createImageIntakeSpendGuardMock,
  validateUploadedImagesMock,
  extractMock,
  findStoreMatchesForIntakeMock,
  getImageIntakeQuotaSnapshotMock,
  listActiveStoreProductTypeKeysMock,
  listAuthoredStoreProductTypeNamesMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getPostHogClientMock: vi.fn(),
  captureMock: vi.fn(),
  shutdownMock: vi.fn(),
  getCollectorPreferencesSnapshotMock: vi.fn(),
  createImageIntakeSpendGuardMock: vi.fn(),
  validateUploadedImagesMock: vi.fn(),
  extractMock: vi.fn(),
  findStoreMatchesForIntakeMock: vi.fn(),
  getImageIntakeQuotaSnapshotMock: vi.fn(),
  listActiveStoreProductTypeKeysMock: vi.fn(),
  listAuthoredStoreProductTypeNamesMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({
  getSession: getSessionMock,
  // The action resolves the admin flag from the session it already holds; the quota exemption is
  // decided by the role, never by an environment allowlist.
  getIsAdmin: (session: { user?: { role?: unknown } } | null) => session?.user?.role === "admin",
}));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: getCollectorPreferencesSnapshotMock,
}));
vi.mock("@/lib/data/stores/storeMatchingQueries", () => ({
  findStoreMatchesForIntake: findStoreMatchesForIntakeMock,
}));
vi.mock("@/lib/data/imageIntake/spendGuard", () => ({
  createImageIntakeSpendGuard: createImageIntakeSpendGuardMock,
}));
vi.mock("@/lib/data/imageIntake/imageIntakeQuotaQueries", () => ({
  getImageIntakeQuotaSnapshot: getImageIntakeQuotaSnapshotMock,
}));
// The catalog is read live per request, so it is a mock here rather than a fixture list: these
// tests are about what the action does with what the catalog says, including saying nothing.
vi.mock("@/lib/data/catalog/storeProductTypeQueries", () => ({
  listActiveStoreProductTypeKeysCached: listActiveStoreProductTypeKeysMock,
  listAuthoredStoreProductTypeNamesCached: listAuthoredStoreProductTypeNamesMock,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => {
    const translate = (key: string) => `name:${key}`;
    translate.has = () => true;
    return translate;
  },
}));
vi.mock("@/lib/imageIntake/validateUpload", () => ({ validateUploadedImages: validateUploadedImagesMock }));
// The provider double keeps the suite off the network entirely: the real class is never constructed
// with a live client, and `extract` is stubbed so no Gemini call is even attempted.
vi.mock("@/lib/imageIntake/geminiProvider", () => ({
  GeminiExtractionProvider: class {
    generateDraft = vi.fn();
  },
  resolveImageIntakeModelId: () => "test-model",
}));
// Only `extract` is stubbed. The rest of the module is the real thing on purpose: the action asks
// it to classify the failure it was handed (`isProviderRequestRejected`), and a stubbed classifier
// would make the mapping test assert against a double instead of the real error contract.
vi.mock("@/lib/imageIntake/extractionEngine", async () => ({
  ...(await vi.importActual<typeof import("@/lib/imageIntake/extractionEngine")>("@/lib/imageIntake/extractionEngine")),
  extract: extractMock,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { extractOrderFromImagesAction } from "../imageIntakeExtractAction";
import { IMAGE_INTAKE_FILES_FIELD } from "../imageIntakeContract";

const USER_SESSION = { user: { id: "user-1" } };

function field<T>(value: T | null, source: "read" | "assumed" | null) {
  return { value, source };
}

function buildDraft(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    store: { matchedStoreId: null, name: field("Pop Dealer", "read"), phone: field(null, null), candidates: [] },
    currency: field("PEN", "assumed"),
    orderDate: field("2026-07-20", "read"),
    totalCost: field(48000, "read"),
    groups: [
      {
        sourcePhrase: "el pack chase de Gojo",
        reason: "split" as const,
        doubtful: false,
        priceSplit: "explicit-unit" as const,
        products: [
          { name: "Gojo", unitPrice: 9000, suggestedProductTypeKey: null, referenceUrl: null },
          { name: "Gojo (chase)", unitPrice: 6000, suggestedProductTypeKey: null, referenceUrl: null },
        ],
      },
    ],
    payments: [],
    delivery: null,
    warnings: [],
    ...overrides,
  };
}

function buildFormData(fileCount = 1): FormData {
  const formData = new FormData();
  for (let index = 0; index < fileCount; index++) {
    formData.append(
      IMAGE_INTAKE_FILES_FIELD,
      new File([new Uint8Array([1, 2, 3])], `photo-${index}.png`, {
        type: "image/png",
      }),
    );
  }
  return formData;
}

const VALIDATED_IMAGE = {
  buffer: Buffer.from([1, 2, 3]),
  format: "png" as const,
  width: 800,
  height: 1200,
  byteSize: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  getPostHogClientMock.mockReturnValue({ capture: captureMock, shutdown: shutdownMock });
  getSessionMock.mockResolvedValue(USER_SESSION);
  getCollectorPreferencesSnapshotMock.mockResolvedValue({ baseCurrencyCode: "PEN" });
  validateUploadedImagesMock.mockResolvedValue({ ok: true, images: [VALIDATED_IMAGE] });
  findStoreMatchesForIntakeMock.mockResolvedValue({ kind: "unknown" });
  createImageIntakeSpendGuardMock.mockReturnValue({
    assertCanSpend: vi.fn().mockResolvedValue(undefined),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
  });
  listActiveStoreProductTypeKeysMock.mockResolvedValue([{ key: "figures" }, { key: "manga" }]);
  listAuthoredStoreProductTypeNamesMock.mockResolvedValue([]);
  getImageIntakeQuotaSnapshotMock.mockResolvedValue({
    limit: 20,
    usedPhotos: 3,
    remaining: 17,
    periodKey: "2026-07",
    renewalAtIso: "2026-08-01T00:00:00.000Z",
  });
});

describe("extractOrderFromImagesAction", () => {
  it("refuses an unauthenticated caller before touching the ledger or the provider", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "unauthorized" });
    expect(createImageIntakeSpendGuardMock).not.toHaveBeenCalled();
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("stops on the currency gate without spending a request", async () => {
    getCollectorPreferencesSnapshotMock.mockResolvedValue({ baseCurrencyCode: null });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "missing-base-currency" });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("maps an upload validation failure to its own code, carrying the offending position", async () => {
    validateUploadedImagesMock.mockResolvedValue({
      ok: false,
      error: { code: "unsupported-format", index: 0, measured: null },
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "unsupported-format", imageIndex: 0 });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("carries the position and the measurement of an image refused for its dimensions", async () => {
    // What the screen needs to say "Photo 2 is 1080 x 108 px" instead of "one of the photos is too
    // small or too large": without these three fields the message can only restate the rule.
    validateUploadedImagesMock.mockResolvedValue({
      ok: false,
      error: { code: "image-too-small", index: 1, measured: { width: 1080, height: 108 } },
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({
      ok: false,
      code: "image-too-small",
      imageIndex: 1,
      imageWidth: 1080,
      imageHeight: 108,
    });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("reports a submission-level refusal with no position, since no single photo caused it", async () => {
    validateUploadedImagesMock.mockResolvedValue({
      ok: false,
      error: { code: "too-many-images", index: null, measured: null },
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "too-many-images" });
  });

  it.each([
    ["budget-blocked"],
    ["rate-limited"],
    ["invalid-model-response"],
    ["provider-error"],
    ["ledger-error"],
    // The daily attempt cap counts billable attempts, successes and failures alike, so it carries
    // no balance: the refusal is the bare code, never a remaining figure the collector does not own.
    ["daily-attempt-cap-exceeded"],
  ])("maps the %s engine outcome to the same code", async (status) => {
    extractMock.mockResolvedValue({ status });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: status });
  });

  it("reports a provider 4xx as its own code, so the copy never promises a retry that cannot work", async () => {
    const { ProviderRequestError } = await import("@/lib/imageIntake/extractionEngine");
    extractMock.mockResolvedValue({
      status: "provider-error",
      error: new ProviderRequestError({ code: "GEMINI_REQUEST_REJECTED", kind: "rejected", status: 400 }),
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    // The API refused what we sent, so every attempt fails identically: this is a defect of ours,
    // not a passing outage, and it must be countable and readable as such.
    expect(result).toEqual({ ok: false, code: "provider-rejected" });
    const failureEvent = captureMock.mock.calls
      .map((call) => call[0])
      .find((event) => event.event === "image_intake_failed");
    expect(failureEvent?.properties.failure_code).toBe("provider-rejected");
  });

  it("reports a truncated answer as response-too-long, not as a failure worth retrying", async () => {
    const { ProviderRequestError } = await import("@/lib/imageIntake/extractionEngine");
    // The regression. A response cut off at the output ceiling carries no HTTP status, and
    // retryability used to be inferred from that status alone, so it fell through to
    // `provider-error`: "try again in a minute". It is deterministic, so the collector retried and
    // paid for the same refusal again. It must arrive as its own code, whose copy states the real
    // remedy (send fewer photos).
    extractMock.mockResolvedValue({
      status: "provider-error",
      error: new ProviderRequestError({
        code: "GEMINI_RESPONSE_TRUNCATED",
        kind: "truncated",
        usage: { inputTokens: 2240, outputTokens: 32000 },
        shape: { partialChars: 91000, groupsEmitted: 1, productsEmitted: 412, paymentsEmitted: 0 },
      }),
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "response-too-long" });
  });

  it("records the truncation diagnosis, which nothing else can reconstruct afterwards", async () => {
    const { ProviderRequestError } = await import("@/lib/imageIntake/extractionEngine");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    extractMock.mockResolvedValue({
      status: "provider-error",
      error: new ProviderRequestError({
        code: "GEMINI_RESPONSE_TRUNCATED",
        kind: "truncated",
        usage: { inputTokens: 2240, outputTokens: 32000, thoughtsTokens: 31000, totalTokens: 34240 },
        shape: { partialChars: 91000, groupsEmitted: 1, productsEmitted: 412, paymentsEmitted: 0 },
      }),
    });

    await extractOrderFromImagesAction(buildFormData());

    const line = warn.mock.calls.map((call) => String(call[0])).find((text) => text.includes("[image-intake]"));
    expect(line).toBeDefined();
    // The three figures that separate a genuinely enormous order from a looping model from a
    // reasoning blow-up. Without them the ledger only says a request failed.
    expect(line).toContain("outputTokens=32000");
    expect(line).toContain("thoughtsTokens=31000");
    expect(line).toContain("productsEmitted=412");
    expect(line).toContain("reportedAs=response-too-long");
    warn.mockRestore();
  });

  it("still tells a plain provider outage to try again, so the honest retry is not lost", async () => {
    const { ProviderTransportError } = await import("@/lib/imageIntake/extractionEngine");
    extractMock.mockResolvedValue({
      status: "provider-error",
      error: new ProviderTransportError({ reason: "server-error", status: 503 }),
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "provider-error" });
  });

  it("keeps a retryable transport failure on the generic provider code", async () => {
    const { ProviderTransportError } = await import("@/lib/imageIntake/extractionEngine");
    extractMock.mockResolvedValue({
      status: "provider-error",
      error: new ProviderTransportError({ reason: "server-error", status: 503 }),
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "provider-error" });
  });

  it("captures the dedicated global budget event only for a budget block", async () => {
    extractMock.mockResolvedValue({ status: "budget-blocked" });

    await extractOrderFromImagesAction(buildFormData());

    const events = captureMock.mock.calls.map((call) => call[0].event);
    expect(events).toContain("image_intake_global_budget_blocked");
  });

  it("returns the breakdown-applied draft on success", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.baseCurrencyCode).toBe("PEN");
    expect(result.draft.groups[0].products).toHaveLength(2);
  });

  it("fills in the collector's base currency, marked assumed, when the source stated none", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft({ currency: field(null, null) }) });

    const result = await extractOrderFromImagesAction(buildFormData());

    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.currency).toEqual({ value: "PEN", source: "assumed" });
  });

  it("keeps a currency the model read in the source, marked read", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft({ currency: field("USD", "read") }) });

    const result = await extractOrderFromImagesAction(buildFormData());

    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.currency).toEqual({ value: "USD", source: "read" });
  });

  it("replaces a currency the model assumed on its own with the collector's base currency", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft({ currency: field("USD", "assumed") }) });

    const result = await extractOrderFromImagesAction(buildFormData());

    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.currency).toEqual({ value: "PEN", source: "assumed" });
  });

  it("stops with the ceiling code and a count instead of a truncated draft", async () => {
    const products = Array.from({ length: 240 }, (_, index) => ({ name: `Tomo ${index + 1}`, unitPrice: 1000 }));
    extractMock.mockResolvedValue({
      status: "ok",
      draft: buildDraft({
        groups: [
          {
            sourcePhrase: "los 240 tomos",
            reason: "open-range" as const,
            doubtful: false,
            priceSplit: "explicit-unit" as const,
            products,
          },
        ],
      }),
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({ ok: false, code: "product-ceiling-exceeded", productCount: 240, maxProducts: 200 });
  });

  describe("images that carry no order at all", () => {
    /** The all-null shell a correct reading of a photo of a cat produces. */
    function buildEmptyDraft(overrides: Partial<Record<string, unknown>> = {}) {
      return buildDraft({
        store: { matchedStoreId: null, name: field(null, null), phone: field(null, null), candidates: [] },
        totalCost: field(null, null),
        groups: [],
        payments: [],
        ...overrides,
      });
    }

    it("refuses a draft with no products, no total, no store and no payment, without handing one back", async () => {
      extractMock.mockResolvedValue({ status: "ok", draft: buildEmptyDraft() });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(result).toEqual({ ok: false, code: "no-order-found" });
      // Nothing may look like a success to the client, and the store lookup is pointless work on a
      // draft that named no store.
      expect(findStoreMatchesForIntakeMock).not.toHaveBeenCalled();
      const events = captureMock.mock.calls.map((call) => call[0]);
      expect(events.map((event) => event.event)).not.toContain("image_intake_succeeded");
      const failed = events.find((event) => event.event === "image_intake_failed");
      expect(failed?.properties).toEqual({ photo_count: 1, failure_code: "no-order-found" });
    });

    it("still refuses when the shell carries an order date and a currency, which every screenshot has", async () => {
      extractMock.mockResolvedValue({
        status: "ok",
        draft: buildEmptyDraft({ orderDate: field("2026-07-20", "read"), currency: field("PEN", "read") }),
      });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(result).toEqual({ ok: false, code: "no-order-found" });
    });

    it("never reports extracted content on the refusal event", async () => {
      extractMock.mockResolvedValue({ status: "ok", draft: buildEmptyDraft() });

      await extractOrderFromImagesAction(buildFormData());

      const serialized = JSON.stringify(captureMock.mock.calls);
      expect(serialized).not.toContain("Gojo");
      expect(serialized).not.toContain("Pop Dealer");
    });

    it("spends the photo, because the reading itself succeeded and was billed", async () => {
      const recordFailure = vi.fn().mockResolvedValue(undefined);
      createImageIntakeSpendGuardMock.mockReturnValue({
        assertCanSpend: vi.fn().mockResolvedValue(undefined),
        recordUsage: vi.fn().mockResolvedValue(undefined),
        recordFailure,
      });
      extractMock.mockResolvedValue({ status: "ok", draft: buildEmptyDraft() });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(result).toEqual({ ok: false, code: "no-order-found" });
      // `extract()` settles the reservation as SUCCEEDED before it returns an `ok` outcome, and only
      // a FAILED settlement gives photos back. This action must not reverse that: the request was
      // sent and billed, and the answer was correct. A refund here would make uploading anything at
      // all free, which is a way to spend the product's budget on rubbish.
      expect(recordFailure).not.toHaveBeenCalled();
    });

    it.each([
      ["only a total", { totalCost: field(48000, "read") }],
      [
        "only a store name",
        {
          store: { matchedStoreId: null, name: field("Pop Dealer", "read"), phone: field(null, null), candidates: [] },
        },
      ],
      [
        "only a store phone",
        {
          store: {
            matchedStoreId: null,
            name: field(null, null),
            phone: field("+51987654321", "read"),
            candidates: [],
          },
        },
      ],
      ["only a payment", { payments: [{ amount: field(5000, "read"), paidAt: field(null, null) }] }],
      [
        "only one product",
        {
          groups: [
            {
              sourcePhrase: "el pack chase de Gojo",
              reason: "not-nameable" as const,
              doubtful: true,
              priceSplit: "none" as const,
              products: [{ name: "Gojo", unitPrice: null }],
            },
          ],
        },
      ],
    ])("hands back a partial draft that carries %s: incomplete is useful, empty is not", async (_label, overrides) => {
      extractMock.mockResolvedValue({ status: "ok", draft: buildEmptyDraft(overrides) });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(result.ok).toBe(true);
    });
  });

  /**
   * A submission that held two separate purchases. Unlike the empty-draft case above, this verdict
   * has no server-side derivation to fall back on: a draft that fused two orders is shaped exactly
   * like a draft of one, so the model's warning is the only evidence there is.
   */
  describe("images that hold more than one order", () => {
    const MULTIPLE_ORDERS_WARNING = { code: "multiple-orders-detected" as const, detail: null };

    it("refuses the draft and reports the split instead of handing back a fused order", async () => {
      extractMock.mockResolvedValue({ status: "ok", draft: buildDraft({ warnings: [MULTIPLE_ORDERS_WARNING] }) });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(result).toEqual({ ok: false, code: "multiple-orders" });
      // No draft leaves the server, so nothing downstream can be tempted to render it.
      expect(findStoreMatchesForIntakeMock).not.toHaveBeenCalled();
      const events = captureMock.mock.calls.map((call) => call[0]);
      expect(events.map((event) => event.event)).not.toContain("image_intake_succeeded");
      const failed = events.find((event) => event.event === "image_intake_failed");
      expect(failed?.properties).toEqual({ photo_count: 1, failure_code: "multiple-orders" });
    });

    it("never reports extracted content on the refusal event", async () => {
      extractMock.mockResolvedValue({ status: "ok", draft: buildDraft({ warnings: [MULTIPLE_ORDERS_WARNING] }) });

      await extractOrderFromImagesAction(buildFormData());

      const serialized = JSON.stringify(captureMock.mock.calls);
      expect(serialized).not.toContain("Gojo");
      expect(serialized).not.toContain("Pop Dealer");
    });

    it("spends the photo, because the reading itself succeeded and was billed", async () => {
      const recordFailure = vi.fn().mockResolvedValue(undefined);
      createImageIntakeSpendGuardMock.mockReturnValue({
        assertCanSpend: vi.fn().mockResolvedValue(undefined),
        recordUsage: vi.fn().mockResolvedValue(undefined),
        recordFailure,
      });
      extractMock.mockResolvedValue({ status: "ok", draft: buildDraft({ warnings: [MULTIPLE_ORDERS_WARNING] }) });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(result).toEqual({ ok: false, code: "multiple-orders" });
      expect(recordFailure).not.toHaveBeenCalled();
    });

    it("hands back the draft normally when no such warning was raised", async () => {
      extractMock.mockResolvedValue({
        status: "ok",
        draft: buildDraft({ warnings: [{ code: "price-split-uneven" as const, detail: null }] }),
      });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(result.ok).toBe(true);
    });
  });

  /**
   * The catalog is a foreign key on the write side, so a suggested category is only ever allowed to
   * be a key the live catalog actually backs. These cases pin the one behaviour that protects the
   * save: an unbacked suggestion is dropped here, and everything else about the draft survives.
   */
  describe("suggested categories", () => {
    function draftWithSuggestions(...keys: (string | null)[]) {
      return buildDraft({
        groups: [
          {
            sourcePhrase: "el pack chase de Gojo",
            reason: "split" as const,
            doubtful: false,
            priceSplit: "explicit-unit" as const,
            products: keys.map((key, index) => ({
              name: `Producto ${index + 1}`,
              unitPrice: 9000,
              suggestedProductTypeKey: key,
              referenceUrl: null,
            })),
          },
        ],
      });
    }

    function readSuggestions(result: Awaited<ReturnType<typeof extractOrderFromImagesAction>>) {
      if (!result.ok) throw new Error("expected ok");
      return result.draft.groups.flatMap((group) => group.products.map((product) => product.suggestedProductTypeKey));
    }

    it("offers the model the live catalog's keys and labels, never a hardcoded list", async () => {
      listActiveStoreProductTypeKeysMock.mockResolvedValue([{ key: "manga" }]);
      extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });

      await extractOrderFromImagesAction(buildFormData());

      const [, context] = extractMock.mock.calls[0];
      expect(context.productCategories).toEqual([{ key: "manga", label: "name:manga" }]);
    });

    it("prefers an admin-authored name for a type the i18n namespace does not know", async () => {
      listActiveStoreProductTypeKeysMock.mockResolvedValue([{ key: "blu_rays" }]);
      listAuthoredStoreProductTypeNamesMock.mockResolvedValue([
        { key: "blu_rays", nameEs: "Blu-rays", nameEn: "Blu-rays" },
      ]);
      extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });

      await extractOrderFromImagesAction(buildFormData());

      const [, context] = extractMock.mock.calls[0];
      expect(context.productCategories).toEqual([{ key: "blu_rays", label: "Blu-rays" }]);
    });

    it("keeps a suggestion the live catalog backs", async () => {
      extractMock.mockResolvedValue({ status: "ok", draft: draftWithSuggestions("manga") });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(readSuggestions(result)).toEqual(["manga"]);
    });

    it("drops a suggestion the catalog has no row for, leaving the rest of the draft untouched", async () => {
      extractMock.mockResolvedValue({ status: "ok", draft: draftWithSuggestions("blu_rays") });

      const result = await extractOrderFromImagesAction(buildFormData());

      if (!result.ok) throw new Error("expected ok");
      expect(readSuggestions(result)).toEqual([null]);
      // The reading itself is intact: only the unbacked convenience field was discarded.
      expect(result.draft.groups[0].products[0].name).toBe("Producto 1");
      expect(result.draft.groups[0].products[0].unitPrice).toBe(9000);
      expect(result.draft.totalCost.value).toBe(48000);
    });

    it("drops a suggestion naming a type that exists but is no longer active", async () => {
      // The active list is the whole contract here: a deactivated type is refused by the write path
      // exactly like a key that never existed, so it must not survive as a suggestion either.
      listActiveStoreProductTypeKeysMock.mockResolvedValue([{ key: "figures" }]);
      extractMock.mockResolvedValue({ status: "ok", draft: draftWithSuggestions("manga") });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(readSuggestions(result)).toEqual([null]);
    });

    it("leaves an absent suggestion absent", async () => {
      extractMock.mockResolvedValue({ status: "ok", draft: draftWithSuggestions(null) });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(readSuggestions(result)).toEqual([null]);
    });

    it("drops only the unbacked keys when a draft mixes valid and invented ones", async () => {
      extractMock.mockResolvedValue({
        status: "ok",
        draft: draftWithSuggestions("manga", "blu_rays", null, "figures"),
      });

      const result = await extractOrderFromImagesAction(buildFormData());

      expect(readSuggestions(result)).toEqual(["manga", null, null, "figures"]);
    });

    it("never hands back a category that could make the order write refuse the whole order", async () => {
      // The assertion that protects the save: whatever the model answered, every category leaving
      // this action is one the live catalog can resolve, so `createOrderItems` cannot refuse over it.
      extractMock.mockResolvedValue({
        status: "ok",
        draft: draftWithSuggestions("MANGA", "manga ", "../../etc/passwd", "figures"),
      });

      const result = await extractOrderFromImagesAction(buildFormData());

      if (!result.ok) throw new Error("expected ok");
      const survivors = readSuggestions(result).filter((key): key is string => key !== null);
      expect(survivors).toEqual(["figures"]);
    });
  });

  it("resolves the store step and captures STORE_MATCHED on a certain match", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });
    findStoreMatchesForIntakeMock.mockResolvedValue({
      kind: "certain",
      storeId: "store-1",
      name: "Pop Dealer",
      matchedBy: "name",
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(findStoreMatchesForIntakeMock).toHaveBeenCalledWith("user-1", { name: "Pop Dealer", phone: null });
    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.store.matchedStoreId).toBe("store-1");
    expect(result.draft.store.candidates).toEqual([]);
    const events = captureMock.mock.calls.map((call) => call[0]);
    const matchedEvent = events.find((event) => event.event === "image_intake_store_matched");
    expect(matchedEvent?.properties).toEqual({ matched_by: "name" });
  });

  it("carries an ambiguous match's candidates onto the draft without matching a store id", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });
    findStoreMatchesForIntakeMock.mockResolvedValue({
      kind: "ambiguous",
      candidates: [
        { storeId: "store-1", name: "Pop Dealer" },
        { storeId: "store-2", name: "Pop Dealer PE" },
      ],
    });

    const result = await extractOrderFromImagesAction(buildFormData());

    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.store.matchedStoreId).toBeNull();
    expect(result.draft.store.candidates).toHaveLength(2);
    const events = captureMock.mock.calls.map((call) => call[0].event);
    expect(events).not.toContain("image_intake_store_matched");
  });

  it("never attaches extracted content to an analytics event", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });

    await extractOrderFromImagesAction(buildFormData());

    const serialized = JSON.stringify(captureMock.mock.calls);
    expect(serialized).not.toContain("Gojo");
    expect(serialized).not.toContain("Pop Dealer");
    expect(serialized).not.toContain("pack chase");
  });

  it("reports the balance the collector was looking at when they submitted", async () => {
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });

    await extractOrderFromImagesAction(buildFormData());

    const submitted = captureMock.mock.calls.find((call) => call[0].event === "image_intake_submitted");
    expect(submitted?.[0].properties).toMatchObject({ photos_remaining_before: 17 });
  });

  it("passes the session's admin flag to the guard, so administrators are exempt from the bag", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1", role: "admin" } });
    extractMock.mockResolvedValue({ status: "ok", draft: buildDraft() });

    await extractOrderFromImagesAction(buildFormData());

    expect(createImageIntakeSpendGuardMock.mock.calls[0][0]).toMatchObject({ isAdmin: true });
  });

  it("maps a quota refusal to its own code, carrying the balance and the renewal date", async () => {
    extractMock.mockResolvedValue({ status: "quota-exceeded", remaining: 2 });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toEqual({
      ok: false,
      code: "quota-exceeded",
      remaining: 2,
      renewalAtIso: "2026-08-01T00:00:00.000Z",
    });
  });

  it("reports the daily attempt cap as an ordinary failure, without the quota event", async () => {
    extractMock.mockResolvedValue({ status: "daily-attempt-cap-exceeded" });

    await extractOrderFromImagesAction(buildFormData());

    const events = captureMock.mock.calls.map((call) => call[0]);
    const failed = events.find((event) => event.event === "image_intake_failed");
    expect(failed?.properties).toMatchObject({ failure_code: "daily-attempt-cap-exceeded" });
    expect(events.map((event) => event.event)).not.toContain("image_intake_quota_blocked");
  });

  it("maps a daily cap refusal to its own code", async () => {
    extractMock.mockResolvedValue({ status: "daily-cap-exceeded", remaining: 1 });

    const result = await extractOrderFromImagesAction(buildFormData());

    expect(result).toMatchObject({ ok: false, code: "daily-cap-exceeded", remaining: 1 });
  });
});
