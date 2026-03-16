"use server";

import { prisma } from "@/lib/prisma";
import { findDuplicateCandidates } from "@/queries/store";

const DEFAULT_LIMIT = 5;

/**
 * Returns store candidates that may duplicate the given name query.
 * Used by the create-store form to show suggestions when the name input loses focus.
 */
export async function getDuplicateCandidates(nameQuery: string, limit: number = DEFAULT_LIMIT) {
  return findDuplicateCandidates(prisma, nameQuery, limit);
}
