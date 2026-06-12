import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { DuplicateCandidate } from "@/queries/store";
import { getDuplicateCandidates, getDuplicateCandidatesForSubmit } from "../new/_actions/getDuplicateCandidates";

export const MIN_DUPLICATE_QUERY_LENGTH = 2;

/**
 * Fetches duplicate-store suggestions for the name typed so far (blur check).
 * Returns an empty list for queries shorter than the minimum length and
 * tracks the suggestions-shown event when there are candidates.
 */
export async function fetchDuplicateCandidatesForQuery(query: string): Promise<DuplicateCandidate[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < MIN_DUPLICATE_QUERY_LENGTH) return [];

  const candidates = await getDuplicateCandidates(trimmedQuery);
  if (candidates.length > 0) {
    posthog.capture(POSTHOG_EVENTS.STORE.DUPLICATE_SUGGESTIONS_SHOWN, {
      candidate_count: candidates.length,
      name_query: trimmedQuery,
    });
  }
  return candidates;
}

/**
 * Checks for similar stores in the submitted country right before creating.
 * Returns the candidates that should gate the submit behind a confirmation
 * modal and tracks the modal-shown event when there are any.
 */
export async function checkDuplicateCandidatesOnSubmit(formData: FormData): Promise<DuplicateCandidate[]> {
  const submittedName = formData.get("name");
  const submittedCountry = formData.get("countryCode");
  const nameToValidate = typeof submittedName === "string" ? submittedName.trim() : "";
  const submittedCountryCode = typeof submittedCountry === "string" ? submittedCountry : "";

  const candidates = await getDuplicateCandidatesForSubmit(nameToValidate, submittedCountryCode);
  if (candidates.length > 0) {
    posthog.capture(POSTHOG_EVENTS.STORE.DUPLICATE_SUBMIT_MODAL_SHOWN, {
      candidate_count: candidates.length,
      name_query: nameToValidate,
      country_code: submittedCountryCode,
    });
  }
  return candidates;
}
