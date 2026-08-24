/**
 * The marker image intake writes into an order's note, and the one way to recognise it.
 *
 * `Order` carries no `source` column, so the only trace that a purchase was captured from a photo is
 * this idempotency marker, in the same `[namespace:digest]` shape the chat importer already uses.
 * The note is user-editable, which is why nothing may re-derive "this came from a photo" from an
 * arbitrary later read of it: the only trustworthy moment is the request that just wrote it.
 */

/** Namespace segment of an image-intake marker. */
export const IMAGE_INTAKE_MARKER_NAMESPACE = "image-intake";

/** Opening of every image-intake marker, used to recognise one at the moment it is written. */
export const IMAGE_INTAKE_MARKER_PREFIX = `[${IMAGE_INTAKE_MARKER_NAMESPACE}:`;

/** Whether a note the caller just wrote carries the image-intake marker. */
export function hasImageIntakeMarker(note: string | null | undefined): boolean {
  return typeof note === "string" && note.trimStart().startsWith(IMAGE_INTAKE_MARKER_PREFIX);
}
