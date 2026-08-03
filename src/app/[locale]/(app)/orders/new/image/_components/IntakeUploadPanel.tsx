"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  GripVertical,
  ImageIcon,
  Package,
  UploadCloud,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import Button from "@/components/core/Button/Button";
import Card from "@/components/core/Card";
import AlertBanner from "@/components/modules/AlertBanner";
import { ACCEPTED_IMAGE_MIME_TYPES } from "@/lib/imageIntake/constants";
import { cn } from "@/lib/styles";

export type IntakeAttachment = {
  id: string;
  file: File;
  previewUrl: string;
};

export type IntakeUploadPanelProps = {
  attachments: IntakeAttachment[];
  onFilesAdded: (files: File[]) => void;
  /**
   * Reports a drop that carried something this surface cannot use (a PDF, a folder, an iPhone
   * HEIC). Only drops report it: the file picker already filters by `accept`, and a paste that
   * carries no image is a normal paste that must be left alone.
   */
  onUnsupportedFiles: () => void;
  onRemove: (id: string) => void;
  /**
   * Moves the attachment at `fromIndex` to `toIndex`, keeping every other one in place. Indices
   * rather than ids because position is the whole subject here: the extraction reads the photos as
   * one conversation in the order this list shows them.
   */
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSubmit: () => void;
  /** Photos left in the monthly bag; `null` when no cap applies, which hides every quota line. */
  remainingPhotos: number | null;
  /** Photos that must be removed for the batch to fit; `null` when it already fits. */
  overflowExcess: number | null;
  /** Shown once per device, the first time the collector reaches this surface. */
  showFirstTimeExplainer: boolean;
};

/** Shared chrome for the two reorder controls, so the pair cannot drift apart visually. */
const REORDER_BUTTON_CLASS = cn(
  "flex size-7 items-center justify-center rounded-full",
  "[color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
  "hover:[color:var(--text-primary)]",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
);

/**
 * Emphasis renderer shared by the guidance lines, so the rule inside each sentence is picked out
 * the same way and the two cannot drift apart visually.
 */
function renderStrong(chunks: ReactNode): ReactNode {
  return <strong className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">{chunks}</strong>;
}

/** True when the MIME type is one this surface, and the server validator, accepts. */
function isAcceptedImageType(mimeType: string): boolean {
  return (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

type TransferReadResult = { accepted: File[]; rejectedCount: number };

/**
 * Pulls the usable images out of a drop or paste payload.
 *
 * `items` is read in preference to `files` because it is the only side that tells a real file from a
 * dragged string, and because a dropped directory arrives as an item whose `getAsFile()` yields
 * nothing usable rather than as a `File`. Anything that is not an accepted image is counted instead
 * of discarded, so the caller can tell "the payload had no files at all" from "it had files and they
 * were refused" and report the second case instead of swallowing it.
 */
function readTransferredImages(source: DataTransfer | null | undefined): TransferReadResult {
  const accepted: File[] = [];
  let rejectedCount = 0;

  const items = source?.items;
  if (items && items.length > 0) {
    for (const item of Array.from(items)) {
      if (item.kind !== "file") continue;
      const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
      if (!file || !isAcceptedImageType(file.type)) {
        rejectedCount += 1;
        continue;
      }
      accepted.push(file);
    }
    return { accepted, rejectedCount };
  }

  for (const file of Array.from(source?.files ?? [])) {
    if (isAcceptedImageType(file.type)) {
      accepted.push(file);
    } else {
      rejectedCount += 1;
    }
  }
  return { accepted, rejectedCount };
}

/** True when the drag carries files rather than a text selection or a link. */
function isFileDrag(source: DataTransfer | null | undefined): boolean {
  return Array.from(source?.types ?? []).includes("Files");
}

/**
 * True when the event came from somewhere the user is typing. The paste door must never take a
 * keystroke away from a field, and this flow has editable fields on the screens that follow.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * The attach surface: a dropzone-shaped picker, an ordered thumbnail grid with a remove and two
 * reorder controls per photo, and the extraction CTA.
 *
 * The grid is a sequence, not a set. Everything attached here is read as one conversation in the
 * order shown, so each tile states its position and can be moved, by dragging it or by the arrow
 * buttons that make the same move available to a keyboard and to a touch screen.
 *
 * Three doors lead to the same `onFilesAdded`: the file picker, a drop, and a clipboard paste. The
 * picker stays the primary and only guaranteed one, because dragging needs a pointer and pasting
 * needs a keyboard with an image already on the clipboard; the other two are shortcuts for the
 * desktop habit of taking a screenshot and moving it straight into the browser.
 *
 * The accept list is the three real formats the server validator accepts, deliberately without
 * `image/heic`: an iOS HEIC photo cannot be decoded by the canvas compression step, so offering it
 * in the picker would only produce a failure after the user already committed.
 */
export default function IntakeUploadPanel({
  attachments,
  onFilesAdded,
  onUnsupportedFiles,
  onRemove,
  onReorder,
  onSubmit,
  remainingPhotos,
  overflowExcess,
  showFirstTimeExplainer,
}: IntakeUploadPanelProps) {
  const t = useTranslations("imageIntake.upload");
  const tQuota = useTranslations("imageIntake.quota");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const linkHintId = useId();
  const [isDragActive, setIsDragActive] = useState(false);
  /**
   * Second level of the guidance, closed by default. The advice behind it applies to a minority of
   * orders and the review screen asks for the same screenshot again, pointing at the product it is
   * missing; what only this screen can offer is the chance to attach it before the read, which is a
   * single pass over every photo.
   */
  const [isLinkHintOpen, setIsLinkHintOpen] = useState(false);
  /** Index being dragged for a reorder, and the tile it is currently hovering. */
  const [reorderSourceIndex, setReorderSourceIndex] = useState<number | null>(null);
  const [reorderTargetIndex, setReorderTargetIndex] = useState<number | null>(null);
  /**
   * What the live region says after the last move. Dragging and the arrow buttons both write it,
   * because a reorder is a change with no other spoken evidence: the grid rearranges silently, and a
   * screen-reader user who just pressed an arrow would otherwise get no confirmation that anything
   * happened, nor where the photo ended up.
   */
  const [orderAnnouncement, setOrderAnnouncement] = useState("");
  /**
   * Nesting depth of the drag inside the surface. A boolean would switch off the moment the pointer
   * crossed onto a child element, because entering a child fires `dragleave` on the element left
   * behind; counting enter and leave events keeps the state on until the drag really exits.
   */
  const dragDepthRef = useRef(0);

  const handlePick = () => {
    inputRef.current?.click();
  };

  const handleToggleLinkHint = () => {
    setIsLinkHintOpen((open) => !open);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length > 0) {
      onFilesAdded(picked);
    }
    // Reset so re-picking the same file still fires a change event.
    event.target.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    if (isFileDrag(event.dataTransfer)) {
      setIsDragActive(true);
    }
  };

  // Without a prevented default on every dragover the browser refuses the drop and opens the image
  // in a tab instead, losing the whole surface the user was working on.
  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragActive(false);

    const { accepted, rejectedCount } = readTransferredImages(event.dataTransfer);
    if (accepted.length > 0) {
      onFilesAdded(accepted);
    }
    // Reported after the accepted files so the coordinator's error reset does not erase it: a mixed
    // drop must both attach what it can and say what it could not.
    if (rejectedCount > 0) {
      onUnsupportedFiles();
    }
  };

  /**
   * The single door every reorder goes through, whichever gesture asked for it, so the live region
   * is written exactly once per move and can never drift from what the list actually did.
   */
  const moveAttachment = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= attachments.length) return;
    onReorder(fromIndex, toIndex);
    setOrderAnnouncement(t("reorderAnnouncement", { position: toIndex + 1, total: attachments.length }));
  };

  /**
   * Reorder drag, hand-rolled on the native drag events rather than on a drag-and-drop library
   * (ADR 0010: hand-roll UI primitives by default).
   *
   * It is intentionally the secondary way to reorder. A pointer drag reaches neither a keyboard user
   * nor a touch screen, where HTML drag events do not fire at all, so the arrow buttons on every
   * tile are the guaranteed path and this is the shortcut for a mouse.
   *
   * The transfer carries a `text/plain` payload because Firefox refuses to start a drag without one.
   * That also keeps this drag out of the way of the surface-wide file drop: that one only reacts to
   * a transfer whose types include "Files", which an internal reorder never has.
   */
  const handleItemDragStart = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    setReorderSourceIndex(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  };

  const handleItemDragOver = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (reorderSourceIndex === null) return;
    // Both stopped: without the prevented default the browser refuses the drop, and without the
    // stopped propagation the surface-wide file dropzone would treat this as an incoming file drag.
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    setReorderTargetIndex(index);
  };

  const handleItemDrop = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (reorderSourceIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    moveAttachment(reorderSourceIndex, index);
    setReorderSourceIndex(null);
    setReorderTargetIndex(null);
  };

  const handleItemDragEnd = () => {
    setReorderSourceIndex(null);
    setReorderTargetIndex(null);
  };

  /**
   * Clipboard door, bound to the document rather than to this surface.
   *
   * A `paste` event only reaches the focused element, and right after a screenshot nothing inside
   * this panel holds focus, so a container-scoped listener would demand a preliminary click and
   * defeat the shortcut it exists to provide. The two guards that make a document-wide listener safe
   * are the mount lifetime and the target check: this panel renders only in the upload phase, so
   * leaving that phase removes the listener with it, and a paste that came from a field or that
   * carries no image is left untouched so ordinary typing keeps working.
   */
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const { accepted } = readTransferredImages(event.clipboardData);
      if (accepted.length === 0) return;
      event.preventDefault();
      onFilesAdded(accepted);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onFilesAdded]);

  const hasAttachments = attachments.length > 0;
  const dropzoneLabel = isDragActive ? t("dropActive") : hasAttachments ? t("chooseMore") : t("dropzoneTitle");

  return (
    <div
      className="flex flex-col gap-[var(--space-5)]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col gap-[var(--space-2)]">
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
          <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {t("title")}
          </h2>
          {/* Passive counter: information, never a gate, and never an alert that steals focus
              when the number changes. */}
          {remainingPhotos !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 [font-size:var(--text-caption)] [color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
              <ImageIcon size={13} aria-hidden />
              {tQuota("counter", { count: remainingPhotos })}
            </span>
          )}
        </div>
        <p className="[font-size:var(--text-body)] [color:var(--text-secondary)]">{t("description")}</p>
        {showFirstTimeExplainer && remainingPhotos !== null && (
          <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{tQuota("explainer")}</p>
        )}
        {/*
          Two levels of guidance, not one wall of it. The first level holds the two rules that
          decide how the whole batch is read, so both are stated without asking for a click; the
          second holds the product-sheet advice, which applies to a minority of orders and is
          therefore a click away rather than a tax on everyone's attention.

          The order line stays on level one even though it costs words. The extraction reads the
          photos as one conversation from the first to the last, so an unordered batch is read
          wrong; the reorder hint beside the grid explains how to move a photo, never that the
          position is read, and it appears only after a second photo is attached, which is too
          late to change how the collector picked them.
        */}
        <section aria-label={t("guidanceLabel")} className="flex flex-col gap-[var(--space-2)]">
          <AlertBanner tone="info" icon={<Package size={16} />}>
            <p>{t.rich("guidanceOneOrder", { strong: renderStrong })}</p>
            <p className="mt-1">{t.rich("guidanceOrder", { strong: renderStrong })}</p>
          </AlertBanner>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={handleToggleLinkHint}
            aria-expanded={isLinkHintOpen}
            aria-controls={linkHintId}
            trailingIcon={
              <ChevronDown
                size={14}
                aria-hidden
                className={cn("transition-transform", isLinkHintOpen && "rotate-180")}
                style={{ transitionDuration: "var(--motion-fast)" }}
              />
            }
          >
            {t("linkHintToggle")}
          </Button>
          <p
            id={linkHintId}
            hidden={!isLinkHintOpen}
            className="[font-size:var(--text-caption)] [color:var(--text-muted)]"
          >
            {t("linkHint")}
          </p>
        </section>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
        onChange={handleInputChange}
        className="sr-only"
      />

      <Card variant="outlined" padding="none">
        <button
          type="button"
          onClick={handlePick}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-[var(--space-2)]",
            "rounded-[var(--radius-xl)] px-[var(--space-4)] py-[var(--space-8)]",
            "transition-colors",
            isDragActive
              ? "[color:var(--text-primary)] [background:color-mix(in_oklch,var(--accent)_var(--state-selected-bg-mix),var(--surface))] [border:1px_dashed_var(--accent)]"
              : "[color:var(--text-secondary)] [border:1px_dashed_var(--border-strong)] hover:[color:var(--text-primary)]",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
        >
          <UploadCloud size={28} aria-hidden />
          <span className="[font-size:var(--text-body)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
            {dropzoneLabel}
          </span>
          <span className="[font-size:var(--text-caption)]">{t("dropzoneHint")}</span>
          {/* Neither dropping nor pasting exists on a touch screen, so the line advertising them is
              gated in CSS at the desktop breakpoint rather than branched on a viewport read, which
              would render the desktop wording first and swap it after hydration. */}
          <span className="hidden [font-size:var(--text-caption)] md:block">{t("dragPasteHint")}</span>
        </button>
      </Card>

      {hasAttachments && (
        <section className="flex flex-col gap-[var(--space-3)]">
          <div className="flex flex-col gap-[var(--space-1)]">
            <h3 className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
              {t("attachedTitle", { count: attachments.length })}
            </h3>
            {attachments.length > 1 && (
              <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{t("reorderHint")}</p>
            )}
          </div>
          <ul aria-label={t("listLabel")} className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
            {attachments.map((attachment, index) => (
              <li
                key={attachment.id}
                draggable
                onDragStart={handleItemDragStart(index)}
                onDragOver={handleItemDragOver(index)}
                onDrop={handleItemDrop(index)}
                onDragEnd={handleItemDragEnd}
                className={cn(
                  "relative rounded-[var(--radius-lg)] transition-opacity",
                  reorderSourceIndex === index && "opacity-50",
                  reorderTargetIndex === index &&
                    reorderSourceIndex !== index &&
                    "[outline:2px_solid_var(--accent)] [outline-offset:2px]",
                )}
              >
                <span
                  className="block aspect-square w-full overflow-hidden rounded-[var(--radius-lg)]"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                >
                  {attachment.previewUrl ? (
                    <Image
                      src={attachment.previewUrl}
                      alt=""
                      width={240}
                      height={240}
                      unoptimized
                      // Left to the list item: a draggable image starts its own image drag, which
                      // would carry the blob instead of the reorder payload.
                      draggable={false}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center [color:var(--text-muted)]">
                      <ImageIcon size={20} aria-hidden />
                    </span>
                  )}
                </span>
                {/* The position, stated rather than inferred: the order is what the extraction
                    reads, so it must be visible without counting tiles. */}
                <span
                  className={cn(
                    "absolute top-1 left-1 flex min-w-6 items-center gap-1 rounded-[var(--radius-pill)] px-1.5 py-0.5",
                    "[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)]",
                    "[color:var(--text-primary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
                  )}
                >
                  <GripVertical size={12} aria-hidden className="[color:var(--text-muted)]" />
                  <span className="sr-only">{t("position", { position: index + 1 })}</span>
                  <span aria-hidden>{index + 1}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(attachment.id)}
                  aria-label={t("removeOne", { name: attachment.file.name })}
                  className={cn(
                    "absolute top-1 right-1 flex size-7 items-center justify-center rounded-full",
                    "[color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
                    "hover:[color:var(--text-primary)]",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  )}
                >
                  <X size={14} aria-hidden />
                </button>
                {/* The keyboard and touch path to the same reorder the drag performs. Each label
                    names the photo it moves and the direction, so the control is usable without
                    seeing which tile it sits on. */}
                {attachments.length > 1 && (
                  <span className="absolute right-1 bottom-1 left-1 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => moveAttachment(index, index - 1)}
                      disabled={index === 0}
                      aria-label={t("moveEarlier", { position: index + 1 })}
                      className={cn(REORDER_BUTTON_CLASS, "disabled:pointer-events-none disabled:opacity-40")}
                    >
                      <ArrowLeft size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAttachment(index, index + 1)}
                      disabled={index === attachments.length - 1}
                      aria-label={t("moveLater", { position: index + 1 })}
                      className={cn(REORDER_BUTTON_CLASS, "disabled:pointer-events-none disabled:opacity-40")}
                    >
                      <ArrowRight size={14} aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p role="status" aria-live="polite" className="sr-only">
            {orderAnnouncement}
          </p>
        </section>
      )}

      {overflowExcess !== null && remainingPhotos !== null && (
        <AlertBanner tone="warning" role="status" icon={<AlertTriangle size={16} />}>
          {tQuota("overflow", { attached: attachments.length, remaining: remainingPhotos, excess: overflowExcess })}
        </AlertBanner>
      )}

      <div className="flex flex-col gap-[var(--space-2)]">
        {remainingPhotos !== null && (
          <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{tQuota("helper")}</p>
        )}
        <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{t("helper")}</p>
      </div>

      <Button type="button" variant="primary" size="lg" fullWidth onClick={onSubmit} disabled={overflowExcess !== null}>
        {t("submit")}
      </Button>
    </div>
  );
}
