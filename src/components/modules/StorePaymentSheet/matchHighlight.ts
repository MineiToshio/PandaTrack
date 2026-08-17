/**
 * Diacritic-insensitive matching shared by the allocation panel's filter and the row's highlight,
 * so what the filter kept and what the row paints can never disagree.
 *
 * Kept as its own module rather than duplicated in both components: a second copy of the
 * normalizer is exactly how a match without a visible highlight gets introduced.
 */

/** Lowercased, diacritic-free form of `value`, plus the source index each output char came from. */
function normalizeWithIndex(value: string): { normalized: string; sourceIndexes: number[] } {
  let normalized = "";
  const sourceIndexes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const folded = value[index]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    for (let offset = 0; offset < folded.length; offset += 1) {
      normalized += folded[offset];
      sourceIndexes.push(index);
    }
  }
  return { normalized, sourceIndexes };
}

/** Lowercased, diacritic-free form of `value`. */
export function normalizeForMatch(value: string): string {
  return normalizeWithIndex(value).normalized;
}

/** True when `query` appears anywhere in `value`, ignoring case and diacritics. An empty query matches everything. */
export function matchesQuery(value: string, query: string): boolean {
  const normalizedQuery = normalizeForMatch(query.trim());
  if (normalizedQuery === "") return true;
  return normalizeForMatch(value).includes(normalizedQuery);
}

export type MatchPart = { text: string; isMatch: boolean };

/**
 * Splits `text` around the first occurrence of `query`, mapping the match back to the ORIGINAL
 * characters so an accented name highlights the accented span, not a folded stand-in. Returns a
 * single non-matching part when there is nothing to highlight.
 */
export function splitOnMatch(text: string, query: string): MatchPart[] {
  const trimmed = query.trim();
  if (trimmed === "") return [{ text, isMatch: false }];

  const { normalized, sourceIndexes } = normalizeWithIndex(text);
  const normalizedQuery = normalizeForMatch(trimmed);
  if (normalizedQuery === "") return [{ text, isMatch: false }];

  const start = normalized.indexOf(normalizedQuery);
  if (start === -1) return [{ text, isMatch: false }];

  const sourceStart = sourceIndexes[start];
  const lastNormalizedIndex = start + normalizedQuery.length - 1;
  const sourceEnd = sourceIndexes[lastNormalizedIndex] + 1;

  const parts: MatchPart[] = [];
  if (sourceStart > 0) parts.push({ text: text.slice(0, sourceStart), isMatch: false });
  parts.push({ text: text.slice(sourceStart, sourceEnd), isMatch: true });
  if (sourceEnd < text.length) parts.push({ text: text.slice(sourceEnd), isMatch: false });
  return parts;
}
