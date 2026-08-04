import { formatCentsForInput } from "@/lib/currency";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import type { ExtractedGroup, ExtractedProduct } from "./draftSchema";

/**
 * The row shape the order item grid edits. Declared structurally rather than imported from the grid
 * so this module stays free of React and can be unit-tested on its own; the grid's own `ItemRow` is
 * assignable to it.
 */
export type DraftItemRow = {
  rowId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  productTypeKey: string;
};

/**
 * Quantity is always "1" in a draft. The breakdown engine expands a lot into one product per unit so
 * a partial arrival can be tracked against individual rows, so the review screen hides the column
 * (`showQuantity={false}`) and this constant is what goes back out on the round trip.
 */
const DRAFT_ROW_QUANTITY = "1";

/** Deterministic row id, so a row keeps its identity across re-renders of the same group. */
export function draftRowId(groupKey: string, index: number): string {
  return `${groupKey}-${index}`;
}

/**
 * Turns one extracted group into grid rows.
 *
 * Prices become the decimal text a person reads and types, not the minor-unit integer the draft
 * stores: the grid holds its cell values as strings, which is what lets someone type "11." without
 * the field fighting them halfway through the number.
 */
export function groupToItemRows(group: ExtractedGroup, currencyCode: string, groupKey: string): DraftItemRow[] {
  return group.products.map((product, index) => ({
    rowId: draftRowId(groupKey, index),
    name: product.name,
    quantity: DRAFT_ROW_QUANTITY,
    unitPrice: product.unitPrice !== null ? formatCentsForInput(product.unitPrice, currencyCode) : "",
    productTypeKey: product.suggestedProductTypeKey ?? "",
  }));
}

/**
 * Turns edited grid rows back into a group's products.
 *
 * `carried` holds the per-product data the grid has no cell for, keyed by row id: today that is the
 * captured reference link, which is capture-only and must survive an edit to the row it belongs to
 * without the grid ever needing to know it exists. A row the collector added has no entry and
 * therefore no link, which is correct: nothing read a link for a product nobody extracted.
 *
 * A price the money parser cannot read becomes `null` here, exactly as an empty field does. The
 * caller is responsible for refusing to save while any cell still holds text that did not parse;
 * this function's job is the shape, not the verdict.
 */
export function itemRowsToProducts(
  rows: DraftItemRow[],
  currencyCode: string,
  carried: ReadonlyMap<string, Pick<ExtractedProduct, "referenceUrl">>,
): ExtractedProduct[] {
  return rows.map((row) => {
    const trimmedPrice = row.unitPrice.trim();
    return {
      name: row.name,
      unitPrice: trimmedPrice === "" ? null : parseDecimalToMinorUnits(trimmedPrice, currencyCode),
      suggestedProductTypeKey: row.productTypeKey === "" ? null : row.productTypeKey,
      referenceUrl: carried.get(row.rowId)?.referenceUrl ?? null,
    };
  });
}

/** The link-carrying data `itemRowsToProducts` needs, built from the same group the rows came from. */
export function buildCarriedProductData(
  group: ExtractedGroup,
  groupKey: string,
): Map<string, Pick<ExtractedProduct, "referenceUrl">> {
  return new Map(
    group.products.map((product, index) => [draftRowId(groupKey, index), { referenceUrl: product.referenceUrl }]),
  );
}

/**
 * Row ids whose price cell holds text the money parser refuses.
 *
 * Thousands separators, three decimals and a pasted currency symbol are all rejected, and all of
 * them are things a person genuinely types. Writing that rejection into the draft as `null` would
 * save the row as having no price at all, and the totals check goes quiet as soon as one price is
 * missing, so the notice that would have caught the loss would go quiet with it.
 */
export function findUnreadablePriceRowIds(rows: DraftItemRow[], currencyCode: string): string[] {
  return rows
    .filter((row) => {
      const trimmed = row.unitPrice.trim();
      return trimmed !== "" && parseDecimalToMinorUnits(trimmed, currencyCode) === null;
    })
    .map((row) => row.rowId);
}
