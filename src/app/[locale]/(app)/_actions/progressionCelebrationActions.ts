"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { claimRankCelebration } from "@/lib/data/progression/progressionMutations";
import {
  getRankCelebrationContent,
  getUserProgressCache,
  getWelcomeCelebrationContent,
  type RankCelebrationContent,
  type WelcomeCelebrationContent,
} from "@/lib/data/progression/progressionQueries";

/**
 * The two server-gated celebrations.
 *
 * The unlock toast and the medal celebration are raised straight off the credited action's own
 * payload and never come through here: they announce something that just became true and cannot be
 * true twice. A rank, by contrast, can be re-derived by any later recompute, so the surface that
 * announces it has to be claimed rather than merely decided (`FR-12-19`). The claim is the same
 * mechanism the migrated history's aggregated welcome uses, so neither can replay.
 *
 * Neither action takes a target user. The acting collector is resolved from the session and both
 * writes are scoped to their own rows, so there is no cross-user surface here at all (`BR-12-02`).
 */

export type ClaimRankCelebrationResult = { claimed: false } | { claimed: true; content: RankCelebrationContent };

/**
 * Claims the celebration for a rank the collector has just reached, and returns what to render.
 *
 * The claim happens before the modal opens, not after it is dismissed. A collector who navigates
 * away mid-animation has still crossed the rank, and replaying the celebration on their next credited
 * action would be worse than missing it once.
 */
export async function claimRankCelebrationAction(
  rankIndex: number,
  previousRankIndex: number,
): Promise<ClaimRankCelebrationResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { claimed: false };
  }

  try {
    // The rank arrives from the client, and the claim it drives is a one-way watermark: a stale or
    // tampered index would advance `lastCelebratedRankIndex` past ranks the collector has not
    // reached yet and permanently swallow their real celebrations on the way up. So it is checked
    // against what the server already derived, and a rank above the recorded high-water mark
    // claims nothing rather than being trusted.
    const progress = await getUserProgressCache(session.user.id);
    if (!progress || rankIndex > progress.highestRankIndex) {
      return { claimed: false };
    }

    const claimed = await claimRankCelebration(session.user.id, rankIndex);
    if (!claimed) {
      return { claimed: false };
    }

    const content = await getRankCelebrationContent(session.user.id, rankIndex, previousRankIndex);
    if (!content) {
      return { claimed: false };
    }

    // Reported from the server because this is where the claim happens: a client-side event would
    // count the render, and the render is exactly the part that may never arrive.
    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.PROGRESSION.RANK_UP_CELEBRATED,
      properties: { rank_index: content.rankIndex, previous_rank_index: previousRankIndex },
    });

    return { claimed: true, content };
  } catch (error) {
    // A celebration that fails is a lost animation, never a lost point: the ledger entry behind it
    // is already committed, so the collector loses nothing they can see on the next visit.
    Sentry.captureException(error, { extra: { action: "claimRankCelebrationAction" } });
    return { claimed: false };
  }
}

export type ClaimWelcomeCelebrationResult = { claimed: false } | { claimed: true; content: WelcomeCelebrationContent };

/**
 * Claims the one-time aggregated welcome the migrated history earns (`FR-12-43`, `AC-12-11`).
 *
 * Claimed against the same watermark as a rank celebration, at the rank the backfill left the
 * collector on, which is exactly what makes it replace every rank celebration the migrated history
 * would otherwise have fired on its way up.
 */
export async function claimWelcomeCelebrationAction(): Promise<ClaimWelcomeCelebrationResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { claimed: false };
  }

  try {
    const content = await getWelcomeCelebrationContent(session.user.id);
    if (!content) {
      return { claimed: false };
    }

    const claimed = await claimRankCelebration(session.user.id, content.rankIndex);
    return claimed ? { claimed: true, content } : { claimed: false };
  } catch (error) {
    Sentry.captureException(error, { extra: { action: "claimWelcomeCelebrationAction" } });
    return { claimed: false };
  }
}
