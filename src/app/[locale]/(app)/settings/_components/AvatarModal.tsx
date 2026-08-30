"use client";

import { Image as ImageIcon, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/modules/Modal/Modal";
import { CropperBody, useImageCropperState } from "@/components/modules/ImageCropper";
import { AVATAR_ACCEPTED_MIME_TYPES, AVATAR_MAX_SOURCE_SIZE_BYTES } from "@/lib/user/avatarShared";
import { cn } from "@/lib/styles";
import { createCroppedPreviewUrl } from "../_utils/cropImagePreview";

const ACCEPTED_FILE_TYPES = AVATAR_ACCEPTED_MIME_TYPES.join(",");

export type AvatarModalSubmitPayload = {
  formData: FormData;
  /**
   * Object URL for the optimistic preview, or `null` when the source image had not finished
   * decoding yet. Ownership transfers to the caller, which must revoke it once it stops using it.
   */
  previewUrl: string | null;
};

export type AvatarModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fires synchronously on confirm, before the modal closes. The parent coordinator owns the
   * optimistic patch, the Server Action dispatch, and the rollback + toast on failure
   * (`optimistic-client-updates.mdc`) — this modal never awaits the server.
   */
  onSubmit: (payload: AvatarModalSubmitPayload) => void;
};

export default function AvatarModal({ isOpen, onClose, onSubmit }: AvatarModalProps) {
  const t = useTranslations("settings");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cropperId = useId();
  const cropper = useImageCropperState();
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  // Preloaded in parallel with `editorImageUrl` so the confirm step can crop it into an
  // optimistic preview synchronously, without awaiting an image decode at submit time.
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen) return;
    if (editorImageUrl?.startsWith("blob:")) URL.revokeObjectURL(editorImageUrl);
    // Intentional state reset when the modal closes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditorImageUrl(null);
    setEditorFile(null);
    setEditorError(null);
    loadedImageRef.current = null;
    cropper.reset();
    // Cropper is a stable ref-like object; the cleanup should not refire when its identity drifts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSelectFile = (file: File) => {
    if (!AVATAR_ACCEPTED_MIME_TYPES.includes(file.type as (typeof AVATAR_ACCEPTED_MIME_TYPES)[number])) {
      setEditorError(t("profile.errors.avatarInvalidType"));
      return;
    }
    if (file.size > AVATAR_MAX_SOURCE_SIZE_BYTES) {
      setEditorError(t("profile.errors.avatarTooLarge"));
      return;
    }
    if (editorImageUrl?.startsWith("blob:")) URL.revokeObjectURL(editorImageUrl);
    setEditorError(null);
    setEditorFile(file);
    const url = URL.createObjectURL(file);
    setEditorImageUrl(url);
    cropper.reset();

    loadedImageRef.current = null;
    const preloadImage = new Image();
    preloadImage.onload = () => {
      loadedImageRef.current = preloadImage;
    };
    preloadImage.src = url;
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0];
    if (next) handleSelectFile(next);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleSelectFile(file);
  };

  const handleConfirm = () => {
    if (!editorFile || !editorImageUrl || !cropper.croppedAreaPixels) {
      setEditorError(t("profile.errors.avatarMalformed"));
      return;
    }
    const { x, y, width, height } = cropper.croppedAreaPixels;
    const cropArea = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
    const formData = new FormData();
    formData.set("file", editorFile);
    formData.set("cropX", String(cropArea.x));
    formData.set("cropY", String(cropArea.y));
    formData.set("cropWidth", String(cropArea.width));
    formData.set("cropHeight", String(cropArea.height));

    // The preload may not have finished decoding yet; the preview is a best-effort optimistic
    // aid, so submit proceeds either way and the parent reconciles with the server's own image.
    const previewUrl = loadedImageRef.current ? createCroppedPreviewUrl(loadedImageRef.current, cropArea) : null;

    // Optimistic Confirmation: close synchronously and let the parent apply the cropped preview
    // locally in parallel with the Server Action.
    onSubmit({ formData, previewUrl });
    onClose();
  };

  const showCropper = editorImageUrl != null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("profile.avatar.modal.title")}
      subtitle={t("profile.avatar.modal.subtitle")}
      icon={<ImageIcon size={20} aria-hidden="true" />}
      tone="default"
      size="md"
      primaryAction={{
        label: t("profile.avatar.modal.confirm"),
        onClick: handleConfirm,
        disabled: !showCropper || !cropper.croppedAreaPixels,
      }}
      secondaryAction={{
        label: t("profile.avatar.modal.cancel"),
        onClick: onClose,
      }}
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          id={`${cropperId}-file`}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={handleInputChange}
          aria-label={t("profile.avatar.modal.title")}
        />

        {showCropper ? (
          <CropperBody
            id={cropperId}
            imageUrl={editorImageUrl as string}
            shape="round"
            crop={cropper.crop}
            zoom={cropper.zoom}
            onCropChange={cropper.setCrop}
            onZoomChange={cropper.setZoom}
            onCropComplete={cropper.handleCropComplete}
            zoomLabel={t("profile.avatar.modal.zoomLabel")}
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            className={cn(
              "mx-auto flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] px-6 text-center",
              "[background:var(--surface)] [border:1.5px_dashed_var(--border-strong)]",
              "transition-colors hover:[border-color:var(--accent)]",
              "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
            )}
          >
            <span className="inline-flex size-12 items-center justify-center rounded-full [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_12%,transparent)]">
              <Upload size={20} aria-hidden="true" />
            </span>
            <span className="space-y-1">
              <span className="block text-[14px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                {t("profile.avatar.modal.dropzoneTitle")}
              </span>
              <span className="block text-[12px] [color:var(--text-muted)]">
                {t("profile.avatar.modal.dropzoneDescription")}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] [font-weight:var(--font-weight-medium)] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_12%,transparent)]">
              {t("profile.avatar.modal.browseCta")}
            </span>
          </button>
        )}

        {editorError ? (
          <p role="alert" className="text-[12px] [color:var(--destructive)]">
            {editorError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
