import { describe, expect, it } from "vitest";
import { orderCreateSchema, orderPaymentCreateSchema } from "@/lib/orders/orderValidation";
import type { ImageIntakeDraft } from "../draftSchema";
import { mapDraftToOrderCreateInput, mapDraftToOrderPaymentCreateInputs } from "../mapDraftToOrderCreate";

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx0";

function buildConfirmedDraft(): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: VALID_CUID,
      name: { value: "Panda Store", source: "read" },
      phone: { value: "+51987654321", source: "read" },
      candidates: [],
    },
    currency: { value: "PEN", source: "read" },
    orderDate: { value: "2026-07-20", source: "read" },
    totalCost: { value: 6000, source: "read" },
    groups: [
      {
        sourcePhrase: "del 42 al 43",
        reason: "split",
        doubtful: false,
        priceSplit: "explicit-unit",
        products: [
          { name: "Figura 42", unitPrice: 3000, suggestedProductTypeKey: null, referenceUrl: null },
          { name: "Figura 43", unitPrice: 3000, suggestedProductTypeKey: null, referenceUrl: null },
        ],
      },
    ],
    payments: [{ amount: { value: 2000, source: "read" }, paidAt: { value: "2026-07-20", source: "read" } }],
    delivery: {
      expectedFrom: { value: "2026-08-01", source: "assumed" },
      expectedTo: { value: "2026-08-15", source: "assumed" },
      cost: { value: 0, source: "assumed" },
    },
    warnings: [],
  };
}

function buildUnconfirmedDraft(): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: null,
      name: { value: null, source: null },
      phone: { value: null, source: null },
      candidates: [],
    },
    currency: { value: "PEN", source: "assumed" },
    orderDate: { value: null, source: null },
    totalCost: { value: null, source: null },
    groups: [],
    payments: [],
    delivery: null,
    warnings: [],
  };
}

describe("mapDraftToOrderCreateInput", () => {
  it("maps a confirmed draft into input orderCreateSchema accepts", () => {
    const mapped = mapDraftToOrderCreateInput(buildConfirmedDraft());
    const result = orderCreateSchema.safeParse(mapped);
    expect(result.success).toBe(true);
  });

  it("flattens every group's products into quantity-1 items with sequential positions", () => {
    const mapped = mapDraftToOrderCreateInput(buildConfirmedDraft());
    expect(mapped.items).toEqual([
      { name: "Figura 42", quantity: 1, unitPrice: 3000, productTypeKey: null, position: 1 },
      { name: "Figura 43", quantity: 1, unitPrice: 3000, productTypeKey: null, position: 2 },
    ]);
  });

  it("carries a reviewed category onto the item the order write receives", () => {
    const draft = buildConfirmedDraft();
    draft.groups[0].products[0].suggestedProductTypeKey = "figures";

    const mapped = mapDraftToOrderCreateInput(draft);

    expect(mapped.items[0].productTypeKey).toBe("figures");
    // A product nobody categorised stays uncategorised rather than inheriting its neighbour's key.
    expect(mapped.items[1].productTypeKey).toBeNull();
  });

  it("keeps a categorised item acceptable to the order schema", () => {
    const draft = buildConfirmedDraft();
    draft.groups[0].products.forEach((product) => {
      product.suggestedProductTypeKey = "manga";
      // The reference link is capture-only: it has nowhere to go on an order and must not leak into
      // the write input as an unexpected property.
      product.referenceUrl = "https://mercadolibre.com.pe/MPE-123";
    });

    const mapped = mapDraftToOrderCreateInput(draft);

    expect(orderCreateSchema.safeParse(mapped).success).toBe(true);
    expect(JSON.stringify(mapped)).not.toContain("mercadolibre");
  });

  it("carries the resolved store id straight through", () => {
    const mapped = mapDraftToOrderCreateInput(buildConfirmedDraft());
    expect(mapped.storeId).toBe(VALID_CUID);
  });

  it("keeps the extracted arrival window on the order itself", () => {
    const mapped = mapDraftToOrderCreateInput(buildConfirmedDraft());
    expect(mapped.expectedDeliveryFrom).toBe("2026-08-01");
    expect(mapped.expectedDeliveryTo).toBe("2026-08-15");
  });

  it("does not smuggle a shipping cost into an order, which has nowhere to store one", () => {
    const mapped = mapDraftToOrderCreateInput(buildConfirmedDraft());
    expect(Object.keys(mapped)).not.toContain("cost");
    expect(Object.keys(mapped)).not.toContain("deliveryCost");
  });

  it("maps an unconfirmed draft into a structurally coherent but schema-rejected input", () => {
    const mapped = mapDraftToOrderCreateInput(buildUnconfirmedDraft());
    expect(mapped).toEqual({
      storeId: null,
      orderDate: null,
      expectedDeliveryFrom: null,
      expectedDeliveryTo: null,
      currencyCode: "PEN",
      totalCost: null,
      items: [],
    });
    const result = orderCreateSchema.safeParse(mapped);
    expect(result.success).toBe(false);
  });
});

describe("mapDraftToOrderPaymentCreateInputs", () => {
  it("maps confirmed payments into input orderPaymentCreateSchema accepts", () => {
    const mapped = mapDraftToOrderPaymentCreateInputs(buildConfirmedDraft(), VALID_CUID);
    expect(mapped).toHaveLength(1);
    const result = orderPaymentCreateSchema.safeParse(mapped[0]);
    expect(result.success).toBe(true);
  });

  it("returns an empty array for a draft with no payments", () => {
    const mapped = mapDraftToOrderPaymentCreateInputs(buildUnconfirmedDraft(), VALID_CUID);
    expect(mapped).toEqual([]);
  });
});
