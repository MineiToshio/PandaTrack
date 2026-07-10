import { z } from "zod";

const MAX_NAME_QUERY_LENGTH = 200;
const MIN_DUPLICATE_LIMIT = 1;
const MAX_DUPLICATE_LIMIT = 20;

const nameQueryField = z.string().trim().min(1).max(MAX_NAME_QUERY_LENGTH);

/** Input contract for the blur-time duplicate suggestion lookup. */
export const duplicateCandidatesQuerySchema = z.object({
  nameQuery: nameQueryField,
  limit: z.number().int().min(MIN_DUPLICATE_LIMIT).max(MAX_DUPLICATE_LIMIT),
});

/** Input contract for the on-submit same-country duplicate check. */
export const duplicateCandidatesSubmitSchema = z.object({
  nameQuery: nameQueryField,
  countryCode: z.string().length(2),
});

export type DuplicateCandidatesQueryInput = z.infer<typeof duplicateCandidatesQuerySchema>;
export type DuplicateCandidatesSubmitInput = z.infer<typeof duplicateCandidatesSubmitSchema>;
