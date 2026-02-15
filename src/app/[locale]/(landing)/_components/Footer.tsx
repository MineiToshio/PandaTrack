"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { siTiktok } from "simple-icons";
import { CONTACT_INFO, POSTHOG_EVENTS } from "@/lib/constants";
import posthog from "posthog-js";

const ICON_SIZE = 18;

export default function Footer() {
  const t = useTranslations("landing.footer");
  const locale = useLocale();
  const year = new Date().getFullYear();
  const focusVisibleClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md";

  return (
    <footer className="bg-background text-foreground w-full px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
        <div className="text-muted-foreground flex flex-col items-center gap-1 text-center text-sm sm:items-start sm:text-left">
          <p>{t("copyright", { year })}</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
            <span>{t("madeBy")}</span>
            <a
              href={`mailto:${CONTACT_INFO.email}`}
              className={`hover:text-foreground inline-flex items-center gap-1.5 transition-colors ${focusVisibleClass}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={CONTACT_INFO.email}
              onClick={() =>
                posthog.capture(POSTHOG_EVENTS.LANDING.SOCIAL_LINK_CLICKED, { platform: "email" })
              }
            >
              <Mail size={ICON_SIZE} aria-hidden />
            </a>
            <a
              href={CONTACT_INFO.tiktok}
              className={`hover:text-foreground inline-flex items-center gap-1.5 transition-colors ${focusVisibleClass}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`TikTok ${CONTACT_INFO.tiktok}`}
              onClick={() =>
                posthog.capture(POSTHOG_EVENTS.LANDING.SOCIAL_LINK_CLICKED, { platform: "tiktok" })
              }
            >
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                width={ICON_SIZE}
                height={ICON_SIZE}
                fill="currentColor"
                aria-hidden
              >
                <path d={siTiktok.path} />
              </svg>
            </a>
          </p>
        </div>
        <nav aria-label="Legal" className="flex gap-6">
          <Link
            href={`/${locale}/terms`}
            className={`text-muted-foreground hover:text-foreground text-sm transition-colors ${focusVisibleClass}`}
          >
            {t("terms")}
          </Link>
          <Link
            href={`/${locale}/privacy`}
            className={`text-muted-foreground hover:text-foreground text-sm transition-colors ${focusVisibleClass}`}
          >
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
