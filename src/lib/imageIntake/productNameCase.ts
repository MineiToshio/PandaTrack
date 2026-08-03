import type { ImageIntakeDraft } from "./draftSchema";

/**
 * Capitalises the first letter of an extracted product name, and nothing else.
 *
 * A model transcribing a chat keeps whatever case the seller typed, so "set de 6 mistery box" comes
 * back exactly as it was written and lands in a product row that reads as a typo next to every
 * hand-typed product. Asking the model to capitalise would put a mechanical transform in the one
 * place that cannot be relied on to perform it consistently, the same trap the amount contract
 * already fell into, so the rewrite happens here where it is deterministic and testable.
 *
 * Deliberately only the first letter. Title casing every word would be wrong in Spanish, where
 * "Set De 6 Mistery Box De One Piece" is not how anybody writes a product, and it would also destroy
 * casing the source got right, like "One Piece" or "PS5". Everything after the first character is
 * left exactly as read.
 *
 * A name that does not start with a letter is returned untouched: "3 figuras de Gojo" and "+Ultra"
 * have no first letter to raise, and forcing one would corrupt the name rather than tidy it.
 */
export function capitalizeProductName(name: string): string {
  // Iterating the string yields whole code points, so an astral first character (an emoji, for
  // instance) is treated as one unit instead of a broken half of a surrogate pair.
  const [firstCharacter] = name;
  if (firstCharacter === undefined) return name;

  const raised = firstCharacter.toLocaleUpperCase("es");
  // `toLocaleUpperCase` can return more than one character for some scripts (the German sharp s
  // becomes "SS"), which would silently lengthen the name, so an expanding case change is skipped.
  if (raised === firstCharacter || raised.length !== firstCharacter.length) return name;

  return raised + name.slice(firstCharacter.length);
}

/**
 * Applies {@link capitalizeProductName} to every product in the draft.
 *
 * Runs on the extraction path only, so what the collector reviews is what gets saved. A name the
 * collector types themselves, in the manual form or in the split and merge modal, is left alone:
 * their own capitalisation is a choice, not a transcription artefact.
 *
 * `sourcePhrase` is never touched. It is quoted back to the collector as evidence of what the chat
 * literally said, so editing it would undermine the one field whose whole job is to be verbatim.
 */
export function withCapitalizedProductNames(draft: ImageIntakeDraft): ImageIntakeDraft {
  return {
    ...draft,
    groups: draft.groups.map((group) => ({
      ...group,
      products: group.products.map((product) => ({
        ...product,
        name: capitalizeProductName(product.name),
      })),
    })),
  };
}
