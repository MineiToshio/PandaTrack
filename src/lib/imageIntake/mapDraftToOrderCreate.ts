import type { ImageIntakeDraft, ExtractedGroup } from "@/lib/imageIntake/draftSchema";

/**
 * Structural transform target for `orderCreateSchema`. Fields stay nullable here even though the
 * destination schema requires most of them, because this mapper is a pure shape transform with no
 * validation of its own: a draft field the user has not confirmed yet maps straight through as
 * `null`, and `orderCreateSchema.safeParse` (run by the caller at save time) is the single place
 * that decides whether that null is acceptable.
 */
export interface DraftOrderCreateInput {
  storeId: string | null;
  orderDate: string | null;
  expectedDeliveryFrom: string | null;
  expectedDeliveryTo: string | null;
  currencyCode: string | null;
  totalCost: number | null;
  items: DraftOrderItemInput[];
}

/** Structural transform target for one row of `orderCreateSchema.items`. */
export interface DraftOrderItemInput {
  name: string;
  quantity: number;
  unitPrice: number | null;
  /**
   * Catalog category for the item, as the collector left it on the review screen. It reaches this
   * mapper already validated against the live catalog (an unbacked suggestion was dropped to `null`
   * server-side), which matters because the write path refuses the whole order over a single key it
   * cannot resolve.
   */
  productTypeKey: string | null;
  position: number;
}

/** Structural transform target for `orderPaymentCreateSchema`. */
export interface DraftOrderPaymentInput {
  orderId: string;
  amount: number | null;
  paymentDate: string | null;
}

// Partial arrival tracking needs one row per unit, so a confirmed draft product is always a
// quantity-1 order item; the breakdown engine is what turns a lot phrase into several such rows.
const CONFIRMED_ITEM_QUANTITY = 1;

function flattenGroupsToItems(groups: ExtractedGroup[]): DraftOrderItemInput[] {
  const items: DraftOrderItemInput[] = [];
  let position = 1;
  for (const group of groups) {
    for (const product of group.products) {
      items.push({
        name: product.name,
        quantity: CONFIRMED_ITEM_QUANTITY,
        unitPrice: product.unitPrice,
        productTypeKey: product.suggestedProductTypeKey,
        position,
      });
      position += 1;
    }
  }
  return items;
}

/**
 * Maps a confirmed draft to the shape `orderCreateSchema` expects. Pure and synchronous: it does
 * not call Prisma, does not persist anything, and does not itself validate the result. The draft
 * has no free-text note field, so `orderCreateSchema.note` is intentionally left unset here.
 *
 * The draft's `delivery` block is expectation, not a shipment: `expectedFrom` and `expectedTo` are
 * the window the chat promised, and they map onto the order's own expected-delivery fields below.
 * `delivery.cost` has no counterpart anywhere on an order, and no delivery is created from a draft
 * (a delivery records a shipment that was actually dispatched, with real products in it), so this
 * function deliberately does not map the cost. It is not dropped in silence either: the review
 * screen shows the figure it read and says it lands with the delivery the user registers later.
 */
export function mapDraftToOrderCreateInput(draft: ImageIntakeDraft): DraftOrderCreateInput {
  return {
    storeId: draft.store.matchedStoreId,
    orderDate: draft.orderDate.value,
    expectedDeliveryFrom: draft.delivery?.expectedFrom.value ?? null,
    expectedDeliveryTo: draft.delivery?.expectedTo.value ?? null,
    currencyCode: draft.currency.value,
    totalCost: draft.totalCost.value,
    items: flattenGroupsToItems(draft.groups),
  };
}

/**
 * Maps a confirmed draft's payments to `orderPaymentCreateSchema` inputs. Takes `orderId`
 * explicitly because the order does not exist yet when `mapDraftToOrderCreateInput` runs; the
 * caller supplies it once `createOrder` has returned.
 */
export function mapDraftToOrderPaymentCreateInputs(draft: ImageIntakeDraft, orderId: string): DraftOrderPaymentInput[] {
  return draft.payments.map((payment) => ({
    orderId,
    amount: payment.amount.value,
    paymentDate: payment.paidAt.value,
  }));
}
