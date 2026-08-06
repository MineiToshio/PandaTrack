/**
 * Order list sort enum + payment state — pure types/constants shared by the server
 * query layer and the client toolbar. Kept here (no Prisma imports) so client
 * components can consume it without dragging the data-layer bundle in.
 */
export const ORDER_LIST_SORT_VALUES = ["recent", "oldest", "store-asc", "store-desc", "payment-asc", "total-desc"] as const;

export type OrderListSort = (typeof ORDER_LIST_SORT_VALUES)[number];

export type OrderListPaymentState = "paid" | "partial" | "unpaid" | "overdue";
