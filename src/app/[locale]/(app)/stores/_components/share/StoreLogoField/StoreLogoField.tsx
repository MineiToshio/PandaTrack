"use client";

import "react-easy-crop/react-easy-crop.css";

import { Building2, Crop, Pencil, Upload, X } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import Button from "@/components/core/Button/Button";
import Label from "@/components/core/Label";
import Modal from "@/components/modules/Modal/Modal";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import {
  STORE_LOGO_ACCEPTED_MIME_TYPES,
  STORE_LOGO_MAX_SOURCE_SIZE_BYTES,
  STORE_LOGO_OUTPUT_SIZE_PX,
  type StoreLogoAction,
} from "@/lib/store/logoShared";
import { getCroppedImageDataUrl } from "./getCroppedImageDataUrl";
import { extensionForEncodedType } from "@/lib/images/canvasEncoding";
import { getProcessedImageBlob } from "@/lib/images/getProcessedImageBlob";

export type StoreLogoSubmission = {
  action: StoreLogoAction;
  file: File | null;
};

type StoreLogoFieldCopy = {
  label: string;
  helper: string;
  emptyTitle: string;
  emptyDescription: string;
  uploadCta: string;
  editCta: string;
  removeCta: string;
  editorTitle: string;
  editorDescription: string;
  zoomLabel: string;
  editorCancel: string;
  editorConfirm: string;
  acceptedFormats: string;
  maxSize: string;
};

type StoreLogoFieldProps = {
  id: string;
  initialLogoUrl?: string | null;
  disabled?: boolean;
  error?: string | null;
  copy: StoreLogoFieldCopy;
  onChange: (value: StoreLogoSubmission) => void;
  onRemove?: () => void;
  renderError?: (errorCode: string) => string;
};

const ACCEPTED_FILE_TYPES = STORE_LOGO_ACCEPTED_MIME_TYPES.join(",");

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** True when the paste came from somewhere the user is typing, so it must be left untouched. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}
const DEFAULT_CROP: Point = { x: 0, y: 0 };
const DEFAULT_ZOOM = 1;
const DEFAULT_SUBMISSION: StoreLogoSubmission = {
  action: "keep",
  file: null,
};

export default function StoreLogoField({
  id,
  initialLogoUrl = null,
  disabled = false,
  error,
  copy,
  onChange,
  onRemove,
  renderError,
}: StoreLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [submission, setSubmission] = useState<StoreLogoSubmission>(DEFAULT_SUBMISSION);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialLogoUrl);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>(DEFAULT_CROP);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [confirmedCrop, setConfirmedCrop] = useState<Point>(DEFAULT_CROP);
  const [confirmedZoom, setConfirmedZoom] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    onChange(submission);
  }, [onChange, submission]);

  const supportsInteraction = !disabled;
  const hasPreview = previewUrl != null;
  const canEditPreview = supportsInteraction && submission.action === "set" && previewUrl != null;
  const sizeHint = useMemo(() => Math.round(STORE_LOGO_MAX_SOURCE_SIZE_BYTES / (1024 * 1024)), []);

  const resetEditorState = () => {
    if (editorImageUrl && editorImageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(editorImageUrl);
    }

    setEditorImageUrl(null);
    setEditorFile(null);
    setEditorError(null);
    setCrop(DEFAULT_CROP);
    setZoom(DEFAULT_ZOOM);
    setCroppedAreaPixels(null);
  };

  const openFileDialog = () => {
    if (!supportsInteraction) {
      return;
    }

    inputRef.current?.click();
  };

  const openEditorForFile = useCallback(
    (
      file: File,
      options?: {
        preserveViewport?: boolean;
      },
    ) => {
      if (!STORE_LOGO_ACCEPTED_MIME_TYPES.includes(file.type as (typeof STORE_LOGO_ACCEPTED_MIME_TYPES)[number])) {
        setEditorError("logoInvalidType");
        return;
      }

      if (file.size > STORE_LOGO_MAX_SOURCE_SIZE_BYTES) {
        setEditorError("logoTooLarge");
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setEditorError(null);
      setEditorFile(file);
      setEditorImageUrl(objectUrl);
      setCrop(options?.preserveViewport ? confirmedCrop : DEFAULT_CROP);
      setZoom(options?.preserveViewport ? confirmedZoom : DEFAULT_ZOOM);
      setCroppedAreaPixels(null);
    },
    [confirmedCrop, confirmedZoom],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }

    openEditorForFile(nextFile);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!supportsInteraction) {
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) {
      return;
    }

    openEditorForFile(droppedFile);
  };

  // Clipboard door, bound to the document rather than to this field, mirroring the image-intake
  // upload panel's paste handler. `isEditableTarget` keeps a paste into the name/description
  // fields (or the country combobox) on the same step from being hijacked into the logo editor.
  useEffect(() => {
    if (!supportsInteraction) return;

    function handlePaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) return;
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (!STORE_LOGO_ACCEPTED_MIME_TYPES.includes(file.type as (typeof STORE_LOGO_ACCEPTED_MIME_TYPES)[number])) {
          continue;
        }
        event.preventDefault();
        openEditorForFile(file);
        return;
      }
    }

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [supportsInteraction, openEditorForFile]);

  const handleRemove = () => {
    if (!supportsInteraction) {
      return;
    }

    setPreviewUrl(null);
    setSubmission({ action: "remove", file: null });
    setConfirmedCrop(DEFAULT_CROP);
    setConfirmedZoom(DEFAULT_ZOOM);
    setEditorError(null);
    onRemove?.();
  };

  const handleEdit = async () => {
    if (!canEditPreview) {
      return;
    }

    try {
      const editableFile = submission.file;
      if (!editableFile) {
        setEditorError("logoProcessingFailed");
        return;
      }

      openEditorForFile(editableFile, { preserveViewport: true });
    } catch {
      setEditorError("logoProcessingFailed");
    }
  };

  const handleEditorCancel = () => {
    resetEditorState();
  };

  const handleEditorConfirm = async () => {
    if (!editorFile || !editorImageUrl || !croppedAreaPixels) {
      setEditorError("logoMalformed");
      return;
    }

    const cropArea = {
      x: Math.round(croppedAreaPixels.x),
      y: Math.round(croppedAreaPixels.y),
      width: Math.round(croppedAreaPixels.width),
      height: Math.round(croppedAreaPixels.height),
    };

    try {
      const [nextPreviewUrl, processedImage] = await Promise.all([
        getCroppedImageDataUrl(editorImageUrl, cropArea),
        getProcessedImageBlob(editorImageUrl, cropArea, STORE_LOGO_OUTPUT_SIZE_PX),
      ]);
      // The encoder falls back to JPEG on engines without real WebP support (see canvasEncoding.ts),
      // so the file extension must follow the verified mimeType instead of assuming WebP.
      const processedFile = new File(
        [processedImage.blob],
        `logo.${extensionForEncodedType(processedImage.mimeType)}`,
        {
          type: processedImage.mimeType,
        },
      );
      setPreviewUrl(nextPreviewUrl);
      setConfirmedCrop(crop);
      setConfirmedZoom(zoom);
      setSubmission({ action: "set", file: processedFile });
      resetEditorState();
    } catch {
      setEditorError("logoProcessingFailed");
    }
  };

  const handleCropComplete = (_croppedArea: Area, nextCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  };

  return (
    <div data-field="logo" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{copy.label}</Label>
        <Typography size="2xs" className="text-text-muted">
          {copy.maxSize.replace("{size}", String(sizeHint))}
        </Typography>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />

      {hasPreview ? (
        <div
          data-slot="logo-preview"
          className={cn(
            "flex w-full items-center gap-3 rounded-[var(--radius-lg)] p-3 transition",
            "[background:var(--surface-elevated)] [border:1.5px_dashed_var(--border-strong)]",
            error && "[border-color:var(--destructive)]",
          )}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <span className="relative size-[150px] flex-shrink-0 overflow-hidden rounded-[var(--radius-md)]">
            <Image src={previewUrl} alt="" fill sizes="150px" className="object-cover" unoptimized />
          </span>
          <div className="min-w-0 flex-1">
            <Typography
              size="sm"
              className="truncate [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
            >
              {submission.file?.name ?? copy.label}
            </Typography>
            {submission.file != null && (
              <Typography size="xs" className="[color:var(--text-muted)]">
                {formatFileSize(submission.file.size)}
              </Typography>
            )}
            <div className="mt-2 flex items-center gap-2">
              {canEditPreview ? (
                <Button
                  type="button"
                  variant="tonal"
                  size="sm"
                  onClick={handleEdit}
                  disabled={disabled}
                  leadingIcon={<Pencil size={13} aria-hidden />}
                >
                  {copy.editCta}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="tonal"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
                leadingIcon={<X size={13} aria-hidden />}
              >
                {copy.removeCta}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openFileDialog}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className={cn(
            "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
            "flex w-full flex-wrap items-center gap-3 rounded-[var(--radius-lg)] p-3 text-left transition",
            "[background:var(--surface-elevated)] [border:1.5px_dashed_var(--border-strong)]",
            supportsInteraction && "hover:[border-color:var(--accent)]",
            error && "[border-color:var(--destructive)]",
          )}
          aria-describedby={`${id}-helper`}
          disabled={disabled}
        >
          <span
            aria-hidden="true"
            className="flex size-12 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_14%,var(--surface-elevated))]"
          >
            <Building2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <Typography size="sm" className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
              {copy.emptyTitle}
            </Typography>
            <Typography size="xs" className="[color:var(--text-muted)]">
              {copy.acceptedFormats} · {copy.maxSize.replace("{size}", String(sizeHint))}
            </Typography>
          </div>
          <span className="inline-flex w-full flex-shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs [font-weight:var(--font-weight-medium)] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_12%,transparent)] sm:w-auto sm:justify-start">
            <Upload size={14} aria-hidden />
            {copy.uploadCta}
          </span>
        </button>
      )}

      <Typography id={`${id}-helper`} size="xs" className="text-text-muted">
        {copy.helper}
      </Typography>

      {(error || editorError) && (
        <Typography size="xs" className="text-destructive" role="alert">
          {error
            ? renderError
              ? renderError(error)
              : error
            : editorError
              ? renderError
                ? renderError(editorError)
                : editorError
              : null}
        </Typography>
      )}

      <Modal
        isOpen={Boolean(editorImageUrl)}
        onClose={handleEditorCancel}
        title={copy.editorTitle}
        subtitle={copy.editorDescription}
        icon={<Crop size={20} aria-hidden="true" />}
        size="lg"
        primaryAction={{ label: copy.editorConfirm, onClick: handleEditorConfirm }}
        secondaryAction={{ label: copy.editorCancel, onClick: handleEditorCancel }}
      >
        <div className="space-y-4">
          <div className="relative h-80 overflow-hidden rounded-[var(--radius-lg)] [background:var(--surface)]">
            <Cropper
              image={editorImageUrl ?? ""}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-zoom`}>{copy.zoomLabel}</Label>
            <input
              id={`${id}-zoom`}
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full [accent-color:var(--accent)]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
