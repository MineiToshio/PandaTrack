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
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

const GENERIC_STORE_TERMS = new Set([
  "store",
  "shop",
  "tienda",
  "official",
  "oficial",
  "collectibles",
  "collector",
  "collectors",
  "merch",
  "online",
]);

function tokenizeStoreName(name: string): string[] {
  const normalized = normalizeStoreName(name);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function getMeaningfulTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !GENERIC_STORE_TERMS.has(token));
}

function getTokenOverlapScore(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;
  const candidateTokenSet = new Set(candidateTokens);
  const sharedCount = queryTokens.filter((token) => candidateTokenSet.has(token)).length;
  if (sharedCount === 0) return 0;
  return Math.round((sharedCount / queryTokens.length) * 100);
}

/**
 * Produces a relevance score for duplicate store suggestions.
 * Higher is better; zero means no relevant match.
 */
export function getDuplicateMatchScore(query: string, candidateName: string): number {
  const normalizedQuery = normalizeStoreName(query);
  const normalizedCandidate = normalizeStoreName(candidateName);

  if (!normalizedQuery || !normalizedCandidate) return 0;

  const queryTokens = tokenizeStoreName(normalizedQuery);
  const candidateTokens = tokenizeStoreName(normalizedCandidate);
  const queryMeaningfulTokens = getMeaningfulTokens(queryTokens);
  const candidateMeaningfulTokens = getMeaningfulTokens(candidateTokens);
  const effectiveQueryTokens = queryMeaningfulTokens.length > 0 ? queryMeaningfulTokens : queryTokens;
  const effectiveCandidateTokens = candidateMeaningfulTokens.length > 0 ? candidateMeaningfulTokens : candidateTokens;

  let score = 0;

  if (normalizedCandidate === normalizedQuery) {
    score += 400;
  }

  const minLengthForSubstringBonus = 2;
  const shorter = normalizedQuery.length <= normalizedCandidate.length ? normalizedQuery : normalizedCandidate;
  const longer = normalizedQuery.length > normalizedCandidate.length ? normalizedQuery : normalizedCandidate;
  const hasSubstringMatch = longer.includes(shorter) && shorter.length >= minLengthForSubstringBonus;
  if (hasSubstringMatch) {
    score += 150;
  }

  const candidateTokenSet = new Set(effectiveCandidateTokens);
  const matchingTokenCount = effectiveQueryTokens.filter((token) => candidateTokenSet.has(token)).length;
  if (matchingTokenCount > 0) {
    score += matchingTokenCount * 40;
    if (matchingTokenCount === effectiveQueryTokens.length) {
      score += 120;
    }
  }

  const overlapScore = getTokenOverlapScore(effectiveQueryTokens, effectiveCandidateTokens);
  score += overlapScore;

  const genericOnlyQuery =
    queryMeaningfulTokens.length === 0 && queryTokens.some((token) => GENERIC_STORE_TERMS.has(token));
  if (genericOnlyQuery) {
    score = normalizedCandidate === normalizedQuery ? score : 0;
  }

  return score;
}

/** Score value that corresponds to 100% similarity (exact / near-exact match). */
const SCORE_FOR_100_PERCENT = 500;

/**
 * Converts the raw duplicate match score to a 0–100 similarity percentage for threshold and display.
 */
export function getSimilarityPercent(query: string, candidateName: string): number {
  const score = getDuplicateMatchScore(query, candidateName);
  return Math.min(100, Math.round((score / SCORE_FOR_100_PERCENT) * 100));
}

/** Minimum name similarity (0–100) to consider a store a duplicate candidate in the same country. */
export const SIMILARITY_THRESHOLD_PERCENT = 70;
