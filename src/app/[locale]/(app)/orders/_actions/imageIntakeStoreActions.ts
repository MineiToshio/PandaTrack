"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { findDuplicateCandidatesInCountry } from "@/lib/data/stores/storeQueries";
import {
  createStoreFromIntake,
  recordConfirmedStoreMatch,
  type RecordConfirmedStoreMatchOutcome,
} from "@/lib/data/stores/storeMatchingMutations";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import type { StoreStatus } from "../../../../../../generated/prisma/client";

/**
 * Store actions for the image-intake review screen: inline creation on an `unknown` match, and
 * confirming a match (a "Cambiar" correction, or picking a candidate out of an `ambiguous` list)
 * so the phone association is remembered for next time.
 *
 * Neither action touches the extraction engine or the draft schema: both take a plain storeId/name/
 * phone payload and delegate the write to the stores data layer, the same boundary the rest of the
 * store domain already owns.
 */

const optionalPhoneSchema = z.string().trim().min(1).max(60).nullable().optional();

const createStoreFromIntakeInputSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(200, "nameTooLong"),
  phone: optionalPhoneSchema,
  /** True when this creation resolves an `ambiguous` list via "Ninguna, crear una nueva". */
  wasAmbiguous: z.boolean().optional(),
  /** True to proceed despite a `possible-duplicate` response already shown to the user once. */
  confirmDuplicate: z.boolean().optional(),
});

export type CreateStoreFromIntakeErrorCode =
  "unauthorized" | "invalid-input" | "country-required" | "possible-duplicate" | "server-error";

export type CreateStoreFromIntakeResult =
  | { ok: true; storeId: string; name: string; status: StoreStatus }
  | {
      ok: false;
      code: CreateStoreFromIntakeErrorCode;
      /** Populated only for `possible-duplicate`, so the client can offer them instead of a blind retry. */
      candidates?: Array<{ storeId: string; name: string }>;
    };

/**
 * Creates a `PENDING` (or, for an admin, `APPROVED`) store from the review screen's inline creation
 * card, without leaving the screen. Guarded by the same near-duplicate check the manual store form
 * shows before submit (`findDuplicateCandidatesInCountry`), so this path cannot bypass the store
 * layer's duplicate protection: a caller who sees `possible-duplicate` must either pick one of the
 * returned candidates instead, or resubmit with `confirmDuplicate: true` to proceed anyway.
 */
export async function createStoreFromIntakeAction(rawInput: unknown): Promise<CreateStoreFromIntakeResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthorized" };
  }
  const userId = session.user.id;

  const parsed = createStoreFromIntakeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "invalid-input" };
  }
  const { name, phone, wasAmbiguous, confirmDuplicate } = parsed.data;

  const preferences = await getCollectorPreferencesSnapshot(userId);
  const countryCode = preferences?.preferredCountryCode ?? null;
  if (!countryCode) {
    // Intake never asks for a country: it is inferred from the collector's own settings. Without
    // one there is nothing honest to persist on the new store's required countryCode.
    return { ok: false, code: "country-required" };
  }

  try {
    if (!confirmDuplicate) {
      const duplicates = await findDuplicateCandidatesInCountry(name, countryCode, userId);
      if (duplicates.length > 0) {
        return {
          ok: false,
          code: "possible-duplicate",
          candidates: duplicates.map((candidate) => ({ storeId: candidate.id, name: candidate.name })),
        };
      }
    }

    const isAdmin = getIsAdmin(session);
    const status: StoreStatus = isAdmin ? "APPROVED" : "PENDING";

    const created = await createStoreFromIntake({
      name,
      phone: phone ?? null,
      countryCode,
      createdByUserId: userId,
      status,
      approvedByUserId: isAdmin ? userId : null,
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.IMAGE_INTAKE.STORE_CREATED_INLINE,
      properties: { had_phone: Boolean(phone), was_ambiguous: Boolean(wasAmbiguous), status },
    });
    if (wasAmbiguous) {
      posthog.capture({
        distinctId: userId,
        event: POSTHOG_EVENTS.IMAGE_INTAKE.STORE_AMBIGUITY_RESOLVED,
        properties: { resolution: "created_new" },
      });
    }
    await posthog.shutdown();

    return { ok: true, storeId: created.id, name, status };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "createStoreFromIntake" } });
    return { ok: false, code: "server-error" };
  }
}

const confirmStoreMatchInputSchema = z.object({
  storeId: z.string().min(1),
  phone: optionalPhoneSchema,
  /** Candidate count shown when this confirms an `ambiguous` pick; omitted for a "Cambiar" correction. */
  candidateCount: z.number().int().min(1).max(50).optional(),
});

export type ConfirmStoreMatchResult =
  | {
      ok: true;
      /** False when the pick was accepted but taught the matcher nothing; see `outcome` for why. */
      learned: boolean;
      outcome: RecordConfirmedStoreMatchOutcome;
    }
  | { ok: false; code: "unauthorized" | "invalid-input" | "server-error" };

/**
 * Confirms the store the user picked for this intake, either correcting a `certain` match via
 * "Cambiar" or resolving an `ambiguous` list, and remembers the phone association through
 * `recordConfirmedStoreMatch`.
 *
 * The store id arrives from the client and is never treated as authorization: the review screen is
 * handed the whole orderable catalog, so any authenticated caller can name any store. The data layer
 * decides whether the caller's relationship with that store makes their contribution trustworthy,
 * and reports back through `outcome`. A refused contribution is not an error for the user: their
 * pick still stands on the draft, only the shared catalog is left untouched, so the result stays
 * `ok: true` with `learned: false` rather than surfacing a failure they cannot act on.
 *
 * Fires `STORE_AMBIGUITY_RESOLVED` only when it actually resolves an ambiguity (`candidateCount`
 * present), not on a plain correction of an already-certain match.
 */
export async function confirmStoreMatchAction(rawInput: unknown): Promise<ConfirmStoreMatchResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthorized" };
  }
  const userId = session.user.id;

  const parsed = confirmStoreMatchInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "invalid-input" };
  }

  try {
    const outcome = await recordConfirmedStoreMatch({
      userId,
      storeId: parsed.data.storeId,
      phone: parsed.data.phone ?? null,
    });

    if (parsed.data.candidateCount !== undefined) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: POSTHOG_EVENTS.IMAGE_INTAKE.STORE_AMBIGUITY_RESOLVED,
        properties: {
          resolution: "candidate_picked",
          candidate_count: parsed.data.candidateCount,
          // How often a confirmation feeds the matcher, so the restriction above is measurable
          // rather than assumed.
          match_learned: outcome === "recorded",
        },
      });
      await posthog.shutdown();
    }

    return { ok: true, learned: outcome === "recorded", outcome };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "confirmStoreMatch" } });
    return { ok: false, code: "server-error" };
  }
}
