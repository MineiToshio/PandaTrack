import type { ImageIntakeQuotaSnapshot } from "@/lib/imageIntake/quota";

/**
 * What the create surfaces need to know about the collector's monthly AI-photo bag: the
 * remaining-photo line on the "Desde una imagen" card, and whether that card is still usable.
 *
 * A narrowed view of the quota snapshot rather than a second definition of it, so the counter the
 * selector shows and the balance the reservation enforces can never describe different things.
 *
 * `remaining` is `null` only when no cap applies (administrators), in which case the line is hidden
 * rather than filled with a placeholder number.
 */
export type PhotoCounterSnapshot = Pick<ImageIntakeQuotaSnapshot, "remaining" | "limit" | "renewalAtIso">;

/** True when the bag is capped and empty: the image card renders disabled with a zero counter. */
export function isPhotoBagExhausted(snapshot: PhotoCounterSnapshot | null): boolean {
  return snapshot?.remaining === 0;
}
