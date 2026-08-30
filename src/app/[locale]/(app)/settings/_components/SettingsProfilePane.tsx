"use client";

import { Pencil, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import SectionCard from "@/components/core/SectionCard";
import { useToast } from "@/contexts/ToastContext";
import { normalizeProfileImageUrl } from "@/lib/user/avatarShared";
import {
  removeAvatarAction,
  saveAvatarAction,
  saveDisplayNameAction,
  saveUsernameAction,
} from "@/app/[locale]/(app)/settings/_actions/profileActions";
import AvatarModal, { type AvatarModalSubmitPayload } from "./AvatarModal";
import AvatarRemoveModal from "./AvatarRemoveModal";
import CooldownChip from "./CooldownChip";
import DisplayNameModal from "./DisplayNameModal";
import SettingsRow from "./SettingsRow";
import UserAvatarHero from "./UserAvatarHero";
import UsernameModal from "./UsernameModal";

const COOLDOWN_DAYS = 7;

export type SettingsProfilePaneProps = {
  initialUsername: string;
  initialDisplayName: string;
  initialImageUrl: string | null;
  initialUsernameChangedAt: Date | null;
};

function computeCooldownDays(usernameChangedAt: Date | null, now: Date): number {
  if (!usernameChangedAt) return 0;
  const elapsedMs = now.getTime() - usernameChangedAt.getTime();
  const remainingMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export default function SettingsProfilePane({
  initialUsername,
  initialDisplayName,
  initialImageUrl,
  initialUsernameChangedAt,
}: SettingsProfilePaneProps) {
  const t = useTranslations("settings");
  const { addToast } = useToast();
  const [username, setUsername] = useState(initialUsername);
  const [usernameChangedAt, setUsernameChangedAt] = useState(initialUsernameChangedAt);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [imageUrl, setImageUrl] = useState<string | null>(normalizeProfileImageUrl(initialImageUrl));
  const [openModal, setOpenModal] = useState<"username" | "displayName" | "avatar" | "avatarRemove" | null>(null);

  const cooldownDays = useMemo(() => computeCooldownDays(usernameChangedAt, new Date()), [usernameChangedAt]);
  const cooldownActive = cooldownDays > 0;
  const hasImage = imageUrl != null && imageUrl.trim() !== "";

  function translateProfileError(errorKey: string): string {
    return t(`profile.errors.${errorKey}` as never);
  }

  // Optimistic Confirmation coordinators (`optimistic-client-updates.mdc`): each handler applies
  // the local patch in the same tick the modal closes, dispatches the Server Action in parallel,
  // and reverts to the pre-patch snapshot with an error toast on either an `ok: false` result or
  // a rejected promise.

  const handleDisplayNameSubmit = (trimmedName: string) => {
    const previousDisplayName = displayName;
    setDisplayName(trimmedName);
    saveDisplayNameAction(trimmedName)
      .then((result) => {
        if (result.ok) return;
        setDisplayName(previousDisplayName);
        addToast(translateProfileError(result.error), { variant: "error" });
      })
      .catch(() => {
        setDisplayName(previousDisplayName);
        addToast(translateProfileError("generic"), { variant: "error" });
      });
  };

  const handleUsernameSubmit = (nextUsername: string) => {
    const previousUsername = username;
    const previousUsernameChangedAt = usernameChangedAt;
    setUsername(nextUsername);
    setUsernameChangedAt(new Date());
    saveUsernameAction(nextUsername)
      .then((result) => {
        if (result.ok) return;
        setUsername(previousUsername);
        setUsernameChangedAt(previousUsernameChangedAt);
        if (result.error === "rateLimited" && result.retryAfterIso) {
          const date = new Date(result.retryAfterIso).toLocaleDateString();
          addToast(t("profile.errors.rateLimited", { date }), { variant: "error" });
        } else {
          addToast(translateProfileError(result.error), { variant: "error" });
        }
      })
      .catch(() => {
        setUsername(previousUsername);
        setUsernameChangedAt(previousUsernameChangedAt);
        addToast(translateProfileError("generic"), { variant: "error" });
      });
  };

  const handleAvatarSubmit = ({ formData, previewUrl }: AvatarModalSubmitPayload) => {
    const previousImageUrl = imageUrl;
    if (previewUrl) setImageUrl(previewUrl);
    saveAvatarAction(formData)
      .then((result) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        if (!result.ok) {
          setImageUrl(previousImageUrl);
          addToast(translateProfileError(result.error), { variant: "error" });
          return;
        }
        setImageUrl(normalizeProfileImageUrl(result.imageUrl) ?? result.imageUrl);
      })
      .catch(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setImageUrl(previousImageUrl);
        addToast(translateProfileError("generic"), { variant: "error" });
      });
  };

  const handleAvatarRemoveConfirm = () => {
    const previousImageUrl = imageUrl;
    setImageUrl(null);
    removeAvatarAction()
      .then((result) => {
        if (result.ok) return;
        setImageUrl(previousImageUrl);
        addToast(translateProfileError(result.error), { variant: "error" });
      })
      .catch(() => {
        setImageUrl(previousImageUrl);
        addToast(translateProfileError("generic"), { variant: "error" });
      });
  };

  return (
    <>
      <SectionCard
        topAccent="accent"
        headingLevel="h2"
        eyebrow={
          <Eyebrow variant="chip" tone="accent" icon={User}>
            {t("profile.eyebrow")}
          </Eyebrow>
        }
        title={t("profile.title")}
      >
        <p className="-mt-2 mb-2 text-[13px] [color:var(--text-secondary)]">{t("profile.subtitle")}</p>
        <SettingsRow
          label={t("profile.rows.avatar")}
          value={
            <span className="flex items-center gap-3">
              <UserAvatarHero displayName={displayName} imageUrl={imageUrl} size="s56" />
              {!hasImage ? (
                <span className="text-[12px] [font-weight:var(--font-weight-regular)] [color:var(--text-muted)]">
                  {t("profile.avatar.initialFallback")}
                </span>
              ) : null}
            </span>
          }
          actions={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenModal("avatar")}>
                {hasImage ? t("profile.avatar.replaceCta") : t("profile.avatar.changeCta")}
              </Button>
              {hasImage ? (
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="sm"
                  onClick={() => setOpenModal("avatarRemove")}
                >
                  {t("profile.avatar.removeCta")}
                </Button>
              ) : null}
            </>
          }
        />
        <SettingsRow
          label={t("profile.rows.username")}
          value={
            <span className="flex flex-col gap-1.5">
              <span>@{username}</span>
              {cooldownActive ? (
                <CooldownChip
                  label={t(
                    cooldownDays === 1 ? "profile.username.cooldown.chipDay" : "profile.username.cooldown.chipDays",
                    {
                      days: cooldownDays,
                    },
                  )}
                />
              ) : null}
            </span>
          }
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenModal("username")}
              leadingIcon={<Pencil size={13} aria-hidden="true" />}
            >
              {t("account.email.changeButton")}
            </Button>
          }
        />
        <SettingsRow
          label={t("profile.rows.displayName")}
          value={displayName}
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenModal("displayName")}
              leadingIcon={<Pencil size={13} aria-hidden="true" />}
            >
              {t("account.email.changeButton")}
            </Button>
          }
        />
      </SectionCard>

      <UsernameModal
        isOpen={openModal === "username"}
        onClose={() => setOpenModal(null)}
        initialUsername={username}
        usernameChangedAt={usernameChangedAt}
        onSubmit={handleUsernameSubmit}
      />
      <DisplayNameModal
        isOpen={openModal === "displayName"}
        onClose={() => setOpenModal(null)}
        initialName={displayName}
        onSubmit={handleDisplayNameSubmit}
      />
      <AvatarModal isOpen={openModal === "avatar"} onClose={() => setOpenModal(null)} onSubmit={handleAvatarSubmit} />
      <AvatarRemoveModal
        isOpen={openModal === "avatarRemove"}
        onClose={() => setOpenModal(null)}
        displayName={displayName}
        onConfirm={handleAvatarRemoveConfirm}
      />
    </>
  );
}
