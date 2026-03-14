/**
 * Normalizes a store name for duplicate-matching: lowercase, trim, collapse internal whitespace.
 * Used when searching for likely duplicates so slight formatting differences still match.
 */
export function normalizeStoreName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}
