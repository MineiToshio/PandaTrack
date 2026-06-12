export const DELIVERY_LIST_SORT_VALUES = ["oldest", "recent", "eta-asc", "store-asc"] as const;

export type DeliveryListSort = (typeof DELIVERY_LIST_SORT_VALUES)[number];

/** Oldest shipments first — collectors clear the backlog top-down (FR-08-30). */
export const DEFAULT_DELIVERY_LIST_SORT: DeliveryListSort = "oldest";
