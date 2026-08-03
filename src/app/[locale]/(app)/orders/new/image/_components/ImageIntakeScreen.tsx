"use client";

import { AlertTriangle, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import AlertBanner from "@/components/modules/AlertBanner";
import type { StoreComboboxOption } from "@/components/modules/StoreCombobox";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { compressForIntake } from "@/lib/images/compressForIntake";
import { precheckIntakeSubmission } from "@/lib/imageIntake/clientPrecheck";
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
} from "../../../_actions/imageIntakeContract";
import { extractOrderFromImagesAction } from "../../../_actions/imageIntakeExtractAction";
import { saveOrderFromDraftAction } from "../../../_actions/imageIntakeSaveAction";
import IntakeProcessingPanel, { type IntakeProcessingStep } from "./IntakeProcessingPanel";
import IntakeQuotaExhausted from "./IntakeQuotaExhausted";
import IntakeReviewScreen from "./IntakeReviewScreen";
import IntakeUploadPanel, { type IntakeAttachment } from "./IntakeUploadPanel";
import {
  clientErrorMessageKey,
  extractErrorMessageKey,
  saveErrorMessageKey,
  type IntakeErrorState,
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

  const handleFilesAdded = useCallback((files: File[]) => {
    setError(null);
    setAttachments((current) => [
      ...current,
      ...sortBatchByCaptureTime(files).map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.push(previewUrl);
        return { id: nextAttachmentId(), file, previewUrl };
      }),
    ]);
  }, []);

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
      const precheck = precheckIntakeSubmission(files);
      if (!precheck.ok) {
        setError({ messageKey: clientErrorMessageKey(precheck.code) });
        return;
      }

      setError(null);
      setProcessingStep("optimizing");
      setPhase("processing");

      let segments: { blob: Blob; mimeType: string }[];
      try {
        const compressed = await Promise.all(files.map((file) => compressForIntake(file)));
        segments = compressed.flatMap((result) => result.segments);
      } catch {
        // The attachments are deliberately left in place: an error surface that also wipes the work
        // makes the user redo the whole submission to retry it.
        setError({ messageKey: clientErrorMessageKey("compression-failed") });
        setPhase("upload");
        return;
      }

      // Segmentation can turn one tall screenshot into several uploads, so the limits are re-checked
      // against what is actually sent rather than against what was picked.
      const segmentPrecheck = precheckIntakeSubmission(segments.map((segment) => ({ size: segment.blob.size })));
      if (!segmentPrecheck.ok) {
        setError({ messageKey: clientErrorMessageKey(segmentPrecheck.code) });
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
          setError({
            messageKey: extractErrorMessageKey(result.code),
            values:
              result.productCount !== undefined && result.maxProducts !== undefined
                ? { productCount: result.productCount, maxProducts: result.maxProducts }
                : undefined,
          });
          setPhase("upload");
          return;
        }
        setDraft(result.draft);
        setSpentPhotoCount(segments.length);
        setPhase("review");
      } catch {
        setError({ messageKey: "serverError" });
        setPhase("upload");
      } finally {
        clearTimeout(readingTimer);
      }
    },
    [locale],
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
    async (confirmedDraft: ImageIntakeDraft, exchangeRate: number | null) => {
      setIsSaving(true);
      setError(null);
      try {
        const result = await saveOrderFromDraftAction(confirmedDraft, exchangeRate);
        if (!result.ok) {
          setError({ messageKey: saveErrorMessageKey(result.code) });
          return;
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
    [locale, router],
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
    setDraft(null);
    setPhase("upload");
  }, []);

  const shareNotice: ShareNotice | null = urlShareNotice ?? (isShareStashEmpty ? "attach" : null);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {error && (
        <AlertBanner tone="destructive" icon={<AlertTriangle size={16} />} title={t("errors.title")}>
          <span className="block">{t(`errors.${error.messageKey}`, error.values)}</span>
          {attachments.length > 0 && <span className="block">{t("errors.attachmentsKept")}</span>}
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
          onSave={(confirmedDraft, exchangeRate) => void handleSave(confirmedDraft, exchangeRate)}
          onManualClick={handleManualClick}
          spentPhotoCount={spentPhotoCount}
          remainingPhotos={remainingPhotos}
          onAddProductSheet={handleAddProductSheet}
        />
      )}
    </div>
  );
}
