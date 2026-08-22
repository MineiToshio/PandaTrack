"use client";

import { AlertTriangle, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import AlertBanner from "@/components/modules/AlertBanner";
import type { StoreComboboxOption } from "@/components/modules/StoreCombobox";
import { useToast } from "@/contexts/ToastContext";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { prepareSubmissionForIntake } from "@/lib/images/compressForIntake";
import { readImageDimensionsFromUrl } from "@/lib/images/readImageDimensions";
import {
  countPhotosWithinSubmissionBudget,
  precheckAttachedPhotos,
  precheckPreparedSegments,
} from "@/lib/imageIntake/clientPrecheck";
import { checkIntakeSourceDimensions, type IntakeDimensionIssue } from "@/lib/imageIntake/dimensionPrecheck";
import { MAX_IMAGE_HEIGHT, MAX_IMAGE_WIDTH, MIN_IMAGE_DIMENSION } from "@/lib/imageIntake/constants";
import { computePhotoOverflow, type ImageIntakeQuotaSnapshot } from "@/lib/imageIntake/quota";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import { writeManualPrefillStash } from "@/lib/imageIntake/manualPrefillStash";
import { authClient } from "@/lib/auth/auth-client";
import {
  readAndClearShareStash,
  SHARE_RESUMED_AFTER_AUTH_MIN_AGE_MS,
  SHARE_SOURCE_IOS_SHORTCUT,
  SHARE_SOURCE_PARAM,
  SHARE_SOURCE_SHARE,
  SHARE_STASH_FAILED,
  SHARE_STASH_PARAM,
  sweepExpiredShareStash,
} from "@/lib/pwa/shareStash";
import {
  IMAGE_INTAKE_ENTRY_SOURCE_FIELD,
  IMAGE_INTAKE_FILES_FIELD,
  IMAGE_INTAKE_LOCALE_FIELD,
  newImageIntakeSaveToken,
} from "../../../_actions/imageIntakeContract";
import { extractOrderFromImagesAction } from "../../../_actions/imageIntakeExtractAction";
import type { IntakeBreakdownPayload } from "@/lib/imageIntake/intakeBreakdownContract";
import { saveOrderFromDraftAction } from "../../../_actions/imageIntakeSaveAction";
import IntakeProcessingPanel, { type IntakeProcessingStep } from "./IntakeProcessingPanel";
import IntakeQuotaExhausted from "./IntakeQuotaExhausted";
import IntakeReviewScreen from "./IntakeReviewScreen";
import IntakeUploadPanel, { type IntakeAttachment } from "./IntakeUploadPanel";
import {
  clientErrorMessageKey,
  dimensionIssueMessage,
  extractErrorMessageKey,
  extractErrorReference,
  fileTooLargeMessage,
  saveErrorMessageKey,
  serverDimensionMessage,
  type IntakeErrorState,
  type IntakePhotoIssueMessage,
} from "./intakeErrorCopy";

export type ImageIntakeScreenProps = {
  storeOptions: StoreComboboxOption[];
  /** The collector's photo balance as of this render, read server-side by the page. */
  quota: ImageIntakeQuotaSnapshot;
  /** The collector's base currency. The page only renders this screen once one is configured. */
  baseCurrencyCode: string;
  /** Active catalog category keys, so the review screen can correct a suggested category. */
  productTypeKeys: string[];
};

type IntakePhase = "upload" | "processing" | "review";

/**
 * Rough upload throughput used only to decide when the "Subiendo..." step gives way to "Leyendo la
 * conversación...". The two phases happen on the far side of a single Server Action call, which
 * exposes no progress event to observe, so this is the one estimated boundary in an otherwise real
 * three-step display. Both steps describe work that is genuinely happening; only the moment one
 * hands over to the other is approximated.
 */
const ESTIMATED_UPLOAD_BYTES_PER_MS = 120;
const MIN_UPLOAD_STEP_MS = 400;
const MAX_UPLOAD_STEP_MS = 4_000;

/** Values of {@link IMAGE_INTAKE_ENTRY_SOURCE_FIELD}, matching the persisted entry-source enum. */
const ENTRY_SOURCE_IN_APP = "IN_APP";
const ENTRY_SOURCE_SHARE = "SHARE";

type IntakeEntrySource = typeof ENTRY_SOURCE_IN_APP | typeof ENTRY_SOURCE_SHARE;

/** Analytics-side spelling of the door, snake_case like every other event property. */
const ENTRY_SOURCE_PROPERTY: Record<string, string> = {
  [SHARE_SOURCE_SHARE]: "share",
  [SHARE_SOURCE_IOS_SHORTCUT]: "ios_shortcut",
};

/**
 * What the screen tells a user who arrived from outside the app but has no photos attached:
 * `attach` when the stash was empty or expired, `ios` when the Shortcut opened the screen (iOS
 * cannot pass the bytes at all), `failed` when the hand-off itself broke.
 */
type ShareNotice = "attach" | "ios" | "failed";

/**
 * Epoch milliseconds the signed-in session started, or `null` when it cannot be established.
 *
 * The share pickup needs it to tell "this share was made under the session reading it now" from
 * "someone authenticated after these bytes arrived". Read from the auth client rather than passed
 * down as a prop so the guard lives next to the only code that depends on it.
 */
async function readSessionStartedAt(): Promise<number | null> {
  try {
    const { data } = await authClient.getSession();
    const createdAt = data?.session?.createdAt;
    if (!createdAt) return null;
    const startedAt = new Date(createdAt).getTime();
    return Number.isFinite(startedAt) ? startedAt : null;
  } catch {
    // An unreadable session is treated as an unknown one by the pickup, which refuses it. The user
    // is asked to attach the photos again rather than being handed someone else's.
    return null;
  }
}

function nextAttachmentId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

/**
 * Sorts one batch of freshly picked files by capture time, oldest first.
 *
 * The order of the attachments is meaningful: the extraction reads them as one conversation from
 * the first to the last, so a batch picked out of order would be read out of order. A file manager
 * hands them over in whatever order the picker felt like, and their modification time is the closest
 * thing to "when this screenshot was taken" the browser exposes.
 *
 * It sorts the BATCH ONLY, and the caller appends the result at the end of what is already
 * attached. Sorting the whole list on every add would be the obvious implementation and the wrong
 * one: it would silently undo any manual order the collector had just set, and manual order exists
 * precisely because the file dates can lie (someone who screenshots a chat from the bottom up gets
 * timestamps that run backwards). Automatic ordering is therefore a first guess about new files, and
 * never an opinion about files the collector has already arranged.
 *
 * `lastModified` is not guaranteed by every source (a pasted blob can report the paste instant), so
 * the sort is stable-by-construction on ties: `Array.prototype.sort` is stable, so files sharing a
 * timestamp keep the order they arrived in.
 */
function sortBatchByCaptureTime(files: File[]): File[] {
  return [...files].sort((left, right) => left.lastModified - right.lastModified);
}

/**
 * Local marker for the one-time quota explainer. Device-local on purpose: it decides whether one
 * sentence is shown, which is not worth a column on the user record, and showing it again on a new
 * device is a harmless outcome.
 */
const QUOTA_EXPLAINER_SEEN_KEY = "pandatrack:imageIntake:quotaExplainerSeen";

/** Never subscribes: whether the explainer was already seen cannot change while the screen is open. */
function subscribeToNothing(): () => void {
  return () => {};
}

function readQuotaExplainerSeen(): boolean {
  try {
    return window.localStorage.getItem(QUOTA_EXPLAINER_SEEN_KEY) !== null;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The explainer is a nicety, so the
    // failure mode is simply never showing it rather than showing it on every visit.
    return true;
  }
}

/**
 * Coordinator for the whole image-intake flow: attach, compress, extract, review, save.
 *
 * It owns the draft between extraction and confirmation, and that is the only place the draft ever
 * lives. Nothing is persisted before the user presses the primary CTA on the review screen.
 */
export default function ImageIntakeScreen({
  storeOptions,
  quota,
  baseCurrencyCode,
  productTypeKeys,
}: ImageIntakeScreenProps) {
  const t = useTranslations("imageIntake");
  const locale = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const shareSource = searchParams.get(SHARE_SOURCE_PARAM);
  const shareStashStatus = searchParams.get(SHARE_STASH_PARAM);

  // Two of the three share notices are a pure function of the URL, so they are derived rather than
  // stored: only "the stash turned out to be empty" is discovered asynchronously, on pickup.
  const urlShareNotice: ShareNotice | null =
    shareSource === SHARE_SOURCE_IOS_SHORTCUT
      ? "ios"
      : shareSource === SHARE_SOURCE_SHARE && shareStashStatus === SHARE_STASH_FAILED
        ? "failed"
        : null;

  const [phase, setPhase] = useState<IntakePhase>("upload");
  const [isShareStashEmpty, setIsShareStashEmpty] = useState(false);
  const [attachments, setAttachments] = useState<IntakeAttachment[]>([]);
  /**
   * Photos this screen already knows it cannot read, by attachment id, from the measurement taken
   * the moment they were attached.
   *
   * Keyed by id rather than by position because the grid is reorderable and removable: the position
   * a photo is called by is whatever it is at render time, while the verdict belongs to the file.
   */
  const [dimensionIssues, setDimensionIssues] = useState<Record<string, IntakeDimensionIssue>>({});
  const [processingStep, setProcessingStep] = useState<IntakeProcessingStep>("optimizing");
  const [error, setError] = useState<IntakeErrorState | null>(null);
  const [draft, setDraft] = useState<ImageIntakeDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /**
   * Photos the last successful read actually spent. Counted in uploaded segments, not in attached
   * files, because segmentation can turn one tall screenshot into several uploads and it is the
   * uploads the bag is charged for. The review screen states it back before offering to read again.
   */
  const [spentPhotoCount, setSpentPhotoCount] = useState(0);
  /**
   * The idempotency token this draft's save attempts share.
   *
   * Frozen at the first attempt and held for as long as the review screen shows this draft, because
   * a save can report failure after the order was written and the collector's next move is usually
   * to correct something and press save again. With the marker derived from the draft's contents,
   * that correction made the retry look like a different order and produced a second one. It is
   * cleared whenever a new extraction replaces the draft, which is a genuinely different order.
   */
  const saveTokenRef = useRef<string | null>(null);

  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const remainingPhotos = quota.remaining;
  const isQuotaExhausted = remainingPhotos === 0;
  // The single interruption in the whole quota system: the batch does not fit, and the fix is on
  // this same screen, which is why it is an inline banner and not a dialog.
  const overflowExcess = computePhotoOverflow(attachments.length, remainingPhotos);

  // Read through `useSyncExternalStore` rather than an effect that sets state: the server render
  // never shows the explainer, and the client's own answer arrives with hydration instead of as a
  // second render pass.
  const hasSeenQuotaExplainer = useSyncExternalStore(subscribeToNothing, readQuotaExplainerSeen, () => true);

  useEffect(() => {
    if (remainingPhotos === null || hasSeenQuotaExplainer) return;
    try {
      window.localStorage.setItem(QUOTA_EXPLAINER_SEEN_KEY, "1");
    } catch {
      // Same unavailable-storage case as the read: showing the sentence once more is harmless.
    }
  }, [hasSeenQuotaExplainer, remainingPhotos]);

  const overflowReportedRef = useRef(false);
  useEffect(() => {
    if (overflowExcess === null) {
      overflowReportedRef.current = false;
      return;
    }
    if (overflowReportedRef.current) return;
    overflowReportedRef.current = true;
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.QUOTA_OVERFLOW_SHOWN, {
      photo_count: attachments.length,
      photos_remaining: remainingPhotos,
    });
  }, [attachments.length, overflowExcess, remainingPhotos]);

  useEffect(() => {
    if (!isQuotaExhausted) return;
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.QUOTA_EXHAUSTED_SHOWN, { photo_limit: quota.limit });
  }, [isQuotaExhausted, quota.limit]);

  /**
   * How a photo is named in a message about it: its position in the grid, which every tile states,
   * plus its filename when the source had one (a pasted screenshot often does not).
   */
  const photoLabel = useCallback(
    (position: number, name: string): string =>
      name ? t("errors.photoLabelNamed", { position, name }) : t("errors.photoLabel", { position }),
    [t],
  );

  /**
   * Measures a freshly attached batch and records what cannot be read.
   *
   * This is the whole point of the attach-time check: the refusal is decidable from the photo's own
   * dimensions, so there is no reason to make the collector press the button, wait through a
   * compression pass and an upload, and only then be told that something in the batch was wrong. A
   * photo that cannot be measured records nothing, and the server stays the authority either way.
   */
  const inspectAttachedPhotos = useCallback(async (added: IntakeAttachment[]) => {
    const verdicts = await Promise.all(
      added.map(async (attachment) => {
        const dimensions = await readImageDimensionsFromUrl(attachment.previewUrl);
        if (!dimensions) return null;
        const issue = checkIntakeSourceDimensions(dimensions.width, dimensions.height);
        return issue ? ([attachment.id, issue] as const) : null;
      }),
    );

    const found = verdicts.filter((verdict): verdict is NonNullable<typeof verdict> => verdict !== null);
    if (found.length === 0) return;
    setDimensionIssues((current) => ({ ...current, ...Object.fromEntries(found) }));
  }, []);

  const handleFilesAdded = useCallback(
    (files: File[]) => {
      setError(null);
      const added = sortBatchByCaptureTime(files).map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.push(previewUrl);
        return { id: nextAttachmentId(), file, previewUrl };
      });
      setAttachments((current) => [...current, ...added]);
      void inspectAttachedPhotos(added);
    },
    [inspectAttachedPhotos],
  );

  /**
   * Moves one attachment to another position, keeping every other attachment's relative order.
   *
   * Deliberately does not touch `previewUrlsRef`: that array is a bag of live object URLs to revoke
   * on unmount, not a parallel list of the attachments, and the unmount cleanup captured its
   * identity on the first render. Reordering it would buy nothing and rebuilding it would orphan the
   * captured reference, so the order of the photos lives in state alone.
   */
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setError(null);
    setAttachments((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  /**
   * A drop is the one client-side door that can carry a format the picker never offered, so it
   * reuses the very message the server sends when it refuses a format: the user needs the accepted
   * list, not a distinction between which side of the wire noticed.
   */
  const handleUnsupportedFiles = useCallback(() => {
    setError({ messageKey: extractErrorMessageKey("unsupported-format") });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setError(null);
    setDimensionIssues((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        // Spliced in place rather than reassigned: the unmount cleanup captured this array on the
        // first render, so swapping in a new one would orphan it and leak every preview attached
        // after the first removal.
        const index = previewUrlsRef.current.indexOf(removed.previewUrl);
        if (index !== -1) previewUrlsRef.current.splice(index, 1);
      }
      return current.filter((attachment) => attachment.id !== id);
    });
  }, []);

  const runExtraction = useCallback(
    async (files: File[], entrySource: IntakeEntrySource) => {
      // Count only. What a source photo weighs is deliberately not a reason to refuse it: the
      // preparation step below is what decides the size of the upload, and it turns a
      // full-resolution screenshot into a fraction of its original bytes. See
      // `precheckAttachedPhotos`.
      const precheck = precheckAttachedPhotos(files);
      if (!precheck.ok) {
        setError({ messageKey: clientErrorMessageKey(precheck.code) });
        return;
      }

      setError(null);
      setProcessingStep("optimizing");
      setPhase("processing");

      let segments: { blob: Blob; mimeType: string }[];
      /** Which attached photo each uploaded segment came from, so a refusal can name it. */
      let segmentSources: number[];
      /** Prepared bytes per ATTACHED photo, summing the segments it was split into. */
      let bytesPerPhoto: number[];
      /** Rejections judged from what the preparation step actually decoded and produced. */
      let dimensionRejections: IntakePhotoIssueMessage[];
      try {
        const prepared = await prepareSubmissionForIntake(files);
        const compressed = prepared.results;
        segments = compressed.flatMap((result) => result.segments);
        segmentSources = compressed.flatMap((result, fileIndex) => result.segments.map(() => fileIndex));
        bytesPerPhoto = compressed.map((result) =>
          result.segments.reduce((sum, segment) => sum + segment.blob.size, 0),
        );
        dimensionRejections = compressed.flatMap((result, fileIndex) => {
          const issue = checkIntakeSourceDimensions(result.source.width, result.source.height);
          return issue ? [dimensionIssueMessage(issue, photoLabel(fileIndex + 1, files[fileIndex].name))] : [];
        });
        if (prepared.usedFallbackQuality) {
          posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.SUBMISSION_RECOMPRESSED, {
            photo_count: files.length,
            segment_count: segments.length,
            webp_quality: prepared.webpQuality,
            total_bytes: prepared.totalBytes,
            fits: prepared.fits,
          });
        }
      } catch {
        // The attachments are deliberately left in place: an error surface that also wipes the work
        // makes the user redo the whole submission to retry it.
        setError({ messageKey: clientErrorMessageKey("compression-failed") });
        setPhase("upload");
        return;
      }

      // The same verdict the attach surface already shows, reached again from the dimensions the
      // preparation step really decoded. It is not redundant: a share pickup submits the instant the
      // files land, before the attach-time pass has measured anything, and this is the run that has
      // to stop a photo the server would refuse after the collector already paid the upload.
      if (dimensionRejections.length > 0) {
        setError({
          messageKey: "photosRejected",
          values: { count: dimensionRejections.length },
          photos: dimensionRejections,
        });
        setPhase("upload");
        return;
      }

      // The only place byte size is judged. It is judged on what is actually sent, which is neither
      // what the collector picked (preparation shrinks it) nor one-per-photo (segmentation can turn
      // one tall screenshot into several uploads).
      const segmentPrecheck = precheckPreparedSegments(segments.map((segment) => ({ size: segment.blob.size })));
      if (!segmentPrecheck.ok) {
        // The refusal is about a segment, and a segment is not a thing the collector ever saw: it is
        // named by the photo it was cut from.
        const sourceIndex = segmentPrecheck.index !== null ? segmentSources[segmentPrecheck.index] : undefined;
        const culprit = sourceIndex !== undefined ? files[sourceIndex] : undefined;
        // A batch that does not fit even at the ladder's floor ends in a number rather than a rule:
        // the collector is told how many of their photos would go through, which is one decision
        // instead of a remove-and-retry loop.
        const fittingPhotoCount =
          segmentPrecheck.code === "submission-too-large" ? countPhotosWithinSubmissionBudget(bytesPerPhoto) : null;
        setError(
          culprit && sourceIndex !== undefined
            ? {
                messageKey: "photosRejected",
                values: { count: 1 },
                photos: [
                  fileTooLargeMessage(
                    photoLabel(sourceIndex + 1, culprit.name),
                    segments[segmentPrecheck.index ?? 0].blob.size,
                  ),
                ],
              }
            : fittingPhotoCount !== null && fittingPhotoCount > 0
              ? { messageKey: "submissionTooLargeWithFit", values: { count: fittingPhotoCount } }
              : { messageKey: clientErrorMessageKey(segmentPrecheck.code) },
        );
        setPhase("upload");
        return;
      }

      const formData = new FormData();
      formData.set(IMAGE_INTAKE_LOCALE_FIELD, locale);
      formData.set(IMAGE_INTAKE_ENTRY_SOURCE_FIELD, entrySource);
      segments.forEach((segment, index) => {
        formData.append(
          IMAGE_INTAKE_FILES_FIELD,
          new File([segment.blob], `intake-${index}`, { type: segment.mimeType }),
        );
      });

      setProcessingStep("uploading");
      const totalBytes = segments.reduce((sum, segment) => sum + segment.blob.size, 0);
      const uploadStepMs = Math.min(
        MAX_UPLOAD_STEP_MS,
        Math.max(MIN_UPLOAD_STEP_MS, totalBytes / ESTIMATED_UPLOAD_BYTES_PER_MS),
      );
      const readingTimer = setTimeout(() => setProcessingStep("reading"), uploadStepMs);

      try {
        const result = await extractOrderFromImagesAction(formData);
        if (!result.ok) {
          // A dimension refusal from the server carries the position and the measurement, so it is
          // resolved back to the photo the collector attached rather than shown as a rule they have
          // no way to map onto anything in front of them.
          const serverPhoto: IntakePhotoIssueMessage[] | undefined =
            (result.code === "image-too-small" || result.code === "image-too-large") &&
            result.imageIndex !== undefined &&
            result.imageWidth !== undefined &&
            result.imageHeight !== undefined &&
            segmentSources[result.imageIndex] !== undefined
              ? [
                  serverDimensionMessage(
                    result.code,
                    photoLabel(
                      segmentSources[result.imageIndex] + 1,
                      files[segmentSources[result.imageIndex]]?.name ?? "",
                    ),
                    result.imageWidth,
                    result.imageHeight,
                  ),
                ]
              : undefined;

          setError(
            serverPhoto
              ? { messageKey: "photosRejected", values: { count: 1 }, photos: serverPhoto }
              : {
                  messageKey: extractErrorMessageKey(result.code),
                  values:
                    result.productCount !== undefined && result.maxProducts !== undefined
                      ? { productCount: result.productCount, maxProducts: result.maxProducts }
                      : { minDimension: MIN_IMAGE_DIMENSION, maxWidth: MAX_IMAGE_WIDTH, maxHeight: MAX_IMAGE_HEIGHT },
                  reference: extractErrorReference(result.code) ?? undefined,
                },
          );
          setPhase("upload");
          return;
        }
        saveTokenRef.current = null;
        setDraft(result.draft);
        setSpentPhotoCount(segments.length);
        setPhase("review");
      } catch {
        setError({ messageKey: "serverError", reference: extractErrorReference("server-error") ?? undefined });
        setPhase("upload");
      } finally {
        clearTimeout(readingTimer);
      }
    },
    [locale, photoLabel],
  );

  const handleExtract = useCallback(async () => {
    // The CTA is already disabled while the batch does not fit; this keeps a submission that
    // arrives some other way (a stale click, a keyboard activation mid-update) from spending a
    // reservation the server would refuse anyway.
    if (overflowExcess !== null) return;
    await runExtraction(
      attachments.map((attachment) => attachment.file),
      ENTRY_SOURCE_IN_APP,
    );
  }, [attachments, overflowExcess, runExtraction]);

  /**
   * Pickup for an arrival from outside the app.
   *
   * The service worker has already parked the shared files in Cache Storage and redirected here, so
   * this reads them, attaches them exactly as a manual pick would, and starts the extraction
   * immediately: a user who just shared a screenshot has already decided, and a screen asking them
   * to confirm the upload would be a toll on a decision that was made in the other app.
   *
   * The stash is read once per mount, and only by a session that was already open when the share
   * was made: bytes parked before someone signed in cannot be attributed to them, and on a shared
   * device they would belong to the previous person. Any outcome without files is a prompt to attach
   * them by hand, never a dead end: iOS cannot pass bytes through the Shortcut at all, and an
   * expired, refused, or broken stash leaves the user with the same remedy.
   *
   * Every arrival that does not read the stash sweeps it instead, so an abandoned share does not sit
   * in Cache Storage waiting for a pickup that is never coming.
   */
  const sharePickupStartedRef = useRef(false);

  useEffect(() => {
    if (sharePickupStartedRef.current) return;
    sharePickupStartedRef.current = true;

    const isSharePickup = shareSource === SHARE_SOURCE_SHARE && shareStashStatus !== SHARE_STASH_FAILED;
    if (!isSharePickup) {
      void sweepExpiredShareStash();
    }

    if (shareSource !== SHARE_SOURCE_SHARE && shareSource !== SHARE_SOURCE_IOS_SHORTCUT) return;

    const entrySourceProperty = ENTRY_SOURCE_PROPERTY[shareSource];

    if (shareSource === SHARE_SOURCE_IOS_SHORTCUT) {
      posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.SHARE_TARGET_RECEIVED, {
        entry_source: entrySourceProperty,
        photo_count: 0,
      });
      return;
    }

    if (shareStashStatus === SHARE_STASH_FAILED) {
      posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.SHARE_TARGET_RECEIVED, {
        entry_source: entrySourceProperty,
        photo_count: 0,
        stash_status: SHARE_STASH_FAILED,
      });
      return;
    }

    void (async () => {
      const sessionStartedAt = await readSessionStartedAt();
      const result = await readAndClearShareStash({ sessionStartedAt });
      if (result.outcome !== "picked") {
        setIsShareStashEmpty(true);
        posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.SHARE_TARGET_RECEIVED, {
          entry_source: entrySourceProperty,
          photo_count: 0,
          stash_status: result.outcome === "identity-changed" ? "identity_changed" : "empty",
        });
        return;
      }
      const stash = result.pickup;

      posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.SHARE_TARGET_RECEIVED, {
        entry_source: entrySourceProperty,
        photo_count: stash.files.length,
      });

      if (Date.now() - stash.createdAt > SHARE_RESUMED_AFTER_AUTH_MIN_AGE_MS) {
        posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.SHARE_RESUMED_AFTER_AUTH, {
          photo_count: stash.files.length,
        });
      }

      handleFilesAdded(stash.files);
      await runExtraction(stash.files, ENTRY_SOURCE_SHARE);
    })();
  }, [handleFilesAdded, runExtraction, shareSource, shareStashStatus]);

  const handleSave = useCallback(
    async (
      confirmedDraft: ImageIntakeDraft,
      exchangeRate: number | null,
      breakdown: IntakeBreakdownPayload | undefined,
    ) => {
      setIsSaving(true);
      setError(null);
      saveTokenRef.current ??= newImageIntakeSaveToken();
      try {
        const result = await saveOrderFromDraftAction(confirmedDraft, exchangeRate, saveTokenRef.current, breakdown);
        if (!result.ok) {
          setError({ messageKey: saveErrorMessageKey(result.code) });
          return;
        }
        // A row that carried a breakdown gets its OWN sentence, and it is not a nicety: the generic
        // one says "add it by hand", which for a plain row means two fields and for this one means
        // retyping up to N lines. This copy names the breakdown and sends the collector to the
        // order's detail, where the panel has lived since ADR 0028.
        const skippedBreakdownCount = result.skippedBreakdownIndexes.length;
        if (skippedBreakdownCount > 0) {
          addToast(t("save.breakdownSkipped", { count: skippedBreakdownCount }), { variant: "warning" });
        }
        // A payment the order domain refused (a date before the order, an amount over the balance)
        // is skipped rather than failing the save, so the collector has to be told: otherwise the
        // order lands looking paid for less than what the photo said, with no explanation. The
        // toast survives the navigation below, because the provider sits above this route. Only the
        // rows the sentence above did not already name: `Math.max` because the idempotency branch
        // reports named breakdowns against a skip count of zero.
        const skippedPlainCount = Math.max(0, result.paymentsSkipped - skippedBreakdownCount);
        if (skippedPlainCount > 0) {
          addToast(t("save.paymentsSkipped", { count: skippedPlainCount }), { variant: "warning" });
        }
        // Not an optimistic navigation: creating an order is not a change this screen can undo
        // locally, so the user is only moved once the write is confirmed. The pending state on the
        // CTA is what carries the feedback in the meantime.
        router.push(`/${locale}${ROUTES.orders}/${result.orderId}`);
      } catch {
        setError({ messageKey: "serverError" });
      } finally {
        setIsSaving(false);
      }
    },
    [addToast, locale, router, t],
  );

  /**
   * "Complete by hand" from anywhere in this flow. When it fires from the review screen, the
   * collector already spent photos and a real extraction on this draft, so the manual form must
   * open with that work carried over rather than blank; when it fires from the quota-exhausted
   * panel, extraction never ran and there is nothing to carry, so the optional draft is simply
   * omitted. Stashing happens here, right before the navigation that consumes it, so the manual
   * form's own mount effect is the only other place this hand-off is ever touched.
   */
  const handleManualClick = useCallback(
    (confirmedDraft?: ImageIntakeDraft) => {
      if (confirmedDraft) {
        writeManualPrefillStash(confirmedDraft);
      }
      router.push(`/${locale}${ROUTES.ordersNew}`);
    },
    [locale, router],
  );

  /**
   * "Add the product page screenshot" from the review screen: back to the attach surface with the
   * photos of this submission still attached, so only the missing one has to be picked. The draft is
   * dropped because the next read replaces it wholesale, and any edit made here would be overwritten
   * by that read rather than merged into it.
   */
  const handleAddProductSheet = useCallback(() => {
    setError(null);
    saveTokenRef.current = null;
    setDraft(null);
    setPhase("upload");
  }, []);

  const shareNotice: ShareNotice | null = urlShareNotice ?? (isShareStashEmpty ? "attach" : null);

  /**
   * What the attach-time measurement found, resolved against the grid as it stands now, so each
   * line names the photo by the position its tile is showing at this moment.
   */
  const rejectedPhotos: IntakePhotoIssueMessage[] = attachments.flatMap((attachment, index) => {
    const issue = dimensionIssues[attachment.id];
    return issue ? [dimensionIssueMessage(issue, photoLabel(index + 1, attachment.file.name))] : [];
  });

  // One error surface, never two saying the same thing: a submission blocked by these photos fails
  // with exactly this list, so the submit-time error replaces the standing one rather than stacking
  // under it.
  const photoIssues = error?.photos ?? (phase === "upload" ? rejectedPhotos : []);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {(error || photoIssues.length > 0) && (
        <AlertBanner tone="destructive" icon={<AlertTriangle size={16} />} title={t("errors.title")}>
          <span className="block">
            {error
              ? t(`errors.${error.messageKey}`, error.values)
              : t("errors.photosRejected", { count: photoIssues.length })}
          </span>
          {photoIssues.length > 0 && (
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-[var(--space-4)]">
              {photoIssues.map((photoIssue) => (
                <li key={`${photoIssue.messageKey}-${photoIssue.values.photo}`}>
                  {t(`errors.${photoIssue.messageKey}`, photoIssue.values)}
                </li>
              ))}
            </ul>
          )}
          {attachments.length > 0 && <span className="mt-1 block">{t("errors.attachmentsKept")}</span>}
          {error?.reference !== undefined && (
            <span className="mt-1 block [font-size:var(--text-caption)] [color:var(--text-muted)]">
              {t("errors.reference", { reference: error.reference })}
            </span>
          )}
        </AlertBanner>
      )}

      {shareNotice && phase === "upload" && !error && (
        <AlertBanner
          tone={shareNotice === "failed" ? "destructive" : "info"}
          icon={shareNotice === "failed" ? <AlertTriangle size={16} /> : <Share2 size={16} />}
        >
          {t(`share.${shareNotice}`)}
        </AlertBanner>
      )}

      {phase === "upload" &&
        (isQuotaExhausted && quota.limit !== null ? (
          <IntakeQuotaExhausted
            limit={quota.limit}
            renewalAtIso={quota.renewalAtIso}
            onManualClick={handleManualClick}
          />
        ) : (
          <IntakeUploadPanel
            attachments={attachments}
            onFilesAdded={handleFilesAdded}
            onUnsupportedFiles={handleUnsupportedFiles}
            onRemove={handleRemove}
            onReorder={handleReorder}
            onSubmit={() => void handleExtract()}
            remainingPhotos={remainingPhotos}
            overflowExcess={overflowExcess}
            hasUnreadablePhotos={rejectedPhotos.length > 0}
            showFirstTimeExplainer={!hasSeenQuotaExplainer}
          />
        ))}

      {phase === "processing" && <IntakeProcessingPanel activeStep={processingStep} />}

      {phase === "review" && draft && (
        <IntakeReviewScreen
          initialDraft={draft}
          baseCurrencyCode={baseCurrencyCode}
          storeOptions={storeOptions}
          productTypeKeys={productTypeKeys}
          isSaving={isSaving}
          onSave={(confirmedDraft, exchangeRate, breakdown) => void handleSave(confirmedDraft, exchangeRate, breakdown)}
          onManualClick={handleManualClick}
          spentPhotoCount={spentPhotoCount}
          remainingPhotos={remainingPhotos}
          onAddProductSheet={handleAddProductSheet}
        />
      )}
    </div>
  );
}
