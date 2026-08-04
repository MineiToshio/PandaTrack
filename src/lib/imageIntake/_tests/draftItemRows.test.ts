import { describe, expect, it } from "vitest";
import {
  buildCarriedProductData,
  draftRowId,
  findUnreadablePriceRowIds,
  groupToItemRows,
  itemRowsToProducts,
  type DraftItemRow,
} from "../draftItemRows";
import type { ExtractedGroup } from "../draftSchema";

function buildGroup(overrides: Partial<ExtractedGroup> = {}): ExtractedGroup {
  return {
    sourcePhrase: "el pack chase de Gojo",
    reason: "split",
    doubtful: false,
    priceSplit: "explicit-unit",
    products: [
      { name: "Gojo", unitPrice: 9000, suggestedProductTypeKey: "figures", referenceUrl: null },
      { name: "Gojo (chase)", unitPrice: null, suggestedProductTypeKey: null, referenceUrl: "https://ml.com.pe/x" },
    ],
    ...overrides,
  };
}

describe("groupToItemRows", () => {
  it("renders prices as the decimal text a person reads, not the stored integer", () => {
    const rows = groupToItemRows(buildGroup(), "PEN", "g0");
    expect(rows[0].unitPrice).toBe("90.00");
  });

  it("leaves an unpriced product's cell empty rather than inventing a zero", () => {
    expect(groupToItemRows(buildGroup(), "PEN", "g0")[1].unitPrice).toBe("");
  });

  it("carries the suggested category into the type cell and quantity as one", () => {
    const rows = groupToItemRows(buildGroup(), "PEN", "g0");
    expect(rows[0].productTypeKey).toBe("figures");
    expect(rows[1].productTypeKey).toBe("");
    expect(rows.every((row) => row.quantity === "1")).toBe(true);
  });

  it("gives each row an id derived from its group and position", () => {
    expect(groupToItemRows(buildGroup(), "PEN", "g0").map((row) => row.rowId)).toEqual([
      draftRowId("g0", 0),
      draftRowId("g0", 1),
    ]);
  });
});

describe("itemRowsToProducts", () => {
  const carried = buildCarriedProductData(buildGroup(), "g0");

  function rows(overrides: Partial<DraftItemRow>[] = []): DraftItemRow[] {
    const base = groupToItemRows(buildGroup(), "PEN", "g0");
    return base.map((row, index) => ({ ...row, ...overrides[index] }));
  }

  it("reads an edited price back into minor units", () => {
    expect(itemRowsToProducts(rows([{ unitPrice: "115" }]), "PEN", carried)[0].unitPrice).toBe(11500);
  });

  it("treats an emptied price cell as no price rather than as zero", () => {
    expect(itemRowsToProducts(rows([{ unitPrice: "  " }]), "PEN", carried)[0].unitPrice).toBeNull();
  });

  it("keeps a captured link on the row it belongs to, which the grid has no cell for", () => {
    const products = itemRowsToProducts(rows([{ name: "Gojo Satoru" }]), "PEN", carried);
    expect(products[0].referenceUrl).toBeNull();
    expect(products[1].referenceUrl).toBe("https://ml.com.pe/x");
  });

  it("gives a row the collector added no link, since nothing read one for it", () => {
    const added: DraftItemRow = { rowId: "g0-added-2", name: "Nuevo", quantity: "1", unitPrice: "10", productTypeKey: "" };
    expect(itemRowsToProducts([added], "PEN", carried)[0].referenceUrl).toBeNull();
  });

  it("maps an empty type cell to no category rather than to an empty key the catalog cannot resolve", () => {
    expect(itemRowsToProducts(rows(), "PEN", carried)[1].suggestedProductTypeKey).toBeNull();
  });
});

describe("findUnreadablePriceRowIds", () => {
  it("reports a cell holding text the money parser refuses", () => {
    const row: DraftItemRow = { rowId: "r1", name: "x", quantity: "1", unitPrice: "1,500", productTypeKey: "" };
    expect(findUnreadablePriceRowIds([row], "PEN")).toEqual(["r1"]);
  });

  it("says nothing about an empty cell, which is a legitimate answer", () => {
    const row: DraftItemRow = { rowId: "r1", name: "x", quantity: "1", unitPrice: "", productTypeKey: "" };
    expect(findUnreadablePriceRowIds([row], "PEN")).toEqual([]);
  });
});
