"use server";

import { prisma } from "@/lib/prisma";
import { findDuplicateCandidates, findDuplicateCandidatesInCountry } from "@/queries/store";
import { SIMILARITY_THRESHOLD_PERCENT } from "@/lib/store/duplicateMatch";

const DEFAULT_LIMIT = 5;

/**
 * Returns store candidates that may duplicate the given name query.
 * Used by the create-store form to show suggestions when the name input loses focus (blur).
 */
export async function getDuplicateCandidates(nameQuery: string, limit: number = DEFAULT_LIMIT) {
  return findDuplicateCandidates(prisma, nameQuery, limit);
}

/**
 * Returns stores in the given country whose name similarity meets the threshold.
 * Used on create-store submit to show the confirmation modal only when there are similar stores in the same country.
 */
export async function getDuplicateCandidatesForSubmit(nameQuery: string, countryCode: string) {
  return findDuplicateCandidatesInCountry(prisma, nameQuery, countryCode, DEFAULT_LIMIT, SIMILARITY_THRESHOLD_PERCENT);
}
