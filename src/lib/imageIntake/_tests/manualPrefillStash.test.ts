import { beforeEach, describe, expect, it } from "vitest";
import type { ImageIntakeDraft } from "../draftSchema";
import {
  deriveManualFormPrefill,
  readAndClearManualPrefillStash,
  writeManualPrefillStash,
} from "../manualPrefillStash";

const MANUAL_PREFILL_STORAGE_KEY = "pandatrack:imageIntake:manualPrefill";
const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx0";

function buildDraft(overrides: Partial<ImageIntakeDraft> = {}): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: VALID_CUID,
      name: { value: "Pop Dealer", source: "read" },
      phone: { value: null, source: null },
      candidates: [],
    },
    currency: { value: "PEN", source: "read" },
    orderDate: { value: "2026-07-20", source: "read" },
    totalCost: { value: 48000, source: "read" },
    groups: [
      {
        sourcePhrase: "el pack chase de Gojo",
        reason: "split",
        doubtful: false,
        priceSplit: "explicit-unit",
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

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("writeManualPrefillStash / readAndClearManualPrefillStash", () => {
  it("hands back exactly what was stashed", () => {
    const draft = buildDraft();
    writeManualPrefillStash(draft);

    expect(readAndClearManualPrefillStash()).toEqual(draft);
  });

  it("clears the stash on read: a second read in the same session returns null", () => {
    writeManualPrefillStash(buildDraft());

    expect(readAndClearManualPrefillStash()).not.toBeNull();
    expect(readAndClearManualPrefillStash()).toBeNull();
    expect(window.sessionStorage.getItem(MANUAL_PREFILL_STORAGE_KEY)).toBeNull();
  });

  it("returns null when nothing was ever stashed", () => {
    expect(readAndClearManualPrefillStash()).toBeNull();
  });

  it("never writes anything to the URL: only sessionStorage is touched", () => {
    const before = window.location.href;
    writeManualPrefillStash(buildDraft());

    expect(window.location.href).toBe(before);
    expect(window.location.search).toBe("");
  });

  it("ignores a corrupt (non-JSON) stash entry instead of throwing", () => {
    window.sessionStorage.setItem(MANUAL_PREFILL_STORAGE_KEY, "not json at all {");

    expect(() => readAndClearManualPrefillStash()).not.toThrow();
    expect(readAndClearManualPrefillStash()).toBeNull();
  });

  it("ignores an entry whose draft fails schema validation (a tampered or stale-shape payload)", () => {
    window.sessionStorage.setItem(
      MANUAL_PREFILL_STORAGE_KEY,
      JSON.stringify({ createdAt: Date.now(), draft: { totally: "not a draft" } }),
    );

    expect(readAndClearManualPrefillStash()).toBeNull();
  });

  it("ignores an entry missing the envelope's own shape (no createdAt)", () => {
    window.sessionStorage.setItem(MANUAL_PREFILL_STORAGE_KEY, JSON.stringify({ draft: buildDraft() }));

    expect(readAndClearManualPrefillStash()).toBeNull();
  });

  it("ignores an entry older than the TTL", () => {
    const fifteenMinutesAndOneSecondAgo = Date.now() - (15 * 60 * 1000 + 1000);
    window.sessionStorage.setItem(
      MANUAL_PREFILL_STORAGE_KEY,
      JSON.stringify({ createdAt: fifteenMinutesAndOneSecondAgo, draft: buildDraft() }),
    );

    expect(readAndClearManualPrefillStash()).toBeNull();
  });

  it("still clears an entry it ultimately rejects, so a corrupt value never lingers", () => {
    window.sessionStorage.setItem(MANUAL_PREFILL_STORAGE_KEY, "not json at all {");

    readAndClearManualPrefillStash();

    expect(window.sessionStorage.getItem(MANUAL_PREFILL_STORAGE_KEY)).toBeNull();
  });
});

describe("deriveManualFormPrefill", () => {
  it("honours the matched store only when it is among the form's own available stores", () => {
    const draft = buildDraft();

    expect(deriveManualFormPrefill(draft, [VALID_CUID, "other-store"]).storeId).toBe(VALID_CUID);
    expect(deriveManualFormPrefill(draft, ["a-different-store"]).storeId).toBeNull();
  });

  it("drops the store hand-off entirely when the draft never matched one", () => {
    const draft = buildDraft({
      store: {
        matchedStoreId: null,
        name: { value: null, source: null },
        phone: { value: null, source: null },
        candidates: [],
      },
    });

    expect(deriveManualFormPrefill(draft, [VALID_CUID]).storeId).toBeNull();
  });

  it("carries the order date, currency, and total straight through", () => {
    const prefill = deriveManualFormPrefill(buildDraft(), [VALID_CUID]);

    expect(prefill.orderDateIso).toBe("2026-07-20");
    expect(prefill.currencyCode).toBe("PEN");
    expect(prefill.totalCostMinorUnits).toBe(48000);
  });

  it("flattens every group's already-broken-down products into one list", () => {
    const draft = buildDraft({
      groups: [
        {
          sourcePhrase: "primer grupo",
          reason: "split",
          doubtful: false,
          priceSplit: "explicit-unit",
          products: [{ name: "Item A", unitPrice: 1000, suggestedProductTypeKey: null, referenceUrl: null }],
        },
        {
          sourcePhrase: "segundo grupo",
          reason: "sealed",
          doubtful: true,
          priceSplit: "none",
          products: [
            { name: "Item B", unitPrice: null, suggestedProductTypeKey: null, referenceUrl: null },
            { name: "Item C", unitPrice: 2500, suggestedProductTypeKey: null, referenceUrl: null },
          ],
        },
      ],
    });

    expect(deriveManualFormPrefill(draft, []).items).toEqual([
      { name: "Item A", unitPriceMinorUnits: 1000, productTypeKey: null },
      { name: "Item B", unitPriceMinorUnits: null, productTypeKey: null },
      { name: "Item C", unitPriceMinorUnits: 2500, productTypeKey: null },
    ]);
  });

  it("carries a reviewed category into the manual form instead of quietly undoing it", () => {
    const draft = buildDraft({
      groups: [
        {
          sourcePhrase: "un tomo",
          reason: "sealed",
          doubtful: false,
          priceSplit: "explicit-unit",
          products: [{ name: "Item A", unitPrice: 1000, suggestedProductTypeKey: "manga", referenceUrl: null }],
        },
      ],
    });

    expect(deriveManualFormPrefill(draft, []).items).toEqual([
      { name: "Item A", unitPriceMinorUnits: 1000, productTypeKey: "manga" },
    ]);
  });

  it("returns an empty item list for a draft with no groups, rather than inventing a row", () => {
    expect(deriveManualFormPrefill(buildDraft({ groups: [] }), [VALID_CUID]).items).toEqual([]);
  });
});
