/**
 * Normalizes free-text for loose matching in search fields (case- and accent-insensitive).
 * Does not alter emoji or strip non-diacritic punctuation; use for substring / equality checks only.
 */
export function foldSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
