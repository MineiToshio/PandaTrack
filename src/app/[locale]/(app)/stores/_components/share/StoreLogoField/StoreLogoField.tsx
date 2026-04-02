"use client";

import "react-easy-crop/react-easy-crop.css";

import { Building2, ImagePlus, Pencil, Upload, X } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, type DragEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFocusScope } from "@/lib/a11y/useFocusScope";
import Cropper, { type Area, type Point } from "react-easy-crop";
import Button from "@/components/core/Button/Button";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import {
  STORE_LOGO_ACCEPTED_MIME_TYPES,
  STORE_LOGO_MAX_SOURCE_SIZE_BYTES,
  type StoreLogoAction,
  type StoreLogoCropArea,
} from "@/lib/store/logoShared";
import { getCroppedImageDataUrl } from "./getCroppedImageDataUrl";

export type StoreLogoSubmission = {
  action: StoreLogoAction;
  file: File | null;
  cropArea: StoreLogoCropArea | null;
};

type StoreLogoFieldCopy = {
  label: string;
  helper: string;
  emptyTitle: string;
  emptyDescription: string;
  uploadCta: string;
  editCta: string;
  replaceCta: string;
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
const DEFAULT_CROP: Point = { x: 0, y: 0 };
const DEFAULT_ZOOM = 1;
const DEFAULT_SUBMISSION: StoreLogoSubmission = {
  action: "keep",
  file: null,
  cropArea: null,
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
  const editorDescriptionId = useId();
  const editorPanelRef = useRef<HTMLDivElement>(null);

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

  const openEditorForFile = (
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
  };

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

  const handleRemove = () => {
    if (!supportsInteraction) {
      return;
    }

    setPreviewUrl(null);
    setSubmission({
      action: "remove",
      file: null,
      cropArea: null,
    });
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

  useFocusScope({
    active: Boolean(editorImageUrl),
    rootRef: editorPanelRef,
    onClose: handleEditorCancel,
  });

  const handleEditorConfirm = async () => {
    if (!editorFile || !editorImageUrl || !croppedAreaPixels) {
      setEditorError("logoMalformed");
      return;
    }

    const cropArea: StoreLogoCropArea = {
      x: Math.round(croppedAreaPixels.x),
      y: Math.round(croppedAreaPixels.y),
      width: Math.round(croppedAreaPixels.width),
      height: Math.round(croppedAreaPixels.height),
    };

    try {
      const nextPreviewUrl = await getCroppedImageDataUrl(editorImageUrl, cropArea);
      setPreviewUrl(nextPreviewUrl);
      setConfirmedCrop(crop);
      setConfirmedZoom(zoom);
      setSubmission({
        action: "set",
        file: editorFile,
        cropArea,
      });
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
            "border-border bg-background/60 relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-dashed text-center transition",
            error && "border-destructive",
          )}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <>
            <Image
              src={previewUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              className="object-cover"
              unoptimized
            />
            <div className="bg-background/75 absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 p-3 backdrop-blur-sm">
              {canEditPreview ? (
                <Button type="button" variant="secondary" size="sm" onClick={handleEdit} disabled={disabled}>
                  <Pencil size={16} aria-hidden />
                  {copy.editCta}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" size="sm" onClick={openFileDialog} disabled={disabled}>
                <ImagePlus size={16} aria-hidden />
                {copy.replaceCta}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={disabled}>
                <X size={16} aria-hidden />
                {copy.removeCta}
              </Button>
            </div>
          </>
        </div>
      ) : (
        <button
          type="button"
          onClick={openFileDialog}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className={cn(
            "border-border bg-background/60 focus-visible:ring-ring relative flex min-h-56 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-4 text-center transition",
            supportsInteraction && "hover:border-primary/60 hover:bg-background",
            error && "border-destructive",
          )}
          aria-describedby={`${id}-helper`}
          disabled={disabled}
        >
          <div className="space-y-3">
            <div className="bg-primary/12 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
              <Building2 size={24} aria-hidden />
            </div>
            <div className="space-y-1">
              <Typography size="sm" className="text-text-title font-semibold">
                {copy.emptyTitle}
              </Typography>
              <Typography size="xs" className="text-text-muted max-w-sm">
                {copy.emptyDescription}
              </Typography>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-primary bg-primary/10 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
                <Upload size={14} aria-hidden />
                {copy.uploadCta}
              </span>
              <Typography size="2xs" className="text-text-muted">
                {copy.acceptedFormats}
              </Typography>
            </div>
          </div>
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

      {editorImageUrl ? (
        <div
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-editor-title`}
          aria-describedby={editorDescriptionId}
        >
          <div
            ref={editorPanelRef}
            tabIndex={-1}
            className="border-border bg-surface w-full max-w-2xl space-y-5 rounded-2xl border p-5 shadow-2xl"
          >
            <div className="space-y-2">
              <Typography id={`${id}-editor-title`} size="sm" className="text-text-title font-semibold">
                {copy.editorTitle}
              </Typography>
              <Typography id={editorDescriptionId} size="xs" className="text-text-muted">
                {copy.editorDescription}
              </Typography>
            </div>

            <div className="bg-background relative h-80 overflow-hidden rounded-2xl">
              <Cropper
                image={editorImageUrl}
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
                className="accent-primary w-full"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={handleEditorCancel}>
                {copy.editorCancel}
              </Button>
              <Button type="button" variant="primary" onClick={handleEditorConfirm}>
                {copy.editorConfirm}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
