"use server";

import { getSession } from "@/lib/auth/auth-server";
import { findDuplicateCandidates, findDuplicateCandidatesInCountry } from "@/lib/data/stores/storeQueries";
import { SIMILARITY_THRESHOLD_PERCENT } from "@/lib/store/duplicateMatch";
import type { DuplicateCandidate } from "@/lib/data/stores/storeQueries";
import {
  duplicateCandidatesQuerySchema,
  duplicateCandidatesSubmitSchema,
} from "../_schemas/duplicateCandidatesSchema";

const DEFAULT_LIMIT = 5;

/**
 * Returns store candidates that may duplicate the given name query.
 * Used by the create-store form to show suggestions when the name input loses focus (blur).
 * Requires an authenticated session and validated input; returns an empty list otherwise.
 */
export async function getDuplicateCandidates(
  nameQuery: string,
  limit: number = DEFAULT_LIMIT,
): Promise<DuplicateCandidate[]> {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const parsed = duplicateCandidatesQuerySchema.safeParse({ nameQuery, limit });
  if (!parsed.success) return [];

  return findDuplicateCandidates(parsed.data.nameQuery, session.user.id, parsed.data.limit);
}

/**
 * Returns stores in the given country whose name similarity meets the threshold.
 * Used on create-store submit to show the confirmation modal only when there are similar stores in the same country.
 * Requires an authenticated session and validated input; returns an empty list otherwise.
 */
export async function getDuplicateCandidatesForSubmit(
  nameQuery: string,
  countryCode: string,
): Promise<DuplicateCandidate[]> {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const parsed = duplicateCandidatesSubmitSchema.safeParse({ nameQuery, countryCode });
  if (!parsed.success) return [];

  return findDuplicateCandidatesInCountry(
    parsed.data.nameQuery,
    parsed.data.countryCode,
    session.user.id,
    DEFAULT_LIMIT,
    SIMILARITY_THRESHOLD_PERCENT,
  );
}
