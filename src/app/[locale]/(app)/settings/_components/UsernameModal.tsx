"use client";

import { AtSign } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Modal from "@/components/modules/Modal/Modal";
import {
  checkUsernameAvailabilityAction,
  saveUsernameAction,
} from "@/app/[locale]/(app)/settings/_actions/profileActions";
import CooldownChip from "./CooldownChip";

const COOLDOWN_DAYS = 7;
const AVAILABILITY_DEBOUNCE_MS = 300;
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/i;

export type UsernameModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialUsername: string;
  usernameChangedAt: Date | null;
  onSaved: (username: string) => void;
};

type AvailabilityState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "sameAsCurrent" };

function computeCooldownDays(usernameChangedAt: Date | null, now: Date): number {
  if (!usernameChangedAt) return 0;
  const elapsedMs = now.getTime() - usernameChangedAt.getTime();
  const remainingMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

function computeUnlockDate(usernameChangedAt: Date | null): Date | null {
  if (!usernameChangedAt) return null;
  return new Date(usernameChangedAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
}

export default function UsernameModal({
  isOpen,
  onClose,
  initialUsername,
  usernameChangedAt,
  onSaved,
}: UsernameModalProps) {
  const t = useTranslations("settings");
  const fieldId = useId();
  const [value, setValue] = useState(initialUsername);
  const [availability, setAvailability] = useState<AvailabilityState>({ kind: "idle" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cooldownDays = useMemo(() => computeCooldownDays(usernameChangedAt, new Date()), [usernameChangedAt]);
  const unlockDate = useMemo(() => computeUnlockDate(usernameChangedAt), [usernameChangedAt]);
  const cooldownActive = cooldownDays > 0;

  useEffect(() => {
    if (!isOpen) return;
    // Intentional state reset on modal re-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initialUsername);
    setAvailability({ kind: "idle" });
    setErrorMessage(null);
  }, [initialUsername, isOpen]);

  const trimmed = value.trim().toLowerCase();
  const formatValid = trimmed.length >= 3 && trimmed.length <= 30 && USERNAME_REGEX.test(trimmed);
  const dirty = trimmed !== initialUsername.toLowerCase();

  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }
    if (!isOpen || !dirty || !formatValid) {
      return;
    }
    let cancelled = false;
    checkTimeoutRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailabilityAction(trimmed);
      if (cancelled) return;
      setAvailability(result.available ? { kind: "available" } : { kind: "taken" });
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [dirty, formatValid, isOpen, trimmed]);

  const effectiveAvailability: AvailabilityState = !isOpen || !dirty || !formatValid ? { kind: "idle" } : availability;

  const canSave =
    !isPending &&
    !cooldownActive &&
    dirty &&
    formatValid &&
    (effectiveAvailability.kind === "available" || effectiveAvailability.kind === "idle");

  const handleSubmit = () => {
    if (!canSave) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await saveUsernameAction(trimmed);
      if (!result.ok) {
        if (result.error === "rateLimited" && result.retryAfterIso) {
          const date = new Date(result.retryAfterIso).toLocaleDateString();
          setErrorMessage(t("profile.errors.rateLimited", { date }));
        } else {
          setErrorMessage(t(`profile.errors.${result.error}` as never));
        }
        return;
      }
      onSaved(result.username);
      onClose();
    });
  };

  const subtitle = cooldownActive
    ? t(
        cooldownDays === 1
          ? "profile.username.cooldown.modalSubtitleSingular"
          : "profile.username.cooldown.modalSubtitle",
        {
          days: cooldownDays,
        },
      )
    : t("profile.username.modal.subtitle");

  const hintMessage = (() => {
    if (errorMessage) return errorMessage;
    if (!dirty) return t("profile.username.modal.hint");
    if (!formatValid) return t("profile.username.validation.format");
    if (effectiveAvailability.kind === "checking") return t("profile.username.modal.checking");
    if (effectiveAvailability.kind === "available") return t("profile.username.modal.available");
    if (effectiveAvailability.kind === "taken") return t("profile.username.modal.taken");
    return t("profile.username.modal.hint");
  })();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("profile.username.modal.title")}
      subtitle={subtitle}
      icon={<AtSign size={20} aria-hidden="true" />}
      tone="default"
      dismissible={!isPending}
      primaryAction={{
        label: isPending ? t("profile.username.modal.pending") : t("profile.username.modal.save"),
        onClick: handleSubmit,
        disabled: !canSave,
        loading: isPending,
      }}
      secondaryAction={{
        label: t("profile.username.modal.cancel"),
        onClick: onClose,
        disabled: isPending,
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={fieldId}>{t("profile.username.modal.label")}</Label>
          <Input
            id={fieldId}
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            prefix="@"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={cooldownActive || isPending}
            error={Boolean(errorMessage) || effectiveAvailability.kind === "taken"}
            helperText={hintMessage}
            autoFocus
          />
        </div>
        {cooldownActive && unlockDate ? (
          <div className="flex justify-center">
            <CooldownChip
              label={t("profile.username.cooldown.modalChip", {
                date: unlockDate.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
              })}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
