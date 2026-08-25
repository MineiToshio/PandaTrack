"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import MedalStage, { resolveMedalArtSrc } from "@/components/core/MedalStage";
import { RARITY_GRADES, getRarityRingVar, type RarityGrade } from "@/components/core/RarityChip";
import { DEFAULT_DURATION_MS, useToast } from "@/contexts/ToastContext";
import ProgressionCelebration, {
  isCelebratedRarity,
  type ProgressionCelebrationItem,
} from "@/components/modules/ProgressionCelebration";
import { findMedal } from "@/lib/data/progression/medalCatalogue";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  claimRankCelebrationAction,
  claimWelcomeCelebrationAction,
} from "@/app/[locale]/(app)/_actions/progressionCelebrationActions";
import type { MedalUnlockSummary, ProgressionDelta } from "@/lib/data/progression/accrual";

/**
 * The single owner of every progression surface that appears over another flow.
 *
 * Three problems live here together because they are one problem: an unlock toast, a rank
 * celebration and the migrated history's welcome all interrupt whatever the collector was doing,
 * and each of them has to know what the others are doing. Spreading them across the six client
 * coordinators that credit points would give six copies of the same sequencing bug.
 *
 * What it guarantees:
 *
 *   1. **Optimistic.** Everything is raised off the credited Server Action's own payload
 *      (`FR-12-13`); nothing here waits for a navigation, a refetch or a deferred hook. The single
 *      exception is the rank celebration, which is server-claimed before it opens, because a rank
 *      is the one fact a later recompute can re-derive and therefore replay (`FR-12-19`).
 *   2. **One toast at a time.** `ToastContext` stacks by design, which is right for confirmations
 *      and wrong for unlocks: an action that unlocks three medals must announce them in sequence,
 *      never as an overlapping pile (`FR-12-29`). The queue below is additive to the toast system,
 *      not a fork of it. Past `MEDAL_BURST_THRESHOLD` the sequence stops being readable and the
 *      whole batch collapses into a single toast naming the count.
 *   3. **One dialog at a time.** A rank-up and a qualifying medal unlock in the same response are
 *      queued, not stacked: two canonical modals cannot both own focus.
 *   4. **Silent when the layer is off.** With `"Ocultar mi progresión"` on, nothing here raises
 *      anything, in the same tick the switch is flipped (`FR-12-38`, `AC-12-13`).
 */

/** Separation between two unlock toasts: the first one's whole read window, plus a beat. */
const MEDAL_TOAST_GAP_MS = 400;
const MEDAL_TOAST_STEP_MS = DEFAULT_DURATION_MS + MEDAL_TOAST_GAP_MS;

/**
 * How many medals one action may announce individually before the whole batch collapses into a
 * single toast.
 *
 * Three is where a sequence stops reading as a sequence. At the step above, four toasts already
 * hold the screen for the better part of twenty seconds; the first credited action of a collector
 * whose history was migrated unlocks TEN at once, which is forty seconds of stacked interruption
 * over whatever they were actually doing, plus a full-screen celebration behind it. `FR-12-29`
 * promises the unlocks arrive one at a time rather than as a pile, and this keeps that promise in
 * the case the queue alone cannot: the pile is replaced by one honest count, and the album is
 * where the ten are actually read (the same reasoning `FR-12-43` already applies to the migrated
 * history's single aggregated welcome).
 */
const MEDAL_BURST_THRESHOLD = 3;

type ProgressionFeedbackValue = {
  /** `false` while the layer is hidden. Read by the shell so the nav entry follows the switch. */
  progressionVisible: boolean;
  /** Applies the switch locally, before the server has answered, and on the revert path after. */
  setProgressionVisible: (visible: boolean) => void;
  /** Raises whatever a credited Server Action's `progression` payload earned. Never throws. */
  announceProgression: (delta: ProgressionDelta | null | undefined) => void;
};

const ProgressionFeedbackContext = createContext<ProgressionFeedbackValue | null>(null);

/** What every consumer outside the private app shell gets: a layer that exists and does nothing. */
const FALLBACK_FEEDBACK: ProgressionFeedbackValue = {
  progressionVisible: false,
  setProgressionVisible: () => {},
  announceProgression: () => {},
};

export type ProgressionFeedbackProviderProps = {
  children: React.ReactNode;
  locale: string;
  /**
   * Whether the layer is on. Controlled by the app shell rather than held here: the shell renders
   * the navigation entry that has to disappear with it, and it is this provider's own parent, so it
   * cannot read a state this provider owns.
   */
  progressionVisible: boolean;
  /** Applies the switch, optimistically from the settings toggle and again on its revert path. */
  onProgressionVisibleChange: (visible: boolean) => void;
  /**
   * Whether a migrated history is still waiting for its one aggregated welcome. Resolved on the
   * server so the client only spends a round trip on the collectors who actually have one.
   */
  welcomeCelebrationPending?: boolean;
};

export function ProgressionFeedbackProvider({
  children,
  locale,
  progressionVisible,
  onProgressionVisibleChange,
  welcomeCelebrationPending = false,
}: ProgressionFeedbackProviderProps) {
  const t = useTranslations("progress");
  const router = useRouter();
  const { addToast } = useToast();

  const [celebrations, setCelebrations] = useState<ProgressionCelebrationItem[]>([]);

  const toastQueueRef = useRef<MedalUnlockSummary[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainRef = useRef<() => void>(() => {});
  // The queue is drained by a timer that outlives any single render, so the gate it reads has to be
  // a ref rather than the captured state: switching the layer off must silence the toasts still in
  // flight, not only the ones announced afterwards.
  const visibleRef = useRef(progressionVisible);
  useEffect(() => {
    visibleRef.current = progressionVisible;
    // Whatever is still waiting its turn is dropped with it. The drain re-reads the same gate on
    // every step, so a toast already on screen is the most that can survive the switch.
    if (!progressionVisible) {
      toastQueueRef.current = [];
    }
  }, [progressionVisible]);

  // Sized by the caller: `MedalStage` draws at `min(size, 100%)` so it can fit a narrow grid cell,
  // and the toast's media slot has no intrinsic width to resolve that against.
  const renderToastMedia = useCallback(
    (medal: MedalUnlockSummary, medalName: string, rarityLabel: string) => (
      <span className="block w-[72px]">
        <MedalStage
          medalKey={medal.medalKey}
          grade={medal.rarity as RarityGrade}
          size="sm"
          imageSrc={resolveMedalArtSrc(findMedal(medal.medalKey)?.imageKey)}
          label={t("detail.artLabel", { name: medalName, rarity: rarityLabel })}
        />
      </span>
    ),
    [t],
  );

  const raiseMedalToast = useCallback(
    (medal: MedalUnlockSummary) => {
      const grade = medal.rarity as RarityGrade;
      const medalName = t(`medals.${medal.medalKey}.name` as never);
      const rarityLabel = t(`rarity.${grade}` as never);

      addToast(medalName, {
        variant: "achievement",
        achievement: {
          media: renderToastMedia(medal, medalName, rarityLabel),
          kicker: t("celebration.toast.kicker"),
          meta: t("celebration.toast.meta", {
            rarity: rarityLabel,
            series: t(`series.${medal.series}.name` as never),
          }),
          ringVar: getRarityRingVar(grade),
        },
      });

      posthog.capture(POSTHOG_EVENTS.PROGRESSION.MEDAL_TOAST_SHOWN, {
        medal_key: medal.medalKey,
        rarity: medal.rarity,
        series: medal.series,
      });
    },
    [addToast, renderToastMedia, t],
  );

  /**
   * The one toast a burst gets instead of a queue of its own.
   *
   * It is deliberately not a shortened queue: announcing three of ten and dropping the rest would
   * be a lie about what happened. It states the count, wears the rarest of the batch so the moment
   * still looks earned, and points at the album, which is the surface built to read ten medals.
   */
  const raiseBurstToast = useCallback(
    (medals: readonly MedalUnlockSummary[]) => {
      const rarest = medals.reduce((best, medal) =>
        RARITY_GRADES.indexOf(medal.rarity as RarityGrade) > RARITY_GRADES.indexOf(best.rarity as RarityGrade)
          ? medal
          : best,
      );
      const grade = rarest.rarity as RarityGrade;
      const rarestName = t(`medals.${rarest.medalKey}.name` as never);
      const rarityLabel = t(`rarity.${grade}` as never);

      addToast(t("celebration.burst.title", { count: medals.length }), {
        variant: "achievement",
        achievement: {
          media: renderToastMedia(rarest, rarestName, rarityLabel),
          kicker: t("celebration.burst.kicker"),
          meta: t("celebration.burst.meta"),
          ringVar: getRarityRingVar(grade),
        },
      });

      posthog.capture(POSTHOG_EVENTS.PROGRESSION.MEDAL_BURST_TOAST_SHOWN, {
        medal_count: medals.length,
        rarity: grade,
      });
    },
    [addToast, renderToastMedia, t],
  );

  /**
   * The order-creation points toast (`FR-12-05`): the one surface that states the immediate credit
   * and, when one is still owed, the deferred sublinear amount in the same plain sentence, rather
   * than leaving `pointsDelta` silently unused. Raised beside the medal/rank queue below, never
   * instead of it: an order creation can also be a collector's first credited action ever.
   */
  const raiseOrderPointsToast = useCallback(
    (pointsDelta: number, deferredOrderPoints: number | null) => {
      const message =
        deferredOrderPoints && deferredOrderPoints > 0
          ? t("creation.toast.withDeferred", { points: pointsDelta, deferred: deferredOrderPoints })
          : t("creation.toast.immediateOnly", { points: pointsDelta });

      addToast(message, { variant: "success" });

      posthog.capture(POSTHOG_EVENTS.PROGRESSION.ORDER_POINTS_TOAST_SHOWN, {
        points_delta: pointsDelta,
        deferred_points: deferredOrderPoints ?? 0,
      });
    },
    [addToast, t],
  );

  // Ref-indirected so the timer chain below always calls the current closure. A plain dependency
  // would rebuild the chain mid-drain and drop whatever was still queued.
  const drainToastQueue = useCallback(() => {
    const next = toastQueueRef.current.shift();
    if (!next || !visibleRef.current) {
      toastQueueRef.current = [];
      toastTimerRef.current = null;
      return;
    }
    raiseMedalToast(next);
    toastTimerRef.current = setTimeout(() => drainRef.current(), MEDAL_TOAST_STEP_MS);
  }, [raiseMedalToast]);

  useEffect(() => {
    drainRef.current = drainToastQueue;
  });

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const enqueueCelebrations = useCallback((items: readonly ProgressionCelebrationItem[]) => {
    if (items.length === 0) return;
    setCelebrations((current) => [...current, ...items]);
  }, []);

  const announceProgression = useCallback(
    (delta: ProgressionDelta | null | undefined) => {
      // `null` is "we do not know what this credited", never "nothing": guessing a surface from it
      // would announce something that may not have happened.
      if (!delta || !visibleRef.current) return;

      // `deferredOrderPoints` is only ever set on the delta an order creation produces (`FR-12-05`);
      // every other credited action leaves the key off entirely. Skipped when neither figure is
      // actually positive, so a private or not-yet-approved store's zero-credit order stays silent
      // rather than reading "you earned 0 points".
      if (delta.deferredOrderPoints !== undefined && (delta.pointsDelta > 0 || (delta.deferredOrderPoints ?? 0) > 0)) {
        raiseOrderPointsToast(delta.pointsDelta, delta.deferredOrderPoints);
      }

      // A batch too large to read as a sequence is collapsed whole: one toast, and no medal
      // celebrations either. Escalating the rarest of ten to a full-screen dialog on top of the
      // summary toast would put back exactly the interruption the collapse removes, and the album
      // the toast points at shows every one of them in their own frame anyway.
      const isBurst = delta.medalsUnlocked.length > MEDAL_BURST_THRESHOLD;
      if (isBurst) {
        raiseBurstToast(delta.medalsUnlocked);
      }

      // A qualifying unlock is announced by the full-screen surface INSTEAD of the toast, not in
      // addition to it (`FR-12-47`): the same medal arriving twice would read as two unlocks.
      const toasted = isBurst ? [] : delta.medalsUnlocked.filter((medal) => !isCelebratedRarity(medal.rarity));
      if (toasted.length > 0) {
        toastQueueRef.current.push(...toasted);
        if (toastTimerRef.current === null) drainToastQueue();
      }

      // A qualifying unlock waits behind the rank rather than racing it: the claim is a round trip
      // and the medals are already in hand, so appending them first would reliably invert the order
      // the collector should read them in. They are appended on the claim's failure path too, so a
      // celebration that cannot be claimed never swallows the ones queued behind it.
      const medalCelebrations = (isBurst ? [] : delta.medalsUnlocked)
        .filter((medal) => isCelebratedRarity(medal.rarity))
        .map<ProgressionCelebrationItem>((medal) => ({
          kind: "medal",
          medalKey: medal.medalKey,
          rarity: medal.rarity as RarityGrade,
          series: medal.series,
        }));

      if (delta.rankUp) {
        const { from, to } = delta.rankUp;
        void claimRankCelebrationAction(to, from).then(
          (result) => {
            enqueueCelebrations(
              result.claimed ? [{ kind: "rank", content: result.content }, ...medalCelebrations] : medalCelebrations,
            );
          },
          () => {
            // A celebration that cannot be claimed is a lost animation, never a lost point.
            enqueueCelebrations(medalCelebrations);
          },
        );
        return;
      }

      enqueueCelebrations(medalCelebrations);
    },
    [drainToastQueue, enqueueCelebrations, raiseBurstToast, raiseOrderPointsToast],
  );

  // The migrated history's single welcome, claimed once per collector on the first shell mount that
  // finds it pending. It replaces every rank celebration that history would otherwise have fired.
  const welcomeClaimedRef = useRef(false);
  useEffect(() => {
    if (!welcomeCelebrationPending || !progressionVisible || welcomeClaimedRef.current) return;
    welcomeClaimedRef.current = true;
    void claimWelcomeCelebrationAction().then(
      (result) => {
        if (result.claimed) enqueueCelebrations([{ kind: "welcome", content: result.content }]);
      },
      () => {
        // Same reasoning as the rank claim: a welcome that fails to claim is not worth a message.
      },
    );
  }, [enqueueCelebrations, progressionVisible, welcomeCelebrationPending]);

  const current = celebrations[0] ?? null;

  // Reported when the surface actually reaches the screen, not when it was queued: a medal
  // celebration waiting behind a rank-up has not been seen yet. The rank variant reports itself
  // server-side, at the moment it is claimed, so it is not repeated here.
  useEffect(() => {
    if (current?.kind !== "medal") return;
    posthog.capture(POSTHOG_EVENTS.PROGRESSION.MEDAL_CELEBRATED, {
      medal_key: current.medalKey,
      rarity: current.rarity,
    });
  }, [current]);

  const handleCloseCelebration = useCallback(() => {
    setCelebrations((queue) => {
      const [shown, ...rest] = queue;
      if (shown) {
        posthog.capture(POSTHOG_EVENTS.PROGRESSION.CELEBRATION_DISMISSED, { celebration_kind: shown.kind });
      }
      return rest;
    });
  }, []);

  const handleOpenAlbum = useCallback(
    (medalKey: string) => {
      handleCloseCelebration();
      router.push(`/${locale}${ROUTES.progressMedals}/${medalKey}`);
    },
    [handleCloseCelebration, locale, router],
  );

  const handleOpenProgress = useCallback(() => {
    handleCloseCelebration();
    router.push(`/${locale}${ROUTES.progress}`);
  }, [handleCloseCelebration, locale, router]);

  // Switching the layer off has to silence what is already queued, not only what comes next. The
  // celebration queue is cleared during render rather than in an effect: an effect would let one
  // more frame of an already queued dialog through, which is exactly the flash the switch promises
  // not to produce. The toast queue is cleared beside `visibleRef` above, where its own gate lives.
  const [lastVisible, setLastVisible] = useState(progressionVisible);
  if (lastVisible !== progressionVisible) {
    setLastVisible(progressionVisible);
    if (!progressionVisible) {
      setCelebrations([]);
    }
  }

  const value = useMemo<ProgressionFeedbackValue>(
    () => ({ progressionVisible, setProgressionVisible: onProgressionVisibleChange, announceProgression }),
    [announceProgression, onProgressionVisibleChange, progressionVisible],
  );

  return (
    <ProgressionFeedbackContext.Provider value={value}>
      {children}
      {progressionVisible ? (
        <ProgressionCelebration
          item={current}
          onClose={handleCloseCelebration}
          onOpenAlbum={handleOpenAlbum}
          onOpenProgress={handleOpenProgress}
        />
      ) : null}
    </ProgressionFeedbackContext.Provider>
  );
}

/**
 * The progression surfaces, from any client coordinator that credits points.
 *
 * Returns a silent no-op outside the private app shell rather than throwing. A credited mutation
 * must never fail because the surface that would have announced it is not mounted, and several of
 * the coordinators that call this are also rendered in contexts (tests, public pages) that have no
 * progression layer at all.
 */
export function useProgressionFeedback(): ProgressionFeedbackValue {
  const ctx = useContext(ProgressionFeedbackContext);
  return ctx ?? FALLBACK_FEEDBACK;
}
