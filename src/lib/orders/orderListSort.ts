/**
 * Order list sort enum — pure type/constant shared by the server query layer and the client
 * toolbar. Kept here (no Prisma imports) so client components can consume it without dragging the
 * data-layer bundle in.
 *
 * `payment-asc` was retired with the per-order "% paid" progress column (store-level payments no
 * longer track a per-order paid ratio worth sorting by; see `docs/product` for the payment model).
 */
export const ORDER_LIST_SORT_VALUES = ["recent", "oldest", "store-asc", "store-desc", "total-desc"] as const;

export type OrderListSort = (typeof ORDER_LIST_SORT_VALUES)[number];
