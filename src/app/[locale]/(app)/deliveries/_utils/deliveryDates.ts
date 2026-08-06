/**
 * Deliveries-local re-export. The formatting itself lives in `@/lib/arrivalWindow` since the
 * orders list renders the same window in the same row shape; this file stays so the deliveries
 * subtree keeps importing from its own `_utils` as `project-structure.mdc` expects.
 */
export { formatArrivalWindow, formatShortDate, getDeliveryOverdueDays } from "@/lib/arrivalWindow";
