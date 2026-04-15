"use client";

import "react-easy-crop/react-easy-crop.css";

import { ImagePlus, Upload, UserRound, X } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, type DragEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import Button from "@/components/core/Button/Button";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { useFocusScope } from "@/lib/a11y/useFocusScope";
import {
  AVATAR_ACCEPTED_MIME_TYPES,
  AVATAR_MAX_SOURCE_SIZE_BYTES,
  AVATAR_MAX_SOURCE_SIZE_MB,
  normalizeProfileImageUrl,
} from "@/lib/user/avatarShared";
import { cn } from "@/lib/styles";

const ACCEPTED_FILE_TYPES = AVATAR_ACCEPTED_MIME_TYPES.join(",");
const DEFAULT_CROP: Point = { x: 0, y: 0 };
const DEFAULT_ZOOM = 1;

export type AvatarCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AvatarCommitResult = { ok: true; imageUrl: string } | { ok: false; message: string };

export type AvatarRemoveResult = { ok: true } | { ok: false; message: string };

type AvatarFieldCopy = {
  label: string;
  helper: string;
  emptyTitle: string;
  emptyDescription: string;
  uploadCta: string;
  replaceCta: string;
  removeCta: string;
  editorTitle: string;
  editorDescription: string;
  zoomLabel: string;
  editorCancel: string;
  editorConfirm: string;
  editorPending: string;
  acceptedFormats: string;
  maxSize: string;
  removeDialogTitle: string;
  removeDialogLead: string;
  removeDialogIrreversible: string;
  removeDialogCancel: string;
  removeDialogConfirm: string;
  removeDialogPending: string;
};

type AvatarFieldProps = {
  id: string;
  initialImageUrl?: string | null;
  disabled?: boolean;
  error?: string | null;
  copy: AvatarFieldCopy;
  onNotify?: () => void;
  onCommitCroppedAvatar: (payload: { file: File; cropArea: AvatarCropArea }) => Promise<AvatarCommitResult>;
  onConfirmRemoveAvatar: () => Promise<AvatarRemoveResult>;
};

export default function AvatarField({
  id,
  initialImageUrl = null,
  disabled = false,
  error,
  copy,
  onNotify,
  onCommitCroppedAvatar,
  onConfirmRemoveAvatar,
}: AvatarFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const editorDescriptionId = useId();

  const [previewUrl, setPreviewUrl] = useState<string | null>(() => normalizeProfileImageUrl(initialImageUrl));
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>(DEFAULT_CROP);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCommittingCrop, setIsCommittingCrop] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const supportsInteraction = !disabled;
  const hasPreview = previewUrl != null && previewUrl.trim() !== "";
  const sizeHint = useMemo(() => Math.round(AVATAR_MAX_SOURCE_SIZE_MB), []);

  useEffect(() => {
    onNotify?.();
  }, [onNotify]);

  const resetEditorState = () => {
    if (editorImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(editorImageUrl);
    }
    setEditorImageUrl(null);
    setEditorFile(null);
    setEditorError(null);
    setCrop(DEFAULT_CROP);
    setZoom(DEFAULT_ZOOM);
    setCroppedAreaPixels(null);
    setCommitError(null);
    setIsCommittingCrop(false);
  };

  const openFileDialog = () => {
    if (!supportsInteraction) return;
    inputRef.current?.click();
  };

  const openEditorForFile = (file: File) => {
    if (!AVATAR_ACCEPTED_MIME_TYPES.includes(file.type as (typeof AVATAR_ACCEPTED_MIME_TYPES)[number])) {
      setEditorError("avatarInvalidType");
      return;
    }

    if (file.size > AVATAR_MAX_SOURCE_SIZE_BYTES) {
      setEditorError("avatarTooLarge");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setEditorError(null);
    setCommitError(null);
    onNotify?.();
    setEditorFile(file);
    setEditorImageUrl(objectUrl);
    setCrop(DEFAULT_CROP);
    setZoom(DEFAULT_ZOOM);
    setCroppedAreaPixels(null);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    openEditorForFile(nextFile);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!supportsInteraction) return;
    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    openEditorForFile(droppedFile);
  };

  const handleRequestRemovePhoto = () => {
    if (!supportsInteraction || !hasPreview) return;
    setRemoveError(null);
    onNotify?.();
    setRemoveDialogOpen(true);
  };

  const handleDismissRemoveDialog = () => {
    if (disabled) return;
    setRemoveDialogOpen(false);
    setRemoveError(null);
  };

  const handleConfirmRemovePhoto = async () => {
    if (disabled) return;
    setRemoveError(null);
    const result = await onConfirmRemoveAvatar();
    if (!result.ok) {
      setRemoveError(result.message);
      return;
    }
    setPreviewUrl(null);
    setRemoveDialogOpen(false);
    onNotify?.();
  };

  const handleEditorCancel = () => {
    if (isCommittingCrop) return;
    resetEditorState();
    onNotify?.();
  };

  const handleEditorConfirm = async () => {
    if (!editorFile || !editorImageUrl || !croppedAreaPixels) {
      setEditorError("avatarMalformed");
      return;
    }

    const cropArea: AvatarCropArea = {
      x: Math.round(croppedAreaPixels.x),
      y: Math.round(croppedAreaPixels.y),
      width: Math.round(croppedAreaPixels.width),
      height: Math.round(croppedAreaPixels.height),
    };

    setIsCommittingCrop(true);
    setCommitError(null);
    setEditorError(null);

    const result = await onCommitCroppedAvatar({ file: editorFile, cropArea });
    setIsCommittingCrop(false);

    if (!result.ok) {
      setCommitError(result.message);
      return;
    }

    const normalized = normalizeProfileImageUrl(result.imageUrl);
    setPreviewUrl(normalized ?? result.imageUrl);
    resetEditorState();
    onNotify?.();
  };

  const handleCropComplete = (_croppedArea: Area, nextCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  };

  const handleEditorEscapeClose = () => {
    if (isCommittingCrop) return;
    handleEditorCancel();
  };

  useFocusScope({ active: Boolean(editorImageUrl), rootRef: editorPanelRef, onClose: handleEditorEscapeClose });

  const activeError = error ?? editorError;

  return (
    <div data-field="avatar" className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id}>{copy.label}</Label>
          <Typography size="2xs" className="text-text-muted">
            {copy.maxSize.replace("{size}", String(sizeHint))}
          </Typography>
        </div>
        <Typography id={`${id}-helper`} size="xs" className="text-text-muted">
          {copy.helper}
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
        aria-label={copy.label}
        aria-describedby={`${id}-helper`}
      />

      {hasPreview ? (
        <div
          data-slot="avatar-preview"
          className="mx-auto w-full max-w-sm space-y-4"
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <div
            className={cn(
              "border-border bg-background/60 relative aspect-square w-full overflow-hidden rounded-full border border-dashed transition",
              error && "border-destructive",
            )}
          >
            <Image
              src={previewUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={openFileDialog} disabled={disabled}>
              <ImagePlus size={16} aria-hidden />
              {copy.replaceCta}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleRequestRemovePhoto} disabled={disabled}>
              <X size={16} aria-hidden />
              {copy.removeCta}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openFileDialog}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className={cn(
            "border-border bg-background/60 focus-visible:ring-ring relative flex min-h-56 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-4 text-center transition disabled:cursor-not-allowed",
            supportsInteraction && "hover:border-primary/60 hover:bg-background",
            error && "border-destructive",
          )}
          aria-describedby={`${id}-helper`}
          disabled={disabled}
        >
          <div className="w-full space-y-3">
            <div className="bg-primary/12 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
              <UserRound size={24} aria-hidden />
            </div>
            <div className="space-y-1">
              <Typography size="sm" className="text-text-title font-semibold">
                {copy.emptyTitle}
              </Typography>
              <Typography size="xs" className="text-text-muted">
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

      {activeError ? (
        <Typography size="xs" className="text-destructive" role="alert">
          {activeError}
        </Typography>
      ) : null}

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

            <div
              className={cn(
                "bg-background relative h-80 overflow-hidden rounded-2xl",
                isCommittingCrop && "pointer-events-none opacity-60",
              )}
            >
              <Cropper
                image={editorImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
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
                disabled={isCommittingCrop}
              />
            </div>

            {commitError ? (
              <Typography size="xs" className="text-destructive" role="alert">
                {commitError}
              </Typography>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={handleEditorCancel} disabled={isCommittingCrop}>
                {copy.editorCancel}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleEditorConfirm}
                disabled={isCommittingCrop}
                aria-busy={isCommittingCrop}
              >
                {isCommittingCrop ? copy.editorPending : copy.editorConfirm}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        isOpen={removeDialogOpen}
        onClose={handleDismissRemoveDialog}
        title={copy.removeDialogTitle}
        description={
          <div className="space-y-3">
            <Typography size="xs" className="text-text-body leading-6">
              {copy.removeDialogLead}
            </Typography>
            <Typography size="xs" className="text-text-muted leading-6">
              {copy.removeDialogIrreversible}
            </Typography>
          </div>
        }
        role="alertdialog"
        closeOnBackdropClick={false}
        className="max-w-md"
      >
        {removeError ? (
          <Typography size="xs" className="text-destructive mb-4" role="alert">
            {removeError}
          </Typography>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleDismissRemoveDialog} disabled={disabled}>
            {copy.removeDialogCancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirmRemovePhoto}
            disabled={disabled}
            aria-busy={disabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {disabled ? copy.removeDialogPending : copy.removeDialogConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
