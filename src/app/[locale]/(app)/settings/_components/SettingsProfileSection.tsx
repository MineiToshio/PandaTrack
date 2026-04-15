"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import posthog from "posthog-js";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import Typography from "@/components/core/Typography";
import { useShellIdentity } from "@/contexts/ShellIdentityContext";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { validateUsernameCandidate } from "@/lib/user-settings/usernameRules";
import { validateDisplayNameCandidate } from "@/lib/user-settings/displayNameRules";
import { AVATAR_MAX_SOURCE_SIZE_MB } from "@/lib/user/avatarShared";
import { SETTINGS_SECTION_SURFACE_CLASSNAME } from "@/app/[locale]/(app)/settings/settingsSectionChrome";
import {
  checkUsernameAvailabilityAction,
  saveUsernameAction,
  saveDisplayNameAction,
  saveAvatarAction,
  removeAvatarAction,
} from "@/app/[locale]/(app)/settings/_actions/profileActions";
import AvatarField, { type AvatarCropArea } from "@/app/[locale]/(app)/settings/_components/AvatarField";
import type { ProfileErrorCode } from "@/app/[locale]/(app)/settings/_actions/profileActions";
import type { Locale } from "@/types/locale";

type SettingsProfileSectionProps = {
  locale: Locale;
  initialUsername: string;
  initialDisplayName: string;
  initialImageUrl: string | null;
};

type UsernameStatus =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "formatError"; reason: string }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "sameAsCurrent" };

function formatRetryAfter(iso: string, locale: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SettingsProfileSection({
  locale,
  initialUsername,
  initialDisplayName,
  initialImageUrl,
}: SettingsProfileSectionProps) {
  const t = useTranslations("settings.profile");
  const { updateUser } = useShellIdentity();

  return (
    <section className={SETTINGS_SECTION_SURFACE_CLASSNAME} aria-labelledby="settings-profile-heading">
      <SectionTitleWithAccent id="settings-profile-heading" as="h2">
        {t("title")}
      </SectionTitleWithAccent>

      <div className="mt-6">
        <AvatarFlow locale={locale} initialImageUrl={initialImageUrl} updateUser={updateUser} t={t} />
        <div className="border-border/45 mt-8 border-t pt-8">
          <DisplayNameFlow initialDisplayName={initialDisplayName} updateUser={updateUser} t={t} />
          <div className="border-border/45 mt-8 border-t pt-8">
            <UsernameFlow locale={locale} initialUsername={initialUsername} updateUser={updateUser} t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}

type UpdateUserFn = (patch: { username?: string; name?: string; image?: string | null }) => void;

/* -------------------------------------------------------------------------- */
/* Avatar flow                                                                  */
/* -------------------------------------------------------------------------- */

function AvatarFlow({
  locale,
  initialImageUrl,
  updateUser,
  t,
}: {
  locale: Locale;
  initialImageUrl: string | null;
  updateUser: UpdateUserFn;
  t: ReturnType<typeof useTranslations<"settings.profile">>;
}) {
  const tErrors = useTranslations("settings.profile.errors");
  const { addToast } = useToast();
  const avatarId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const resolveAvatarError = useCallback(
    (code: ProfileErrorCode, retryAfterIso?: string) => {
      if (code === "rateLimited" && retryAfterIso) {
        return tErrors("rateLimited", { date: formatRetryAfter(retryAfterIso, locale) });
      }
      const knownKeys: ProfileErrorCode[] = [
        "unauthorized",
        "validation",
        "usernameTaken",
        "avatarInvalidType",
        "avatarTooLarge",
        "avatarMalformed",
        "avatarProcessingFailed",
        "generic",
      ];
      if (knownKeys.includes(code)) {
        return tErrors(code);
      }
      return tErrors("generic");
    },
    [locale, tErrors],
  );

  const handleAvatarFieldNotify = useCallback(() => {
    setAvatarError(null);
  }, []);

  const handleCommitCroppedAvatar = useCallback(
    async (payload: { file: File; cropArea: AvatarCropArea }) => {
      const formData = new FormData();
      formData.append("file", payload.file);
      formData.append("cropX", String(payload.cropArea.x));
      formData.append("cropY", String(payload.cropArea.y));
      formData.append("cropWidth", String(payload.cropArea.width));
      formData.append("cropHeight", String(payload.cropArea.height));

      const result = await saveAvatarAction(formData);

      if (!result.ok) {
        return { ok: false as const, message: resolveAvatarError(result.error) };
      }

      posthog.capture(POSTHOG_EVENTS.SETTINGS.PROFILE_AVATAR_UPLOADED);
      updateUser({ image: result.imageUrl });
      addToast(t("avatar.successUploaded"));
      return { ok: true as const, imageUrl: result.imageUrl };
    },
    [resolveAvatarError, updateUser, addToast, t],
  );

  const handleConfirmRemoveAvatar = useCallback(async () => {
    setIsSubmitting(true);

    const result = await removeAvatarAction();
    setIsSubmitting(false);

    if (!result.ok) {
      return { ok: false as const, message: resolveAvatarError(result.error) };
    }

    posthog.capture(POSTHOG_EVENTS.SETTINGS.PROFILE_AVATAR_REMOVED);
    updateUser({ image: null });
    addToast(t("avatar.successRemoved"));
    return { ok: true as const };
  }, [resolveAvatarError, updateUser, addToast, t]);

  return (
    <div className="space-y-3">
      <AvatarField
        id={avatarId}
        initialImageUrl={initialImageUrl}
        disabled={isSubmitting}
        error={avatarError}
        copy={{
          label: t("avatar.label"),
          helper: t("avatar.helper"),
          emptyTitle: t("avatar.emptyTitle"),
          emptyDescription: t("avatar.emptyDescription"),
          uploadCta: t("avatar.uploadCta"),
          replaceCta: t("avatar.replaceCta"),
          removeCta: t("avatar.removeCta"),
          editorTitle: t("avatar.editorTitle"),
          editorDescription: t("avatar.editorDescription"),
          zoomLabel: t("avatar.zoomLabel"),
          editorCancel: t("avatar.editorCancel"),
          editorConfirm: t("avatar.editorConfirm"),
          editorPending: t("avatar.pending"),
          acceptedFormats: t("avatar.acceptedFormats"),
          maxSize: t("avatar.maxSize", { size: Math.round(AVATAR_MAX_SOURCE_SIZE_MB) }),
          removeDialogTitle: t("avatar.removeDialogTitle"),
          removeDialogLead: t("avatar.removeDialogLead"),
          removeDialogIrreversible: t("avatar.removeDialogIrreversible"),
          removeDialogCancel: t("avatar.removeDialogCancel"),
          removeDialogConfirm: t("avatar.removeDialogConfirm"),
          removeDialogPending: t("avatar.removeDialogPending"),
        }}
        onNotify={handleAvatarFieldNotify}
        onCommitCroppedAvatar={handleCommitCroppedAvatar}
        onConfirmRemoveAvatar={handleConfirmRemoveAvatar}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Display name flow                                                            */
/* -------------------------------------------------------------------------- */

function DisplayNameFlow({
  initialDisplayName,
  updateUser,
  t,
}: {
  initialDisplayName: string;
  updateUser: UpdateUserFn;
  t: ReturnType<typeof useTranslations<"settings.profile">>;
}) {
  const tErrors = useTranslations("settings.profile.errors");
  const { addToast } = useToast();
  const displayNameDescriptionId = useId();
  const displayNameErrorId = useId();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  const handleDisplayNameChange = useCallback((value: string) => {
    setDisplayName(value);
    setDisplayNameError(null);
  }, []);

  const handleSaveDisplayName = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setDisplayNameError(null);

      const validationResult = validateDisplayNameCandidate(displayName);
      if (!validationResult.ok) {
        setDisplayNameError(tErrors("validation"));
        return;
      }

      setIsSubmitting(true);
      const result = await saveDisplayNameAction(displayName);
      setIsSubmitting(false);

      if (!result.ok) {
        setDisplayNameError(tErrors(result.error === "unauthorized" ? "unauthorized" : "generic"));
        return;
      }

      posthog.capture(POSTHOG_EVENTS.SETTINGS.PROFILE_DISPLAY_NAME_SAVED);
      updateUser({ name: result.name });
      setDisplayName(result.name);
      addToast(t("displayName.success"));
    },
    [displayName, tErrors, t, updateUser, addToast],
  );

  const displayNameAriaDescribedBy =
    displayNameError != null ? `${displayNameDescriptionId} ${displayNameErrorId}` : displayNameDescriptionId;

  return (
    <form className="w-full space-y-3" onSubmit={handleSaveDisplayName} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="settings-display-name">{t("displayName.label")}</Label>
        <Typography id={displayNameDescriptionId} size="xs" className="text-text-muted">
          {t("displayName.helper")}
        </Typography>
      </div>
      <Input
        id="settings-display-name"
        type="text"
        autoComplete="name"
        value={displayName}
        onChange={(e) => handleDisplayNameChange(e.target.value)}
        disabled={isSubmitting}
        error={Boolean(displayNameError)}
        maxLength={50}
        aria-invalid={Boolean(displayNameError)}
        aria-describedby={displayNameAriaDescribedBy}
      />
      {displayNameError ? (
        <Typography id={displayNameErrorId} size="sm" className="text-destructive" role="alert">
          {displayNameError}
        </Typography>
      ) : null}
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? t("displayName.pending") : t("displayName.save")}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Username flow                                                                */
/* -------------------------------------------------------------------------- */

const USERNAME_AVAILABILITY_DEBOUNCE_MS = 300;

function UsernameFlow({
  locale,
  initialUsername,
  updateUser,
  t,
}: {
  locale: Locale;
  initialUsername: string;
  updateUser: UpdateUserFn;
  t: ReturnType<typeof useTranslations<"settings.profile">>;
}) {
  const tErrors = useTranslations("settings.profile.errors");
  const tValidation = useTranslations("settings.profile.username.validation");
  const { addToast } = useToast();
  const usernameDescriptionId = useId();
  const usernameErrorId = useId();
  const [username, setUsername] = useState(initialUsername);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({ kind: "idle" });
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveFormatError = useCallback(
    (reason: string): string => {
      if (reason === "USERNAME_LENGTH") return tValidation("length");
      if (reason === "USERNAME_FORMAT") return tValidation("format");
      if (reason === "USERNAME_RESERVED") return tValidation("reserved");
      if (reason === "USERNAME_BLOCKED_SEGMENT") return tValidation("blocked");
      return tValidation("format");
    },
    [tValidation],
  );

  const checkAvailability = useCallback(
    async (candidate: string) => {
      const formatResult = validateUsernameCandidate(candidate);
      if (!formatResult.ok) {
        setUsernameStatus({ kind: "formatError", reason: resolveFormatError(formatResult.reason) });
        return;
      }

      if (formatResult.username === initialUsername) {
        setUsernameStatus({ kind: "sameAsCurrent" });
        return;
      }

      setUsernameStatus({ kind: "checking" });
      const result = await checkUsernameAvailabilityAction(candidate);
      setUsernameStatus(result.available ? { kind: "available" } : { kind: "taken" });
    },
    [initialUsername, resolveFormatError],
  );

  const handleUsernameChange = useCallback(
    (value: string) => {
      setUsername(value);
      setUsernameError(null);

      if (availabilityTimerRef.current) {
        clearTimeout(availabilityTimerRef.current);
      }

      const formatResult = validateUsernameCandidate(value);
      if (!formatResult.ok) {
        setUsernameStatus({ kind: "formatError", reason: resolveFormatError(formatResult.reason) });
        return;
      }

      if (formatResult.username === initialUsername) {
        setUsernameStatus({ kind: "sameAsCurrent" });
        return;
      }

      setUsernameStatus({ kind: "checking" });
      availabilityTimerRef.current = setTimeout(() => {
        checkAvailability(value);
      }, USERNAME_AVAILABILITY_DEBOUNCE_MS);
    },
    [initialUsername, resolveFormatError, checkAvailability],
  );

  useEffect(() => {
    return () => {
      if (availabilityTimerRef.current) {
        clearTimeout(availabilityTimerRef.current);
      }
    };
  }, []);

  const handleSaveUsername = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setUsernameError(null);

      if (usernameStatus.kind === "taken") {
        return;
      }

      if (usernameStatus.kind === "formatError") {
        return;
      }

      if (usernameStatus.kind === "sameAsCurrent") {
        return;
      }

      setIsSubmitting(true);
      const result = await saveUsernameAction(username);
      setIsSubmitting(false);

      if (!result.ok) {
        if (result.error === "rateLimited" && result.retryAfterIso) {
          setUsernameError(tErrors("rateLimited", { date: formatRetryAfter(result.retryAfterIso, locale) }));
        } else if (result.error === "usernameTaken") {
          setUsernameStatus({ kind: "taken" });
        } else if (result.error === "unauthorized") {
          setUsernameError(tErrors("unauthorized"));
        } else {
          setUsernameError(tErrors("generic"));
        }
        return;
      }

      posthog.capture(POSTHOG_EVENTS.SETTINGS.PROFILE_USERNAME_SAVED);
      updateUser({ username: result.username });
      setUsernameStatus({ kind: "sameAsCurrent" });
      addToast(t("username.success"));
    },
    [username, usernameStatus, tErrors, t, locale, updateUser, addToast],
  );

  const isSaveDisabled =
    isSubmitting ||
    usernameStatus.kind === "checking" ||
    usernameStatus.kind === "formatError" ||
    usernameStatus.kind === "taken" ||
    usernameStatus.kind === "sameAsCurrent";

  const usernameControlInvalid =
    usernameStatus.kind === "formatError" || usernameStatus.kind === "taken" || Boolean(usernameError);

  const usernameAriaDescribedBy =
    usernameError != null ? `${usernameDescriptionId} ${usernameErrorId}` : usernameDescriptionId;

  return (
    <form className="w-full space-y-3" onSubmit={handleSaveUsername} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="settings-username">{t("username.label")}</Label>
        <Typography id={usernameDescriptionId} size="xs" className="text-text-muted">
          {t("username.helper")}
        </Typography>
      </div>
      <div className="space-y-2">
        <Input
          id="settings-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => handleUsernameChange(e.target.value)}
          disabled={isSubmitting}
          error={usernameControlInvalid}
          maxLength={30}
          aria-invalid={usernameControlInvalid}
          aria-describedby={usernameAriaDescribedBy}
        />
        <UsernameStatusHint status={usernameStatus} t={t} />
        {usernameError ? (
          <Typography id={usernameErrorId} size="sm" className="text-destructive" role="alert">
            {usernameError}
          </Typography>
        ) : null}
      </div>
      <Button type="submit" variant="primary" disabled={isSaveDisabled}>
        {isSubmitting ? t("username.pending") : t("username.save")}
      </Button>
    </form>
  );
}

function UsernameStatusHint({
  status,
  t,
}: {
  status: UsernameStatus;
  t: ReturnType<typeof useTranslations<"settings.profile">>;
}) {
  if (status.kind === "checking") {
    return (
      <Typography size="xs" className={cn("text-text-muted")} role="status" aria-live="polite">
        {t("username.checking")}
      </Typography>
    );
  }

  if (status.kind === "available") {
    return (
      <Typography size="xs" className="text-success" role="status" aria-live="polite">
        {t("username.available")}
      </Typography>
    );
  }

  if (status.kind === "taken") {
    return (
      <Typography size="xs" className="text-destructive" role="alert">
        {t("username.taken")}
      </Typography>
    );
  }

  if (status.kind === "formatError") {
    return (
      <Typography size="xs" className="text-destructive" role="alert">
        {status.reason}
      </Typography>
    );
  }

  return null;
}
