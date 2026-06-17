"use client";

import { CheckCircle, Shield } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import Eyebrow from "@/components/core/Eyebrow";
import SectionCard from "@/components/core/SectionCard";
import type { AccountCapabilities } from "@/lib/auth/accountCapabilities";
import type { Locale } from "@/types/locale";
import EmailModal from "./EmailModal";
import PasswordModal from "./PasswordModal";
import SettingsRow from "./SettingsRow";

export type SettingsAccountPaneProps = {
  locale: Locale;
  initialEmail: string;
  emailVerified: boolean;
  capabilities: AccountCapabilities;
  passwordChangedAt: Date | null;
};

function computePasswordSummary(date: Date | null): {
  key: "summaryUnknown" | "summaryRecent" | "summary";
  months: number;
} {
  if (!date) return { key: "summaryUnknown", months: 0 };
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
  if (months <= 0) return { key: "summaryRecent", months: 0 };
  return { key: "summary", months };
}

export default function SettingsAccountPane({
  locale,
  initialEmail,
  emailVerified,
  capabilities,
  passwordChangedAt,
}: SettingsAccountPaneProps) {
  const t = useTranslations("settings");
  const [email, setEmail] = useState(initialEmail);
  const [passwordTouchedAt, setPasswordTouchedAt] = useState<Date | null>(passwordChangedAt);
  const [openModal, setOpenModal] = useState<"email" | "password" | null>(null);

  return (
    <>
      <SectionCard
        topAccent="cool"
        headingLevel="h2"
        eyebrow={
          <Eyebrow variant="chip" tone="cool" icon={Shield}>
            {t("account.eyebrow")}
          </Eyebrow>
        }
        title={t("account.title")}
      >
        <p className="-mt-2 mb-2 text-[13px] [color:var(--text-secondary)]">{t("account.subtitle")}</p>
        <SettingsRow
          label={t("account.rows.email")}
          value={
            <span className="flex flex-col gap-1.5">
              <span>{email}</span>
              {emailVerified ? (
                <Chip variant="success" size="sm" className="w-fit" icon={<CheckCircle size={12} aria-hidden="true" />}>
                  {t("account.email.verifiedChip")}
                </Chip>
              ) : null}
              {!capabilities.canChangeEmail ? (
                <span className="text-[12px] [font-weight:var(--font-weight-regular)] [color:var(--text-muted)]">
                  {t("account.email.googleHelper")}
                </span>
              ) : null}
            </span>
          }
          actions={
            capabilities.canChangeEmail ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenModal("email")}>
                {t("account.email.changeButton")}
              </Button>
            ) : undefined
          }
        />
        <SettingsRow
          label={t("account.rows.password")}
          value={
            <span className="flex flex-col gap-1.5">
              <span className="[font-family:var(--font-mono)] [letter-spacing:0.15em]">••••••••••</span>
              <span className="text-[12px] [font-weight:var(--font-weight-regular)] [color:var(--text-muted)]">
                {capabilities.canChangePassword
                  ? (() => {
                      const summary = computePasswordSummary(passwordTouchedAt);
                      if (summary.key === "summary") return t("account.password.summary", { months: summary.months });
                      return t(`account.password.${summary.key}`);
                    })()
                  : t("account.password.summaryUnset")}
              </span>
            </span>
          }
          actions={
            capabilities.canChangePassword ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenModal("password")}>
                {t("account.password.changeButton")}
              </Button>
            ) : capabilities.canSetPassword ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenModal("password")}>
                {t("account.password.setButton")}
              </Button>
            ) : undefined
          }
        />
      </SectionCard>

      <EmailModal
        isOpen={openModal === "email"}
        onClose={() => setOpenModal(null)}
        locale={locale}
        onChanged={(next) => setEmail(next)}
      />
      <PasswordModal
        isOpen={openModal === "password"}
        onClose={() => setOpenModal(null)}
        locale={locale}
        isChange={capabilities.canChangePassword}
        onSaved={() => setPasswordTouchedAt(new Date())}
      />
    </>
  );
}
